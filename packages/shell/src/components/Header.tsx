import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Header.css';

const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleCartUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ itemCount?: number }>;
      if (customEvent.detail && typeof customEvent.detail.itemCount === 'number') {
        setCartCount(customEvent.detail.itemCount);
      }
    };

    window.addEventListener('cart:updated', handleCartUpdate);
    return () => window.removeEventListener('cart:updated', handleCartUpdate);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <header
      className={`header ${scrolled ? 'header--scrolled' : ''}`}
      role="banner"
    >
      <div className="header__inner container">
        {/* Logo */}
        <Link to="/" className="header__logo" aria-label="VÊTU Home">
          <span className="header__logo-text">VÊTU</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="header__nav" role="navigation" aria-label="Main navigation">
          <Link
            to="/catalog"
            className={`header__link ${isActive('/catalog') ? 'header__link--active' : ''}`}
          >
            Catalog
          </Link>
          <Link
            to="/cart"
            className={`header__link ${isActive('/cart') ? 'header__link--active' : ''}`}
          >
            Cart
            <span className="header__badge" aria-label={`${cartCount} items in cart`}>{cartCount}</span>
          </Link>
          <Link
            to="/analytics"
            className={`header__link ${isActive('/analytics') ? 'header__link--active' : ''}`}
          >
            Analytics
          </Link>
        </nav>

        {/* Actions */}
        <div className="header__actions">
          <button
            className="header__search-btn"
            aria-label="Search products"
            title="Search"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {/* Mobile Menu Toggle */}
          <button
            className={`header__hamburger ${mobileMenuOpen ? 'header__hamburger--open' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div
        className={`header__mobile-menu ${mobileMenuOpen ? 'header__mobile-menu--open' : ''}`}
        role="navigation"
        aria-label="Mobile navigation"
      >
        <Link to="/catalog" className="header__mobile-link">Catalog</Link>
        <Link to="/cart" className="header__mobile-link">Cart</Link>
        <Link to="/analytics" className="header__mobile-link">Analytics</Link>
      </div>
    </header>
  );
};

export default Header;
