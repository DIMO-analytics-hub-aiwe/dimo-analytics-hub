import mongoose, { Document, Schema } from 'mongoose';

export interface IVehicle {
  dimoVehicleId: string;
  overallScore: {
    consistencyScore: string;
    timeOfDayScore: string;
    hardBrakingScore: string;
    speedAdherenceScore: string;
    overallClassification: string;
  };
  totalTrips: number;
  totalDistance: number;
  averageSpeed: number;
}

export interface IVehicleDocument extends IVehicle, Document {}

const VehicleSchema: Schema = new Schema({
  dimoVehicleId: { type: String, required: true, unique: true },
  overallScore: {
    consistencyScore: { type: String, enum: ['Excellent', 'Good', 'Average', 'Poor', 'Unknown'], default: 'Unknown' },
    timeOfDayScore: { type: String, enum: ['Excellent', 'Good', 'Average', 'Poor', 'Unknown'], default: 'Unknown' },
    hardBrakingScore: { type: String, enum: ['Excellent', 'Good', 'Average', 'Poor', 'Unknown'], default: 'Unknown' },
    speedAdherenceScore: { type: String, enum: ['Excellent', 'Good', 'Average', 'Poor', 'Unknown'], default: 'Unknown' },
    overallClassification: { type: String, enum: ['Class A', 'Class B', 'Class C', 'Class D', 'Unknown'], default: 'Unknown' }
  },
  totalTrips: { type: Number, default: 0 },
  totalDistance: { type: Number, default: 0 },
  averageSpeed: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.model<IVehicleDocument>('Vehicle', VehicleSchema);