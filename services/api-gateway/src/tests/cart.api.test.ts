import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { ProductModel, CartModel } from '../models';
import { eventBus } from '../events/eventBus';
import { initInventoryEventConsumer, publishInventoryEvent, INVENTORY_CHANNELS } from '../events/inventoryEvents';

const app = createApp();

const testProduct = {
  name: 'Merino Wool Sweater',
  slug: 'merino-wool-sweater',
  description: '100% fine Italian merino wool sweater with ribbed cuffs.',
  shortDescription: '100% fine Italian merino wool sweater.',
  category: 'Knitwear',
  tags: ['wool', 'sweater', 'winter'],
  images: [
    {
      url: 'https://example.com/sweater.jpg',
      alt: 'Merino Wool Sweater',
      isPrimary: true,
    },
  ],
  variants: [
    {
      sku: 'MWS-M-NAVY',
      name: 'Medium / Navy',
      price: 120.0,
      inventory: 5,
      isAvailable: true,
      attributes: { size: 'M', color: 'Navy' },
    },
    {
      sku: 'MWS-L-NAVY',
      name: 'Large / Navy',
      price: 120.0,
      inventory: 0,
      isAvailable: false,
      attributes: { size: 'L', color: 'Navy' },
    },
  ],
};

describe('Cart API & Inventory Events', () => {
  let createdProductId: string;
  const sessionId = 'test-session-' + Date.now();

  beforeAll(() => {
    eventBus.clear();
    initInventoryEventConsumer();
  });

  beforeEach(async () => {
    await ProductModel.deleteMany({});
    await CartModel.deleteMany({});

    const product = await ProductModel.create(testProduct);
    createdProductId = product.id;
  });

  describe('GET /api/cart', () => {
    it('should return empty cart for new session', async () => {
      const res = await request(app)
        .get('/api/cart')
        .set('x-cart-session', sessionId)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.subtotal).toBe(0);
      expect(res.body.data.itemCount).toBe(0);
    });

    it('should require session identifier', async () => {
      const res = await request(app)
        .get('/api/cart')
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/cart/items', () => {
    it('should add available item to cart', async () => {
      const res = await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'MWS-M-NAVY',
          quantity: 2,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.itemCount).toBe(2);
      expect(res.body.data.subtotal).toBe(240);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].productName).toBe('Merino Wool Sweater');
    });

    it('should reject addition when quantity exceeds stock', async () => {
      const res = await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'MWS-M-NAVY',
          quantity: 10, // Only 5 available
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Insufficient inventory');
    });

    it('should reject out-of-stock variant', async () => {
      const res = await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'MWS-L-NAVY',
          quantity: 1,
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent SKU', async () => {
      const res = await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'NON-EXISTENT',
          quantity: 1,
        })
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('should increment existing item quantity when added again', async () => {
      await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'MWS-M-NAVY',
          quantity: 1,
        })
        .expect(201);

      const res = await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'MWS-M-NAVY',
          quantity: 2,
        })
        .expect(201);

      expect(res.body.data.itemCount).toBe(3);
      expect(res.body.data.subtotal).toBe(360);
    });
  });

  describe('PATCH /api/cart/items/:sku', () => {
    it('should update quantity of item in cart', async () => {
      await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'MWS-M-NAVY',
          quantity: 1,
        });

      const res = await request(app)
        .patch('/api/cart/items/MWS-M-NAVY')
        .set('x-cart-session', sessionId)
        .send({ quantity: 4 })
        .expect(200);

      expect(res.body.data.itemCount).toBe(4);
      expect(res.body.data.subtotal).toBe(480);
    });

    it('should remove item when quantity updated to 0', async () => {
      await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'MWS-M-NAVY',
          quantity: 2,
        });

      const res = await request(app)
        .patch('/api/cart/items/MWS-M-NAVY')
        .set('x-cart-session', sessionId)
        .send({ quantity: 0 })
        .expect(200);

      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.itemCount).toBe(0);
    });
  });

  describe('DELETE /api/cart/items/:sku', () => {
    it('should remove item by SKU', async () => {
      await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'MWS-M-NAVY',
          quantity: 1,
        });

      const res = await request(app)
        .delete('/api/cart/items/MWS-M-NAVY')
        .set('x-cart-session', sessionId)
        .expect(200);

      expect(res.body.data.items).toHaveLength(0);
    });
  });

  describe('DELETE /api/cart', () => {
    it('should clear entire cart', async () => {
      await request(app)
        .post('/api/cart/items')
        .set('x-cart-session', sessionId)
        .send({
          productId: createdProductId,
          variantSku: 'MWS-M-NAVY',
          quantity: 2,
        });

      const res = await request(app)
        .delete('/api/cart')
        .set('x-cart-session', sessionId)
        .expect(200);

      expect(res.body.data.items).toHaveLength(0);
      expect(res.body.data.itemCount).toBe(0);
      expect(res.body.data.subtotal).toBe(0);
    });
  });

  describe('Redis-based Inventory Event Processing (FR-07)', () => {
    it('should update product inventory in database when inventory event is emitted', async () => {
      // Current inventory for MWS-M-NAVY is 5. Emit event to increase by 10 (e.g. restock)
      await publishInventoryEvent(INVENTORY_CHANNELS.UPDATED, {
        sku: 'MWS-M-NAVY',
        quantity: 10,
        reason: 'restock',
      });

      // Allow event handler loop execution
      await new Promise((resolve) => setTimeout(resolve, 100));

      const updatedProduct = await ProductModel.findById(createdProductId);
      const variant = updatedProduct?.variants.find((v) => v.sku === 'MWS-M-NAVY');
      expect(variant?.inventory).toBe(15);
      expect(variant?.isAvailable).toBe(true);
    });
  });
});
