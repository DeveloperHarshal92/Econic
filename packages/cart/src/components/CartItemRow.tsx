import React from 'react';
import { CartItemDto } from '../api/cartApi';

interface CartItemRowProps {
  item: CartItemDto;
  onUpdateQuantity: (sku: string, quantity: number) => void;
  onRemove: (sku: string) => void;
}

const CartItemRow: React.FC<CartItemRowProps> = ({ item, onUpdateQuantity, onRemove }) => {
  return (
    <div className="cart-item" role="row">
      <div className="cart-item__image-container">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.productName} className="cart-item__image" />
        ) : (
          <div className="cart-item__no-image">{item.productName.charAt(0)}</div>
        )}
      </div>

      <div className="cart-item__details">
        <h4 className="cart-item__name">{item.productName}</h4>
        <span className="cart-item__variant">{item.variantName}</span>
        <span className="cart-item__price">${item.price.toFixed(2)}</span>
      </div>

      <div className="cart-item__actions">
        <div className="cart-item__quantity-controls" role="group" aria-label="Adjust quantity">
          <button
            type="button"
            className="cart-item__qty-btn"
            onClick={() => onUpdateQuantity(item.variantSku, item.quantity - 1)}
            disabled={item.quantity <= 1}
            aria-label="Decrease quantity"
          >
            -
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
            +
          </button>
        </div>

        <span className="cart-item__total-price">
          ${(item.price * item.quantity).toFixed(2)}
        </span>

        <button
          type="button"
          className="cart-item__remove-btn"
          onClick={() => onRemove(item.variantSku)}
          aria-label={`Remove ${item.productName} from cart`}
        >
          🗑️
        </button>
      </div>
    </div>
  );
};

export default CartItemRow;
