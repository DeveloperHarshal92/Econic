import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { addToCart } from '../utils/cartHelper';
import CinematicHero from '../components/CinematicHero';
import InteractiveSelector from '../components/ui/InteractiveSelector';
import { useIntersectionObserver } from '../hooks';
import './HomePage.css';

// ─── Interfaces ──────────────────────────────────────────

interface ProductImage {
  url: string;
  alt: string;
  isPrimary?: boolean;
}

interface ProductVariant {
  sku: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  attributes: Record<string, string>;
  inventory: number;
  isAvailable: boolean;
}

interface Product {
  id?: string;
  _id?: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  category: string;
  tags?: string[];
  images: ProductImage[];
  variants: ProductVariant[];
  isActive?: boolean;
}

// ─── Fallback SVG Image Generator ────────────────────────

const FALLBACK_IMAGE = "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22800%22%20viewBox%3D%220%200%20600%20800%22%3E%3Crect%20fill%3D%22%23EFECE6%22%20width%3D%22600%22%20height%3D%22800%22%2F%3E%3Ctext%20fill%3D%22%2377766F%22%20font-family%3D%22sans-serif%22%20font-size%3D%2224%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%3EV%C3%8ATU%20COLLECTION%3C%2Ftext%3E%3C%2Fsvg%3E";

// Color mapping for swatches
const COLOR_MAP: Record<string, string> = {
  black: '#1D211E',
  white: '#FFFFFF',
  navy: '#1B2A4A',
  olive: '#525B44',
  beige: '#D8CEBE',
  grey: '#8A8D8F',
  gray: '#8A8D8F',
  blue: '#3A5A78',
  'sky blue': '#8EAFC7',
  tan: '#C2A684',
  brown: '#6B4C35',
  red: '#8B2626',
  indigo: '#2E3A59',
  khaki: '#A89F81',
};

const HomePage: React.FC = () => {

  // Product data state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);
  const [productError, setProductError] = useState<string | null>(null);

  // Selected variant SKU for each product (productId -> variantSku)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  // Wishlist state (local interactivity)
  const [wishlist, setWishlist] = useState<Record<string, boolean>>({});

  // Cart action states: productId -> 'idle' | 'adding' | 'added'
  const [cartStatus, setCartStatus] = useState<Record<string, 'idle' | 'adding' | 'added'>>({});

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Newsletter state
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);

  // ─── Phase 3, 4 & 5 Motion Viewport Observers (One-Time Reveals) ───
  const { ref: categoriesRef, isIntersecting: categoriesVisible } = useIntersectionObserver<HTMLElement>({
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px',
    once: true,
  });

  const { ref: productsRef, isIntersecting: productsVisible } = useIntersectionObserver<HTMLElement>({
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px',
    once: true,
  });

  const { ref: brandStoryRef, isIntersecting: brandStoryVisible } = useIntersectionObserver<HTMLElement>({
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px',
    once: true,
  });

  const { ref: benefitsRef, isIntersecting: benefitsVisible } = useIntersectionObserver<HTMLElement>({
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px',
    once: true,
  });

  const { ref: collectionsRef, isIntersecting: collectionsVisible } = useIntersectionObserver<HTMLElement>({
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px',
    once: true,
  });

  const { ref: newsletterRef, isIntersecting: newsletterVisible } = useIntersectionObserver<HTMLElement>({
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px',
    once: true,
  });

  // ─── Fetch Featured Products ───────────────────────────
  const fetchFeaturedProducts = useCallback(async () => {
    setLoadingProducts(true);
    setProductError(null);
    try {
      const response = await fetch('/api/products?limit=8');
      if (!response.ok) {
        throw new Error(`Failed to load products (HTTP ${response.status})`);
      }
      const data = await response.json();
      if (data && Array.isArray(data.data)) {
        setProducts(data.data);
        // Initialize default variants
        const defaults: Record<string, string> = {};
        data.data.forEach((p: Product) => {
          const pId = p.id || p._id || '';
          const firstVariant = p.variants && p.variants.length > 0 ? p.variants[0] : undefined;
          if (pId && firstVariant) {
            defaults[pId] = firstVariant.sku;
          }
        });
        setSelectedVariants(defaults);
      } else {
        setProducts([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to product catalog';
      setProductError(msg);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    fetchFeaturedProducts();
  }, [fetchFeaturedProducts]);

  // Handle Add to Cart action
  const handleAddToCart = async (product: Product) => {
    const pId = product.id || product._id;
    if (!pId) return;

    const firstVariant = product.variants && product.variants.length > 0 ? product.variants[0] : undefined;
    const firstVariantSku = firstVariant ? firstVariant.sku : '';
    const variantSku = selectedVariants[pId] || firstVariantSku;
    if (!variantSku) return;

    setCartStatus((prev) => ({ ...prev, [pId]: 'adding' }));

    try {
      await addToCart({
        productId: pId,
        variantSku,
        quantity: 1,
      });

      setCartStatus((prev) => ({ ...prev, [pId]: 'added' }));
      setToastMessage(`Added "${product.name}" to your cart`);

      setTimeout(() => {
        setCartStatus((prev) => ({ ...prev, [pId]: 'idle' }));
      }, 2000);

      setTimeout(() => {
        setToastMessage(null);
      }, 3500);
    } catch (err) {
      setCartStatus((prev) => ({ ...prev, [pId]: 'idle' }));
      setToastMessage(`Failed to add item to cart: ${err instanceof Error ? err.message : 'Error'}`);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const toggleWishlist = (productId: string) => {
    setWishlist((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newsletterEmail && newsletterEmail.includes('@')) {
      setNewsletterSubmitting(true);
      setTimeout(() => {
        setNewsletterSubmitting(false);
        setNewsletterSubscribed(true);
        setNewsletterEmail('');
      }, 350);
    }
  };

  return (
    <div className="home-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="home-toast" role="status" aria-live="polite">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── 3. Cinematic Fashion Hero Section with Scroll Expansion ── */}
      <CinematicHero />

      {/* ─── 4. Category Discovery Tiles ────────────────────── */}
      <section
        ref={categoriesRef}
        className={`categories-section container ${categoriesVisible ? 'categories-section--revealed' : ''}`}
        aria-label="Browse by Category"
      >
        <div className="categories-grid">
          {/* Tile 1: Clothing */}
          <Link to="/catalog?category=Clothing" className="category-card" aria-label="Shop Clothing">
            <div className="category-card__image-wrap">
              <img
                src="https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=800&q=85"
                alt="Clothing Collection"
                className="category-card__img"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
              />
              <div className="category-card__overlay" />
            </div>
            <div className="category-card__content">
              <div>
                <h2 className="category-card__title">Clothing</h2>
                <p className="category-card__desc">T-Shirts, Shirts, Jackets, and More</p>
              </div>
              <span className="category-card__arrow-btn" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </div>
          </Link>

          {/* Tile 2: Footwear */}
          <Link to="/catalog?category=Footwear" className="category-card" aria-label="Shop Footwear">
            <div className="category-card__image-wrap">
              <img
                src="https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=85"
                alt="Footwear Collection"
                className="category-card__img"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
              />
              <div className="category-card__overlay" />
            </div>
            <div className="category-card__content">
              <div>
                <h2 className="category-card__title">Footwear</h2>
                <p className="category-card__desc">Sneakers, Casual Shoes, Boots Collection</p>
              </div>
              <span className="category-card__arrow-btn" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </div>
          </Link>

          {/* Tile 3: Bags */}
          <Link to="/catalog?category=Bags" className="category-card" aria-label="Shop Bags">
            <div className="category-card__image-wrap">
              <img
                src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=85"
                alt="Bags Collection"
                className="category-card__img"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
              />
              <div className="category-card__overlay" />
            </div>
            <div className="category-card__content">
              <div>
                <h2 className="category-card__title">Bags</h2>
                <p className="category-card__desc">Backpacks, Tote Bags, Duffle and More</p>
              </div>
              <span className="category-card__arrow-btn" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </div>
          </Link>

          {/* Tile 4: Accessories */}
          <Link to="/catalog?category=Accessories" className="category-card" aria-label="Shop Accessories">
            <div className="category-card__image-wrap">
              <img
                src="https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=85"
                alt="Accessories Collection"
                className="category-card__img"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
              />
              <div className="category-card__overlay" />
            </div>
            <div className="category-card__content">
              <div>
                <h2 className="category-card__title">Accessories</h2>
                <p className="category-card__desc">Belts, Watches, Caps, Sunglasses and More</p>
              </div>
              <span className="category-card__arrow-btn" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* ─── 5. New Arrivals / Featured Products ────────────── */}
      <section
        ref={productsRef}
        className={`products-section container ${productsVisible ? 'products-section--revealed' : ''}`}
        aria-label="New Arrivals"
      >
        <div className="section-header">
          <div className="section-header__title-group">
            <h2 className="section-header__title">New Arrivals</h2>
            <div className="section-header__line" />
          </div>
          <Link to="/catalog" className="section-header__link">
            View All Products
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>

        {/* Loading State */}
        {loadingProducts && (
          <div className="products-grid">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="product-skeleton-card">
                <div className="skeleton product-skeleton-img" />
                <div className="skeleton product-skeleton-line product-skeleton-line--short" />
                <div className="skeleton product-skeleton-line" />
                <div className="skeleton product-skeleton-line product-skeleton-line--half" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loadingProducts && productError && (
          <div className="products-error-state">
            <p className="products-error-msg">{productError}</p>
            <button
              type="button"
              className="hero-btn hero-btn--primary"
              onClick={fetchFeaturedProducts}
            >
              Retry Loading Catalog
            </button>
          </div>
        )}

        {/* Products Grid */}
        {!loadingProducts && !productError && products.length > 0 && (
          <div className="products-grid">
            {products.slice(0, 4).map((product, idx) => {
              const pId = product.id || product._id || `p-${idx}`;
              const firstImg = product.images && product.images.length > 0 ? product.images[0] : undefined;
              const primaryImg = product.images ? (product.images.find((img) => img.isPrimary) || firstImg) : undefined;
              const firstVariant = product.variants && product.variants.length > 0 ? product.variants[0] : undefined;
              const activeVariantSku = selectedVariants[pId] || (firstVariant ? firstVariant.sku : '');
              const activeVariant = product.variants ? (product.variants.find((v) => v.sku === activeVariantSku) || firstVariant) : undefined;

              const currentPrice = activeVariant?.price ?? 0;
              const comparePrice = activeVariant?.compareAtPrice;
              const hasDiscount = Boolean(comparePrice && comparePrice > currentPrice);
              const discountPercent = hasDiscount && comparePrice
                ? Math.round(((comparePrice - currentPrice) / comparePrice) * 100)
                : 0;

              // Extract unique colors from variants
              const colors: string[] = [];
              product.variants.forEach((v) => {
                const c = v.attributes?.color;
                if (c && !colors.includes(c)) {
                  colors.push(c);
                }
              });

              // Assign badge
              let badgeText = '';
              if (idx === 0) badgeText = 'NEW';
              else if (idx === 1) badgeText = 'BESTSELLER';
              else if (hasDiscount) badgeText = `-${discountPercent}%`;

              const isWishlisted = Boolean(wishlist[pId]);
              const addStatus = cartStatus[pId] || 'idle';

              return (
                <article key={pId} className="product-card">
                  {/* Card Image Area */}
                  <div className="product-card__media">
                    <Link to={`/catalog/${product.slug}`} className="product-card__media-link">
                      <img
                        src={primaryImg?.url || FALLBACK_IMAGE}
                        alt={primaryImg?.alt || product.name}
                        className="product-card__img"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                        }}
                      />
                    </Link>

                    {/* Badge */}
                    {badgeText && (
                      <span className={`product-card__badge ${badgeText.startsWith('-') ? 'product-card__badge--sale' : ''}`}>
                        {badgeText}
                      </span>
                    )}

                    {/* Wishlist Button */}
                    <button
                      type="button"
                      className={`product-card__wishlist-btn ${isWishlisted ? 'product-card__wishlist-btn--active' : ''}`}
                      onClick={() => toggleWishlist(pId)}
                      aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
                    >
                      <svg width="17" height="17" viewBox="0 0 24 24" fill={isWishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  </div>

                  {/* Card Content Area */}
                  <div className="product-card__info">
                    <span className="product-card__category">{product.category}</span>
                    <h3 className="product-card__name">
                      <Link to={`/catalog/${product.slug}`}>
                        {product.name}
                      </Link>
                    </h3>

                    {/* Pricing */}
                    <div className="product-card__pricing">
                      <span className="product-card__price">
                        ₹{currentPrice.toLocaleString('en-IN')}
                      </span>
                      {hasDiscount && comparePrice && (
                        <span className="product-card__compare-price">
                          ₹{comparePrice.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    {/* Bottom Controls: Color Swatches & Add to Cart Action */}
                    <div className="product-card__footer">
                      {/* Color Swatches */}
                      <div className="product-card__swatches" role="group" aria-label={`Color options for ${product.name}`}>
                        {colors.slice(0, 4).map((col) => {
                          const variantForColor = product.variants.find((v) => v.attributes?.color === col);
                          const isSelected = activeVariant?.attributes?.color === col;
                          const bgHex = COLOR_MAP[col.toLowerCase()] || '#C9BBA7';

                          return (
                            <button
                              key={col}
                              type="button"
                              className={`product-card__swatch ${isSelected ? 'product-card__swatch--active' : ''}`}
                              style={{ backgroundColor: bgHex }}
                              onClick={() => {
                                if (variantForColor) {
                                  setSelectedVariants((prev) => ({
                                    ...prev,
                                    [pId]: variantForColor.sku,
                                  }));
                                }
                              }}
                              title={`Select ${col}`}
                              aria-label={`Select ${col}`}
                            />
                          );
                        })}
                      </div>

                      {/* Add to Cart Button */}
                      <button
                        type="button"
                        className={`product-card__cart-btn ${addStatus === 'added' ? 'product-card__cart-btn--added' : ''}`}
                        onClick={() => handleAddToCart(product)}
                        disabled={addStatus === 'adding'}
                        aria-label={`Add ${product.name} to cart`}
                        title="Add to cart"
                      >
                        {addStatus === 'adding' ? (
                          <span className="product-card__cart-spinner" />
                        ) : addStatus === 'added' ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <path d="M16 10a4 4 0 0 1-8 0" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ─── 6. Brand Story / Editorial Section ─────────────── */}
      <section
        ref={brandStoryRef}
        id="brand-story"
        className={`brand-story-section container ${brandStoryVisible ? 'brand-story-section--revealed' : ''}`}
        aria-label="Brand Philosophy"
      >
        <div className="brand-story-grid">
          {/* Left Column: Portrait on Architecture Steps */}
          <div className="brand-story__left-media">
            <img
              src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=800&q=85"
              alt="Model sitting on architectural stone stairs"
              className="brand-story__left-img"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
            />
          </div>

          {/* Center Column: Narrative Copy & CTA */}
          <div className="brand-story__center-content">
            <span className="brand-story__eyebrow">OUR PHILOSOPHY</span>
            <h2 className="brand-story__headline">
              Timeless Style,<br />
              <em className="brand-story__headline-em">Real</em> Impact.
            </h2>
            <p className="brand-story__paragraph">
              We create modern essentials that look good, feel great and are made to last. Quality materials, thoughtful design and a more conscious tomorrow.
            </p>
            <Link to="/catalog" className="hero-btn hero-btn--primary brand-story__cta">
              Our Story
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>

          {/* Right Column: Plant Detail & EST. 2024 */}
          <div className="brand-story__right-media">
            <div className="brand-story__plant-frame">
              <img
                src="https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=600&q=85"
                alt="Lush green botanical leaves"
                className="brand-story__plant-img"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
              />
            </div>
            <div className="brand-story__est">
              <span className="brand-story__est-text">EST. 2024</span>
              <div className="brand-story__est-line" />
            </div>
          </div>
        </div>
      </section>

      {/* ─── 7. Shopping Benefits ────────────────────────────── */}
      <section
        ref={benefitsRef}
        className={`benefits-section container ${benefitsVisible ? 'benefits-section--revealed' : ''}`}
        aria-label="Customer Shopping Benefits"
      >
        <div className="benefits-grid">
          {/* Benefit 1 */}
          <div className="benefit-item">
            <div className="benefit-item__icon-wrap">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" />
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <h3 className="benefit-item__title">Free Shipping</h3>
            <p className="benefit-item__desc">On orders over ₹2,500</p>
          </div>

          {/* Benefit 2 */}
          <div className="benefit-item">
            <div className="benefit-item__icon-wrap">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="21 8 21 21 3 21 3 8" />
                <rect x="1" y="3" width="22" height="5" />
                <line x1="10" y1="12" x2="14" y2="12" />
              </svg>
            </div>
            <h3 className="benefit-item__title">Easy Returns</h3>
            <p className="benefit-item__desc">30-day return policy</p>
          </div>

          {/* Benefit 3 */}
          <div className="benefit-item">
            <div className="benefit-item__icon-wrap">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </div>
            <h3 className="benefit-item__title">Secure Payment</h3>
            <p className="benefit-item__desc">100% secure checkout</p>
          </div>

          {/* Benefit 4 */}
          <div className="benefit-item">
            <div className="benefit-item__icon-wrap">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
                <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
              </svg>
            </div>
            <h3 className="benefit-item__title">Sustainable Choices</h3>
            <p className="benefit-item__desc">Thoughtful and lasting</p>
          </div>
        </div>
      </section>

      {/* ─── 8. Shop by Style / Collections ──────────────────── */}
      <section
        ref={collectionsRef}
        id="collections"
        className={`collections-section container ${collectionsVisible ? 'collections-section--revealed' : ''}`}
        aria-label="Curated Edits"
      >
        <div className="section-header">
          <div className="section-header__title-group">
            <h2 className="section-header__title">Shop by Style</h2>
            <div className="section-header__line" />
          </div>
          <Link to="/catalog" className="section-header__link">
            View All Collections
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>

        <InteractiveSelector />
      </section>

      {/* ─── 9. Newsletter Section ──────────────────────────── */}
      <section
        ref={newsletterRef}
        className={`newsletter-section ${newsletterVisible ? 'newsletter-section--revealed' : ''}`}
        aria-label="Join Community"
      >
        <div className="newsletter-section__inner container">
          <div className="newsletter-card">
            <div className="newsletter-card__content">
              <span className="newsletter-card__eyebrow">JOIN THE VÊTU COMMUNITY</span>
              <h2 className="newsletter-card__headline">Get 10% Off Your First Order</h2>
              <p className="newsletter-card__desc">
                Subscribe to our newsletter for exclusive offers, new arrivals and style inspiration.
              </p>
            </div>

            <div className="newsletter-card__action" aria-live="polite">
              {newsletterSubscribed ? (
                <div className="newsletter-card__success">
                  <p className="newsletter-card__success-title">Welcome to VÊTU.</p>
                  <p className="newsletter-card__success-desc">
                    Use code <strong className="newsletter-card__code">VETU10</strong> for 10% off your first checkout.
                  </p>
                </div>
              ) : (
                <form className="newsletter-card__form" onSubmit={handleNewsletterSubmit}>
                  <input
                    type="email"
                    className="newsletter-card__input"
                    placeholder="Enter your email"
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    required
                    aria-label="Email address for 10% discount"
                    disabled={newsletterSubmitting}
                  />
                  <button
                    type="submit"
                    className="newsletter-card__btn"
                    disabled={newsletterSubmitting}
                    aria-label="Subscribe to newsletter"
                  >
                    {newsletterSubmitting ? 'Joining...' : 'Subscribe \u2192'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
