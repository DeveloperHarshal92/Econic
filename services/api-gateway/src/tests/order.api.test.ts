import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { ProductModel, CartModel, OrderModel } from '../models';
import { eventBus } from '../events/eventBus';
import { initInventoryEventConsumer } from '../events/inventoryEvents';

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

describe('Order & Payment API (Phase 3)', () => {
  let createdProductId: string;
  const sessionId = 'test-order-session-' + Date.now();

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

    it('should create an order with valid cart and calculate subtotal/tax/total', async () => {
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
      expect(res.body.data.paymentDetails.clientSecret).toBeDefined();
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

  describe('Payment Webhook & Inventory Consistency (FR-08, FR-09)', () => {
    it('should confirm payment, deduct inventory, and clear cart upon payment webhook', async () => {
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
        .send({ shippingAddress: validAddress });

      const paymentIntentId = orderRes.body.data.paymentDetails.paymentIntentId;

      // Step 3: Trigger payment webhook (payment_intent.succeeded)
      const webhookPayload = {
        id: 'evt_stripe_test_' + Date.now(),
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: paymentIntentId,
          },
        },
      };

      const webhookRes = await request(app)
        .post('/api/orders/payments/webhook')
        .send(webhookPayload)
        .expect(200);

      expect(webhookRes.body.received).toBe(true);

      // Allow event bus execution
      await new Promise((r) => setTimeout(r, 100));

      // Step 4: Verify Order status updated
      const updatedOrder = await OrderModel.findOne({
        'paymentDetails.paymentIntentId': paymentIntentId,
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

      // Step 7: Replaying the same webhook event ID should be idempotent and NOT deduct inventory again
      await request(app)
        .post('/api/orders/payments/webhook')
        .send(webhookPayload)
        .expect(200);

      await new Promise((r) => setTimeout(r, 100));

      const unchangedProduct = await ProductModel.findById(createdProductId);
      const unchangedVariant = unchangedProduct?.variants.find((v) => v.sku === 'SOS-M-WHT');
      expect(unchangedVariant?.inventory).toBe(7); // Still 7, not 4!
    });
  });
});
