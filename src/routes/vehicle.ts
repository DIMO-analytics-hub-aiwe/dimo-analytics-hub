import express, { Request, Response } from 'express';
import Vehicle from '../models/Vehicle';
import TripProcessingService from '../services/tripProcessingService';
import { authMiddleware } from '../middleware/auth';
import { DIMO } from '@dimo-network/dimo-node-sdk';

const router = express.Router();
const dimo = new DIMO('Production');

router.post('/process', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { vehicleId, token } = req.body;
    const auth = { headers: { "Authorization": token } }
    const { trips } = await dimo.trips.list({ ...auth, tokenId: vehicleId });
    console.log(trips);
    await TripProcessingService.initVehicleStats(vehicleId);
    const processedTrips = await Promise.all(trips.map(async (trip: any) => {
      return await TripProcessingService.processTrip(auth, vehicleId, trip);
    }));
    console.log(processedTrips);
    res.json(processedTrips);
  } catch (error) {
    console.error('Error during processing:', error);
    res.status(500).json({ error: 'Error during processing' });
  }
});

router.use(authMiddleware);

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const vehicle = await Vehicle.findOne({ dimoVehicleId: req.params.id });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching vehicle' });
  }
});

router.get('/:id/score', async (req: Request, res: Response) => {
  try {
    const vehicle = await Vehicle.findOne({ dimoVehicleId: req.params.id });
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(vehicle.overallScore);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching vehicle score' });
  }
});

export default router;