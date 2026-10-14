import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { AnalyticsModel } from '../models';

const app = createApp();

describe('Analytics & Predictive Prefetching API (Phase 4)', () => {
  beforeEach(async () => {
    await AnalyticsModel.deleteMany({});
  });

  describe('POST /api/analytics/events', () => {
    it('should record an analytics event', async () => {
      const res = await request(app)
        .post('/api/analytics/events')
        .send({
          sessionId: 'session-123',
          eventType: 'product_view',
          path: '/catalog/classic-leather-jacket',
          productSlug: 'classic-leather-jacket',
          category: 'Outerwear',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.sessionId).toBe('session-123');
      expect(res.body.data.eventType).toBe('product_view');
    });

    it('should reject invalid event type', async () => {
      const res = await request(app)
        .post('/api/analytics/events')
        .send({
          sessionId: 'session-123',
          eventType: 'INVALID_TYPE',
          path: '/unknown',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/analytics/events/batch', () => {
    it('should ingest multiple events in a single batch', async () => {
      const batch = [
        {
          sessionId: 's-1',
          eventType: 'page_view',
          path: '/',
        },
        {
          sessionId: 's-1',
          eventType: 'product_view',
          path: '/catalog/silk-shirt',
          productSlug: 'silk-shirt',
        },
        {
          sessionId: 's-1',
          eventType: 'add_to_cart',
          path: '/catalog/silk-shirt',
        },
      ];

      const res = await request(app)
        .post('/api/analytics/events/batch')
        .send({ events: batch })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(3);

      const count = await AnalyticsModel.countDocuments();
      expect(count).toBe(3);
    });
  });

  describe('GET /api/analytics/dashboard', () => {
    it('should aggregate metrics and conversion rate', async () => {
      // Session 1: views 2 products, adds 1 to cart
      await AnalyticsModel.create([
        { sessionId: 's-1', eventType: 'page_view', path: '/' },
        { sessionId: 's-1', eventType: 'product_view', path: '/catalog/p1', productSlug: 'p1', category: 'Suits' },
        { sessionId: 's-1', eventType: 'product_view', path: '/catalog/p2', productSlug: 'p2', category: 'Suits' },
        { sessionId: 's-1', eventType: 'add_to_cart', path: '/catalog/p1', productSlug: 'p1' },
        { sessionId: 's-1', eventType: 'checkout_step', path: '/checkout' },
        { sessionId: 's-1', eventType: 'prefetch_hit', path: '/catalog/p2' },
      ]);

      // Session 2: views 1 product, no cart
      await AnalyticsModel.create([
        { sessionId: 's-2', eventType: 'page_view', path: '/' },
        { sessionId: 's-2', eventType: 'product_view', path: '/catalog/p1', productSlug: 'p1', category: 'Suits' },
      ]);

      const res = await request(app)
        .get('/api/analytics/dashboard')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalEvents).toBe(8);
      expect(res.body.data.uniqueSessions).toBe(2);
      expect(res.body.data.productViews).toBe(3);
      expect(res.body.data.cartAdditions).toBe(1);
      expect(res.body.data.checkoutStarts).toBe(1);
      expect(res.body.data.prefetchHits).toBe(1);
      // Conversion rate = 1 / 3 = ~33.3%
      expect(res.body.data.conversionRate).toBe(33.3);
      expect(res.body.data.topProducts[0].slug).toBe('p1');
    });
  });

  describe('GET /api/analytics/predictive/:slug (FR-11)', () => {
    it('should return co-viewed products for intelligent edge prefetching', async () => {
      // Session A views 'leather-jacket' then 'silk-scarf'
      await AnalyticsModel.create([
        { sessionId: 's-a', eventType: 'product_view', path: '/catalog/leather-jacket', productSlug: 'leather-jacket' },
        { sessionId: 's-a', eventType: 'product_view', path: '/catalog/silk-scarf', productSlug: 'silk-scarf' },
      ]);

      // Session B views 'leather-jacket' then 'silk-scarf' then 'sunglasses'
      await AnalyticsModel.create([
        { sessionId: 's-b', eventType: 'product_view', path: '/catalog/leather-jacket', productSlug: 'leather-jacket' },
        { sessionId: 's-b', eventType: 'product_view', path: '/catalog/silk-scarf', productSlug: 'silk-scarf' },
        { sessionId: 's-b', eventType: 'product_view', path: '/catalog/sunglasses', productSlug: 'sunglasses' },
      ]);

      const res = await request(app)
        .get('/api/analytics/predictive/leather-jacket')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toContain('silk-scarf');
      expect(res.body.data[0]).toBe('silk-scarf'); // Highest co-occurrence score
    });
  });
});
