import DimoService from './dimoService';
import MapboxService from './mapboxService';
import Trip, { ITripDocument } from '../models/Trip';
import KalmanFilter from '../utils/kalmanFilter';
import Vehicle, { IVehicle, IVehicleDocument } from '../models/Vehicle';
import {RateLimiter} from '../utils/rateLimiter.js';

interface ILocation {
    timestamp: string;
    latitude: number;
    longitude: number;
    altitude: number;
  }
  
  interface ISpeed {
    timestamp: string;
    speed: number;
    averageDriverSpeed: number;
    allowedSpeed: number;
    distance: number;
  }
  
  interface ITripMetrics {
    averageSpeed: number;
    maxSpeed: number;
    distance: number;
    hardBrakeCount: number;
    speedAdherencePercentage: number;
    score: {
      hardBraking: string;
      speedAdherence: string;
      overall: string;
    };
  }
  
  interface RouteInfo {
    distance: number;
    duration: number;
    speedLimits: (number | null)[];
    segmentSpeeds: number[];
    segmentDistances: number[];
    geometry: any;
  }

class TripProcessingService {
    private kalmanFilter: KalmanFilter;
    private rateLimiter: RateLimiter;

    constructor(rateLimiter: RateLimiter) {
      this.kalmanFilter = new KalmanFilter();
      this.rateLimiter = rateLimiter;
    }
  
    private async processLocations(adjustedLocations: ILocation[]): Promise<{ speeds: ISpeed[], routeInfos: RouteInfo[] }> {
      const speeds: ISpeed[] = [];
      const routeInfos: RouteInfo[] = [];
      const windowSize = 10;
      var skipFirstRound = true;
      for (let i = 0; i < adjustedLocations.length - 1; i++) {
        const startTime = new Date(adjustedLocations[i].timestamp).getTime();
        let endIndex = i + 1;
        
        while (endIndex < adjustedLocations.length &&
               (new Date(adjustedLocations[endIndex].timestamp).getTime() - startTime) < windowSize * 1000) {
          endIndex++;
        }
        
        if (endIndex >= adjustedLocations.length) {
          endIndex = adjustedLocations.length - 1;
        }
      
        const endTime = new Date(adjustedLocations[endIndex].timestamp).getTime();
        const timeDiff = (endTime - startTime) / 1000;
        const distance = this.calculateDistance(adjustedLocations[i], adjustedLocations[endIndex]);
        const speed = distance / timeDiff; 
        if(skipFirstRound || speed > 60 || distance < 2) {
          skipFirstRound = false;
          i = endIndex - 1;
          continue;
        }
        const routeInfo =  await this.rateLimiter.execute(() => {
          return MapboxService.getRouteInfo(
            adjustedLocations[i],
            adjustedLocations[endIndex]
          );
        });
        routeInfos.push(routeInfo);
        const validSpeedLimits = routeInfo.segmentSpeeds.filter(speed => speed !== null) as number[];
        const avgSpeed = validSpeedLimits.length > 0 ? validSpeedLimits.reduce((sum, speed) => sum + speed, 0) / validSpeedLimits.length : 0;
        const maxSpeedLimits = routeInfo.speedLimits.filter(speed => speed !== null) as number[];
        const maxSpeed = maxSpeedLimits.length > 0 ? maxSpeedLimits.reduce((sum, speed) => sum + speed, 0) / maxSpeedLimits.length : 0;

        speeds.push({
          timestamp: adjustedLocations[i].timestamp,
          speed: speed,
          averageDriverSpeed: avgSpeed,
          allowedSpeed: 0, // isNaN(maxSpeed) ? Number.MAX_VALUE : maxSpeed, 
          distance: distance
        });


        i = endIndex - 1; 
      }

      return { speeds, routeInfos };
    }

    async processTrip(token: any, vehicleId: number, trip: any): Promise<ITripDocument | null> {
      try {
        const telemetryData = await DimoService.getTripTelemetry(token, vehicleId, trip.start.time, trip.end.time);
        
        const signals = telemetryData.data.signals;

        if(signals == null || signals.length == 0) {
          return null;
        }

        const adjustedLocations = this.applyKalmanFilter(telemetryData.data.signals);
        
        const { speeds, routeInfos } = await this.processLocations(adjustedLocations);
        
        
        const tripMetrics = this.calculateTripMetrics(speeds, routeInfos);

        if(tripMetrics.distance < 1) {
          return null;
        }
          
        const savedTrip = await this.saveTripData(vehicleId.toString(), trip, adjustedLocations, speeds, tripMetrics);
        
        return savedTrip;
      } catch (error) {
        console.error('Ошибка при обработке поездки:', error);
        throw error;
      }
    }

  private applyKalmanFilter(signals: any[]): ILocation[] {
    return signals.map(signal => {
      const filtered = this.kalmanFilter.filter({
        latitude: signal.currentLocationLatitude,
        longitude: signal.currentLocationLongitude
      });
      return {
        timestamp: signal.timestamp,
        latitude: filtered.latitude,
        longitude: filtered.longitude,
        altitude: signal.currentLocationAltitude
      };
    });
  }

  private calculateDistance(loc1: ILocation, loc2: ILocation): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = this.toRadians(loc1.latitude);
    const φ2 = this.toRadians(loc2.latitude);
    const Δφ = this.toRadians(loc2.latitude - loc1.latitude);
    const Δλ = this.toRadians(loc2.longitude - loc1.longitude);

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  }

  private toRadians(degrees: number): number {
    return degrees * Math.PI / 180;
  }

  private calculateTripMetrics(speeds: ISpeed[], routeInfos: RouteInfo[]): ITripMetrics {
    const averageSpeed = this.calculateAverageSpeed(speeds);
    const maxSpeed = Math.max(...speeds.map(s => s.speed));
    const hardBrakeCount = this.calculateHardBrakes(speeds);
    const speedAdherencePercentage = this.calculateSpeedAdherence(speeds);
    const distance = routeInfos.reduce((sum, info) => sum + info.distance, 0) / 1000; // Convert to km

    return {
      averageSpeed,
      maxSpeed,
      distance,
      hardBrakeCount,
      speedAdherencePercentage,
      score: this.calculateScore(hardBrakeCount, speedAdherencePercentage, distance)
    };
  }

  private calculateAverageSpeed(speeds: ISpeed[]): number {
    return speeds.reduce((sum, speed) => sum + speed.speed, 0) / speeds.length;
  }

  private calculateHardBrakes(speeds: ISpeed[]): number {
    let hardBrakeCount = 0;
    for (let i = 1; i < speeds.length; i++) {
      const deceleration = (speeds[i-1].speed - speeds[i].speed) / ((new Date(speeds[i].timestamp).getTime() - new Date(speeds[i-1].timestamp).getTime()) / 1000);
      if (deceleration > 7) { // 7 m/s^2 is considered a hard brake
        hardBrakeCount++;
      }
    }
    return hardBrakeCount;
  }

  private calculateSpeedAdherence(speeds: ISpeed[]): number {
    const speedingInstances = speeds.filter(speed => speed.speed > speed.averageDriverSpeed).length;
    return (speedingInstances*1.0/ speeds.length) * 100;
  }

  private calculateScore(hardBrakeCount: number, speedAdherencePercentage: number, distance: number): { hardBraking: string; speedAdherence: string; overall: string } {
    const hardBrakingScore = this.getHardBrakingScore(hardBrakeCount, distance);
    const speedAdherenceScore = this.getSpeedAdherenceScore(speedAdherencePercentage);
    
    const totalScore = (this.scoreToNumber(hardBrakingScore) * 1 + this.scoreToNumber(speedAdherenceScore) * 2) / 3; // Speed adherence has double weight
    
    return {
      hardBraking: hardBrakingScore,
      speedAdherence: speedAdherenceScore,
      overall: this.getOverallClass(totalScore)
    };
  }

  private getHardBrakingScore(count: number, distance: number): string {
    const rate = count / (distance / 100);
    if (rate <= 1) return 'Excellent';
    if (rate <= 3) return 'Good';
    if (rate <= 5) return 'Average';
    return 'Poor';
  }

  private getSpeedAdherenceScore(percentage: number): string {
    if (percentage <= 5) return 'Excellent';
    if (percentage <= 15) return 'Good';
    if (percentage <= 30) return 'Average';
    return 'Poor';
  }

  private scoreToNumber(score: string): number {
    switch (score) {
      case 'Excellent': return 3;
      case 'Good': return 2;
      case 'Average': return 1;
      case 'Poor': return 0;
      default: return 0;
    }
  }

  private getOverallClass(score: number): string {
    if (score >= 2.5) return 'Class A';
    if (score >= 2) return 'Class B';
    if (score >= 1.5) return 'Class C';
    return 'Class D';
  }

  private async saveTripData(vehicleId: string, tripData: any, locations: ILocation[], speeds: ISpeed[], metrics: ITripMetrics): Promise<ITripDocument> {
    const trip = new Trip({
      dimoVehicleId: vehicleId,
      tripId: tripData.id,
      vehicleId: vehicleId,
      startTime: tripData.start.time,
      endTime: tripData.end.time,
      locations: locations,
      speeds: speeds,
      ...metrics
    });
    return await trip.save();
  }

  //write function to update vehicle stats based on the all trips
  async updateVehicleStats(vehicleId: number): Promise<void> {
    const vehicle = await Vehicle.findOne({ dimoVehicleId: vehicleId });
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }
    const trips = await Trip.find({ dimoVehicleId: vehicleId });
    
    vehicle.totalTrips = trips.length;
    vehicle.totalDistance = trips.reduce((sum, trip) => sum + trip.distance, 0); 
    vehicle.averageSpeed = trips.reduce((sum, trip) => sum + trip.averageSpeed, 0) / trips.length;
    vehicle.overallScore = this.calculateOverallVehicleScore(trips);

    await vehicle.save();
  } 

  async initVehicleStats(vehicleId: string): Promise<void> {
    const vehicle = await Vehicle.findOne({ dimoVehicleId: vehicleId });
    if (!vehicle) {
      //create vehicle
      const newVehicle = new Vehicle({
        dimoVehicleId: vehicleId,
        totalTrips: 0,
        totalDistance: 0,
        averageSpeed: 0,
        overallScore: {
          consistencyScore: 'Unknown',
          timeOfDayScore: 'Unknown',
          hardBrakingScore: 'Unknown',
          speedAdherenceScore: 'Unknown',
          overallClassification: 'Unknown'
        }
      });
      await newVehicle.save();
    } else {
      vehicle.totalTrips = 0;
      vehicle.totalDistance = 0;
  
      await vehicle.save();
    } 
  }


  private calculateOverallVehicleScore(trips: ITripDocument[]): { consistencyScore: string; timeOfDayScore: string; hardBrakingScore: string; speedAdherenceScore: string; overallClassification: string } {
    const totalDistance = trips.reduce((sum, trip) => sum + trip.distance, 0);
    const totalHardBrakes = trips.reduce((sum, trip) => sum + trip.hardBrakeCount, 0);
    const avgSpeedAdherence = trips.reduce((sum, trip) => sum + trip.speedAdherencePercentage, 0) / trips.length;

    const consistencyScore = this.getConsistencyScore(trips);
    const timeOfDayScore = this.getTimeOfDayScore(trips);
    const hardBrakingScore = this.getHardBrakingScore(totalHardBrakes, totalDistance);
    const speedAdherenceScore = this.getSpeedAdherenceScore(avgSpeedAdherence);

    const overallScore = (
      this.scoreToNumber(consistencyScore) +
      this.scoreToNumber(timeOfDayScore) +
      this.scoreToNumber(hardBrakingScore) +
      this.scoreToNumber(speedAdherenceScore) * 3  // Double weight for speed adherence
    ) / 6;  // Divide by 8 due to the double weight of speed adherence

    return {
      consistencyScore,
      timeOfDayScore,
      hardBrakingScore,
      speedAdherenceScore,
      overallClassification: this.getOverallClass(overallScore)
    };
  }

  private getConsistencyScore(trips: ITripDocument[]): string {
    // This is a simplified implementation. In a real-world scenario, you'd need a more sophisticated algorithm to detect regular patterns.
    const regularTrips = trips.filter(trip => {
      const startHour = new Date(trip.startTime).getHours();
      return startHour >= 7 && startHour <= 9 || startHour >= 16 && startHour <= 18;
    });
    const regularTripPercentage = (regularTrips.length / trips.length) * 100;

    if (regularTripPercentage > 90) return 'Excellent';
    if (regularTripPercentage > 80) return 'Good';
    if (regularTripPercentage > 70) return 'Average';
    return 'Poor';
  }

  private getTimeOfDayScore(trips: ITripDocument[]): string {
    const nightTrips = trips.filter(trip => {
      const date = new Date(trip.startTime);
      // Convert to EDT (UTC-4)
      const edtDate = new Date(date.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const startHour = edtDate.getHours();
      return startHour >= 23 || startHour < 4;
    });
    const nightTripPercentage = (nightTrips.length / trips.length) * 100;

    if (nightTripPercentage <= 5) return 'Excellent';
    if (nightTripPercentage <= 10) return 'Good';
    if (nightTripPercentage <= 20) return 'Average';
    return 'Poor';
  }
}
const rateLimiter = new RateLimiter(295, 60000);
export default new TripProcessingService(rateLimiter);