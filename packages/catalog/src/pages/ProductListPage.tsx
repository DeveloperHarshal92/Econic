import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchProducts, fetchCategories, Product, PaginationMeta } from '../api/productApi';
import ProductCard from '../components/ProductCard';
import SearchBar from '../components/SearchBar';
import CategoryFilter from '../components/CategoryFilter';
import Pagination from '../components/Pagination';
import ProductSkeleton from '../components/ProductSkeleton';
import '../styles/catalog.css';

const ProductListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read filter state from URL params
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = searchParams.get('sortOrder') || 'desc';

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchProducts({
        page,
        limit: 12,
        search: search || undefined,
        category: category || undefined,
        sortBy,
        sortOrder,
      });
      setProducts(result.data);
      setMeta(result.meta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load products';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, search, category, sortBy, sortOrder]);

  const loadCategories = useCallback(async () => {
    try {
      const result = await fetchCategories();
      setCategories(result.data);
    } catch {
      // Non-critical — categories can fail silently
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const updateParams = (updates: Record<string, string>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    // Reset to page 1 when filters change
    if (!updates.page) {
      newParams.delete('page');
    }
    setSearchParams(newParams);
  };

  return (
    <section className="product-list container" aria-label="Product catalog">
      {/* Editorial Page Header */}
      <div className="product-list__header">
        <div className="product-list__heading-group">
          <span className="product-list__eyebrow">COLLECTION ARCHIVE</span>
          <h1 className="product-list__title">
            {category || 'All Garments & Essentials'}
          </h1>
          {meta && (
            <p className="product-list__count">
              {meta.total === 0
                ? '0 curated pieces'
                : meta.totalPages > 1
                ? `Showing ${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)} of ${meta.total} curated pieces`
                : `Showing ${meta.total} ${meta.total === 1 ? 'curated piece' : 'curated pieces'}`}
            </p>
          )}
        </div>

        {/* Sort Controls */}
        <div className="product-list__sort">
          <label htmlFor="sort-select" className="product-list__sort-label">Sort by</label>
          <div className="product-list__select-wrap">
            <select
              id="sort-select"
              className="product-list__sort-select"
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split(':');
                updateParams({ sortBy: sb!, sortOrder: so! });
              }}
            >
              <option value="createdAt:desc">Newest First</option>
              <option value="createdAt:asc">Oldest First</option>
              <option value="name:asc">Name: A to Z</option>
              <option value="name:desc">Name: Z to A</option>
              <option value="price:asc">Price: Low to High</option>
              <option value="price:desc">Price: High to Low</option>
            </select>
            <svg className="product-list__select-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {/* Filters & Search Row */}
      <div className="product-list__filters">
        <SearchBar
          value={search}
          onChange={(value) => updateParams({ search: value })}
        />
        <CategoryFilter
          categories={categories}
          selected={category}
          onChange={(value) => updateParams({ category: value })}
        />
      </div>

      {/* Active Filter Chips */}
      {(search || category) && (
        <div className="product-list__active-filters" role="status">
          <span className="product-list__active-label">Active Filters:</span>
          {search && (
            <span className="product-list__filter-tag">
              Search: "{search}"
              <button
                type="button"
                onClick={() => updateParams({ search: '' })}
                aria-label="Clear search filter"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          )}
          {category && (
            <span className="product-list__filter-tag">
              {category}
              <button
                type="button"
                onClick={() => updateParams({ category: '' })}
                aria-label={`Remove ${category} filter`}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          )}
          <button
            type="button"
            className="product-list__clear-all"
            onClick={() => setSearchParams(new URLSearchParams())}
          >
            Clear All
          </button>
        </div>
      )}

      {/* Content States */}
      {error ? (
        <div className="product-list__error" role="alert">
          <div className="product-list__error-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2>Unable to Load Collection</h2>
          <p>{error}</p>
          <button
            type="button"
            className="product-list__retry-btn"
            onClick={loadProducts}
          >
            Retry Connection
          </button>
        </div>
      ) : loading ? (
        <div className="product-list__grid" aria-busy="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="product-list__empty" role="status">
          <div className="product-list__empty-icon-box">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h2>No Pieces Found</h2>
          <p>No garments match your current selection. Try broadening your search or resetting filters.</p>
          <button
            type="button"
            className="product-list__reset-btn"
            onClick={() => setSearchParams(new URLSearchParams())}
          >
            View All Products
          </button>
        </div>
      ) : (
        <>
          <div className="product-list__grid" role="list">
            {products.map((product, index) => (
              <ProductCard
                key={product.id || product.slug || `product-${index}`}
                product={product}
                index={index}
              />
            ))}
          </div>

          {meta && meta.totalPages > 1 && (
            <Pagination
              meta={meta}
              onPageChange={(p) => updateParams({ page: String(p) })}
            />
          )}
        </>
      )}
    </section>
  );
};

export default ProductListPage;
