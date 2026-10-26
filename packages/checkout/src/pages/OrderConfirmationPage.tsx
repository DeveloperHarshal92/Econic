import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchOrder, OrderResponse } from '../api/checkoutApi';

const OrderConfirmationPage: React.FC = () => {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [order, setOrder] = useState<OrderResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderNumber) return;

    fetchOrder(orderNumber)
      .then((res) => setOrder(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to retrieve order confirmation'))
      .finally(() => setLoading(false));
  }, [orderNumber]);

  if (loading) {
    return (
      <div className="order-confirm container">
        <div className="skeleton order-confirm-skeleton" aria-busy="true" aria-label="Loading confirmation details" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="order-confirm container">
        <div className="order-confirm__card text-center">
          <div className="order-confirm__icon order-confirm__icon--error" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="order-confirm__title">Order Not Found</h2>
          <p className="order-confirm__subtitle">{error || "We could not find records for the specified order reference."}</p>
          <div className="order-confirm__actions">
            <Link to="/" className="checkout-btn checkout-btn--primary">Return Home</Link>
            <Link to="/catalog" className="checkout-btn checkout-btn--secondary">Explore Collection</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="order-confirm container animate-fade-in">
      <div className="order-confirm__card">
        <div className="order-confirm__icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <p className="order-confirm__eyebrow">Payment Confirmed & Verified</p>
        <h1 className="order-confirm__title">Thank you for your order</h1>
        <p className="order-confirm__subtitle">
          Your order <strong className="order-number-tag">#{order.orderNumber}</strong> has been received and is being prepared with artisanal care.
        </p>

        <div className="order-confirm__status-bar">
          <div className="order-status-pill">
            <span className="order-status-label">Order Status:</span>
            <span className="status-confirmed">{order.status.toUpperCase()}</span>
          </div>
          <span className="order-status-divider" aria-hidden="true">•</span>
          <div className="order-status-pill">
            <span className="order-status-label">Payment:</span>
            <span className="status-paid">{order.paymentStatus.toUpperCase()}</span>
          </div>
        </div>

        <div className="order-confirm__details-grid">
          {/* Shipping Address */}
          <div className="order-confirm__section">
            <h2 className="order-confirm__section-title">Shipping Information</h2>
            <div className="order-address-box">
              <p className="order-address-name">{order.shippingAddress.fullName}</p>
              <p className="order-address-line">{order.shippingAddress.line1}</p>
              {order.shippingAddress.line2 && <p className="order-address-line">{order.shippingAddress.line2}</p>}
              <p className="order-address-line">
                {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
              </p>
              <p className="order-address-line">{order.shippingAddress.country}</p>
              {order.shippingAddress.phone && (
                <p className="order-address-phone">Phone: {order.shippingAddress.phone}</p>
              )}
            </div>
          </div>

          {/* Items Summary */}
          <div className="order-confirm__section">
            <h2 className="order-confirm__section-title">Items Ordered</h2>
            <div className="order-confirm__items" role="list">
              {order.items.map((item) => (
                <div key={item.variantSku} className="order-confirm__item-row" role="listitem">
                  <div className="order-confirm__item-meta">
                    <span className="order-confirm__item-name">{item.productName}</span>
                    <span className="order-confirm__item-variant">
                      {item.variantName} × {item.quantity}
                    </span>
                  </div>
                  <span className="order-confirm__item-price">
                    ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>

            <div className="order-confirm__totals">
              <div className="row">
                <span>Subtotal</span>
                <span>₹{order.subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="row">
                <span>Shipping</span>
                <span>{order.shipping === 0 ? 'Complimentary' : `₹${order.shipping.toLocaleString('en-IN')}`}</span>
              </div>
              <div className="row">
                <span>Estimated Tax</span>
                <span>₹{order.tax.toLocaleString('en-IN')}</span>
              </div>
              <div className="row total">
                <span>Total Paid</span>
                <span className="total-amount">₹{order.total.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="order-confirm__actions">
          <Link to="/" className="checkout-btn checkout-btn--primary">
            Return to Homepage
          </Link>
          <Link to="/catalog" className="checkout-btn checkout-btn--secondary">
            Continue Browsing Collection
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;
