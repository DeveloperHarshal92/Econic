import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CartApp from './CartApp';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/cart/*" element={<CartApp />} />
          <Route path="/*" element={<CartApp />} />
        </Routes>
      </BrowserRouter>
    </React.StrictMode>
  );
}
