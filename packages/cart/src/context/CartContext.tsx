import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  CartItemDto,
  fetchCart,
  addToCartApi,
  updateItemQuantityApi,
  removeItemApi,
  clearCartApi,
} from '../api/cartApi';

export interface CartContextType {
  items: CartItemDto[];
  subtotal: number;
  itemCount: number;
  loading: boolean;
  error: string | null;
  addItem: (item: { productId: string; variantSku: string; quantity: number }) => Promise<void>;
  updateQuantity: (variantSku: string, quantity: number) => Promise<void>;
  removeItem: (variantSku: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItemDto[]>([]);
  const [subtotal, setSubtotal] = useState<number>(0);
  const [itemCount, setItemCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const syncState = (data: { items: CartItemDto[]; subtotal: number; itemCount: number }) => {
    setItems(data.items);
    setSubtotal(data.subtotal);
    setItemCount(data.itemCount);

    // Broadcast update across MFEs (e.g. Header in Shell)
    window.dispatchEvent(
      new CustomEvent('cart:updated', {
        detail: {
          itemCount: data.itemCount,
          subtotal: data.subtotal,
        },
      })
    );
  };

  const refreshCart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCart();
      syncState(res.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch cart';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const addItem = async (item: { productId: string; variantSku: string; quantity: number }) => {
    setError(null);
    try {
      const res = await addToCartApi(item);
      syncState(res.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to add item to cart';
      setError(msg);
      throw err;
    }
  };

  const updateQuantity = async (variantSku: string, quantity: number) => {
    setError(null);
    try {
      const res = await updateItemQuantityApi(variantSku, quantity);
      syncState(res.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update quantity';
      setError(msg);
      throw err;
    }
  };

  const removeItem = async (variantSku: string) => {
    setError(null);
    try {
      const res = await removeItemApi(variantSku);
      syncState(res.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove item';
      setError(msg);
      throw err;
    }
  };

  const clearCart = async () => {
    setError(null);
    try {
      const res = await clearCartApi();
      syncState(res.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to clear cart';
      setError(msg);
      throw err;
    }
  };

  // Cross-MFE Event Listener
  useEffect(() => {
    refreshCart();

    const handleExternalAdd = (e: Event) => {
      const customEvent = e as CustomEvent<{ productId: string; variantSku: string; quantity: number }>;
      if (customEvent.detail) {
        addItem(customEvent.detail).catch(() => {});
      }
    };

    const handleExternalRefresh = () => {
      refreshCart();
    };

    window.addEventListener('cart:add', handleExternalAdd);
    window.addEventListener('cart:refresh', handleExternalRefresh);

    return () => {
      window.removeEventListener('cart:add', handleExternalAdd);
      window.removeEventListener('cart:refresh', handleExternalRefresh);
    };
  }, [refreshCart]);

  return (
    <CartContext.Provider
      value={{
        items,
        subtotal,
        itemCount,
        loading,
        error,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        refreshCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
