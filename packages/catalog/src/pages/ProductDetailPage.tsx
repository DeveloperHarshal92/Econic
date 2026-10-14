import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchProductBySlug, Product } from '../api/productApi';

const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    fetchProductBySlug(slug)
      .then((res) => {
        setProduct(res.data);
        setSelectedVariant(0);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load product');
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="product-detail container" aria-busy="true">
        <div className="product-detail__skeleton">
          <div className="skeleton" style={{ height: '500px', borderRadius: 'var(--radius-xl)' }} />
          <div>
            <div className="skeleton" style={{ height: '40px', width: '60%', marginBottom: '16px' }} />
            <div className="skeleton" style={{ height: '20px', width: '30%', marginBottom: '24px' }} />
            <div className="skeleton" style={{ height: '100px', marginBottom: '24px' }} />
            <div className="skeleton" style={{ height: '48px', width: '200px' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="product-detail container">
        <div className="product-list__error" role="alert">
          <p className="product-list__error-icon">😞</p>
          <h2>Product not found</h2>
          <p>{error || "The product you're looking for doesn't exist."}</p>
          <Link to="/catalog" className="product-list__retry-btn">
            Back to Catalog
          </Link>
        </div>
      </div>
    );
  }

  const variant = product.variants[selectedVariant]!;
  const primaryImage = product.images.find((i) => i.isPrimary) || product.images[0];
  const hasDiscount = variant.compareAtPrice && variant.compareAtPrice > variant.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - variant.price / variant.compareAtPrice!) * 100)
    : 0;

  return (
    <div className="product-detail container animate-fade-in">
      {/* Breadcrumb */}
      <nav className="product-detail__breadcrumb" aria-label="Breadcrumb">
        <Link to="/catalog">Catalog</Link>
        <span className="product-detail__breadcrumb-sep">/</span>
        <Link to={`/catalog?category=${product.category}`}>{product.category}</Link>
        <span className="product-detail__breadcrumb-sep">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="product-detail__layout">
        {/* Image */}
        <div className="product-detail__image-section">
          <div className="product-detail__image-wrapper">
            {hasDiscount && (
              <span className="product-detail__discount-badge">
                -{discountPercent}%
              </span>
            )}
            {primaryImage ? (
              <img
                src={primaryImage.url}
                alt={primaryImage.alt}
                className="product-detail__image"
                loading="lazy"
              />
            ) : (
              <div className="product-detail__no-image">
                <span>No Image</span>
              </div>
            )}
          </div>

          {/* Thumbnail Gallery */}
          {product.images.length > 1 && (
            <div className="product-detail__thumbs" role="list">
              {product.images.map((img, i) => (
                <img
                  key={i}
                  src={img.url}
                  alt={img.alt}
                  className="product-detail__thumb"
                  loading="lazy"
                />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="product-detail__info">
          <span className="product-detail__category">{product.category}</span>
          <h1 className="product-detail__name">{product.name}</h1>

          {/* Price */}
          <div className="product-detail__price-row">
            <span className="product-detail__price">
              ${variant.price.toFixed(2)}
            </span>
            {hasDiscount && (
              <span className="product-detail__compare-price">
                ${variant.compareAtPrice!.toFixed(2)}
              </span>
            )}
          </div>

          {/* Variants */}
          <div className="product-detail__variants" role="radiogroup" aria-label="Select variant">
            <p className="product-detail__variants-label">Variant</p>
            <div className="product-detail__variant-options">
              {product.variants.map((v, i) => (
                <button
                  key={v.sku}
                  className={`product-detail__variant-btn ${i === selectedVariant ? 'product-detail__variant-btn--active' : ''} ${!v.isAvailable ? 'product-detail__variant-btn--disabled' : ''}`}
                  onClick={() => v.isAvailable && setSelectedVariant(i)}
                  disabled={!v.isAvailable}
                  role="radio"
                  aria-checked={i === selectedVariant}
                  aria-label={v.name}
                >
                  {v.name}
                  {!v.isAvailable && <span className="sr-only"> (Out of stock)</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Stock Status */}
          <div className="product-detail__stock">
            {variant.isAvailable ? (
              <span className="product-detail__stock--in">
                ✓ In Stock ({variant.inventory} available)
              </span>
            ) : (
              <span className="product-detail__stock--out">
                ✕ Out of Stock
              </span>
            )}
          </div>

          {/* Add to Cart */}
          <button
            className={`product-detail__add-to-cart ${added ? 'product-detail__add-to-cart--added' : ''}`}
            disabled={!variant.isAvailable || added}
            onClick={() => {
              if (!variant.isAvailable || !product) return;
              window.dispatchEvent(
                new CustomEvent('cart:add', {
                  detail: {
                    productId: product.id,
                    variantSku: variant.sku,
                    quantity: 1,
                  },
                })
              );
              setAdded(true);
              setTimeout(() => setAdded(false), 2000);
            }}
            aria-label={`Add ${product.name} - ${variant.name} to cart`}
          >
            {added ? '✓ Added to Bag!' : variant.isAvailable ? 'Add to Cart' : 'Sold Out'}
          </button>

          {/* Description */}
          <div className="product-detail__description">
            <h2 className="product-detail__desc-title">Description</h2>
            <p>{product.description}</p>
          </div>

          {/* SKU & Tags */}
          <div className="product-detail__meta">
            <p><strong>SKU:</strong> {variant.sku}</p>
            {product.tags.length > 0 && (
              <div className="product-detail__tags">
                {product.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/catalog?search=${tag}`}
                    className="product-detail__tag"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
