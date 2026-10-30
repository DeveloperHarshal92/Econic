import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CheckoutApp from './CheckoutApp';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/checkout/*" element={<CheckoutApp />} />
          <Route path="/*" element={<CheckoutApp />} />
        </Routes>
      </BrowserRouter>
    </React.StrictMode>
  );
}
