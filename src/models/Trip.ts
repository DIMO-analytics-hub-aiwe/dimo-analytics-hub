import mongoose, { Document, Schema } from 'mongoose';

export interface ITrip {
  tripId: string;
  dimoVehicleId: string;
  startTime: Date;
  endTime: Date;
  locations: Array<{
    timestamp: Date;
    latitude: number;
    longitude: number;
    altitude: number;
  }>;
  speeds: Array<{
    timestamp: Date;
    speed: number;
    allowedSpeed: number;
  }>;
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

export interface ITripDocument extends ITrip, Document {}

const TripSchema: Schema = new Schema({
  tripId: { type: String, required: true },
  dimoVehicleId: { type: String, ref: 'Vehicle', required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  locations: [{
    timestamp: Date,
    latitude: Number,
    longitude: Number,
    altitude: Number
  }],
  speeds: [{
    timestamp: Date,
    speed: Number,
    averageDriverSpeed: Number,
    allowedSpeed: Number
  }],
  averageSpeed: { type: Number },
  maxSpeed: { type: Number },
  distance: { type: Number },
  hardBrakeCount: { type: Number, default: 0 },
  speedAdherencePercentage: { type: Number },
  score: {
    hardBraking: { type: String, enum: ['Excellent', 'Good', 'Average', 'Poor'] },
    speedAdherence: { type: String, enum: ['Excellent', 'Good', 'Average', 'Poor'] },
    overall: { type: String, enum: ['Class A', 'Class B', 'Class C', 'Class D'] }
  }
}, { timestamps: true });

export default mongoose.model<ITripDocument>('Trip', TripSchema);