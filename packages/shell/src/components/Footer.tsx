import React from 'react';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="footer" role="contentinfo">
      <div className="footer__inner container">
        <div className="footer__grid">
          {/* Brand */}
          <div className="footer__brand">
            <h2 className="footer__logo">VÊTU</h2>
            <p className="footer__tagline">
              Curated premium fashion &amp; lifestyle essentials.
            </p>
          </div>

          {/* Links */}
          <div className="footer__col">
            <h3 className="footer__col-title">Shop</h3>
            <ul className="footer__links">
              <li><a href="/catalog">All Products</a></li>
              <li><a href="/catalog?category=Outerwear">Outerwear</a></li>
              <li><a href="/catalog?category=Footwear">Footwear</a></li>
              <li><a href="/catalog?category=Accessories">Accessories</a></li>
            </ul>
          </div>

          <div className="footer__col">
            <h3 className="footer__col-title">Company</h3>
            <ul className="footer__links">
              <li><a href="#">About</a></li>
              <li><a href="#">Sustainability</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Press</a></li>
            </ul>
          </div>

          <div className="footer__col">
            <h3 className="footer__col-title">Support</h3>
            <ul className="footer__links">
              <li><a href="#">FAQ</a></li>
              <li><a href="#">Shipping</a></li>
              <li><a href="#">Returns</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="footer__bottom">
          <p className="footer__copyright">
            &copy; {new Date().getFullYear()} VÊTU. All rights reserved.
          </p>
          <p className="footer__tech">
            Built with React Micro-Frontends
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
