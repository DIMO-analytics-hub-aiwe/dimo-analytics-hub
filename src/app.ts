import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import connectDB from './config/database';
import tripsRoutes from './routes/trips';
import vehicleRoutes from './routes/vehicle';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

connectDB();

app.use(express.json());

app.use('/api/trips', tripsRoutes);
app.use('/api/vehicle', vehicleRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('DIMO Driving Analysis API');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;