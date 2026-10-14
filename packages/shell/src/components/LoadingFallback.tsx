import React from 'react';
import './LoadingFallback.css';

const LoadingFallback: React.FC = () => {
  return (
    <div className="loading-fallback" role="status" aria-label="Loading content">
      <div className="loading-fallback__spinner">
        <div className="loading-fallback__ring" />
      </div>
      <p className="loading-fallback__text">Loading...</p>
    </div>
  );
};

export default LoadingFallback;
