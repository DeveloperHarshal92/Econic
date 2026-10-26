import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './Header.css';

const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [shopDropdownOpen, setShopDropdownOpen] = useState(false);
  const [collectionsDropdownOpen, setCollectionsDropdownOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  // Scroll detection for slight elevation
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 15);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch initial cart count on mount
  useEffect(() => {
    const fetchInitialCart = async () => {
      try {
        const sessionId = localStorage.getItem('vetu_cart_session');
        if (!sessionId) return;
        const res = await fetch('/api/cart', {
          headers: { 'x-cart-session': sessionId },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.data && typeof data.data.itemCount === 'number') {
            setCartCount(data.data.itemCount);
          }
        }
      } catch {
        // Non-critical: fail silently if cart is empty or network unavailable
      }
    };
    fetchInitialCart();
  }, []);

  // Listen for MFE cart updates
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

  // Close mobile menu and dropdowns on route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setShopDropdownOpen(false);
    setCollectionsDropdownOpen(false);
    setAccountModalOpen(false);
  }, [location.pathname]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      navigate(`/catalog?search=${encodeURIComponent(query)}`);
      setMobileMenuOpen(false);
    }
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="header-wrapper">
      {/* 1. Announcement Bar */}
      <div className="announcement-bar" role="region" aria-label="Store Announcements">
        <div className="announcement-bar__inner container">
          <span className="announcement-bar__item announcement-bar__item--left">
            FREE SHIPPING ON ORDERS OVER ₹2,500
          </span>
          <span className="announcement-bar__item announcement-bar__item--center">
            CONSIDERED ESSENTIALS. MADE FOR EVERYDAY. &nbsp;|&nbsp; VÊTU
          </span>
          <span className="announcement-bar__item announcement-bar__item--right">
            EASY RETURNS &nbsp;|&nbsp; SECURE PAYMENT
          </span>
        </div>
      </div>

      {/* 2. Main Navigation Header */}
      <header
        className={`header ${scrolled ? 'header--scrolled' : ''}`}
        role="banner"
      >
        <div className="header__inner container">
          {/* Left Navigation Links */}
          <nav className="header__nav" role="navigation" aria-label="Main navigation">
            {/* Shop Dropdown */}
            <div
              className="header__dropdown-container"
              onMouseEnter={() => setShopDropdownOpen(true)}
              onMouseLeave={() => setShopDropdownOpen(false)}
            >
              <Link
                to="/catalog"
                className={`header__link ${isActive('/catalog') && !location.search ? 'header__link--active' : ''}`}
                aria-haspopup="true"
                aria-expanded={shopDropdownOpen}
              >
                Shop
                <svg className="header__chevron" width="10" height="6" viewBox="0 0 10 6" fill="none">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              {shopDropdownOpen && (
                <div className="header__dropdown-menu" role="menu">
                  <Link to="/catalog" className="header__dropdown-item" role="menuitem">
                    All Products
                  </Link>
                  <Link to="/catalog?category=Clothing" className="header__dropdown-item" role="menuitem">
                    Clothing
                  </Link>
                  <Link to="/catalog?category=Footwear" className="header__dropdown-item" role="menuitem">
                    Footwear
                  </Link>
                  <Link to="/catalog?category=Bags" className="header__dropdown-item" role="menuitem">
                    Bags
                  </Link>
                  <Link to="/catalog?category=Accessories" className="header__dropdown-item" role="menuitem">
                    Accessories
                  </Link>
                </div>
              )}
            </div>

            <Link
              to="/catalog?category=Clothing"
              className="header__link"
            >
              New Arrivals
            </Link>

            {/* Collections Dropdown */}
            <div
              className="header__dropdown-container"
              onMouseEnter={() => setCollectionsDropdownOpen(true)}
              onMouseLeave={() => setCollectionsDropdownOpen(false)}
            >
              <a
                href="#collections"
                className="header__link"
                aria-haspopup="true"
                aria-expanded={collectionsDropdownOpen}
              >
                Collections
                <svg className="header__chevron" width="10" height="6" viewBox="0 0 10 6" fill="none">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              {collectionsDropdownOpen && (
                <div className="header__dropdown-menu" role="menu">
                  <Link to="/catalog?category=Clothing" className="header__dropdown-item" role="menuitem">
                    Everyday Classics
                  </Link>
                  <Link to="/catalog?category=Clothing" className="header__dropdown-item" role="menuitem">
                    Minimal Basics
                  </Link>
                  <Link to="/catalog?category=Footwear" className="header__dropdown-item" role="menuitem">
                    Streetwear Edit
                  </Link>
                  <Link to="/catalog?category=Accessories" className="header__dropdown-item" role="menuitem">
                    Accessories Edit
                  </Link>
                </div>
              )}
            </div>

            <a href="#brand-story" className="header__link">
              Our Story
            </a>
          </nav>

          {/* Center Brand Wordmark */}
          <Link to="/" className="header__logo" aria-label="VÊTU Home">
            <span className="header__logo-text">V Ê T U</span>
          </Link>

          {/* Right Actions: Search, Account, Cart, Mobile Toggle */}
          <div className="header__actions">
            {/* Search Input Bar */}
            <form className="header__search-form" onSubmit={handleSearchSubmit} role="search">
              <svg className="header__search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="search"
                className="header__search-input"
                placeholder="Search for products, categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search catalog"
              />
            </form>

            {/* Account Icon */}
            <div className="header__account-container">
              <button
                type="button"
                className="header__icon-btn"
                onClick={() => setAccountModalOpen(!accountModalOpen)}
                aria-label="Account status"
                title="Account"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </button>
              {accountModalOpen && (
                <div className="header__account-tooltip" role="dialog" aria-label="Account Info">
                  <p className="header__account-title">Guest Shopper</p>
                  <p className="header__account-desc">Fast guest checkout is enabled for all orders.</p>
                  <button
                    type="button"
                    className="header__account-close"
                    onClick={() => setAccountModalOpen(false)}
                  >
                    Got it
                  </button>
                </div>
              )}
            </div>

            {/* Cart Button */}
            <Link to="/cart" className="header__icon-btn header__cart-btn" aria-label={`View shopping cart with ${cartCount} items`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <span className="header__badge" aria-hidden="true">
                {cartCount}
              </span>
            </Link>

            {/* Mobile Hamburger Menu Toggle */}
            <button
              type="button"
              className={`header__hamburger ${mobileMenuOpen ? 'header__hamburger--open' : ''}`}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <div
          className={`header__mobile-menu ${mobileMenuOpen ? 'header__mobile-menu--open' : ''}`}
          role="navigation"
          aria-label="Mobile navigation"
        >
          {/* Mobile Search */}
          <form className="header__mobile-search" onSubmit={handleSearchSubmit}>
            <input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search products"
            />
            <button type="submit" aria-label="Search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>
          </form>

          <div className="header__mobile-links">
            <Link to="/catalog" className="header__mobile-link">
              Shop All Products
            </Link>
            <Link to="/catalog?category=Clothing" className="header__mobile-link">
              Clothing
            </Link>
            <Link to="/catalog?category=Footwear" className="header__mobile-link">
              Footwear
            </Link>
            <Link to="/catalog?category=Bags" className="header__mobile-link">
              Bags
            </Link>
            <Link to="/catalog?category=Accessories" className="header__mobile-link">
              Accessories
            </Link>
            <a href="#collections" className="header__mobile-link">
              Curated Collections
            </a>
            <a href="#brand-story" className="header__mobile-link">
              Our Philosophy
            </a>
            <Link to="/cart" className="header__mobile-link">
              Cart ({cartCount})
            </Link>
            <Link to="/analytics" className="header__mobile-link header__mobile-link--subtle">
              Platform Analytics
            </Link>
          </div>
        </div>
      </header>
    </div>
  );
};

export default Header;
