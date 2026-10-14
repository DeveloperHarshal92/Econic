import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import CartPage from './pages/CartPage';
import './styles/cart.css';

const CartApp: React.FC = () => {
  return (
    <CartProvider>
      <Routes>
        <Route path="/" element={<CartPage />} />
      </Routes>
    </CartProvider>
  );
};

export default CartApp;
