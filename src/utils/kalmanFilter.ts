interface ILocation {
    latitude: number;
    longitude: number;
  }
  
  class KalmanFilter {
    private Q_metres_per_second: number;
    private R_metres: number;
    private time_step: number;
    private lat: number;
    private lng: number;
    private variance: number;
  
    constructor() {
      this.Q_metres_per_second = 3;
      this.R_metres = 1;
      this.time_step = 1;
      this.lat = 0;
      this.lng = 0;
      this.variance = -1;
    }
  
    filter(location: ILocation): ILocation {
      if (this.variance < 0) {
        this.lat = location.latitude;
        this.lng = location.longitude;
        this.variance = this.R_metres;
        return location;
      }
  
      const predictionVariance = this.variance + (this.Q_metres_per_second * this.time_step);
  
      // Kalman gain matrix
      const K_gain = predictionVariance / (predictionVariance + this.R_metres);
  
      // Update the state estimate
      this.lat += K_gain * (location.latitude - this.lat);
      this.lng += K_gain * (location.longitude - this.lng);
  
      // Update the variance
      this.variance = (1 - K_gain) * predictionVariance;
  
      return { latitude: this.lat, longitude: this.lng };
    }
  }
  
  export default KalmanFilter;