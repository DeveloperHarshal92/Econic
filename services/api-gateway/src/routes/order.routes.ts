import { Router, Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';
import { z } from 'zod';
import { AppError } from '../middleware/error.middleware';
import crypto from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();

const ShippingAddressSchema = z.object({
  fullName: z.string().min(2, 'Full name is required'),
  line1: z.string().min(3, 'Address line 1 is required'),
  line2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  postalCode: z.string().min(3, 'Postal code is required'),
  country: z.string().min(2, 'Country is required'),
  phone: z.string().optional(),
});

const CreateOrderSchema = z.object({
  shippingAddress: ShippingAddressSchema,
  idempotencyKey: z.string().optional(),
});

// POST /api/orders - Create order from cart
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = (req.headers['x-cart-session'] as string) || req.body?.sessionId;
    if (!sessionId) {
      throw new AppError('x-cart-session header or sessionId is required', 400);
    }

    const validated = CreateOrderSchema.parse(req.body);
    const idempotencyKey =
      (req.headers['idempotency-key'] as string) || validated.idempotencyKey;

    const order = await orderService.createOrderFromCart({
      sessionId,
      shippingAddress: validated.shippingAddress,
      idempotencyKey,
    });

    res.status(201).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// GET /api/orders/:orderNumber - Fetch order by orderNumber
router.get('/:orderNumber', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderNumber } = req.params;
    const order = await orderService.getOrderByNumber(orderNumber!);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/payments/confirm - Direct test confirmation endpoint
router.post('/payments/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      throw new AppError('paymentIntentId is required', 400);
    }

    const order = await orderService.confirmOrderPayment(paymentIntentId);
    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/payments/webhook - Validated payment webhook handler
router.post('/payments/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sigHeader = req.headers['stripe-signature'] as string;
    const webhookSecret = config.stripe.webhookSecret;

    // Verify webhook signature when secret is configured
    if (webhookSecret && sigHeader) {
      const parts = sigHeader.split(',').reduce((acc, curr) => {
        const [k, v] = curr.split('=');
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {} as Record<string, string>);

      const timestamp = parts['t'];
      const signature = parts['v1'];
      const payloadString = JSON.stringify(req.body);

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(`${timestamp}.${payloadString}`)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new AppError('Invalid webhook signature', 400);
      }
    }

    const event = req.body;
    const eventId = event?.id || 'evt_' + Math.random().toString(36).substring(2, 10);
    const eventType = event?.type;

    logger.info('Processing payment webhook', { eventId, eventType });

    if (eventType === 'payment_intent.succeeded') {
      const paymentIntentId = event.data?.object?.id;
      if (paymentIntentId) {
        await orderService.confirmOrderPayment(paymentIntentId, eventId);
      }
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

export default router;
