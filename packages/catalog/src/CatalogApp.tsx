import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProductListPage from './pages/ProductListPage';
import ProductDetailPage from './pages/ProductDetailPage';
import './styles/catalog.css';

/**
 * Catalog Micro-Frontend root component.
 * Exposed via Module Federation as 'catalog/CatalogApp'.
 */
const CatalogApp: React.FC = () => {
  return (
    <div className="catalog-mfe">
      <Routes>
        <Route index element={<ProductListPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path=":slug" element={<ProductDetailPage />} />
      </Routes>
    </div>
  );
};

export default CatalogApp;
