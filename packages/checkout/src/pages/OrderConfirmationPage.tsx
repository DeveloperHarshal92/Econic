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
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to fetch order'))
      .finally(() => setLoading(false));
  }, [orderNumber]);

  if (loading) {
    return (
      <div className="order-confirm container">
        <div className="skeleton" style={{ height: '300px', borderRadius: '16px' }} />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="order-confirm container">
        <div className="order-confirm__card text-center">
          <h2>Order Not Found</h2>
          <p>{error || "We couldn't retrieve your order details."}</p>
          <Link to="/" className="btn btn--primary">Return Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="order-confirm container animate-fade-in">
      <div className="order-confirm__card">
        <div className="order-confirm__icon">✓</div>
        <h1 className="order-confirm__title">Thank You for Your Order!</h1>
        <p className="order-confirm__subtitle">
          Your order <strong>#{order.orderNumber}</strong> has been received and confirmed.
        </p>

        <div className="order-confirm__status-badge">
          Status: <span className="status-confirmed">{order.status.toUpperCase()}</span> | Payment: <span className="status-paid">{order.paymentStatus.toUpperCase()}</span>
        </div>

        <div className="order-confirm__details-grid">
          {/* Shipping Address */}
          <div className="order-confirm__section">
            <h3>Shipping Details</h3>
            <p><strong>{order.shippingAddress.fullName}</strong></p>
            <p>{order.shippingAddress.line1}</p>
            {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
            </p>
            <p>{order.shippingAddress.country}</p>
          </div>

          {/* Items Summary */}
          <div className="order-confirm__section">
            <h3>Items Purchased</h3>
            <div className="order-confirm__items">
              {order.items.map((item) => (
                <div key={item.variantSku} className="order-confirm__item-row">
                  <div>
                    <span className="order-confirm__item-name">{item.productName}</span>
                    <span className="order-confirm__item-variant">({item.variantName} × {item.quantity})</span>
                  </div>
                  <span className="order-confirm__item-price">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="order-confirm__totals">
              <div className="row">
                <span>Subtotal:</span>
                <span>${order.subtotal.toFixed(2)}</span>
              </div>
              <div className="row">
                <span>Shipping:</span>
                <span>{order.shipping === 0 ? 'FREE' : `$${order.shipping.toFixed(2)}`}</span>
              </div>
              <div className="row">
                <span>Tax:</span>
                <span>${order.tax.toFixed(2)}</span>
              </div>
              <div className="row total">
                <span>Total Paid:</span>
                <span>${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="order-confirm__actions">
          <Link to="/" className="btn btn--primary">
            Back to Home
          </Link>
          <Link to="/catalog" className="btn btn--secondary">
            Continue Browsing
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;
