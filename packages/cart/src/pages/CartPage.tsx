import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import CartItemRow from '../components/CartItemRow';

const CartPage: React.FC = () => {
  const { items, subtotal, itemCount, loading, error, updateQuantity, removeItem, clearCart } =
    useCart();

  if (loading && items.length === 0) {
    return (
      <div className="cart-page container">
        <h1 className="cart-page__title">Shopping Bag</h1>
        <div className="cart-page__loading">
          <div className="skeleton" style={{ height: '80px', marginBottom: '1rem' }} />
          <div className="skeleton" style={{ height: '80px', marginBottom: '1rem' }} />
          <div className="skeleton" style={{ height: '80px', marginBottom: '1rem' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page container animate-fade-in">
      <div className="cart-page__header">
        <h1 className="cart-page__title">Shopping Bag</h1>
        {itemCount > 0 && (
          <span className="cart-page__count">
            ({itemCount} {itemCount === 1 ? 'item' : 'items'})
          </span>
        )}
      </div>

      {error && (
        <div className="cart-page__error" role="alert">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="cart-page__empty">
          <div className="cart-page__empty-icon">🛍️</div>
          <h2>Your bag is empty</h2>
          <p>Explore our catalog to find premium clothing and accessories.</p>
          <Link to="/catalog" className="cart-page__shop-btn">
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div className="cart-page__layout">
          <div className="cart-page__items-list">
            <div className="cart-page__list-header">
              <span>Product</span>
              <button
                type="button"
                className="cart-page__clear-btn"
                onClick={clearCart}
                aria-label="Clear all items from bag"
              >
                Clear Bag
              </button>
            </div>

            {items.map((item) => (
              <CartItemRow
                key={item.variantSku}
                item={item}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            ))}
          </div>

          <aside className="cart-page__summary" aria-label="Order summary">
            <h2 className="cart-page__summary-title">Summary</h2>

            <div className="cart-page__summary-row">
              <span>Subtotal</span>
              <span className="cart-page__summary-val">${subtotal.toFixed(2)}</span>
            </div>

            <div className="cart-page__summary-row">
              <span>Estimated Shipping</span>
              <span className="cart-page__summary-val">
                {subtotal > 150 ? 'FREE' : '$15.00'}
              </span>
            </div>

            {subtotal <= 150 && (
              <div className="cart-page__shipping-note">
                Add ${(150 - subtotal).toFixed(2)} more for <strong>FREE shipping</strong>.
              </div>
            )}

            <div className="cart-page__summary-row cart-page__summary-total">
              <span>Total</span>
              <span className="cart-page__summary-val">
                ${(subtotal + (subtotal > 150 ? 0 : 15)).toFixed(2)}
              </span>
            </div>

            <Link to="/checkout" className="cart-page__checkout-btn">
              Proceed to Checkout &rarr;
            </Link>

            <Link to="/catalog" className="cart-page__continue-link">
              Continue Shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
};

export default CartPage;
