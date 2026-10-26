import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { ProductModel } from '../models';
import { productService } from '../services/product.service';
import { publishInventoryEvent, INVENTORY_CHANNELS, initInventoryEventConsumer } from '../events/inventoryEvents';
import { eventBus } from '../events/eventBus';

const testProductData = {
  name: 'Limited Edition Oxford Shirt',
  slug: 'limited-oxford-shirt',
  description: 'Exclusive 100% Egyptian cotton shirt in limited quantity.',
  shortDescription: 'Limited edition oxford shirt.',
  category: 'Shirts',
  tags: ['limited', 'cotton'],
  images: [{ url: 'https://example.com/shirt.jpg', alt: 'Oxford Shirt', isPrimary: true }],
  variants: [
    {
      sku: 'OXF-LTD-WHT-M',
      name: 'Medium / White',
      price: 85.0,
      inventory: 1, // EXACTLY 1 in stock for concurrency test
      isAvailable: true,
      attributes: { size: 'M', color: 'White' },
    },
    {
      sku: 'OXF-LTD-BLU-M',
      name: 'Medium / Blue',
      price: 85.0,
      inventory: 5,
      isAvailable: true,
      attributes: { size: 'M', color: 'Blue' },
    },
  ],
};

describe('Atomic Inventory Concurrency & Correctness (Stage 2 & 3)', () => {
  beforeAll(() => {
    eventBus.clear();
    initInventoryEventConsumer();
  });

  beforeEach(async () => {
    await ProductModel.deleteMany({});
    await ProductModel.create(testProductData);
  });

  describe('Single-Operation Boundary Checks', () => {
    it('should reject decrement attempts that exceed available stock and leave stock intact', async () => {
      // Available stock is 1; try to decrement by 2
      const result = await productService.adjustVariantInventory('OXF-LTD-WHT-M', -2);

      expect(result.success).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_STOCK');
      expect(result.previousInventory).toBe(1);
      expect(result.newInventory).toBe(1);

      // Verify database document was not modified
      const product = await ProductModel.findOne({ 'variants.sku': 'OXF-LTD-WHT-M' });
      const variant = product?.variants.find((v) => v.sku === 'OXF-LTD-WHT-M');
      expect(variant?.inventory).toBe(1);
      expect(variant?.isAvailable).toBe(true);
    });

    it('should set isAvailable to false when inventory drops to zero', async () => {
      const result = await productService.adjustVariantInventory('OXF-LTD-WHT-M', -1);

      expect(result.success).toBe(true);
      expect(result.newInventory).toBe(0);

      const product = await ProductModel.findOne({ 'variants.sku': 'OXF-LTD-WHT-M' });
      const variant = product?.variants.find((v) => v.sku === 'OXF-LTD-WHT-M');
      expect(variant?.inventory).toBe(0);
      expect(variant?.isAvailable).toBe(false);
    });

    it('should atomically restock variant and set isAvailable to true', async () => {
      // First deplete stock
      await productService.adjustVariantInventory('OXF-LTD-WHT-M', -1);

      // Then restock by 10
      const restockResult = await productService.adjustVariantInventory('OXF-LTD-WHT-M', 10);

      expect(restockResult.success).toBe(true);
      expect(restockResult.previousInventory).toBe(0);
      expect(restockResult.newInventory).toBe(10);

      const product = await ProductModel.findOne({ 'variants.sku': 'OXF-LTD-WHT-M' });
      const variant = product?.variants.find((v) => v.sku === 'OXF-LTD-WHT-M');
      expect(variant?.inventory).toBe(10);
      expect(variant?.isAvailable).toBe(true);
    });
  });

  describe('Concurrent Purchases for Last Unit (Overselling Prevention)', () => {
    it('should allow only one concurrent request to purchase the last unit and reject others', async () => {
      // OXF-LTD-WHT-M has inventory: 1
      // Launch 5 simultaneous decrement attempts in parallel
      const attempts = [
        productService.adjustVariantInventory('OXF-LTD-WHT-M', -1),
        productService.adjustVariantInventory('OXF-LTD-WHT-M', -1),
        productService.adjustVariantInventory('OXF-LTD-WHT-M', -1),
        productService.adjustVariantInventory('OXF-LTD-WHT-M', -1),
        productService.adjustVariantInventory('OXF-LTD-WHT-M', -1),
      ];

      const results = await Promise.all(attempts);

      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      // Exactly ONE must succeed, FOUR must fail
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(4);

      // Database inventory must be exactly 0, NEVER negative
      const product = await ProductModel.findOne({ 'variants.sku': 'OXF-LTD-WHT-M' });
      const variant = product?.variants.find((v) => v.sku === 'OXF-LTD-WHT-M');
      expect(variant?.inventory).toBe(0);
      expect(variant?.isAvailable).toBe(false);
    });
  });

  describe('Multi-Replica Redis Pub/Sub Broadcast Safety', () => {
    it('should ignore order_placed events in Redis consumer to prevent multi-instance double decrements', async () => {
      // OXF-LTD-BLU-M has 5 in stock.
      // Suppose an order was confirmed on Instance A and decremented in MongoDB to 4.
      await productService.adjustVariantInventory('OXF-LTD-BLU-M', -1);

      // Instance A broadcasts 'order_placed' event over Redis to other replicas
      await publishInventoryEvent(INVENTORY_CHANNELS.UPDATED, {
        sku: 'OXF-LTD-BLU-M',
        quantity: -1,
        reason: 'order_placed',
        orderId: 'ORD-TEST-12345',
      });

      // Wait for any consumer loop execution
      await new Promise((r) => setTimeout(r, 100));

      // The consumer MUST NOT decrement MongoDB again
      const product = await ProductModel.findOne({ 'variants.sku': 'OXF-LTD-BLU-M' });
      const variant = product?.variants.find((v) => v.sku === 'OXF-LTD-BLU-M');
      expect(variant?.inventory).toBe(4); // Stays 4, NOT 3!
    });

    it('should deduplicate duplicate events with identical eventId', async () => {
      const fixedEventId = 'unique-event-uuid-12345';

      // Send first restock event (+5)
      await publishInventoryEvent(INVENTORY_CHANNELS.UPDATED, {
        sku: 'OXF-LTD-BLU-M',
        quantity: 5,
        reason: 'restock',
        eventId: fixedEventId,
      });

      await new Promise((r) => setTimeout(r, 100));

      let product = await ProductModel.findOne({ 'variants.sku': 'OXF-LTD-BLU-M' });
      let variant = product?.variants.find((v) => v.sku === 'OXF-LTD-BLU-M');
      expect(variant?.inventory).toBe(10); // 5 + 5

      // Send duplicate replayed event with same eventId
      await publishInventoryEvent(INVENTORY_CHANNELS.UPDATED, {
        sku: 'OXF-LTD-BLU-M',
        quantity: 5,
        reason: 'restock',
        eventId: fixedEventId,
      });

      await new Promise((r) => setTimeout(r, 100));

      // Must remain 10, NOT 15
      product = await ProductModel.findOne({ 'variants.sku': 'OXF-LTD-BLU-M' });
      variant = product?.variants.find((v) => v.sku === 'OXF-LTD-BLU-M');
      expect(variant?.inventory).toBe(10);
    });
  });
});
