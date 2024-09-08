import axios, { AxiosResponse } from 'axios';
import dotenv from 'dotenv';

interface ILocation {
  latitude: number;
  longitude: number;
}

interface MapboxRouteResponse {
  routes: Array<{
    geometry: any;
    legs: Array<{
      steps: any[];
      summary: string;
      weight: number;
      duration: number;
      distance: number;
      annotation: {
        distance: number[];
        duration: number[];
        speed: number[];
        maxspeed: Array<{ speed: number | null; unit: string } | null>;
      };
    }>;
    weight_name: string;
    weight: number;
    duration: number;
    distance: number;
  }>;
  waypoints: any[];
  code: string;
  uuid: string;
}

interface RouteInfo {
  distance: number;
  duration: number;
  speedLimits: (number | null)[];
  segmentSpeeds: number[];
  segmentDistances: number[];
  geometry: any;
}

dotenv.config();

export class MapboxService {
  private apiUrl: string;
  private accessToken: string;

  constructor() {
    this.apiUrl = 'https://api.mapbox.com/directions/v5/mapbox/driving';
    this.accessToken = process.env.MAPBOX_API_KEY || '';
  }

  async getRouteInfo(start: ILocation, end: ILocation): Promise<RouteInfo> {
    try {
      const response: AxiosResponse<MapboxRouteResponse> = await axios.get(
        `${this.apiUrl}/${start.longitude},${start.latitude};${end.longitude},${end.latitude}`,
        {
          params: {
            alternatives: false,
            annotations: 'speed,maxspeed,distance',
            geometries: 'geojson',
            overview: 'full',
            steps: true,
            access_token: this.accessToken
          }
        }
      );
      return this.processRouteResponse(response.data);
    } catch (error) {
      console.error('Error fetching route info from Mapbox API:', error);
      throw error;
    }
  }

  private processRouteResponse(data: MapboxRouteResponse): RouteInfo {
    const route = data.routes[0];
    const annotation = route.legs[0].annotation;

    return {
      distance: route.distance,
      duration: route.duration,
      speedLimits: annotation.maxspeed.map(speed => speed ? speed.speed : null),
      segmentSpeeds: annotation.speed,
      segmentDistances: annotation.distance,
      geometry: route.geometry
    };
  }
}

export default new MapboxService();