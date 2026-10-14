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
      {/* Page Header */}
      <div className="product-list__header">
        <div>
          <h1 className="product-list__title">
            {category || 'All Products'}
          </h1>
          {meta && (
            <p className="product-list__count">
              {meta.total} {meta.total === 1 ? 'product' : 'products'}
            </p>
          )}
        </div>

        {/* Sort */}
        <div className="product-list__sort">
          <label htmlFor="sort-select" className="sr-only">Sort products</label>
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
            <option value="name:asc">Name A–Z</option>
            <option value="name:desc">Name Z–A</option>
            <option value="price:asc">Price: Low → High</option>
            <option value="price:desc">Price: High → Low</option>
          </select>
        </div>
      </div>

      {/* Filters Row */}
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

      {/* Active Filters */}
      {(search || category) && (
        <div className="product-list__active-filters" role="status">
          {search && (
            <span className="product-list__filter-tag">
              Search: "{search}"
              <button
                onClick={() => updateParams({ search: '' })}
                aria-label="Clear search filter"
              >
                ×
              </button>
            </span>
          )}
          {category && (
            <span className="product-list__filter-tag">
              {category}
              <button
                onClick={() => updateParams({ category: '' })}
                aria-label={`Remove ${category} filter`}
              >
                ×
              </button>
            </span>
          )}
          <button
            className="product-list__clear-all"
            onClick={() => setSearchParams(new URLSearchParams())}
          >
            Clear All
          </button>
        </div>
      )}

      {/* Content */}
      {error ? (
        <div className="product-list__error" role="alert">
          <p className="product-list__error-icon">😞</p>
          <h2>Failed to load products</h2>
          <p>{error}</p>
          <button
            className="product-list__retry-btn"
            onClick={loadProducts}
          >
            Try Again
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
          <p className="product-list__empty-icon">🔍</p>
          <h2>No products found</h2>
          <p>Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <div className="product-list__grid" role="list">
            {products.map((product, index) => (
              <ProductCard
                key={product.id}
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
