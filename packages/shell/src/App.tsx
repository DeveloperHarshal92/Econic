import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingFallback from './components/LoadingFallback';
import HomePage from './pages/HomePage';
import AnalyticsDashboardPage from './pages/AnalyticsDashboardPage';

// Lazy-load Module Federation remotes
const CatalogApp = lazy(() => import('catalog/CatalogApp'));
const CartApp = lazy(() => import('cart/CartApp'));
const CheckoutApp = lazy(() => import('checkout/CheckoutApp'));

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Header />
      <main id="main-content" style={{ minHeight: `calc(100vh - var(--header-height) - 200px)` }}>
        <ErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/catalog/*" element={<CatalogApp />} />
              <Route path="/cart/*" element={<CartApp />} />
              <Route path="/checkout/*" element={<CheckoutApp />} />
              <Route path="/analytics" element={<AnalyticsDashboardPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer />
    </BrowserRouter>
  );
};

export default App;
