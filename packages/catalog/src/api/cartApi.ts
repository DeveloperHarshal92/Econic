/**
 * Cart API integration for Catalog Microfrontend
 * Communicates with /api/cart using the shared 'vetu_cart_session' from localStorage.
 */

const API_BASE = '/api';

export function getOrCreateCartSession(): string {
  let id = localStorage.getItem('vetu_cart_session');
  if (!id) {
    id = 'cart_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('vetu_cart_session', id);
  }
  return id;
}

export interface AddToCartInput {
  productId: string;
  variantSku: string;
  quantity: number;
}

export interface CartResponseData {
  id: string;
  items: Array<{
    productId: string;
    variantSku: string;
    productName: string;
    variantName: string;
    price: number;
    quantity: number;
    imageUrl?: string;
  }>;
  subtotal: number;
  itemCount: number;
}

export async function addToCart(payload: AddToCartInput): Promise<CartResponseData> {
  const sessionId = getOrCreateCartSession();

  const response = await fetch(`${API_BASE}/cart/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cart-session': sessionId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error?.message || `Failed to add item to bag (HTTP ${response.status})`);
  }

  const result = await response.json();
  const cartData: CartResponseData = result.data;

  // Broadcast update event across all microfrontends (Header, Cart MFE, Shell)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('cart:updated', {
        detail: {
          itemCount: cartData.itemCount,
          subtotal: cartData.subtotal,
        },
      })
    );
    window.dispatchEvent(new CustomEvent('cart:refresh'));
  }

  return cartData;
}
