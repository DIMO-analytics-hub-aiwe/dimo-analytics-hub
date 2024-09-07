import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }

  if (token === process.env.SDK_KEY) {
    req.params.token = token;
    next();
  } else {
    res.status(401).json({ error: 'Invalid authorization token' });
  }
};