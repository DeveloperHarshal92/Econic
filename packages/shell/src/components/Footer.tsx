import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer: React.FC = () => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && email.includes('@')) {
      setSubscribed(true);
      setEmail('');
    }
  };

  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__inner container">
        <div className="footer__grid">
          {/* Brand Column */}
          <div className="footer__brand">
            <Link to="/" className="footer__logo" aria-label="VÊTU Home">
              <span className="footer__logo-text">V Ê T U</span>
            </Link>
            <p className="footer__tagline">
              Thoughtfully chosen essentials for modern everyday living. Style, quality and a more conscious tomorrow.
            </p>
            {/* Social Icons */}
            <div className="footer__socials" aria-label="Social media links">
              {/* Instagram */}
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="footer__social-link" aria-label="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </a>
              {/* Facebook */}
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="footer__social-link" aria-label="Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
              {/* YouTube */}
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="footer__social-link" aria-label="YouTube">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
                  <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" />
                </svg>
              </a>
              {/* Pinterest */}
              <a href="https://pinterest.com" target="_blank" rel="noopener noreferrer" className="footer__social-link" aria-label="Pinterest">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="9" x2="12" y2="21" />
                  <path d="M8 12a4 4 0 1 1 8 0c0 3-2 5-4 5s-2-1-2-1" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              </a>
            </div>
          </div>

          {/* Shop Column */}
          <div className="footer__col">
            <h3 className="footer__col-title">Shop</h3>
            <ul className="footer__links">
              <li><Link to="/catalog">All Products</Link></li>
              <li><Link to="/catalog?category=Clothing">New Arrivals</Link></li>
              <li><Link to="/catalog?category=Clothing">Clothing</Link></li>
              <li><Link to="/catalog?category=Footwear">Footwear</Link></li>
              <li><Link to="/catalog?category=Bags">Bags</Link></li>
              <li><Link to="/catalog?category=Accessories">Accessories</Link></li>
            </ul>
          </div>

          {/* Customer Care Column */}
          <div className="footer__col">
            <h3 className="footer__col-title">Customer Care</h3>
            <ul className="footer__links">
              <li><Link to="/catalog">FAQs</Link></li>
              <li><Link to="/catalog">Shipping Policy</Link></li>
              <li><Link to="/catalog">Returns &amp; Refunds</Link></li>
              <li><Link to="/catalog">Size Guide</Link></li>
              <li><Link to="/catalog">Track Order</Link></li>
              <li><Link to="/catalog">Contact Us</Link></li>
            </ul>
          </div>

          {/* About Column */}
          <div className="footer__col">
            <h3 className="footer__col-title">About</h3>
            <ul className="footer__links">
              <li><a href="#brand-story">Our Story</a></li>
              <li><a href="#brand-story">Sustainability</a></li>
              <li><a href="#brand-story">Journal</a></li>
              <li><a href="#brand-story">Careers</a></li>
              <li><a href="#brand-story">Affiliate Program</a></li>
            </ul>
          </div>

          {/* Stay Connected Column */}
          <div className="footer__col footer__col--newsletter">
            <h3 className="footer__col-title">Stay Connected</h3>
            <p className="footer__newsletter-desc">
              Get the latest updates, new arrivals and exclusive offers.
            </p>
            {subscribed ? (
              <p className="footer__subscribed-msg">Thank you for joining our community.</p>
            ) : (
              <form className="footer__mini-form" onSubmit={handleSubscribe}>
                <input
                  type="email"
                  className="footer__mini-input"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-label="Email address for updates"
                />
                <button type="submit" className="footer__mini-btn" aria-label="Subscribe to updates">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer Bottom Strip */}
        <div className="footer__bottom">
          <p className="footer__copyright">
            &copy; 2024 VÊTU. All rights reserved.
          </p>
          <div className="footer__legal">
            <Link to="/catalog" className="footer__legal-link">Privacy Policy</Link>
            <span className="footer__legal-divider">&middot;</span>
            <Link to="/catalog" className="footer__legal-link">Terms of Service</Link>
            <span className="footer__legal-divider">&middot;</span>
            <Link to="/catalog" className="footer__legal-link">Sitemap</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
