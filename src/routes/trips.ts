import express, { Request, Response } from 'express';
import TripProcessingService from '../services/tripProcessingService';
import Trip from '../models/Trip';

const router = express.Router();

router.post('/process', async (req: Request, res: Response) => {
  try {
    const { user, vehicleId, trip } = req.body;
    const processedTrip = await TripProcessingService.processTrip(user, vehicleId, trip);
    res.json(processedTrip);
  } catch (error) {
    res.status(500).json({ error: 'Error processing trip' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    res.json(trip);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching trip' });
  }
});

export default router;