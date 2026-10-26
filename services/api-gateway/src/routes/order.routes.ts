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

const VerifyPaymentSchema = z.object({
  razorpay_order_id: z.string({ required_error: 'razorpay_order_id is required' }).min(1, 'razorpay_order_id cannot be empty'),
  razorpay_payment_id: z.string({ required_error: 'razorpay_payment_id is required' }).min(1, 'razorpay_payment_id cannot be empty'),
  razorpay_signature: z.string({ required_error: 'razorpay_signature is required' }).min(1, 'razorpay_signature cannot be empty'),
});

// POST /api/orders - Create order from cart and initialize Razorpay order
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

    const responseData = {
      ...order.toJSON(),
      razorpayKeyId: config.razorpay.keyId,
    };

    res.status(201).json({ success: true, data: responseData });
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

// POST /api/orders/payments/verify - Secure Razorpay payment verification
router.post('/payments/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = VerifyPaymentSchema.parse(req.body);
    const order = await orderService.verifyPaymentAndConfirmOrder({
      razorpayOrderId: validated.razorpay_order_id,
      razorpayPaymentId: validated.razorpay_payment_id,
      razorpaySignature: validated.razorpay_signature,
    });

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
});

// POST /api/orders/payments/confirm - Obsolete simulated endpoint disabled for security
router.post('/payments/confirm', (_req: Request, _res: Response, next: NextFunction) => {
  next(
    new AppError(
      'Simulated payment confirmation endpoint is disabled. Use /api/orders/payments/verify with authentic Razorpay payment response.',
      400
    )
  );
});

// POST /api/orders/payments/webhook - Legacy webhook handler (webhooks integrated separately later)
router.post('/payments/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sigHeader = req.headers['stripe-signature'] as string;
    const webhookSecret = config.stripe.webhookSecret;

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

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

export default router;
