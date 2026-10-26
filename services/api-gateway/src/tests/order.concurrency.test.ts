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
  name: 'Cashmere Overcoat',
  slug: 'cashmere-overcoat',
  description: 'Pure double-faced cashmere overcoat.',
  shortDescription: 'Pure double-faced cashmere overcoat.',
  category: 'Coats',
  tags: ['cashmere', 'luxury'],
  images: [{ url: 'https://example.com/coat.jpg', alt: 'Cashmere Overcoat', isPrimary: true }],
  variants: [
    {
      sku: 'COAT-L-BLK',
      name: 'Large / Black',
      price: 950.0,
      inventory: 5,
      isAvailable: true,
      attributes: { size: 'L', color: 'Black' },
    },
  ],
};

const validAddress = {
  fullName: 'Marcus Vance',
  line1: '450 Sutter St',
  city: 'San Francisco',
  state: 'CA',
  postalCode: '94108',
  country: 'United States',
  phone: '+1 415 555 0199',
};

function generateRazorpaySignature(orderId: string, paymentId: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

describe('Order & Payment Concurrency and Recovery', () => {
  let createdProductId: string;
  const sessionId = 'concurrent-order-session-' + Date.now();
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

    vi.spyOn(razorpayService, 'createRazorpayOrder').mockImplementation(async (input) => ({
      id: 'order_test_' + Math.random().toString(36).substring(2, 10),
      amount: input.amountPaise,
      currency: input.currency || 'INR',
      receipt: input.receipt,
      notes: input.notes,
    }));

    vi.spyOn(razorpayService, 'fetchPayment').mockImplementation(async (paymentId) => {
      return { id: paymentId, status: 'captured' };
    });
  });

  it('should handle concurrent verification requests for the same order safely without duplicate inventory deductions', async () => {
    // 1. Add 2 items to cart
    await request(app)
      .post('/api/cart/items')
      .set('x-cart-session', sessionId)
      .send({
        productId: createdProductId,
        variantSku: 'COAT-L-BLK',
        quantity: 2,
      })
      .expect(201);

    // 2. Create order
    const orderRes = await request(app)
      .post('/api/orders')
      .set('x-cart-session', sessionId)
      .send({ shippingAddress: validAddress })
      .expect(201);

    const razorpayOrderId = orderRes.body.data.paymentDetails.razorpayOrderId;
    const razorpayPaymentId = 'pay_concurrent_' + Date.now();
    const signature = generateRazorpaySignature(razorpayOrderId, razorpayPaymentId, testSecret);

    // 3. Fire 5 concurrent verification calls with the same payment id
    const concurrentCalls = Array.from({ length: 5 }, () =>
      request(app)
        .post('/api/orders/payments/verify')
        .send({
          razorpay_order_id: razorpayOrderId,
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: signature,
        })
    );

    const results = await Promise.all(concurrentCalls);

    // All should return 200 with confirmed status (either newly confirmed or returned idempotently)
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('confirmed');
      expect(res.body.data.paymentStatus).toBe('succeeded');
    }

    // Wait for any microtasks/event bus
    await new Promise((r) => setTimeout(r, 100));

    // Inventory must be decremented EXACTLY ONCE (from 5 down to 3, NOT down to -5 or 0)
    const product = await ProductModel.findById(createdProductId);
    const variant = product?.variants.find((v) => v.sku === 'COAT-L-BLK');
    expect(variant?.inventory).toBe(3);
  });

  it('should transition order to recoverable review state if inventory is depleted before payment confirmation', async () => {
    // 1. Add 3 coats to cart
    await request(app)
      .post('/api/cart/items')
      .set('x-cart-session', sessionId)
      .send({
        productId: createdProductId,
        variantSku: 'COAT-L-BLK',
        quantity: 3,
      })
      .expect(201);

    // 2. Create order
    const orderRes = await request(app)
      .post('/api/orders')
      .set('x-cart-session', sessionId)
      .send({ shippingAddress: validAddress })
      .expect(201);

    const razorpayOrderId = orderRes.body.data.paymentDetails.razorpayOrderId;
    const razorpayPaymentId = 'pay_depleted_' + Date.now();
    const signature = generateRazorpaySignature(razorpayOrderId, razorpayPaymentId, testSecret);

    // 3. Simulate another transaction wiping out inventory before this payment confirms
    await ProductModel.updateOne(
      { _id: createdProductId, 'variants.sku': 'COAT-L-BLK' },
      { $set: { 'variants.$.inventory': 1 } } // only 1 left, but order requires 3!
    );

    // 4. Submit payment verification
    const verifyRes = await request(app)
      .post('/api/orders/payments/verify')
      .send({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: signature,
      })
      .expect(422);

    expect(verifyRes.body.success).toBe(false);
    expect(verifyRes.body.error.message).toContain('insufficient stock');

    // 5. Verify the order was transitioned to recoverable state for manual review/refund
    const savedOrder = await OrderModel.findOne({
      'paymentDetails.razorpayOrderId': razorpayOrderId,
    });
    expect(savedOrder).not.toBeNull();
    expect(savedOrder?.status).toBe('processing');
    expect(savedOrder?.paymentStatus).toBe('succeeded');
    expect(savedOrder?.fulfillmentStatus).toBe('insufficient_stock_review_required');
    expect(savedOrder?.paymentDetails.razorpayPaymentId).toBe(razorpayPaymentId);

    // Stock should still be 1 (not decremented below zero)
    const product = await ProductModel.findById(createdProductId);
    const variant = product?.variants.find((v) => v.sku === 'COAT-L-BLK');
    expect(variant?.inventory).toBe(1);
  });

  it('should be completely idempotent when repeating payment verification after order is confirmed', async () => {
    // 1. Add 1 item
    await request(app)
      .post('/api/cart/items')
      .set('x-cart-session', sessionId)
      .send({
        productId: createdProductId,
        variantSku: 'COAT-L-BLK',
        quantity: 1,
      })
      .expect(201);

    // 2. Create order
    const orderRes = await request(app)
      .post('/api/orders')
      .set('x-cart-session', sessionId)
      .send({ shippingAddress: validAddress })
      .expect(201);

    const razorpayOrderId = orderRes.body.data.paymentDetails.razorpayOrderId;
    const razorpayPaymentId = 'pay_repeat_' + Date.now();
    const signature = generateRazorpaySignature(razorpayOrderId, razorpayPaymentId, testSecret);

    // 3. First verification confirms order
    const firstRes = await request(app)
      .post('/api/orders/payments/verify')
      .send({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: signature,
      })
      .expect(200);

    expect(firstRes.body.data.status).toBe('confirmed');

    // 4. Second verification with same details
    const secondRes = await request(app)
      .post('/api/orders/payments/verify')
      .send({
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: signature,
      })
      .expect(200);

    expect(secondRes.body.data.orderNumber).toBe(firstRes.body.data.orderNumber);
    expect(secondRes.body.data.status).toBe('confirmed');

    // Check inventory: 5 - 1 = 4
    const product = await ProductModel.findById(createdProductId);
    const variant = product?.variants.find((v) => v.sku === 'COAT-L-BLK');
    expect(variant?.inventory).toBe(4);
  });
});
