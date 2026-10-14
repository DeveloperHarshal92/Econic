import { AnalyticsModel, IAnalyticsEvent, AnalyticsEventType } from '../models';
import { logger } from '../utils/logger';

export interface RecordEventInput {
  sessionId: string;
  eventType: AnalyticsEventType;
  path: string;
  referrer?: string;
  productId?: string;
  productSlug?: string;
  category?: string;
  searchQuery?: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardMetrics {
  totalEvents: number;
  uniqueSessions: number;
  pageViews: number;
  productViews: number;
  cartAdditions: number;
  checkoutStarts: number;
  prefetchHits: number;
  conversionRate: number; // cartAdditions / productViews
  topProducts: Array<{ slug: string; views: number }>;
  topCategories: Array<{ category: string; count: number }>;
}

export class AnalyticsService {
  async recordEvent(input: RecordEventInput): Promise<IAnalyticsEvent> {
    const event = await AnalyticsModel.create({
      ...input,
      timestamp: new Date(),
    });
    logger.debug('Analytics event recorded', {
      type: input.eventType,
      path: input.path,
      session: input.sessionId,
    });
    return event;
  }

  async recordBatch(events: RecordEventInput[]): Promise<number> {
    if (events.length === 0) return 0;
    const docs = events.map((e) => ({ ...e, timestamp: new Date() }));
    await AnalyticsModel.insertMany(docs);
    logger.debug('Batch analytics events recorded', { count: events.length });
    return events.length;
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [
      totalEvents,
      uniqueSessionsResult,
      eventCounts,
      topProductsResult,
      topCategoriesResult,
    ] = await Promise.all([
      AnalyticsModel.countDocuments(),
      AnalyticsModel.distinct('sessionId'),
      AnalyticsModel.aggregate([
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
      ]),
      AnalyticsModel.aggregate([
        { $match: { eventType: 'product_view', productSlug: { $exists: true, $ne: null } } },
        { $group: { _id: '$productSlug', views: { $sum: 1 } } },
        { $sort: { views: -1 } },
        { $limit: 5 },
      ]),
      AnalyticsModel.aggregate([
        { $match: { category: { $exists: true, $ne: null } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
    ]);

    const countsMap = new Map<string, number>();
    eventCounts.forEach((ec: { _id: string; count: number }) => {
      countsMap.set(ec._id, ec.count);
    });

    const pageViews = countsMap.get('page_view') || 0;
    const productViews = countsMap.get('product_view') || 0;
    const cartAdditions = countsMap.get('add_to_cart') || 0;
    const checkoutStarts = countsMap.get('checkout_step') || 0;
    const prefetchHits = countsMap.get('prefetch_hit') || 0;

    const conversionRate = productViews > 0
      ? Math.round((cartAdditions / productViews) * 1000) / 10
      : 0;

    return {
      totalEvents,
      uniqueSessions: uniqueSessionsResult.length,
      pageViews,
      productViews,
      cartAdditions,
      checkoutStarts,
      prefetchHits,
      conversionRate,
      topProducts: topProductsResult.map((p) => ({ slug: p._id, views: p.views })),
      topCategories: topCategoriesResult.map((c) => ({ category: c._id, count: c.count })),
    };
  }

  /**
   * Predictive prefetching: Returns likely next products to prefetch based on
   * other products viewed in sessions containing `currentSlug`.
   */
  async getPredictiveNextProducts(currentSlug: string): Promise<string[]> {
    // Find sessions that looked at currentSlug
    const sessions = await AnalyticsModel.distinct('sessionId', {
      productSlug: currentSlug,
      eventType: 'product_view',
    });

    if (sessions.length === 0) {
      // Fallback: return globally top viewed products
      const globalTop = await AnalyticsModel.aggregate([
        { $match: { eventType: 'product_view', productSlug: { $ne: currentSlug } } },
        { $group: { _id: '$productSlug', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 3 },
      ]);
      return globalTop.map((g) => g._id);
    }

    // Co-viewed products in these sessions
    const coViewed = await AnalyticsModel.aggregate([
      {
        $match: {
          sessionId: { $in: sessions },
          eventType: 'product_view',
          productSlug: { $ne: currentSlug, $exists: true },
        },
      },
      { $group: { _id: '$productSlug', score: { $sum: 1 } } },
      { $sort: { score: -1 } },
      { $limit: 3 },
    ]);

    return coViewed.map((item) => item._id);
  }
}

export const analyticsService = new AnalyticsService();
