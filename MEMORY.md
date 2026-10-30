# VÊTU — Project Memory & Development Continuity Document

> **Document Type:** Central Project Memory, Architecture State & Development Continuity Ledger  
> **Repository:** VÊTU Headless Micro-Frontend E-Commerce Platform  
> **Location:** Root `MEMORY.md` (authoritative continuity file)  
> **Status:** Active, Authoritative & Fully Audited  
> **Audit Date:** October 30, 2026  
> **Primary Authority:** Actual repository source code, package manifests, passing test suites, and live browser DevTools verification.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Project Architecture & Ingress Topology](#2-project-architecture--ingress-topology)
3. [Completed Development Processes (Chronological Audit)](#3-completed-development-processes-chronological-audit)
4. [Current Development Status (Evidence-Based Classification)](#4-current-development-status-evidence-based-classification)
5. [Current In-Progress Tasks](#5-current-in-progress-tasks)
6. [Upcoming Development Roadmap](#6-upcoming-development-roadmap)
7. [Architectural Decisions & Inviolable Rules](#7-architectural-decisions--inviolable-rules)
8. [Known Issues & Technical Debt Matrix](#8-known-issues--technical-debt-matrix)
9. [Verified Development Commands & Environment Setup](#9-verified-development-commands--environment-setup)
10. [Mandatory Instructions for Future AI Agents](#10-mandatory-instructions-for-future-ai-agents)

---

## 1. Project Overview

### 1.1 Brand Identity & Concept
**VÊTU** is a headless, luxury editorial e-commerce platform designed for curated fashion garments and lifestyle essentials. The brand aesthetic is grounded in minimal editorial luxury—prioritizing serene typography (`DM Serif Display` and `Inter`), a warm architectural palette (warm ivory `#F7F5F0`, deep forest green `#12372B`, charcoal `#1D211E`, and taupe `#C9BBA7`), restrained geometric proportions, Indian Rupee (`₹`) pricing, and smooth, hardware-accelerated micro-interactions.

### 1.2 Technology Stack (Manifest Specifications vs. Resolved Runtime)
All version numbers have been audited against actual repository manifests (`package.json`) and resolved runtime packages:

| Component | Manifest Specification | Resolved Runtime Version | Location / Manifest |
|---|---|---|---|
| **Node.js Engine** | `>=18.0.0` | `v22.23.2` | Root `package.json` (`engines.node`) |
| **npm** | `>=9.0.0` | `10.9.8` | Host CLI runtime |
| **TypeScript** | `^5.3.3` | `5.9.3` | Root devDependencies & `tsconfig.base.json` |
| **React** | `^18.2.0` | `18.3.1` | `packages/*/package.json` |
| **React DOM** | `^18.2.0` | `18.3.1` | `packages/*/package.json` |
| **React Router DOM** | `^6.22.0` | `6.22.0` | `packages/*/package.json` |
| **Webpack** | `^5.90.1` | `5.111.1` | `packages/*/package.json` (`devDependencies`) |
| **Webpack Dev Server** | `^4.15.2` | `4.15.2` | `packages/*/package.json` (`devDependencies`) |
| **Express** | `^4.18.2` | `4.22.3` | `services/api-gateway/package.json` |
| **Mongoose** | `^8.1.1` | `8.24.5` | `services/api-gateway/package.json` |
| **MongoDB** | `7.0` | `7.0` (Community / Docker) | `docker-compose.yml` (`image: mongo:7.0`) |
| **Redis** | `7.2-alpine` | `7.2-alpine` / Cloud | `docker-compose.yml` (`image: redis:7.2-alpine`) |
| **ioredis** | `^5.3.2` | `5.11.1` | `services/api-gateway/package.json` |
| **Razorpay SDK** | `^2.9.8` | `2.9.8` (**Test Mode Only**) | `services/api-gateway/package.json` |
| **Vitest** | `^1.2.2` | `1.6.1` | `services/api-gateway/package.json` (`devDependencies`) |
| **Zod** | `^3.22.4` | `3.25.76` | `services/api-gateway/package.json` |
| **Helmet** | `^7.1.0` | `7.1.0` | `services/api-gateway/package.json` |
| **CORS** | `^2.8.5` | `2.8.5` | `services/api-gateway/package.json` |
| **Express Rate Limit** | `^7.1.5` | `7.1.5` | `services/api-gateway/package.json` |

---

## 2. Project Architecture & Ingress Topology

### 2.1 Development Ingress Architecture (`localhost`)
In local development, the platform runs a **unified single-port browser ingress** on `http://localhost:3000`. The Shell Dev Server acts as the central reverse proxy so that users never switch ports during browsing:

```text
Browser Client (Local Development)
       │
       ▼ http://localhost:3000
┌────────────────────────────────────────────────────────┐
│           Shell Dev Server Gateway (:3000)             │
│                                                        │
│  /                     ──► Shell React Host            │
│  /catalog/*            ──► Catalog MFE (via proxy)     │
│  /cart/*               ──► Cart MFE (via proxy)        │
│  /checkout/*           ──► Checkout MFE (via proxy)    │
│  /remote/catalog/*     ──► Proxy to Dev Server :3001   │
│  /remote/cart/*        ──► Proxy to Dev Server :3002   │
│  /remote/checkout/*    ──► Proxy to Dev Server :3003   │
│  /api/*                ──► Proxy to API Gateway :4000  │
└────────────────────────────────────────────────────────┘
       │                 │                │               │
       ▼                 ▼                ▼               ▼
 Catalog Dev :3001  Cart Dev :3002  Checkout Dev :3003  Express API :4000
                                                          │             │
                                                          ▼             ▼
                                                       MongoDB        Redis
                                                       :27017        :11173 / :6379
```

### 2.2 Production Ingress Architecture (Target Cloud Topology)
> [!IMPORTANT]
> `localhost` is strictly for development. In production, client traffic routes through a secure edge reverse proxy (e.g., AWS ALB / Cloudflare) to an Nginx gateway listening on ports 80/443 under a production domain (e.g., `store.vetu.com`).

```text
Internet / Browser Client
       │
       ▼ HTTPS (e.g. https://store.vetu.com)
┌────────────────────────────────────────────────────────┐
│             Production Edge / Nginx Gateway            │
│                                                        │
│  /                     ──► Shell Static Bundle         │
│  /remote/catalog/      ──► Internal http://catalog:3001│
│  /remote/cart/         ──► Internal http://cart:3002   │
│  /remote/checkout/     ──► Internal http://checkout:3003
│  /api/                 ──► Internal http://api-gateway:4000
└────────────────────────────────────────────────────────┘
       │                 │                │               │
       ▼                 ▼                ▼               ▼
 catalog container  cart container  checkout container  api-gateway container
                                                          │             │
                                                          ▼             ▼
                                                    Managed MongoDB  Managed Redis
```

* **Production Nginx Configuration:** Defined in [`packages/shell/nginx.conf`](file:///c:/College%20Work/Internship/Infyntrek/Project%202/packages/shell/nginx.conf) routing upstream traffic to internal Docker container service names (`catalog:3001`, `cart:3002`, `checkout:3003`, `api-gateway:4000/api/`).
* **Chunk & Remote Resolution:** Remotes use `publicPath: 'auto'` which evaluates asset chunks relative to `document.currentScript.src`. Because `remoteEntry.js` is loaded from `/remote/<mfe>/remoteEntry.js`, all nested chunks and assets resolve through the unified ingress without cross-origin conflicts.

### 2.3 Component Responsibilities
* **Shell (`packages/shell`):** Host application, global header with Announcement Bar (`31.875px`) and navigation (`76px`), flagship landing page, analytics dashboard, remote reverse-proxying, and resilient remote loading via `retryLazy`.
* **Catalog Remote (`packages/catalog`):** Product discovery, category filtering, search, and Product Detail Pages (`/catalog/:slug` and `/catalog/products/:id`). Persists cart additions authoritatively via `POST /api/cart/items`.
* **Cart Remote (`packages/cart`):** Anonymous session shopping bag mounted under `/cart`. Renders line items, interactive quantity steppers, item deletion, and communicates with `PATCH /api/cart/items/:sku`.
* **Checkout Remote (`packages/checkout`):** Two-step checkout flow mounted under `/checkout`. Gathers shipping details, initiates Razorpay orders in paise via `POST /api/orders`, handles modal callbacks, verifies HMAC-SHA256 signatures via `POST /api/orders/payments/verify`, and redirects to `/checkout/confirmation/:orderNumber`.
* **API Gateway (`services/api-gateway`):** Centralized backend on port 4000. Handles Zod validation, MongoDB persistence, atomic inventory reservations, Redis pub/sub messaging with `EventEnvelope` deduplication, and Razorpay payment operations.

### 2.4 Cart Session Lifecycle & Ownership
The cart state architecture is strictly backend-authoritative. MongoDB is the single source of truth for cart persistence and line-item pricing:
1. **Shared Key Identification:** All microfrontends use the shared key `vetu_cart_session` in `localStorage`.
2. **HTTP Header Delivery:** Catalog, Cart, and Checkout include the header `'x-cart-session': sessionId` on every cart request.
3. **Backend Resolution:** In [`services/api-gateway/src/routes/cart.routes.ts`](file:///c:/College%20Work/Internship/Infyntrek/Project%202/services/api-gateway/src/routes/cart.routes.ts), `getSessionId(req)` extracts `req.headers['x-cart-session']` and delegates to `cartService.getOrCreateCart(sessionId)`.
4. **Order Conversion:** In [`services/api-gateway/src/routes/order.routes.ts`](file:///c:/College%20Work/Internship/Infyntrek/Project%202/services/api-gateway/src/routes/order.routes.ts), `POST /api/orders` reads `x-cart-session` and converts the active session cart into a pending order.
5. **Cross-MFE Event Protocol:**
   - `cart:updated`: Dispatched with `{ itemCount: number, subtotal: number }` in `detail`. Consumed by Shell `Header.tsx` to immediately increment or decrement the header bag badge.
   - `cart:refresh`: Dispatched by Catalog or checkout mutations to trigger background rehydration if `CartContext` is mounted.
   - *(Note: The legacy client-only `cart:add` event was deprecated and removed; Catalog now invokes the backend API directly).*

---

## 3. Completed Development Processes (Chronological Audit)

Every development phase recorded below has been audited against actual codebase evidence. Statuses are categorized as **Independently Verified**, **Implemented**, or **Corrected / Needs Reverification**:

| # | Development Phase | Status | Audit Findings & Code Evidence | Key Artifacts |
|---|---|---|---|---|
| **1** | **Monorepo & Workspace Setup** | **Independently Verified** | Verified npm workspaces (`packages/*`, `services/*`). Root build and test scripts active. | `package.json`, `tsconfig.base.json` |
| **2** | **Backend Foundation & API Gateway** | **Independently Verified** | Express gateway with Helmet, CORS, rate limiting (200 req/15min), Zod validation, and structured logging. | `services/api-gateway/src/server.ts` |
| **3** | **MongoDB & Redis Integration** | **Independently Verified** | Mongoose 8 with connection pooling; Redis pub/sub with `EventEnvelope` and `instanceId` deduplication in `eventBus.ts`. | `services/api-gateway/src/events/eventBus.ts` |
| **4** | **Authentication & Authorization** | **Independently Verified** | HS256 JWT verification with `requireAdmin` role checking on product mutations (`POST`, `PATCH`, `DELETE`). | `services/api-gateway/src/middleware/auth.middleware.ts` |
| **5** | **Product & Catalog Backend** | **Independently Verified** | Multi-variant product schema, category listing, soft delete (`isActive: false`). 35 unit/integration tests passing. | `services/api-gateway/src/models/product.model.ts` |
| **6** | **Cart & Order Management** | **Independently Verified** | Session-based cart persistence with automatic tax/subtotal calculation. Atomic inventory decrement logic. | `services/api-gateway/src/services/cart.service.ts` |
| **7** | **Checkout & Razorpay Test Integration** | **Independently Verified** | Server-side Razorpay order creation in paise; client modal trigger; timing-safe HMAC-SHA256 signature verification. Legacy simulated endpoint disabled. | `services/api-gateway/src/services/razorpay.service.ts` |
| **8** | **Module Federation Setup** | **Independently Verified** | Webpack 5 Module Federation configured across Shell, Catalog, Cart, and Checkout with shared singletons (`react`, `react-dom`, `react-router-dom`). | `packages/*/webpack.config.js` |
| **9** | **Landing Page & Brand Design System** | **Independently Verified** | Luxury editorial aesthetic implemented with `#F7F5F0`, `#12372B`, `DM Serif Display`, and Indian Rupee (`₹`) formatting. | `docs/DESIGN.md`, `packages/shell/src/pages/HomePage.tsx` |
| **10** | **Motion Phase 1: Hero Simplification** | **Independently Verified** | Scroll-expanding hero card (`CinematicHero.tsx`) with single RAF loop and passive listeners. QA script verified. | `packages/shell/src/components/CinematicHero.tsx`, `qa-hero-phase1-verification.mjs` |
| **11** | **Motion Phase 2: Shared Motion Utilities** | **Corrected / Verified** | **Correction:** Previous reports claimed a standalone `useScrollProgress` hook in `hooks/index.ts`. Inspection confirms `hooks/index.ts` exports `useIntersectionObserver` and `usePrefersReducedMotion`. Scroll progress is computed inline in `CinematicHero.tsx` using `requestAnimationFrame`. | `packages/shell/src/hooks/index.ts`, `qa-phase2-utilities.mjs` |
| **12** | **Motion Phase 3: Categories & Collections** | **Implemented** | 4-tile Category Discovery grid and Curated Collections section with Look 02/03 asset reuse and intersection observer reveals. | `packages/shell/src/pages/HomePage.tsx`, `qa-phase3-categories-collections.mjs` |
| **13** | **Motion Phase 4: New Arrivals & Brand Story** | **Implemented** | Staggered reveals on New Arrivals product cards; asymmetric 3-column editorial layout for Brand Story (`EST. 2024`). | `packages/shell/src/pages/HomePage.tsx`, `qa-phase4-products-brandstory.mjs` |
| **14** | **Motion Phase 5: Benefits & Newsletter** | **Implemented** | 4 customer benefits; newsletter signup card with discount code `VETU10` and `aria-live` announcements. | `packages/shell/src/pages/HomePage.tsx`, `qa-phase5-benefits-newsletter.mjs` |
| **15** | **Motion Phase 6: Full Landing Page QA** | **Implemented** | Multi-viewport responsive audit (375px to 1440px), 0 horizontal overflow, CLS measured at 0.059 (< 0.10). | `docs/FINAL_LANDING_PAGE_REVIEW.md`, `qa-phase6-full-audit.mjs` |
| **16** | **Catalog UI Modernization** | **Independently Verified** | Modernized Catalog MFE (`port 3001`) with VÊTU tokens, 3:4 portrait ProductCards, filters, and ProductDetailPage. | `packages/catalog/src/styles/catalog.css`, `docs/STOREFRONT_UI_MODERNIZATION.md` |
| **17** | **Cart UI Modernization** | **Independently Verified** | Modernized Cart MFE (`port 3002`) with VÊTU tokens, portrait thumbnails, quantity steppers, and sticky order summary. | `packages/cart/src/styles/cart.css`, `docs/STOREFRONT_UI_MODERNIZATION.md` |
| **18** | **Checkout UI Modernization** | **Independently Verified** | Modernized Checkout MFE (`port 3003`) with two-stage clean layout, Razorpay branding in `#12372B`, and confirmation page. | `packages/checkout/src/styles/checkout.css`, `docs/STOREFRONT_UI_MODERNIZATION.md` |
| **19** | **Automated Test Suite Expansion** | **Independently Verified** | API test suite expanded to **89 tests passing** across 8 test suites in Vitest. | `services/api-gateway/src/tests/` |
| **20** | **Microfrontend Integration & Architecture Stabilization** | **Independently Verified** | Fixed PDP blank screen (`<base href="/" />`, `publicPath: '/'`, dual routing, ObjectId resolution); fixed cart sync via direct API persistence and event broadcasting; unified browser ingress through `localhost:3000`; scoped `.container` in `catalog.css` eliminating header layout inflation. | `docs/MICROFRONTEND_INTEGRATION_AUDIT.md`, `scripts/verify-full-flow.mjs` |
| **21** | **Catalog Product Grid Visibility & Rendering Stabilization** | **Independently Verified** | Fixed invisible product cards on `/catalog` caused by CSS selector bleed (`.product-card { opacity: 0; transform: translateY(14px) }` leaked from un-scoped `HomePage.css`). Scoped `HomePage.css` to `.products-section .product-card` and added defensive CSS rules in `catalog.css`. Corrected pagination count text to accurately display active slice (`Showing 1–12 of 200 curated pieces`). Verified across 5 viewports (1440px, 1280px, 768px, 390px, 375px), pagination, and reduced motion via 24/24 passing CDP tests. | `docs/CATALOG_PRODUCT_VISIBILITY_FIX.md`, `scripts/verify-catalog-visual.mjs` |

---

## 4. Current Development Status (Evidence-Based Classification)

To maintain architectural integrity, features are classified according to strict evidentiary standards:

### 4.1 Independently Verified Features (Tested & Passing Live)
* **Unified Single-Port Ingress (`http://localhost:3000`):** DevServer reverse proxy routes `/api` (:4000), `/remote/catalog` (:3001), `/remote/cart` (:3002), and `/remote/checkout` (:3003). Verified live via real Chrome CDP browser test.
* **Product Detail Page Routing:** Verified live on `/catalog/:slug` and `/catalog/products/:id` (MongoDB ObjectId). Missing products render editorial 404 state without white screens.
* **Cross-MFE Cart Persistence & Sync:** Adding an item in Catalog persists to MongoDB and updates Shell Header badge (`1`). Stepper increments update quantity to `2`. Page refresh retains cart items.
* **Header & Announcement Bar Rhythm:** Uniform across all 5 routes (`/`, `/catalog`, `/catalog/:slug`, `/cart`, `/checkout`):
  * Announcement Bar Height: Exactly **31.875px**.
  * Header Height: Exactly **76.000px**.
  * Vertical Padding: Exactly **0px** (no container leakage).
* **Catalog Product Grid Visibility & Responsive Layout:** Verified 100% visible across 5 viewports (1440px desktop 4 columns, 1280px laptop 3 columns, 768px tablet 2 columns, 390px/375px mobile 1 column) with `opacity: 1`, `transform: none`, non-zero client bounding rects, image loading, and hover micro-interactions.
* **Dynamic Pagination Slice Count:** Corrected and verified active slice formatting (`Showing ${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total} curated pieces`) on page 1 (`1–12 of 200`) and page 2 (`13–24 of 200`).
* **Automated Regression Suites:**
  * Vitest Backend API: **89 passed (100%)** across 8 suites in 7.50s.
  * Browser CDP E2E (`scripts/verify-full-flow.mjs`): **22 passed (100%)**.
  * Browser CDP Visual Suite (`scripts/verify-catalog-visual.mjs`): **24 passed (100%)** across 5 viewports, pagination, PDP direct navigation, and reduced motion.
  * TypeScript / Lint (`npm run lint`): **0 errors** across all workspaces.

### 4.2 Implemented (Verified in Codebase)
* **Seeded Catalog:** Inspection of `services/api-gateway/src/scripts/seed.ts` verifies **8 curated products** across 6 categories (`Outerwear`, `Footwear`, `Tops`, `Bags`, `Accessories`, `Bottoms`).
  > [!NOTE]
  > Historical documentation previously claimed "200 seeded products across 4 categories". The actual seed script defines 8 products. The "200" in earlier notes was an accidental conflation with the rate limiter (200 req/15min) or HTTP 200 status.
* **Pagination:** Verified in `ProductListPage.tsx` (`limit: 12` items per page).
* **Analytics Platform:** Verified `/analytics` route mounting `AnalyticsDashboardPage.tsx` and querying `/api/analytics/dashboard`.
* **Resilient Remote Loading:** `retryLazy` implemented in `packages/shell/src/App.tsx` (2 retries, 800ms backoff).
* **Production Nginx Proxy:** Implemented in `packages/shell/nginx.conf` proxying internal Docker hosts.

### 4.3 Reported But Not Independently Verified (Historical)
* **Phase 1–6 Motion Viewport Benchmarks:** Layout Shift (CLS 0.059) and multi-device viewports (375px, 768px, 1440px) were documented in `docs/FINAL_LANDING_PAGE_REVIEW.md` and have dedicated test scripts in `packages/shell/src/tests/`, but full multi-device matrix was run historically.

### 4.4 Pending (Not Yet Implemented)
* **Frontend User Authentication Flow:** Dedicated customer login/register modal in Shell with JWT persistence.
* **Cloud Production Deployment:** AWS/GCP/Render deployment with automated CI/CD and production domain routing.

### 4.5 Production Readiness Status: **PRE-PRODUCTION (STABILIZED)**
> [!WARNING]
> While local development is fully stabilized and all integration tests pass with 100% success, the platform is **not yet production-ready**. 
> Production readiness requires:
> 1. Switching Razorpay from **Test Mode** (`rzp_test_...`) to live merchant credentials following business KYC.
> 2. Cloud infrastructure provisioning (managed MongoDB Atlas, managed Redis, production domain SSL certificate).
> 3. Production secrets management (replacing development JWT secrets and Redis passwords).

---

## 5. Current In-Progress Tasks

* **Task 1: Production Deployment Configuration:** Formulate production Docker Compose environment and verify multi-stage Docker builds without exposed internal development ports.
* **Task 2: Customer Authentication Flow:** Design customer sign-in/account modal in Shell to integrate with existing backend JWT endpoints.

---

## 6. Upcoming Development Roadmap

1. **User Authentication Front-End:** Customer registration, login, order history view, and saved shipping addresses.
2. **Search Enhancement:** Full-text search index and debounced search auto-complete in Catalog.
3. **Admin Dashboard Microfrontend:** Dedicated admin portal for inventory restocking, catalog curation, and order tracking.
4. **CI/CD Pipeline:** GitHub Actions workflow executing `npm run lint`, `npm run test:api`, and `node scripts/verify-full-flow.mjs`.

---

## 7. Architectural Decisions & Inviolable Rules

1. **Microfrontend Preservation:** Never merge microfrontends into a monolith. Webpack 5 Module Federation must remain independent with standalone capability.
2. **Backend Authoritative State:** MongoDB and Express Gateway are the sole authorities for prices, inventory, cart persistence, and payment verification. Frontend state is for synchronization and UI reactivity only.
3. **Unified Single-Port Ingress:** In development, all customer journeys route through `http://localhost:3000`. Do not expose ports 3001–3003 in standard navigation.
4. **Razorpay Security:** All payment transactions must execute in Test Mode until production handover. Simulated `/confirm` payment endpoints must remain disabled. HMAC-SHA256 signature verification is mandatory.
5. **CSS Scoping Integrity:** Never declare un-scoped global selectors or component selectors (e.g. `.product-card` in `HomePage.css` or `.container` in `catalog.css`) in host or remote stylesheets that can leak across microfrontend boundaries. Scope styles under specific containers such as `.products-section`, `.catalog-mfe`, `.cart-page`, or `.checkout-page`.
6. **VÊTU Brand System:** Adhere strictly to the minimal editorial luxury tokens (`#F7F5F0`, `#12372B`, `#1D211E`, `#C9BBA7`, `DM Serif Display`, `Inter`).

---

## 8. Known Issues & Technical Debt Matrix

| Item | Severity | Impact | Mitigation / Status |
|---|---|---|---|
| Windows Sandbox Docker Daemon | Low | Docker daemon requires manual host elevation | Local development verified natively via Node.js v22 and background daemons |
| Inline Scroll Progress in Hero | Low | Scroll logic is coupled to `CinematicHero.tsx` rather than a shared hook | Acceptable; keeps hero self-contained and avoids hook bloat |
| Razorpay Test Mode Keys | Low | Real payments cannot be processed | Expected during development; explicitly locked to test mode |

---

## 9. Verified Development Commands & Environment Setup

```bash
# 1. Install dependencies across all workspaces
npm install

# 2. Build shared packages and services
npm run build:shared
npm run build:api
npm run build:catalog
npm run build:cart
npm run build:checkout
npm run build:shell

# 3. Start local development daemons
npm run dev:api        # Port 4000 (Backend API Gateway)
npm run dev:catalog    # Port 3001 (Catalog remote)
npm run dev:cart       # Port 3002 (Cart remote)
npm run dev:checkout   # Port 3003 (Checkout remote)
npm run dev:shell      # Port 3000 (Unified ingress host)

# 4. Run automated test suites
npm run lint                         # TypeScript / ESLint across all workspaces (0 errors)
npm run test:api                     # 89 Vitest backend API tests (100% pass)
node scripts/verify-full-flow.mjs    # 22 Chrome DevTools Protocol E2E browser tests (100% pass)
node scripts/verify-catalog-visual.mjs # 24 Chrome DevTools Protocol responsive/visual tests (100% pass)

# 5. Database seeding (8 curated products)
npm run seed
```

---

## 10. Mandatory Instructions for Future AI Agents

1. **Read `MEMORY.md` Before Proposing Changes:** This document is the single source of truth for architecture, ports, and verified features.
2. **Preserve Single-Port Ingress:** Keep `http://localhost:3000` as the unified browser entry point. Maintain devServer and Nginx reverse proxy mappings.
3. **Do Not Alter Finalized Landing Page Motion:** The scroll-expanding hero in `CinematicHero.tsx` is finalized. Do not reintroduce carousels or autoplay timers.
4. **Enforce Backend Persistence on Cart Operations:** Never rely solely on custom browser events for cart data; always mutate via `/api/cart` with `x-cart-session`.
5. **Verify With Automated Tests:** Always run `npm run lint`, `npm run test:api`, and `node scripts/verify-full-flow.mjs` before marking tasks complete.

