import React, { useState } from 'react';
import { ShippingAddressInput } from '../api/checkoutApi';

interface CheckoutFormProps {
  onSubmit: (address: ShippingAddressInput) => void;
  loading: boolean;
  total: number;
}

const CheckoutForm: React.FC<CheckoutFormProps> = ({ onSubmit, loading, total }) => {
  const [address, setAddress] = useState<ShippingAddressInput>({
    fullName: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    phone: '',
  });

  const [cardDetails] = useState({
    cardNumber: '4242 •••• •••• 4242',
    expDate: '12/28',
    cvc: '•••',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!address.fullName.trim()) errors.fullName = 'Full name is required';
    if (!address.line1.trim()) errors.line1 = 'Address line 1 is required';
    if (!address.city.trim()) errors.city = 'City is required';
    if (!address.state.trim()) errors.state = 'State is required';
    if (!address.postalCode.trim()) errors.postalCode = 'Postal code is required';
    if (!address.country.trim()) errors.country = 'Country is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(address);
    }
  };

  return (
    <form className="checkout-form" onSubmit={handleSubmit} noValidate>
      <div className="checkout-form__section">
        <h2 className="checkout-form__section-title">1. Shipping Address</h2>

        <div className="form-group">
          <label htmlFor="fullName" className="form-label">
            Full Name *
          </label>
          <input
            id="fullName"
            type="text"
            className={`form-input ${formErrors.fullName ? 'form-input--error' : ''}`}
            value={address.fullName}
            onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
            placeholder="John Doe"
            required
          />
          {formErrors.fullName && <span className="form-error">{formErrors.fullName}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="line1" className="form-label">
            Street Address *
          </label>
          <input
            id="line1"
            type="text"
            className={`form-input ${formErrors.line1 ? 'form-input--error' : ''}`}
            value={address.line1}
            onChange={(e) => setAddress({ ...address, line1: e.target.value })}
            placeholder="123 Luxury Way, Apt 4B"
            required
          />
          {formErrors.line1 && <span className="form-error">{formErrors.line1}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="city" className="form-label">
              City *
            </label>
            <input
              id="city"
              type="text"
              className={`form-input ${formErrors.city ? 'form-input--error' : ''}`}
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
              placeholder="New York"
              required
            />
            {formErrors.city && <span className="form-error">{formErrors.city}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="state" className="form-label">
              State / Province *
            </label>
            <input
              id="state"
              type="text"
              className={`form-input ${formErrors.state ? 'form-input--error' : ''}`}
              value={address.state}
              onChange={(e) => setAddress({ ...address, state: e.target.value })}
              placeholder="NY"
              required
            />
            {formErrors.state && <span className="form-error">{formErrors.state}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="postalCode" className="form-label">
              Postal Code *
            </label>
            <input
              id="postalCode"
              type="text"
              className={`form-input ${formErrors.postalCode ? 'form-input--error' : ''}`}
              value={address.postalCode}
              onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
              placeholder="10001"
              required
            />
            {formErrors.postalCode && <span className="form-error">{formErrors.postalCode}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="country" className="form-label">
              Country *
            </label>
            <select
              id="country"
              className="form-input"
              value={address.country}
              onChange={(e) => setAddress({ ...address, country: e.target.value })}
            >
              <option value="United States">United States</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="France">France</option>
              <option value="Germany">Germany</option>
              <option value="Canada">Canada</option>
              <option value="Japan">Japan</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="phone" className="form-label">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              className="form-input"
              value={address.phone}
              onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
            />
          </div>
        </div>
      </div>

      <div className="checkout-form__section">
        <div className="checkout-form__section-header">
          <h2 className="checkout-form__section-title">2. Payment Method</h2>
          <span className="badge badge--stripe">🔒 Stripe Secure Test Mode</span>
        </div>

        <div className="card-mock-input">
          <div className="form-group">
            <label htmlFor="cardNumber" className="form-label">Card Number</label>
            <input
              id="cardNumber"
              type="text"
              className="form-input font-mono"
              value={cardDetails.cardNumber}
              disabled
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="expDate" className="form-label">Expires</label>
              <input
                id="expDate"
                type="text"
                className="form-input font-mono"
                value={cardDetails.expDate}
                disabled
              />
            </div>
            <div className="form-group">
              <label htmlFor="cvc" className="form-label">CVC</label>
              <input
                id="cvc"
                type="text"
                className="form-input font-mono"
                value={cardDetails.cvc}
                disabled
              />
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="checkout-form__submit-btn"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <span className="spinner" />
        ) : (
          `Authorize & Pay $${total.toFixed(2)}`
        )}
      </button>
    </form>
  );
};

export default CheckoutForm;
