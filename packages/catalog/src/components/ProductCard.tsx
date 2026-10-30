import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../api/productApi';

interface ProductCardProps {
  product: Product;
  index: number;
}

const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22800%22%20viewBox%3D%220%200%20600%20800%22%3E%3Crect%20fill%3D%22%23EFECE6%22%20width%3D%22600%22%20height%3D%22800%22%2F%3E%3Ctext%20fill%3D%22%2377766F%22%20font-family%3D%22sans-serif%22%20font-size%3D%2224%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%3EV%C3%8ATU%20COLLECTION%3C%2Ftext%3E%3C%2Fsvg%3E";

const ProductCard: React.FC<ProductCardProps> = ({ product, index }) => {
  const primaryImage = product.images?.find((img) => img.isPrimary) || product.images?.[0];
  const defaultVariant = product.variants?.[0];

  // Calculate price or price range
  const prices = (product.variants || []).map((v) => v.price);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
  const hasRange = minPrice !== maxPrice && minPrice > 0;

  // Check discount from default variant
  const hasDiscount =
    defaultVariant?.compareAtPrice && defaultVariant.compareAtPrice > defaultVariant.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - defaultVariant.price / defaultVariant.compareAtPrice!) * 100)
    : 0;

  const inStock = (product.variants || []).some((v) => v.isAvailable && v.inventory > 0);

  return (
    <article
      className="product-card"
      style={{ animationDelay: `${index * 40}ms` }}
      aria-label={product.name}
    >
      <Link to={`/catalog/${product.slug}`} className="product-card__link">
        <div className="product-card__image-container">
          <img
            src={primaryImage?.url || FALLBACK_IMAGE}
            alt={primaryImage?.alt || product.name}
            className="product-card__image"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
            }}
          />

          <div className="product-card__badges">
            {index < 2 && inStock && (
              <span className="product-card__badge product-card__badge--new">NEW</span>
            )}
            {hasDiscount && (
              <span className="product-card__badge product-card__badge--sale">-{discountPercent}%</span>
            )}
            {!inStock && (
              <span className="product-card__badge product-card__badge--soldout">Sold Out</span>
            )}
          </div>
        </div>

        <div className="product-card__content">
          <span className="product-card__category">{product.category}</span>
          <h3 className="product-card__title">{product.name}</h3>

          <p className="product-card__description">
            {product.shortDescription || (product.description ? product.description.slice(0, 75) + '...' : '')}
          </p>

          <div className="product-card__footer">
            <div className="product-card__pricing">
              <span className="product-card__price">
                ₹{minPrice.toLocaleString('en-IN')}
                {hasRange && ` – ₹${maxPrice.toLocaleString('en-IN')}`}
              </span>
              {hasDiscount && defaultVariant?.compareAtPrice && (
                <span className="product-card__compare-price">
                  ₹{defaultVariant.compareAtPrice.toLocaleString('en-IN')}
                </span>
              )}
            </div>

            <span className="product-card__view-btn" aria-hidden="true">
              View
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
};

export default ProductCard;
