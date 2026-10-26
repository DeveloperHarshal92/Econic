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
    country: 'India',
    phone: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!address.fullName.trim()) errors.fullName = 'Full name is required';
    if (!address.line1.trim()) errors.line1 = 'Street address is required';
    if (!address.city.trim()) errors.city = 'City is required';
    if (!address.state.trim()) errors.state = 'State / Province is required';
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
        <div className="checkout-form__section-header">
          <span className="checkout-step-number">01</span>
          <h2 className="checkout-form__section-title">Shipping & Delivery Details</h2>
        </div>

        <div className="form-group">
          <label htmlFor="fullName" className="form-label">
            Full Name <span className="form-required" aria-hidden="true">*</span>
          </label>
          <input
            id="fullName"
            type="text"
            className={`form-input ${formErrors.fullName ? 'form-input--error' : ''}`}
            value={address.fullName}
            onChange={(e) => setAddress({ ...address, fullName: e.target.value })}
            placeholder="e.g. Eleanor Vance"
            autoComplete="name"
            required
          />
          {formErrors.fullName && <span className="form-error" role="alert">{formErrors.fullName}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="line1" className="form-label">
            Street Address <span className="form-required" aria-hidden="true">*</span>
          </label>
          <input
            id="line1"
            type="text"
            className={`form-input ${formErrors.line1 ? 'form-input--error' : ''}`}
            value={address.line1}
            onChange={(e) => setAddress({ ...address, line1: e.target.value })}
            placeholder="House/Apartment no., building, street"
            autoComplete="address-line1"
            required
          />
          {formErrors.line1 && <span className="form-error" role="alert">{formErrors.line1}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="line2" className="form-label">
            Apartment, Suite, Unit <span className="form-optional">(Optional)</span>
          </label>
          <input
            id="line2"
            type="text"
            className="form-input"
            value={address.line2 || ''}
            onChange={(e) => setAddress({ ...address, line2: e.target.value })}
            placeholder="Floor, landmark, etc."
            autoComplete="address-line2"
          />
        </div>

        <div className="form-row form-row--three">
          <div className="form-group">
            <label htmlFor="city" className="form-label">
              City <span className="form-required" aria-hidden="true">*</span>
            </label>
            <input
              id="city"
              type="text"
              className={`form-input ${formErrors.city ? 'form-input--error' : ''}`}
              value={address.city}
              onChange={(e) => setAddress({ ...address, city: e.target.value })}
              placeholder="e.g. Mumbai"
              autoComplete="address-level2"
              required
            />
            {formErrors.city && <span className="form-error" role="alert">{formErrors.city}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="state" className="form-label">
              State / Province <span className="form-required" aria-hidden="true">*</span>
            </label>
            <input
              id="state"
              type="text"
              className={`form-input ${formErrors.state ? 'form-input--error' : ''}`}
              value={address.state}
              onChange={(e) => setAddress({ ...address, state: e.target.value })}
              placeholder="e.g. Maharashtra"
              autoComplete="address-level1"
              required
            />
            {formErrors.state && <span className="form-error" role="alert">{formErrors.state}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="postalCode" className="form-label">
              Postal Code <span className="form-required" aria-hidden="true">*</span>
            </label>
            <input
              id="postalCode"
              type="text"
              className={`form-input ${formErrors.postalCode ? 'form-input--error' : ''}`}
              value={address.postalCode}
              onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
              placeholder="e.g. 400001"
              autoComplete="postal-code"
              required
            />
            {formErrors.postalCode && <span className="form-error" role="alert">{formErrors.postalCode}</span>}
          </div>
        </div>

        <div className="form-row form-row--two">
          <div className="form-group">
            <label htmlFor="country" className="form-label">
              Country <span className="form-required" aria-hidden="true">*</span>
            </label>
            <select
              id="country"
              className="form-input form-select"
              value={address.country}
              onChange={(e) => setAddress({ ...address, country: e.target.value })}
              autoComplete="country-name"
            >
              <option value="India">India</option>
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
              Phone Number <span className="form-optional">(For delivery updates)</span>
            </label>
            <input
              id="phone"
              type="tel"
              className="form-input"
              value={address.phone}
              onChange={(e) => setAddress({ ...address, phone: e.target.value })}
              placeholder="+91 98765 43210"
              autoComplete="tel"
            />
          </div>
        </div>
      </div>

      <div className="checkout-form__section">
        <div className="checkout-form__section-header">
          <span className="checkout-step-number">02</span>
          <div>
            <h2 className="checkout-form__section-title">Payment Method</h2>
            <p className="checkout-form__section-subtitle">Official Razorpay Standard Checkout (Sandbox / Test Mode)</p>
          </div>
          <span className="badge badge--secure">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            256-Bit Encrypted
          </span>
        </div>

        <div className="razorpay-method-card">
          <div className="razorpay-method-header">
            <div className="razorpay-indicator" aria-hidden="true">
              <span className="razorpay-indicator-dot" />
            </div>
            <div>
              <p className="razorpay-method-card__title">Razorpay Standard Gateway</p>
              <p className="razorpay-method-card__desc">
                Payment modal securely opens upon clicking below. Authenticated through Razorpay standard checkout supporting major payment instruments with zero real charges in test mode.
              </p>
            </div>
          </div>
          <div className="razorpay-badges-list" aria-label="Supported payment instruments">
            <span className="razorpay-tag">Credit / Debit Cards</span>
            <span className="razorpay-tag">UPI & QR</span>
            <span className="razorpay-tag">NetBanking</span>
            <span className="razorpay-tag">Wallets</span>
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
          <span className="checkout-spinner-label">
            <span className="checkout-spinner" aria-hidden="true" />
            Processing Order...
          </span>
        ) : (
          `Proceed to Pay ₹${total.toLocaleString('en-IN')}`
        )}
      </button>
      
      <p className="checkout-form__disclaimer">
        By placing your order, you agree to VÊTU's Terms of Service and Privacy Policy. All transactions are securely encrypted.
      </p>
    </form>
  );
};

export default CheckoutForm;
