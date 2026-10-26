import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import { createApp } from '../app';
import { ProductModel, CartModel, OrderModel } from '../models';
import { eventBus } from '../events/eventBus';
import { initInventoryEventConsumer } from '../events/inventoryEvents';
import { razorpayService } from '../services/razorpay.service';
import { config } from '../config';

const app = createApp();

const testProduct = {
  name: 'Silk Oxford Shirt',
  slug: 'silk-oxford-shirt',
  description: 'Pure mulberry silk oxford tailored shirt.',
  shortDescription: 'Pure mulberry silk oxford tailored shirt.',
  category: 'Shirts',
  tags: ['silk', 'luxury', 'shirt'],
  images: [
    {
      url: 'https://example.com/shirt.jpg',
      alt: 'Silk Oxford Shirt',
      isPrimary: true,
    },
  ],
  variants: [
    {
      sku: 'SOS-M-WHT',
      name: 'Medium / White',
      price: 180.0,
      inventory: 10,
      isAvailable: true,
      attributes: { size: 'M', color: 'White' },
    },
  ],
};

const validAddress = {
  fullName: 'Alice Walker',
  line1: '123 Avenue Montaigne',
  city: 'Paris',
  state: 'Île-de-France',
  postalCode: '75008',
  country: 'France',
  phone: '+33 1 23 45 67 89',
};

function generateRazorpaySignature(orderId: string, paymentId: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

describe('Order & Razorpay Payment API', () => {
  let createdProductId: string;
  const sessionId = 'test-order-session-' + Date.now();
  const testSecret = config.razorpay.keySecret || 'test_key_secret';

  beforeAll(() => {
    eventBus.clear();
    initInventoryEventConsumer();
  });

  beforeEach(async () => {
    await ProductModel.deleteMany({});
    await CartModel.deleteMany({});
    await OrderModel.deleteMany({});

    const product = await ProductModel.create(testProduct);
    createdProductId = product.id;

    // Spy on external Razorpay network calls for fast deterministic unit tests
    vi.spyOn(razorpayService, 'createRazorpayOrder').mockImplementation(async (input) => ({
      id: 'order_test_' + Math.random().toString(36).substring(2, 10),
      amount: input.amountPaise,
      currency: input.currency || 'INR',
      receipt: input.receipt,
      notes: input.notes,
    }));

    vi.spyOn(razorpayService, 'fetchPayment').mockImplementation(async (paymentId) => {
      if (paymentId.includes('unauthorized') || paymentId.includes('failed')) {
        return { id: paymentId, status: 'failed' };
      }
      return { id: paymentId, status: 'captured' };
    });
  });

  describe('POST /api/orders', () => {
    it('should reject order creation if cart is empty', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('x-cart-session', sessionId)
        .send({ shippingAddress: validAddress })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('empty cart');
    });

    it('should create an order with valid cart and initialize Razorpay order details', async () => {
      // Add 2 shirts to cart ($180 * 2 = $360) -> Free shipping (> 150), tax = 8% ($28.80) -> Total = $388.80
      await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'SOS-M-WHT',
          quantity: 2,
        })
        .expect(201);

      const res = await request(app)
        .post('/api/orders')
        .set('x-cart-session', sessionId)
        .send({ shippingAddress: validAddress })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.orderNumber).toMatch(/^ORD-[A-Z0-9]{6}$/);
      expect(res.body.data.subtotal).toBe(360);
      expect(res.body.data.shipping).toBe(0); // Free shipping threshold > 150
      expect(res.body.data.tax).toBe(28.8);
      expect(res.body.data.total).toBe(388.8);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.paymentStatus).toBe('pending');

      // Razorpay details validation
      expect(res.body.data.paymentDetails.provider).toBe('razorpay');
      expect(res.body.data.paymentDetails.razorpayOrderId).toMatch(/^order_test_/);
      expect(res.body.data.paymentDetails.amountPaise).toBe(38880);
      expect(res.body.data.paymentDetails.currency).toBe('INR');
      expect(res.body.data.razorpayKeyId).toBeDefined();
    });

    it('should be idempotent when idempotency-key header is provided', async () => {
      await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'SOS-M-WHT',
          quantity: 1,
        })
        .expect(201);

      const idempotencyKey = 'idem-' + Date.now();

      const res1 = await request(app)
        .post('/api/orders')
        .set('x-cart-session', sessionId)
        .set('idempotency-key', idempotencyKey)
        .send({ shippingAddress: validAddress })
        .expect(201);

      const res2 = await request(app)
        .post('/api/orders')
        .set('x-cart-session', sessionId)
        .set('idempotency-key', idempotencyKey)
        .send({ shippingAddress: validAddress })
        .expect(201);

      expect(res1.body.data.orderNumber).toBe(res2.body.data.orderNumber);
      expect(res1.body.data.paymentDetails.razorpayOrderId).toBe(
        res2.body.data.paymentDetails.razorpayOrderId
      );
    });
  });

  describe('GET /api/orders/:orderNumber', () => {
    it('should fetch order by orderNumber', async () => {
      await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'SOS-M-WHT',
          quantity: 1,
        });

      const orderRes = await request(app)
        .post('/api/orders')
        .set('x-cart-session', sessionId)
        .send({ shippingAddress: validAddress });

      const orderNumber = orderRes.body.data.orderNumber;

      const res = await request(app)
        .get(`/api/orders/${orderNumber}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.orderNumber).toBe(orderNumber);
      expect(res.body.data.shippingAddress.fullName).toBe('Alice Walker');
    });

    it('should return 404 for nonexistent order', async () => {
      const res = await request(app)
        .get('/api/orders/ORD-NONEXIST')
        .expect(404);

      expect(res.body.success).toBe(false);
    });
  });

  describe('Razorpay Payment Verification & Inventory Consistency', () => {
    it('should verify payment signature, confirm order, deduct inventory, and clear cart', async () => {
      // Step 1: Add 3 items to cart
      await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'SOS-M-WHT',
          quantity: 3,
        });

      // Step 2: Create order
      const orderRes = await request(app)
        .post('/api/orders')
        .set('x-cart-session', sessionId)
        .send({ shippingAddress: validAddress })
        .expect(201);

      const razorpayOrderId = orderRes.body.data.paymentDetails.razorpayOrderId;
      const razorpayPaymentId = 'pay_test_' + Date.now();
      const validSignature = generateRazorpaySignature(
        razorpayOrderId,
        razorpayPaymentId,
        testSecret
      );

      // Step 3: Verify payment with authentic signature
      const verifyRes = await request(app)
        .post('/api/orders/payments/verify')
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: validSignature,
        })
        .expect(200);

      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.status).toBe('confirmed');
      expect(verifyRes.body.data.paymentStatus).toBe('succeeded');
      expect(verifyRes.body.data.paymentDetails.razorpayPaymentId).toBe(razorpayPaymentId);

      // Allow event bus execution
      await new Promise((r) => setTimeout(r, 100));

      // Step 4: Verify Order persisted in database
      const updatedOrder = await OrderModel.findOne({
        'paymentDetails.razorpayOrderId': razorpayOrderId,
      });
      expect(updatedOrder?.status).toBe('confirmed');
      expect(updatedOrder?.paymentStatus).toBe('succeeded');

      // Step 5: Verify Product inventory deducted (10 - 3 = 7)
      const updatedProduct = await ProductModel.findById(createdProductId);
      const variant = updatedProduct?.variants.find((v) => v.sku === 'SOS-M-WHT');
      expect(variant?.inventory).toBe(7);

      // Step 6: Verify Cart is cleared
      const cartRes = await request(app)
        .get('/api/cart')
        .set('x-cart-session', sessionId);
      expect(cartRes.body.data.items).toHaveLength(0);

      // Step 7: Repeated payment verification submission is idempotent and does NOT deduct inventory again
      await request(app)
        .post('/api/orders/payments/verify')
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: validSignature,
        })
        .expect(200);

      await new Promise((r) => setTimeout(r, 100));

      const unchangedProduct = await ProductModel.findById(createdProductId);
      const unchangedVariant = unchangedProduct?.variants.find((v) => v.sku === 'SOS-M-WHT');
      expect(unchangedVariant?.inventory).toBe(7); // Still 7, not 4!
    });

    it('should reject payment verification with invalid signature', async () => {
      // Create order
      await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'SOS-M-WHT',
          quantity: 1,
        });

      const orderRes = await request(app)
        .post('/api/orders')
        .set('x-cart-session', sessionId)
        .send({ shippingAddress: validAddress });

      const razorpayOrderId = orderRes.body.data.paymentDetails.razorpayOrderId;
      const razorpayPaymentId = 'pay_test_' + Date.now();
      const forgedSignature = 'bad_signature_1234567890abcdef1234567890abcdef1234567890abcdef12345678';

      const res = await request(app)
        .post('/api/orders/payments/verify')
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: forgedSignature,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid payment signature');

      // Ensure order remains pending
      const order = await OrderModel.findOne({
        'paymentDetails.razorpayOrderId': razorpayOrderId,
      });
      expect(order?.status).toBe('pending');
      expect(order?.paymentStatus).toBe('pending');
    });

    it('should reject payment verification if order ID does not exist', async () => {
      const validSignature = generateRazorpaySignature(
        'order_nonexistent_123',
        'pay_123',
        testSecret
      );

      const res = await request(app)
        .post('/api/orders/payments/verify')
        .send({
          razorpay_order_id: 'order_nonexistent_123',
          razorpay_payment_id: 'pay_123',
          razorpay_signature: validSignature,
        })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Order not found');
    });

    it('should reject verification request when missing required fields', async () => {
      const res = await request(app)
        .post('/api/orders/payments/verify')
        .send({
          razorpay_order_id: 'order_123',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should disallow obsolete simulated payment confirmation endpoint', async () => {
      const res = await request(app)
        .post('/api/orders/payments/confirm')
        .send({ paymentIntentId: 'pi_fake_123' })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('disabled');
    });
  });
});
