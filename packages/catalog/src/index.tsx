import React from 'react';
import ReactDOM from 'react-dom/client';
import CatalogApp from './CatalogApp';

// Standalone bootstrap for independent development
const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <CatalogApp />
    </React.StrictMode>,
  );
}
