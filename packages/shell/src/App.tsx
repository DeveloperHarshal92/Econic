import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingFallback from './components/LoadingFallback';
import HomePage from './pages/HomePage';
import AnalyticsDashboardPage from './pages/AnalyticsDashboardPage';

// Resilient lazy loader for Module Federation remotes
function retryLazy<T extends React.ComponentType<any>>(
  fn: () => Promise<{ default: T }>,
  retries = 2,
  interval = 800
): Promise<{ default: T }> {
  return new Promise((resolve, reject) => {
    fn()
      .then(resolve)
      .catch((error) => {
        if (retries <= 0) {
          reject(error);
          return;
        }
        setTimeout(() => {
          retryLazy(fn, retries - 1, interval).then(resolve, reject);
        }, interval);
      });
  });
}

// Lazy-load Module Federation remotes with resilience
const CatalogApp = lazy(() => retryLazy(() => import('catalog/CatalogApp')));
const CartApp = lazy(() => retryLazy(() => import('cart/CartApp')));
const CheckoutApp = lazy(() => retryLazy(() => import('checkout/CheckoutApp')));

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
