import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CatalogApp from './CatalogApp';

// Standalone bootstrap for independent development
const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/catalog/*" element={<CatalogApp />} />
          <Route path="/*" element={<CatalogApp />} />
        </Routes>
      </BrowserRouter>
    </React.StrictMode>,
  );
}
