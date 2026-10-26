import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  fetchCheckoutCart,
  createOrder,
  verifyPayment,
  loadRazorpayScript,
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

    // Preload Razorpay checkout SDK
    loadRazorpayScript().catch(() => {
      // Ignored; handleOrderSubmit will also check
    });
  }, []);

  const handleOrderSubmit = async (address: ShippingAddressInput) => {
    setSubmitting(true);
    setError(null);

    try {
      // 1. Create order and obtain Razorpay order details from server
      const orderRes = await createOrder(address);
      const orderData = orderRes.data;

      const razorpayOrderId = orderData.paymentDetails?.razorpayOrderId;
      const keyId = orderData.razorpayKeyId;
      const amountPaise = orderData.paymentDetails?.amountPaise || Math.round(orderData.total * 100);
      const currency = orderData.paymentDetails?.currency || 'INR';

      if (!razorpayOrderId) {
        throw new Error('Failed to obtain Razorpay order identifier from server');
      }

      // 2. Ensure Razorpay script is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !(window as any).Razorpay) {
        throw new Error('Failed to load Razorpay payment SDK. Please check your internet connection.');
      }

      // 3. Configure Razorpay Standard Checkout options
      const options = {
        key: keyId,
        amount: amountPaise,
        currency,
        name: 'VÊTU',
        description: `Order #${orderData.orderNumber}`,
        order_id: razorpayOrderId,
        prefill: {
          name: address.fullName,
          contact: address.phone || '',
        },
        notes: {
          orderNumber: orderData.orderNumber,
        },
        theme: {
          color: '#12372B', // VÊTU Forest Green
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            setSubmitting(true);
            // 4. Secure server-side signature verification
            await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            // 5. Clear cart counter in Shell header
            window.dispatchEvent(
              new CustomEvent('cart:updated', {
                detail: { itemCount: 0, subtotal: 0 },
              })
            );

            // 6. Redirect to confirmation page
            navigate(`/checkout/confirmation/${orderData.orderNumber}`);
          } catch (verifyErr) {
            setError(
              verifyErr instanceof Error
                ? verifyErr.message
                : 'Payment verification failed. Please contact support.'
            );
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
            setError('Payment process was cancelled or closed. You can retry whenever you are ready.');
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (failedResponse: any) => {
        setSubmitting(false);
        const reason = failedResponse?.error?.description || 'Payment failed. Please try again.';
        setError(reason);
      });

      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="checkout-page container">
        <div className="checkout-skeleton-grid" aria-busy="true" aria-label="Loading checkout details">
          <div className="skeleton checkout-skeleton-form" />
          <div className="skeleton checkout-skeleton-sidebar" />
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="checkout-page container">
        <div className="checkout-page__empty">
          <div className="checkout-empty-icon" aria-hidden="true">
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h2 className="checkout-empty-title">Your shopping bag is empty</h2>
          <p className="checkout-empty-desc">
            Please add an item from our curated collection before proceeding to checkout.
          </p>
          <Link to="/catalog" className="checkout-btn checkout-btn--primary">
            Explore Collection
          </Link>
        </div>
      </div>
    );
  }

  // Authoritative server calculation formulas preserved identically
  const shipping = cart.subtotal > 150 ? 0 : 15.0;
  const tax = Math.round(cart.subtotal * 0.08 * 100) / 100;
  const total = Math.round((cart.subtotal + shipping + tax) * 100) / 100;

  return (
    <div className="checkout-page container animate-fade-in">
      <header className="checkout-page__header">
        <div className="checkout-page__breadcrumbs">
          <Link to="/catalog">Collection</Link>
          <span className="breadcrumb-separator">/</span>
          <Link to="/cart">Shopping Bag</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Checkout</span>
        </div>
        <h1 className="checkout-page__title">Checkout & Finalize</h1>
        <p className="checkout-page__subtitle">
          Complete your delivery details to initiate standard encrypted payment.
        </p>
      </header>

      {error && (
        <div className="checkout-page__alert" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div className="checkout-page__layout">
        {/* Form Section */}
        <section className="checkout-page__form-section" aria-label="Customer and delivery details">
          <CheckoutForm
            onSubmit={handleOrderSubmit}
            loading={submitting}
            total={total}
          />
        </section>

        {/* Order Summary Sidebar */}
        <aside className="checkout-page__summary" aria-label="Order summary">
          <div className="summary-header">
            <h2 className="summary-title">Order Summary</h2>
            <span className="summary-count">
              {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="summary-items" role="list">
            {cart.items.map((item) => (
              <div key={item.variantSku} className="summary-item" role="listitem">
                <div className="summary-item__desc">
                  <span className="summary-item__name">{item.productName}</span>
                  <span className="summary-item__variant">
                    {item.variantName} <span className="summary-item__qty">× {item.quantity}</span>
                  </span>
                </div>
                <span className="summary-item__price">
                  ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                </span>
              </div>
            ))}
          </div>

          <div className="summary-totals">
            <div className="summary-row">
              <span className="summary-row__label">Subtotal</span>
              <span className="summary-row__value">₹{cart.subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Shipping</span>
              <span className="summary-row__value">
                {shipping === 0 ? (
                  <span className="summary-free-shipping">Complimentary</span>
                ) : (
                  `₹${shipping.toLocaleString('en-IN')}`
                )}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-row__label">Estimated Tax (8%)</span>
              <span className="summary-row__value">₹{tax.toLocaleString('en-IN')}</span>
            </div>
            <div className="summary-row summary-row--total">
              <span className="summary-row__label">Total Payable</span>
              <span className="summary-row__value summary-row__value--total">
                ₹{total.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="summary-assurance">
            <div className="assurance-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Authenticity & Secure Delivery</span>
            </div>
            <div className="assurance-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span>Complimentary 14-Day Returns</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CheckoutPage;
