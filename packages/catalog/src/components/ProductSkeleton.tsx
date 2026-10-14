import React from 'react';

const ProductSkeleton: React.FC = () => {
  return (
    <div className="product-skeleton" aria-hidden="true">
      <div className="skeleton product-skeleton__image" />
      <div className="product-skeleton__content">
        <div className="skeleton product-skeleton__badge" />
        <div className="skeleton product-skeleton__title" />
        <div className="skeleton product-skeleton__text" />
        <div className="product-skeleton__footer">
          <div className="skeleton product-skeleton__price" />
          <div className="skeleton product-skeleton__btn" />
        </div>
      </div>
    </div>
  );
};

export default ProductSkeleton;
