import React from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import CartItemRow from '../components/CartItemRow';

const CartPage: React.FC = () => {
  const { items, subtotal, itemCount, loading, error, updateQuantity, removeItem, clearCart } =
    useCart();

  if (loading && items.length === 0) {
    return (
      <div className="cart-page container" aria-busy="true">
        <div className="cart-page__header">
          <h1 className="cart-page__title">Shopping Bag</h1>
        </div>
        <div className="cart-page__loading">
          <div className="skeleton" style={{ height: '90px', marginBottom: '1.25rem', borderRadius: 'var(--cart-radius)' }} />
          <div className="skeleton" style={{ height: '90px', marginBottom: '1.25rem', borderRadius: 'var(--cart-radius)' }} />
          <div className="skeleton" style={{ height: '90px', marginBottom: '1.25rem', borderRadius: 'var(--cart-radius)' }} />
        </div>
      </div>
    );
  }

  // Authoritative server calculations
  const shipping = subtotal > 150 ? 0 : 15.0;
  const tax = Math.round(subtotal * 0.08 * 100) / 100;
  const total = Math.round((subtotal + shipping + tax) * 100) / 100;

  return (
    <div className="cart-page container animate-fade-in">
      <div className="cart-page__header">
        <div className="cart-page__title-group">
          <span className="cart-page__eyebrow">YOUR SELECTION</span>
          <h1 className="cart-page__title">Shopping Bag</h1>
        </div>
        {itemCount > 0 && (
          <span className="cart-page__count">
            {itemCount} {itemCount === 1 ? 'garment' : 'garments'}
          </span>
        )}
      </div>

      {error && (
        <div className="cart-page__error" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="cart-page__empty" role="status">
          <div className="cart-page__empty-icon-box">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h2>Your Bag is Empty</h2>
          <p>You have not added any pieces to your bag yet. Discover our curated collection of timeless essentials.</p>
          <Link to="/catalog" className="cart-page__shop-btn">
            Explore Collection
          </Link>
        </div>
      ) : (
        <div className="cart-page__layout">
          {/* Items Section */}
          <div className="cart-page__items-list">
            <div className="cart-page__list-header">
              <span className="cart-page__list-label">Garment Details</span>
              <button
                type="button"
                className="cart-page__clear-btn"
                onClick={clearCart}
                aria-label="Remove all items from shopping bag"
              >
                Clear Entire Bag
              </button>
            </div>

            <div className="cart-page__items-container" role="table" aria-label="Items in bag">
              {items.map((item) => (
                <CartItemRow
                  key={item.variantSku}
                  item={item}
                  onUpdateQuantity={updateQuantity}
                  onRemove={removeItem}
                />
              ))}
            </div>

            <div className="cart-page__back-link-box">
              <Link to="/catalog" className="cart-page__continue-link">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Continue Browsing Catalog
              </Link>
            </div>
          </div>

          {/* Sticky Order Summary Sidebar */}
          <aside className="cart-page__summary" aria-label="Order summary">
            <h2 className="cart-page__summary-title">Order Summary</h2>

            <div className="cart-page__summary-row">
              <span className="cart-page__summary-label">Subtotal</span>
              <span className="cart-page__summary-val">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>

            <div className="cart-page__summary-row">
              <span className="cart-page__summary-label">Estimated Shipping</span>
              <span className="cart-page__summary-val">
                {shipping === 0 ? <strong className="cart-page__free-tag">COMPLIMENTARY</strong> : `₹${shipping.toLocaleString('en-IN')}`}
              </span>
            </div>

            {shipping > 0 && (
              <div className="cart-page__shipping-note">
                Add <strong>₹{(150 - subtotal).toLocaleString('en-IN')}</strong> more for complimentary shipping.
              </div>
            )}

            <div className="cart-page__summary-row">
              <span className="cart-page__summary-label">Estimated Tax (8%)</span>
              <span className="cart-page__summary-val">₹{tax.toLocaleString('en-IN')}</span>
            </div>

            <div className="cart-page__summary-divider" />

            <div className="cart-page__summary-row cart-page__summary-total">
              <span className="cart-page__total-label">Estimated Total</span>
              <span className="cart-page__total-val">₹{total.toLocaleString('en-IN')}</span>
            </div>

            <Link to="/checkout" className="cart-page__checkout-btn">
              <span>Proceed to Checkout</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>

            <div className="cart-page__reassurance">
              <div className="cart-page__reassurance-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>Encrypted 256-bit SSL Checkout</span>
              </div>
              <div className="cart-page__reassurance-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>30-Day Thoughtful Return Guarantee</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};

export default CartPage;
