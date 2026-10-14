import mongoose, { Schema, Document, Model } from 'mongoose';

export type AnalyticsEventType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'search'
  | 'checkout_step'
  | 'prefetch_hit';

export interface IAnalyticsEvent extends Document {
  sessionId: string;
  eventType: AnalyticsEventType;
  path: string;
  referrer?: string;
  productId?: string;
  productSlug?: string;
  category?: string;
  searchQuery?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    sessionId: { type: String, required: true, index: true },
    eventType: {
      type: String,
      required: true,
      enum: ['page_view', 'product_view', 'add_to_cart', 'search', 'checkout_step', 'prefetch_hit'],
      index: true,
    },
    path: { type: String, required: true, index: true },
    referrer: { type: String },
    productId: { type: String, index: true },
    productSlug: { type: String, index: true },
    category: { type: String, index: true },
    searchQuery: { type: String },
    metadata: { type: Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
    toJSON: {
      transform(_doc, ret: any) {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for time-series aggregation
AnalyticsEventSchema.index({ eventType: 1, timestamp: -1 });
AnalyticsEventSchema.index({ productSlug: 1, eventType: 1 });

export const AnalyticsModel: Model<IAnalyticsEvent> = mongoose.model<IAnalyticsEvent>(
  'AnalyticsEvent',
  AnalyticsEventSchema
);
