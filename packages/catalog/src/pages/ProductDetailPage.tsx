import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchProduct, Product } from '../api/productApi';
import { addToCart } from '../api/cartApi';

const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22800%22%20viewBox%3D%220%200%20600%20800%22%3E%3Crect%20fill%3D%22%23EFECE6%22%20width%3D%22600%22%20height%3D%22800%22%2F%3E%3Ctext%20fill%3D%22%2377766F%22%20font-family%3D%22sans-serif%22%20font-size%3D%2224%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%3EV%C3%8ATU%20COLLECTION%3C%2Ftext%3E%3C%2Fsvg%3E";

const ProductDetailPage: React.FC = () => {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const identifier = id || slug;

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);

  useEffect(() => {
    if (!identifier) return;
    setLoading(true);
    setError(null);

    fetchProduct(identifier)
      .then((res) => {
        setProduct(res.data);
        setSelectedVariant(0);
        setActiveImageIndex(0);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load product');
      })
      .finally(() => setLoading(false));
  }, [identifier]);

  if (loading) {
    return (
      <div className="product-detail container" aria-busy="true">
        <div className="product-detail__skeleton">
          <div className="skeleton" style={{ height: '560px', borderRadius: 'var(--radius-sm)' }} />
          <div>
            <div className="skeleton" style={{ height: '24px', width: '30%', marginBottom: '16px' }} />
            <div className="skeleton" style={{ height: '40px', width: '70%', marginBottom: '16px' }} />
            <div className="skeleton" style={{ height: '28px', width: '40%', marginBottom: '24px' }} />
            <div className="skeleton" style={{ height: '120px', marginBottom: '24px' }} />
            <div className="skeleton" style={{ height: '48px', width: '100%' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="product-detail container">
        <div className="product-list__error" role="alert">
          <div className="product-list__error-icon-box">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2>Piece Not Found</h2>
          <p>{error || "The requested garment could not be found in the current archive."}</p>
          <Link to="/catalog" className="product-list__retry-btn">
            Return to Catalog
          </Link>
        </div>
      </div>
    );
  }

  const variant = product.variants[selectedVariant] || product.variants[0];
  const currentImages = product.images.length > 0 ? product.images : [{ url: FALLBACK_IMAGE, alt: product.name, isPrimary: true }];
  const displayedImage = currentImages[activeImageIndex] || currentImages[0];
  const hasDiscount = Boolean(variant?.compareAtPrice && variant.compareAtPrice > variant.price);
  const discountPercent = hasDiscount && variant?.compareAtPrice
    ? Math.round(((variant.compareAtPrice - variant.price) / variant.compareAtPrice) * 100)
    : 0;

  return (
    <div className="product-detail container animate-fade-in">
      {/* Editorial Breadcrumb */}
      <nav className="product-detail__breadcrumb" aria-label="Breadcrumb">
        <Link to="/" className="product-detail__breadcrumb-link">Home</Link>
        <span className="product-detail__breadcrumb-sep" aria-hidden="true">/</span>
        <Link to="/catalog" className="product-detail__breadcrumb-link">Catalog</Link>
        <span className="product-detail__breadcrumb-sep" aria-hidden="true">/</span>
        <Link to={`/catalog?category=${encodeURIComponent(product.category)}`} className="product-detail__breadcrumb-link">{product.category}</Link>
        <span className="product-detail__breadcrumb-sep" aria-hidden="true">/</span>
        <span className="product-detail__breadcrumb-current" aria-current="page">{product.name}</span>
      </nav>

      <div className="product-detail__layout">
        {/* Gallery Section */}
        <div className="product-detail__image-section">
          <div className="product-detail__image-wrapper">
            {hasDiscount && (
              <span className="product-detail__discount-badge">
                -{discountPercent}%
              </span>
            )}
            <img
              src={displayedImage?.url || FALLBACK_IMAGE}
              alt={displayedImage?.alt || product.name}
              className="product-detail__image"
              loading="eager"
              onError={(e) => {
                (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
              }}
            />
          </div>

          {/* Thumbnail Strip */}
          {currentImages.length > 1 && (
            <div className="product-detail__thumbs" role="list" aria-label="Product thumbnails">
              {currentImages.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  className={`product-detail__thumb-btn ${i === activeImageIndex ? 'product-detail__thumb-btn--active' : ''}`}
                  onClick={() => setActiveImageIndex(i)}
                  aria-label={`View image ${i + 1}`}
                >
                  <img
                    src={img.url}
                    alt={img.alt || `${product.name} view ${i + 1}`}
                    className="product-detail__thumb"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details Sidebar */}
        <div className="product-detail__info">
          <div className="product-detail__meta-top">
            <span className="product-detail__category">{product.category}</span>
            <span className="product-detail__sku-tag">SKU: {variant?.sku}</span>
          </div>

          <h1 className="product-detail__name">{product.name}</h1>

          {/* Pricing in INR */}
          <div className="product-detail__price-row">
            <span className="product-detail__price">
              ₹{(variant?.price ?? 0).toLocaleString('en-IN')}
            </span>
            {hasDiscount && variant?.compareAtPrice && (
              <span className="product-detail__compare-price">
                ₹{variant.compareAtPrice.toLocaleString('en-IN')}
              </span>
            )}
          </div>

          {/* Variants Selector */}
          {product.variants.length > 0 && (
            <div className="product-detail__variants" role="radiogroup" aria-label="Select variant">
              <div className="product-detail__variants-header">
                <span className="product-detail__variants-label">Select Option</span>
                <span className="product-detail__variants-current">{variant?.name}</span>
              </div>
              <div className="product-detail__variant-options">
                {product.variants.map((v, i) => (
                  <button
                    key={v.sku}
                    type="button"
                    className={`product-detail__variant-btn ${i === selectedVariant ? 'product-detail__variant-btn--active' : ''} ${!v.isAvailable ? 'product-detail__variant-btn--disabled' : ''}`}
                    onClick={() => v.isAvailable && setSelectedVariant(i)}
                    disabled={!v.isAvailable}
                    role="radio"
                    aria-checked={i === selectedVariant}
                    aria-label={v.name}
                  >
                    <span>{v.name}</span>
                    {!v.isAvailable && <span className="product-detail__sold-mark" aria-hidden="true">(Sold Out)</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock Availability */}
          <div className="product-detail__stock">
            {variant?.isAvailable ? (
              <span className="product-detail__stock--in">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                In Stock ({variant.inventory} available)
              </span>
            ) : (
              <span className="product-detail__stock--out">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                Currently Out of Stock
              </span>
            )}
          </div>

          {/* Add to Cart Action */}
          <div className="product-detail__actions">
            <button
              type="button"
              className={`product-detail__add-to-cart ${added ? 'product-detail__add-to-cart--added' : ''}`}
              disabled={!variant?.isAvailable || added || addingToCart}
              onClick={async () => {
                if (!variant?.isAvailable || !product || added || addingToCart) return;
                const pId = product.id || product._id;
                if (!pId) return;

                setAddingToCart(true);
                setCartError(null);
                try {
                  await addToCart({
                    productId: pId,
                    variantSku: variant.sku,
                    quantity: 1,
                  });
                  setAdded(true);
                  setTimeout(() => setAdded(false), 2400);
                } catch (err) {
                  setCartError(err instanceof Error ? err.message : 'Could not add piece to bag');
                  setTimeout(() => setCartError(null), 4000);
                } finally {
                  setAddingToCart(false);
                }
              }}
              aria-label={`Add ${product.name} - ${variant?.name} to cart`}
            >
              {added ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Added to Bag
                </>
              ) : addingToCart ? (
                <>
                  <span className="product-card__cart-spinner" />
                  Adding...
                </>
              ) : variant?.isAvailable ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                  Add to Bag
                </>
              ) : (
                'Sold Out'
              )}
            </button>
            {cartError && (
              <p className="product-detail__cart-error" role="alert" style={{ color: 'var(--catalog-danger)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                {cartError}
              </p>
            )}
          </div>

          {/* Narrative Description */}
          <div className="product-detail__description">
            <h2 className="product-detail__desc-title">Garment Details & Craft</h2>
            <p>{product.description}</p>
          </div>

          {/* Product Tags */}
          {product.tags && product.tags.length > 0 && (
            <div className="product-detail__tags-section">
              <span className="product-detail__tags-label">Tags:</span>
              <div className="product-detail__tags">
                {product.tags.map((tag) => (
                  <Link
                    key={tag}
                    to={`/catalog?search=${encodeURIComponent(tag)}`}
                    className="product-detail__tag"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
