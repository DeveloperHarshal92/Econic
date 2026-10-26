// ─── Product Types ──────────────────────────────────────

export interface ProductVariant {
  sku: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  attributes: Record<string, string>;
  inventory: number;
  isAvailable: boolean;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  category: string;
  tags: string[];
  images: ProductImage[];
  variants: ProductVariant[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  url: string;
  alt: string;
  isPrimary: boolean;
}

// ─── Cart Types ─────────────────────────────────────────

export interface CartItem {
  productId: string;
  variantSku: string;
  productName: string;
  variantName: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Order Types ────────────────────────────────────────

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

export interface OrderItem {
  productId: string;
  variantSku: string;
  productName: string;
  variantName: string;
  price: number;
  quantity: number;
}

export interface ShippingAddress {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface PaymentDetails {
  provider: 'razorpay' | 'stripe';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  currency?: string;
  amountPaise?: number;
  paymentIntentId?: string;
  clientSecret?: string;
}

export interface Order {
  id: string;
  orderNumber?: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentIntentId?: string;
  paymentDetails?: PaymentDetails;
  createdAt: string;
  updatedAt: string;
}

// ─── API Response Types ─────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

// ─── Filter & Search Types ──────────────────────────────

export interface ProductFilter {
  category?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  isAvailable?: boolean;
  sortBy?: 'name' | 'price' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// ─── Event Types ────────────────────────────────────────

export type EventType =
  | 'inventory:updated'
  | 'inventory:low'
  | 'order:created'
  | 'order:updated'
  | 'payment:succeeded'
  | 'payment:failed';

export interface DomainEvent<T = unknown> {
  type: EventType;
  payload: T;
  timestamp: string;
  correlationId: string;
}

export interface InventoryEvent {
  sku: string;
  productId: string;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
}

// ─── Analytics Types ────────────────────────────────────

export type AnalyticsEventType =
  | 'page_view'
  | 'product_view'
  | 'product_click'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'search';

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  sessionId: string;
  userId?: string;
  payload: Record<string, unknown>;
  timestamp: string;
  url: string;
  referrer?: string;
}

// ─── Health Check ───────────────────────────────────────

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  services: {
    mongodb: 'connected' | 'disconnected';
    redis: 'connected' | 'disconnected';
  };
}
