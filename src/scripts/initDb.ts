import mongoose from 'mongoose';
import Vehicle from '../models/Vehicle';
import Trip from '../models/Trip';
import dotenv from 'dotenv';

dotenv.config();

const initDb = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    // Create collections
    await Vehicle.createCollection();
    await Trip.createCollection();

    // Create indexes
    await Vehicle.createIndexes();
    await Trip.createIndexes();

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    await mongoose.disconnect();
  }
};

initDb();