import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { getRedisClient } from '../config/redis';
import { config } from '../config';
import type { HealthStatus } from '@ecommerce/shared';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const mongoStatus =
    mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

  let redisStatus: 'connected' | 'disconnected' = 'disconnected';
  try {
    const redis = getRedisClient();
    const pong = await redis.ping();
    redisStatus = pong === 'PONG' ? 'connected' : 'disconnected';
  } catch {
    redisStatus = 'disconnected';
  }

  const overallStatus: HealthStatus['status'] =
    mongoStatus === 'connected'
      ? redisStatus === 'connected'
        ? 'healthy'
        : 'degraded'
      : 'unhealthy';

  const health: HealthStatus = {
    status: overallStatus,
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoStatus,
      redis: redisStatus,
    },
  };

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;
  res.status(httpStatus).json(health);
});

export default router;
