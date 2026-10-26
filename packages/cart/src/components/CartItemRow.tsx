import React from 'react';
import { CartItemDto } from '../api/cartApi';

interface CartItemRowProps {
  item: CartItemDto;
  onUpdateQuantity: (sku: string, quantity: number) => void;
  onRemove: (sku: string) => void;
}

const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22800%22%20viewBox%3D%220%200%20600%20800%22%3E%3Crect%20fill%3D%22%23EFECE6%22%20width%3D%22600%22%20height%3D%22800%22%2F%3E%3Ctext%20fill%3D%22%2377766F%22%20font-family%3D%22sans-serif%22%20font-size%3D%2224%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%3EV%C3%8ATU%20COLLECTION%3C%2Ftext%3E%3C%2Fsvg%3E";

const CartItemRow: React.FC<CartItemRowProps> = ({ item, onUpdateQuantity, onRemove }) => {
  return (
    <div className="cart-item" role="row">
      <div className="cart-item__image-container">
        <img
          src={item.imageUrl || FALLBACK_IMAGE}
          alt={item.productName}
          className="cart-item__image"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
          }}
        />
      </div>

      <div className="cart-item__details">
        <h3 className="cart-item__name">{item.productName}</h3>
        <span className="cart-item__variant">Variant: {item.variantName}</span>
        <span className="cart-item__sku">SKU: {item.variantSku}</span>
        <span className="cart-item__unit-price">₹{item.price.toLocaleString('en-IN')} each</span>
      </div>

      <div className="cart-item__actions">
        {/* Quantity Stepper */}
        <div className="cart-item__quantity-controls" role="group" aria-label={`Adjust quantity for ${item.productName}`}>
          <button
            type="button"
            className="cart-item__qty-btn"
            onClick={() => onUpdateQuantity(item.variantSku, item.quantity - 1)}
            disabled={item.quantity <= 1}
            aria-label="Decrease quantity"
          >
            <svg width="10" height="2" viewBox="0 0 10 2" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="0" y1="1" x2="10" y2="1" />
            </svg>
          </button>
          <span className="cart-item__qty-display" aria-live="polite">
            {item.quantity}
          </span>
          <button
            type="button"
            className="cart-item__qty-btn"
            onClick={() => onUpdateQuantity(item.variantSku, item.quantity + 1)}
            aria-label="Increase quantity"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="0" x2="5" y2="10" />
              <line x1="0" y1="5" x2="10" y2="5" />
            </svg>
          </button>
        </div>

        {/* Line Total */}
        <span className="cart-item__total-price">
          ₹{(item.price * item.quantity).toLocaleString('en-IN')}
        </span>

        {/* Remove Action */}
        <button
          type="button"
          className="cart-item__remove-btn"
          onClick={() => onRemove(item.variantSku)}
          aria-label={`Remove ${item.productName} from shopping bag`}
          title="Remove item"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default CartItemRow;
