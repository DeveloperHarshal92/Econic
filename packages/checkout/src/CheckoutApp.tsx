import React from 'react';
import { Routes, Route } from 'react-router-dom';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import './styles/checkout.css';

const CheckoutApp: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<CheckoutPage />} />
      <Route path="/confirmation/:orderNumber" element={<OrderConfirmationPage />} />
    </Routes>
  );
};

export default CheckoutApp;
