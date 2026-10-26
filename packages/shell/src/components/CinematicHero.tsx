import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import desktopHeroImg from '../assets/vetu-campaign-hero-desktop.jpg';
import mobileHeroImg from '../assets/vetu-campaign-hero-mobile.jpg';
import './CinematicHero.css';

/**
 * Editorial Campaign Hero Content (Look 01)
 */
const HERO_CONTENT = {
  eyebrow: 'THE NEW SEASON / 2026',
  categoryTag: 'CLOTHING / ACCESSORIES / FOOTWEAR / BAGS',
  headlineLine1: 'Wear A Better',
  headlineLine2: 'Tomorrow.',
  copy: 'Thoughtfully chosen essentials. Timeless silhouettes. Everyday pieces designed to stay with you.',
  desktopImage: desktopHeroImg,
  mobileImage: mobileHeroImg,
  alt: 'VÊTU campaign model in textured forest-green overshirt and charcoal trousers beside warm limestone courtyard',
};

/**
 * CinematicHero Component for VÊTU — Phase 1 Simplified Motion Architecture
 * 
 * Direction A: Minimal Editorial Luxury
 * - Exactly ONE primary animation: smooth, reversible scroll-driven media expansion.
 * - Removed: Carousel switching, autoplay timer, look pills, slide counters, chevron controls.
 * - Removed: Desktop pointer-driven 3D tilt and pointer listeners.
 * - Removed: Competing background/foreground independent parallax translations.
 * - Removed: Over-engineered entrance animation keyframes.
 * - Preserved: Dynamic header height sync via ResizeObserver on .header-wrapper.
 * - Preserved: 60 FPS direct CSS Custom Property updates via RAF without React component re-renders.
 * - Preserved: Reduced-motion accessible fallback without extended sticky scroll sequence.
 */
const CinematicHero: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Persistent refs for animation frames and coordinates
  const scrollRafIdRef = useRef<number | null>(null);
  const lastProgressRef = useRef<number>(-1);
  const headerHeightRef = useRef<number>(104);

  // Apply CSS custom properties to container element (ZERO React component re-renders)
  const applyScrollProperties = useCallback((progress: number) => {
    const el = containerRef.current;
    if (!el) return;

    if (Math.abs(progress - lastProgressRef.current) < 0.0005) return;
    lastProgressRef.current = progress;

    const p = progress;
    const isMobile = window.innerWidth <= 768;

    // 1. Raw progress
    el.style.setProperty('--hero-progress', p.toFixed(4));

    // 2. Media frame dimensional expansion (responsive start dimensions)
    const startWidth = isMobile ? 94 : 88;
    const startHeight = isMobile ? 82 : 74;
    const startRadius = isMobile ? 8 : 12;

    const widthPct = startWidth + p * (100 - startWidth);
    const heightPct = startHeight + p * (100 - startHeight);
    const radiusPx = Math.max(0, startRadius * (1 - p * 1.5));
    const maxWidth = p > 0.88 ? '100%' : '1540px';

    el.style.setProperty('--hero-width', `${widthPct.toFixed(2)}%`);
    el.style.setProperty('--hero-height', `${heightPct.toFixed(2)}%`);
    el.style.setProperty('--hero-max-width', maxWidth);
    el.style.setProperty('--hero-radius', `${radiusPx.toFixed(1)}px`);

    // 3. Subtle contrast scrim enhancement as card expands
    const scrimOpacity = 0.22 + p * 0.28;
    el.style.setProperty('--hero-scrim-opacity', scrimOpacity.toFixed(3));

    // 4. Scroll cue indicator opacity (fades out as scroll begins)
    const cueOpacity = Math.max(0, 1 - p * 4);
    el.style.setProperty('--hero-cue-opacity', cueOpacity.toFixed(3));
  }, []);

  // Sync actual header height with subpixel precision via ResizeObserver
  useEffect(() => {
    const updateHeaderHeight = () => {
      const headerEl = document.querySelector('.header-wrapper');
      const measured = headerEl ? Math.round(headerEl.getBoundingClientRect().height) : (window.innerWidth <= 768 ? 98 : 104);
      if (measured > 0) {
        headerHeightRef.current = measured;
        if (containerRef.current) {
          containerRef.current.style.setProperty('--header-total-height', `${measured}px`);
        }
      }
    };

    updateHeaderHeight();

    const headerEl = document.querySelector('.header-wrapper');
    let observer: ResizeObserver | null = null;
    if (headerEl && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => updateHeaderHeight());
      observer.observe(headerEl);
    }

    window.addEventListener('resize', updateHeaderHeight, { passive: true });

    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
      if (observer) observer.disconnect();
    };
  }, []);

  // Detect reduced-motion preferences
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);

    const motionListener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    motionQuery.addEventListener('change', motionListener);

    return () => {
      motionQuery.removeEventListener('change', motionListener);
    };
  }, []);

  // Throttled scroll listener with single pending RAF
  useEffect(() => {
    if (prefersReducedMotion) return;

    let isTicking = false;

    const handleScroll = () => {
      if (!isTicking) {
        scrollRafIdRef.current = window.requestAnimationFrame(() => {
          isTicking = false;
          if (!containerRef.current) return;

          const rect = containerRef.current.getBoundingClientRect();
          const windowHeight = window.innerHeight;
          const headerHeight = headerHeightRef.current;
          const stickyFrameHeight = windowHeight - headerHeight;
          const totalScrollable = rect.height - stickyFrameHeight;

          if (totalScrollable > 0) {
            // Distance scrolled past header alignment line
            const currentOffset = headerHeight - rect.top;
            const rawProgress = currentOffset / totalScrollable;
            const progress = rawProgress <= 0.001 ? 0 : Math.min(Math.max(rawProgress, 0), 1);
            applyScrollProperties(progress);
          }
        });
        isTicking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (scrollRafIdRef.current) {
        cancelAnimationFrame(scrollRafIdRef.current);
      }
    };
  }, [prefersReducedMotion, applyScrollProperties]);

  return (
    <section
      ref={containerRef}
      className={`cinematic-hero-track ${prefersReducedMotion ? 'cinematic-hero-track--reduced' : ''}`}
      aria-label="VÊTU Autumn Campaign Editorial"
    >
      <div className="cinematic-hero-sticky">
        {/* Expanding Media Frame */}
        <div className="cinematic-hero-media-wrapper">
          {/* Campaign Photography */}
          <div className="cinematic-hero-media">
            <picture className="cinematic-hero-picture">
              <source media="(max-width: 768px)" srcSet={HERO_CONTENT.mobileImage} />
              <img
                src={HERO_CONTENT.desktopImage}
                alt={HERO_CONTENT.alt}
                className="cinematic-hero-image"
                loading="eager"
              />
            </picture>
          </div>

          {/* Dynamic Editorial Gradient Scrim */}
          <div className="cinematic-hero-scrim" aria-hidden="true" />

          {/* Editorial Content */}
          <div className="cinematic-hero-content">
            {/* 1. Eyebrow Line */}
            <div className="cinematic-hero-eyebrow-wrapper">
              <span className="cinematic-hero-eyebrow">
                {HERO_CONTENT.eyebrow}
              </span>
              <span className="cinematic-hero-eyebrow-sep" aria-hidden="true">&middot;</span>
              <span className="cinematic-hero-eyebrow-tag">
                {HERO_CONTENT.categoryTag}
              </span>
            </div>

            {/* 2. Editorial Headline */}
            <h1 className="cinematic-hero-headline">
              {HERO_CONTENT.headlineLine1}
              <br />
              <em className="cinematic-hero-headline-em">{HERO_CONTENT.headlineLine2}</em>
            </h1>

            {/* 3. Supporting Paragraph */}
            <p className="cinematic-hero-copy">
              {HERO_CONTENT.copy}
            </p>

            {/* 4. Action Buttons */}
            <div className="cinematic-hero-actions">
              <Link to="/catalog" className="cinematic-btn cinematic-btn--primary">
                Explore the collection
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
              <a href="#brand-story" className="cinematic-btn cinematic-btn--ghost">
                Discover our approach
              </a>
            </div>

            {/* 5. Editorial Stats Row */}
            <div className="cinematic-hero-stats-row">
              <div className="cinematic-hero-stat-pill">
                <span className="cinematic-stat-number">200+</span>
                <span className="cinematic-stat-label">CURATED PIECES</span>
              </div>
              <div className="cinematic-hero-stat-sep" aria-hidden="true" />
              <div className="cinematic-hero-stat-pill">
                <span className="cinematic-stat-number">4.8 / 5</span>
                <span className="cinematic-stat-label">CLIENT RATING</span>
              </div>
              <div className="cinematic-hero-stat-sep" aria-hidden="true" />
              <div className="cinematic-hero-stat-pill">
                <span className="cinematic-stat-number">10K+</span>
                <span className="cinematic-stat-label">DELIVERED</span>
              </div>
            </div>
          </div>

          {/* Minimal Scroll Cue Indicator */}
          {!prefersReducedMotion && (
            <div className="cinematic-hero-scroll-cue" aria-hidden="true">
              <span className="cinematic-hero-scroll-text">SCROLL TO EXPAND</span>
              <div className="cinematic-hero-scroll-line">
                <span className="cinematic-hero-scroll-pip" />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default CinematicHero;
