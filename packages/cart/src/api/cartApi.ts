const API_BASE = '/api';

export interface CartItemDto {
  productId: string;
  variantSku: string;
  productName: string;
  variantName: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface CartResponse {
  success: boolean;
  data: {
    id: string;
    items: CartItemDto[];
    subtotal: number;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
  };
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const sessionId = getOrCreateSessionId();
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

export function getOrCreateSessionId(): string {
  let id = localStorage.getItem('vetu_cart_session');
  if (!id) {
    id = 'cart_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('vetu_cart_session', id);
  }
  return id;
}

export async function fetchCart(): Promise<CartResponse> {
  return apiFetch<CartResponse>('/cart');
}

export async function addToCartApi(item: {
  productId: string;
  variantSku: string;
  quantity: number;
}): Promise<CartResponse> {
  return apiFetch<CartResponse>('/cart/items', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function updateItemQuantityApi(
  variantSku: string,
  quantity: number
): Promise<CartResponse> {
  return apiFetch<CartResponse>(`/cart/items/${variantSku}`, {
    method: 'PATCH',
    body: JSON.stringify({ quantity }),
  });
}

export async function removeItemApi(variantSku: string): Promise<CartResponse> {
  return apiFetch<CartResponse>(`/cart/items/${variantSku}`, {
    method: 'DELETE',
  });
}

export async function clearCartApi(): Promise<CartResponse> {
  return apiFetch<CartResponse>('/cart', {
    method: 'DELETE',
  });
}
