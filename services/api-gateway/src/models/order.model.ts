import mongoose, { Schema, Document, Model } from 'mongoose';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded';

export type FulfillmentStatus =
  | 'unfulfilled'
  | 'fulfilled'
  | 'insufficient_stock_review_required';

export interface IOrderItem {
  productId: string;
  variantSku: string;
  productName: string;
  variantName: string;
  price: number;
  quantity: number;
}

export interface IShippingAddress {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface IOrder extends Document {
  orderNumber: string;
  sessionId: string;
  userId?: string;
  items: IOrderItem[];
  shippingAddress: IShippingAddress;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  paymentDetails: {
    provider: 'razorpay' | 'stripe';
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    currency?: string;
    amountPaise?: number;
    paymentIntentId?: string;
    clientSecret?: string;
  };
  idempotencyKey?: string;
  processedWebhookEvents: string[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: String, required: true },
    variantSku: { type: String, required: true, uppercase: true },
    productName: { type: String, required: true },
    variantName: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const ShippingAddressSchema = new Schema<IShippingAddress>(
  {
    fullName: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
  },
  { _id: false }
);

const OrderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      index: true,
      sparse: true,
    },
    items: [OrderItemSchema],
    shippingAddress: { type: ShippingAddressSchema, required: true },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, default: 0, min: 0 },
    shipping: { type: Number, required: true, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'processing', 'succeeded', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    fulfillmentStatus: {
      type: String,
      enum: ['unfulfilled', 'fulfilled', 'insufficient_stock_review_required'],
      default: 'unfulfilled',
      index: true,
    },
    paymentDetails: {
      provider: { type: String, default: 'razorpay' },
      razorpayOrderId: { type: String, index: true, sparse: true },
      razorpayPaymentId: { type: String, index: true, sparse: true },
      razorpaySignature: { type: String },
      currency: { type: String, default: 'INR' },
      amountPaise: { type: Number },
      paymentIntentId: { type: String, index: true, sparse: true },
      clientSecret: { type: String },
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    processedWebhookEvents: [{ type: String }],
  },
  {
    timestamps: true,
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

export const OrderModel: Model<IOrder> = mongoose.model<IOrder>('Order', OrderSchema);
