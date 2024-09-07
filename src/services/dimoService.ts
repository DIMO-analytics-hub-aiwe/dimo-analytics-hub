import {DIMO} from '@dimo-network/dimo-node-sdk';

const dimo = new DIMO('Production'); 

interface DimoTripResponse {
  // Define the structure of the trip response from DIMO API
  // This is a placeholder and should be updated based on actual API response
  trips: any[];
}

interface DimoTelemetryResponse {
  // Define the structure of the telemetry response from DIMO API
  // This is a placeholder and should be updated based on actual API response
  data: {
    signals: any[];
  };
}

class DimoService {


  async queryTelemetry(token: { headers: any }, query: string): Promise<DimoTelemetryResponse> {
    try {
      const response = await dimo.telemetry.query({
        ...token,
        query: `
          query {
            some_valid_GraphQL_query
          }
        `
      });
      console.log(response);
      return response as unknown as DimoTelemetryResponse;
    } catch (error) {
      console.error('Error querying telemetry from DIMO API:', error);
      throw error;
    }
  }

  async getTripTelemetry(token: { headers: Record<string, string> }, vehicleId: string, startTime: string, endTime: string): Promise<DimoTelemetryResponse> {
    const query = `
      query {
        signals(
          tokenId: "${vehicleId}", 
          interval: "1s",
          from: "${startTime}", 
          to: "${endTime}"
        ) {
          currentLocationLatitude(agg: MED)
          currentLocationLongitude(agg: MED)
          timestamp
        }
      }
    `;
    return this.queryTelemetry(token, query);
  }
}

export default new DimoService();