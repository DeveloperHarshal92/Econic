const API_BASE = '/api';

export interface ShippingAddressInput {
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface OrderItem {
  productId: string;
  variantSku: string;
  productName: string;
  variantName: string;
  price: number;
  quantity: number;
}

export interface PaymentDetails {
  provider: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  currency?: string;
  amountPaise?: number;
  paymentIntentId?: string;
  clientSecret?: string;
}

export interface OrderResponse {
  success: boolean;
  data: {
    id: string;
    orderNumber: string;
    items: OrderItem[];
    shippingAddress: ShippingAddressInput;
    subtotal: number;
    shipping: number;
    tax: number;
    total: number;
    status: string;
    paymentStatus: string;
    paymentDetails: PaymentDetails;
    razorpayKeyId?: string;
    createdAt: string;
  };
}

export interface VerifyPaymentInput {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export function getSessionId(): string {
  let id = localStorage.getItem('vetu_cart_session');
  if (!id) {
    id = 'cart_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('vetu_cart_session', id);
  }
  return id;
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const sessionId = getSessionId();
  const headers = {
    'Content-Type': 'application/json',
    'x-cart-session': sessionId,
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function fetchCheckoutCart(): Promise<any> {
  return apiFetch('/cart');
}

export async function createOrder(shippingAddress: ShippingAddressInput): Promise<OrderResponse> {
  const idempotencyKey = 'order_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  return apiFetch<OrderResponse>('/orders', {
    method: 'POST',
    headers: {
      'idempotency-key': idempotencyKey,
    },
    body: JSON.stringify({ shippingAddress }),
  });
}

export async function verifyPayment(params: VerifyPaymentInput): Promise<OrderResponse> {
  return apiFetch<OrderResponse>('/orders/payments/verify', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function fetchOrder(orderNumber: string): Promise<OrderResponse> {
  return apiFetch<OrderResponse>(`/orders/${orderNumber}`);
}

/**
 * Dynamically load Razorpay standard checkout script
 */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
