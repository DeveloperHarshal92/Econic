import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import CatalogApp from './CatalogApp';

// Standalone bootstrap for independent development
const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <CatalogApp />
      </BrowserRouter>
    </React.StrictMode>,
  );
}
