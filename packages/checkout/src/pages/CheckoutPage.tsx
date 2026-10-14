import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  fetchCheckoutCart,
  createOrder,
  confirmPayment,
  ShippingAddressInput,
} from '../api/checkoutApi';
import CheckoutForm from '../components/CheckoutForm';

interface CartData {
  items: Array<{
    productId: string;
    variantSku: string;
    productName: string;
    variantName: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number;
  itemCount: number;
}

const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCheckoutCart()
      .then((res) => setCart(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load bag'))
      .finally(() => setLoading(false));
  }, []);

  const handleOrderSubmit = async (address: ShippingAddressInput) => {
    setSubmitting(true);
    setError(null);
    try {
      // 1. Create order
      const orderRes = await createOrder(address);
      const paymentIntentId = orderRes.data.paymentDetails?.paymentIntentId;

      // 2. Authorize payment
      if (paymentIntentId) {
        await confirmPayment(paymentIntentId);
      }

      // 3. Clear cart counter in Shell header
      window.dispatchEvent(
        new CustomEvent('cart:updated', {
          detail: { itemCount: 0, subtotal: 0 },
        })
      );

      // 4. Redirect to confirmation page
      navigate(`/checkout/confirmation/${orderRes.data.orderNumber}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="checkout-page container">
        <div className="skeleton" style={{ height: '400px', borderRadius: '16px' }} />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="checkout-page container">
        <div className="checkout-page__empty">
          <div className="empty-icon">🛒</div>
          <h2>Your bag is empty</h2>
          <p>Please add products to your shopping bag before proceeding to checkout.</p>
          <Link to="/catalog" className="btn btn--primary">
            Explore Collection
          </Link>
        </div>
      </div>
    );
  }

  const shipping = cart.subtotal > 150 ? 0 : 15.0;
  const tax = Math.round(cart.subtotal * 0.08 * 100) / 100;
  const total = Math.round((cart.subtotal + shipping + tax) * 100) / 100;

  return (
    <div className="checkout-page container animate-fade-in">
      <h1 className="checkout-page__title">Secure Checkout</h1>

      {error && (
        <div className="checkout-page__alert" role="alert">
          {error}
        </div>
      )}

      <div className="checkout-page__layout">
        {/* Form */}
        <div className="checkout-page__form-section">
          <CheckoutForm
            onSubmit={handleOrderSubmit}
            loading={submitting}
            total={total}
          />
        </div>

        {/* Order Summary Sidebar */}
        <aside className="checkout-page__summary" aria-label="Order summary">
          <h2 className="summary-title">Order Summary ({cart.itemCount} items)</h2>

          <div className="summary-items">
            {cart.items.map((item) => (
              <div key={item.variantSku} className="summary-item">
                <div className="summary-item__desc">
                  <span className="summary-item__name">{item.productName}</span>
                  <span className="summary-item__variant">
                    {item.variantName} × {item.quantity}
                  </span>
                </div>
                <span className="summary-item__price">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="summary-totals">
            <div className="row">
              <span>Subtotal</span>
              <span>${cart.subtotal.toFixed(2)}</span>
            </div>
            <div className="row">
              <span>Shipping</span>
              <span>{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
            </div>
            <div className="row">
              <span>Estimated Tax (8%)</span>
              <span>${tax.toFixed(2)}</span>
            </div>
            <div className="row row--total">
              <span>Total</span>
              <span className="total-amount">${total.toFixed(2)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CheckoutPage;
