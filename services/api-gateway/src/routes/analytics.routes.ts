import { Router, Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analytics.service';
import { z } from 'zod';
import { AppError } from '../middleware/error.middleware';

const router = Router();

const EventSchema = z.object({
  sessionId: z.string().min(1, 'sessionId is required'),
  eventType: z.enum([
    'page_view',
    'product_view',
    'add_to_cart',
    'search',
    'checkout_step',
    'prefetch_hit',
  ]),
  path: z.string().min(1, 'path is required'),
  referrer: z.string().optional(),
  productId: z.string().optional(),
  productSlug: z.string().optional(),
  category: z.string().optional(),
  searchQuery: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const BatchSchema = z.object({
  events: z.array(EventSchema).min(1, 'At least one event required'),
});

// POST /api/analytics/events
router.post('/events', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = EventSchema.parse(req.body);
    const event = await analyticsService.recordEvent(validated);
    res.status(201).json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
});

// POST /api/analytics/events/batch
router.post('/events/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { events } = BatchSchema.parse(req.body);
    const count = await analyticsService.recordBatch(events);
    res.status(201).json({ success: true, count });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/dashboard
router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await analyticsService.getDashboardMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
});

// GET /api/analytics/predictive/:slug
router.get('/predictive/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      throw new AppError('Slug is required', 400);
    }
    const nextSlugs = await analyticsService.getPredictiveNextProducts(slug);
    res.json({ success: true, data: nextSlugs });
  } catch (err) {
    next(err);
  }
});

export default router;
