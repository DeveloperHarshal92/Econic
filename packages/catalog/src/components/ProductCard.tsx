import React from 'react';
import { Link } from 'react-router-dom';
import { Product } from '../api/productApi';

interface ProductCardProps {
  product: Product;
  index: number;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, index }) => {
  const primaryImage = product.images.find((img) => img.isPrimary) || product.images[0];
  const defaultVariant = product.variants[0];

  // Calculate price or price range
  const prices = product.variants.map((v) => v.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const hasRange = minPrice !== maxPrice;

  // Check discount from default variant
  const hasDiscount =
    defaultVariant?.compareAtPrice && defaultVariant.compareAtPrice > defaultVariant.price;
  const discountPercent = hasDiscount
    ? Math.round((1 - defaultVariant.price / defaultVariant.compareAtPrice!) * 100)
    : 0;

  const inStock = product.variants.some((v) => v.isAvailable && v.inventory > 0);

  return (
    <article
      className="product-card"
      style={{ animationDelay: `${index * 50}ms` }}
      aria-label={product.name}
    >
      <Link to={`/catalog/${product.slug}`} className="product-card__link">
        <div className="product-card__image-container">
          {primaryImage ? (
            <img
              src={primaryImage.url}
              alt={primaryImage.alt || product.name}
              className="product-card__image"
              loading="lazy"
            />
          ) : (
            <div className="product-card__no-image">
              <span>{product.name.charAt(0)}</span>
            </div>
          )}

          <div className="product-card__badges">
            {hasDiscount && (
              <span className="badge badge--discount">-{discountPercent}%</span>
            )}
            {!inStock && <span className="badge badge--soldout">Out of Stock</span>}
          </div>
        </div>

        <div className="product-card__content">
          <span className="product-card__category">{product.category}</span>
          <h3 className="product-card__title">{product.name}</h3>

          <p className="product-card__description">
            {product.shortDescription || product.description.slice(0, 80) + '...'}
          </p>

          <div className="product-card__footer">
            <div className="product-card__pricing">
              <span className="product-card__price">
                ${minPrice.toFixed(2)}
                {hasRange && ` - $${maxPrice.toFixed(2)}`}
              </span>
              {hasDiscount && defaultVariant?.compareAtPrice && (
                <span className="product-card__compare-price">
                  ${defaultVariant.compareAtPrice.toFixed(2)}
                </span>
              )}
            </div>

            <span className="product-card__view-btn" aria-hidden="true">
              View &rarr;
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
};

export default ProductCard;
