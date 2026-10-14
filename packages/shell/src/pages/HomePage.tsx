import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

const HomePage: React.FC = () => {
  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero" aria-label="Welcome banner">
        <div className="hero__bg" />
        <div className="hero__content container">
          <span className="hero__eyebrow animate-fade-in">New Collection 2026</span>
          <h1 className="hero__title animate-fade-in-up">
            Curated Style,<br />
            <span className="hero__title-accent">Elevated Living</span>
          </h1>
          <p className="hero__subtitle animate-fade-in-up">
            Discover premium fashion and lifestyle essentials — designed with purpose,
            crafted for the discerning.
          </p>
          <div className="hero__actions animate-fade-in-up">
            <Link to="/catalog" className="hero__cta hero__cta--primary">
              Explore Collection
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <Link to="/catalog?category=Outerwear" className="hero__cta hero__cta--secondary">
              Shop Outerwear
            </Link>
          </div>
        </div>
      </section>

      {/* Features Strip */}
      <section className="features container" aria-label="Platform features">
        <div className="features__grid">
          <div className="features__item">
            <div className="features__icon">🚀</div>
            <h3 className="features__title">Micro-Frontend</h3>
            <p className="features__desc">Independent, deployable frontend modules</p>
          </div>
          <div className="features__item">
            <div className="features__icon">⚡</div>
            <h3 className="features__title">Real-time Events</h3>
            <p className="features__desc">Redis-powered inventory & order events</p>
          </div>
          <div className="features__item">
            <div className="features__icon">🛡️</div>
            <h3 className="features__title">Type-Safe</h3>
            <p className="features__desc">End-to-end TypeScript across the stack</p>
          </div>
          <div className="features__item">
            <div className="features__icon">📊</div>
            <h3 className="features__title">Edge Analytics</h3>
            <p className="features__desc">Clickstream tracking with predictive prefetch</p>
          </div>
        </div>
      </section>

      {/* Categories Preview */}
      <section className="categories container" aria-label="Product categories">
        <h2 className="categories__title">
          Shop by <span className="categories__title-accent">Category</span>
        </h2>
        <div className="categories__grid">
          {[
            { name: 'Outerwear', emoji: '🧥', query: 'Outerwear' },
            { name: 'Footwear', emoji: '👟', query: 'Footwear' },
            { name: 'Tops', emoji: '👕', query: 'Tops' },
            { name: 'Accessories', emoji: '🎒', query: 'Accessories' },
            { name: 'Bottoms', emoji: '👖', query: 'Bottoms' },
            { name: 'Bags', emoji: '💼', query: 'Bags' },
          ].map((cat) => (
            <Link
              key={cat.name}
              to={`/catalog?category=${cat.query}`}
              className="categories__card"
            >
              <span className="categories__emoji">{cat.emoji}</span>
              <span className="categories__name">{cat.name}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
