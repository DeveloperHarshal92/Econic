import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePrefersReducedMotion } from '../../hooks';
import look2Img from '../../assets/vetu-campaign-look-02.jpg';
import look3Img from '../../assets/vetu-campaign-look-03.jpg';
import './InteractiveSelector.css';

// ─── Types & Data ──────────────────────────────────────────

export interface CollectionItem {
  id: string;
  number: string;
  title: string;
  tagline: string;
  description: string;
  image: string;
  imageAlt: string;
  link: string;
  category: string;
}

export interface InteractiveSelectorProps {
  items?: CollectionItem[];
  defaultIndex?: number;
  className?: string;
}

export const VETU_COLLECTIONS: CollectionItem[] = [
  {
    id: 'everyday-essentials',
    number: '01',
    title: 'Everyday Essentials',
    tagline: 'Architectural Knits & Relaxed Trousers',
    description: 'Refined daily garments constructed from premium organic cotton and breathable knit blends, designed for effortless layering.',
    image: look3Img,
    imageAlt: 'VÊTU campaign model in architectural knit overshirt and relaxed charcoal trousers',
    link: '/catalog?category=Clothing',
    category: 'Clothing',
  },
  {
    id: 'modern-tailoring',
    number: '02',
    title: 'Modern Tailoring',
    tagline: 'Unstructured Blazers & Clean Lines',
    description: 'Unconstructed silhouettes shaped with relaxed wool blends and neutral taupes, merging formal precision with contemporary comfort.',
    image: look2Img,
    imageAlt: 'VÊTU campaign model in relaxed taupe unconstructed blazer and olive tailored trousers',
    link: '/catalog?category=Clothing',
    category: 'Clothing',
  },
  {
    id: 'elevated-basics',
    number: '03',
    title: 'Elevated Basics',
    tagline: 'Essential Foundations & Clean Cuts',
    description: 'Timeless foundational pieces crafted with disciplined proportions, heavyweight jerseys, and minimalist aesthetic intent.',
    image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=1200&q=85',
    imageAlt: 'Model in minimalist neutral overshirt and foundational organic tee',
    link: '/catalog?category=Clothing',
    category: 'Clothing',
  },
  {
    id: 'weekend-edit',
    number: '04',
    title: 'Weekend Edit',
    tagline: 'Effortless Outerwear & Casual Footwear',
    description: 'Casual silhouettes, durable canvas outerwear, and minimalist footwear designed for understated off-duty ease.',
    image: 'https://images.unsplash.com/photo-1509967419530-da38b4704bc6?auto=format&fit=crop&w=1200&q=85',
    imageAlt: 'Streetwear and weekend outerwear in understated earth tones',
    link: '/catalog?category=Footwear',
    category: 'Footwear',
  },
  {
    id: 'conscious-collection',
    number: '05',
    title: 'Conscious Collection',
    tagline: 'Natural Linen & Sustainable Fibers',
    description: 'Thoughtfully sourced organic materials with low-impact botanical dyes and enduring construction for an intentional wardrobe.',
    image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=1200&q=85',
    imageAlt: 'Editorial model in natural linen and earth-toned tailored textures',
    link: '/catalog?category=Clothing',
    category: 'Clothing',
  },
];

const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22600%22%20height%3D%22800%22%20viewBox%3D%220%200%20600%20800%22%3E%3Crect%20fill%3D%22%23EFECE6%22%20width%3D%22600%22%20height%3D%22800%22%2F%3E%3Ctext%20fill%3D%22%2377766F%22%20font-family%3D%22sans-serif%22%20font-size%3D%2224%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20text-anchor%3D%22middle%22%3EV%C3%8ATU%20COLLECTION%3C%2Ftext%3E%3C%2Fsvg%3E";

// ─── Component ─────────────────────────────────────────────

export const InteractiveSelector: React.FC<InteractiveSelectorProps> = ({
  items = VETU_COLLECTIONS,
  defaultIndex = 0,
  className = '',
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    if (defaultIndex >= 0 && defaultIndex < items.length) {
      return defaultIndex;
    }
    return 0;
  });

  const prefersReducedMotion = usePrefersReducedMotion();

  const handleSelect = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect(index);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = (index + 1) % items.length;
        handleSelect(nextIndex);
        const nextItem = items[nextIndex];
        if (nextItem) {
          const nextEl = document.getElementById(`vetu-panel-${nextItem.id}`);
          nextEl?.focus();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = (index - 1 + items.length) % items.length;
        handleSelect(prevIndex);
        const prevItem = items[prevIndex];
        if (prevItem) {
          const prevEl = document.getElementById(`vetu-panel-${prevItem.id}`);
          prevEl?.focus();
        }
      }
    },
    [handleSelect, items]
  );

  return (
    <div
      className={`vetu-selector ${prefersReducedMotion ? 'vetu-selector--reduced-motion' : ''} ${className}`.trim()}
      role="region"
      aria-label="Interactive Curated Collections Selector"
    >
      <div className="vetu-selector__track" role="tablist" aria-orientation="horizontal">
        {items.map((item, index) => {
          const isActive = index === activeIndex;

          return (
            <div
              key={item.id}
              id={`vetu-panel-${item.id}`}
              className={`vetu-panel ${isActive ? 'vetu-panel--active' : 'vetu-panel--inactive'}`}
              role="tab"
              aria-selected={isActive}
              aria-expanded={isActive}
              aria-controls={`vetu-panel-content-${item.id}`}
              aria-label={`${item.number} ${item.title}`}
              tabIndex={isActive ? 0 : 0}
              onClick={() => handleSelect(index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {/* Background Media */}
              <div className="vetu-panel__media">
                <img
                  src={item.image}
                  alt={item.imageAlt}
                  className="vetu-panel__img"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                  }}
                />
                <div className="vetu-panel__scrim" />
              </div>

              {/* Inactive State: Vertical Collapsed Tag */}
              <div className="vetu-panel__collapsed-tag" aria-hidden={isActive}>
                <span className="vetu-panel__collapsed-num">{item.number}</span>
                <span className="vetu-panel__collapsed-line" />
                <span className="vetu-panel__collapsed-title">{item.title}</span>
              </div>

              {/* Active State: Expanded Content Card */}
              <div
                id={`vetu-panel-content-${item.id}`}
                className="vetu-panel__expanded-content"
                aria-hidden={!isActive}
              >
                <div className="vetu-panel__eyebrow-row">
                  <span className="vetu-panel__badge">{item.number}</span>
                  <span className="vetu-panel__category">{item.category}</span>
                </div>

                <h3 className="vetu-panel__title">{item.title}</h3>
                <p className="vetu-panel__tagline">{item.tagline}</p>
                <p className="vetu-panel__description">{item.description}</p>

                <div className="vetu-panel__actions">
                  <Link
                    to={item.link}
                    className="vetu-panel__cta-btn"
                    tabIndex={isActive ? 0 : -1}
                    aria-label={`Shop the ${item.title} collection`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>Shop Collection</span>
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InteractiveSelector;
