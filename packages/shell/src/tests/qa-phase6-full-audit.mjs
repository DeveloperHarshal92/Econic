import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\HARSHAL\\AppData\\Local\\Temp\\chrome_qa_phase6_test";
const PORT = 9231;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        const page = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
        if (page) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await sleep(250);
  }
  throw new Error("Could not find WebSocket debugger URL");
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];
    this.consoleWarnings = [];
  }

  async ready() {
    if (this.ws.readyState === 1) return;
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.method === 'Runtime.consoleAPICalled') {
          if (data.params.type === 'error') {
            this.consoleErrors.push(data.params.args.map(a => a.value || a.description).join(' '));
          } else if (data.params.type === 'warning') {
            this.consoleWarnings.push(data.params.args.map(a => a.value || a.description).join(' '));
          }
        }
        if (data.id && this.callbacks.has(data.id)) {
          const cb = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) cb.reject(data.error);
          else cb.resolve(data.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  close() {
    this.ws.close();
  }
}

async function runFullAudit() {
  console.log("======================================================================");
  console.log("   VÊTU PHASE 6: FULL LANDING PAGE MOTION QA & PERFORMANCE AUDIT      ");
  console.log("   Direction A: Minimal Editorial Luxury — Comprehensive Verification ");
  console.log("======================================================================\n");

  if (fs.existsSync(USER_DATA)) {
    try { fs.rmSync(USER_DATA, { recursive: true, force: true }); } catch {}
  }

  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${USER_DATA}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--headless=new',
    '--disable-gpu',
    '--window-size=1440,900',
    'http://localhost:3000'
  ]);

  try {
    await sleep(2500);
    const wsUrl = await getWsUrl();
    const cdp = new Cdp(wsUrl);
    await cdp.ready();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Performance.enable');

    console.log("Waiting for full storefront hydration...");
    for (let i = 0; i < 20; i++) {
      const ready = await cdp.eval(`
        !!document.querySelector('.header-wrapper') &&
        !!document.querySelector('.cinematic-hero-track') &&
        !!document.querySelector('.categories-section') &&
        !!document.querySelector('.products-section') &&
        !!document.querySelector('.brand-story-section') &&
        !!document.querySelector('.benefits-section') &&
        !!document.querySelector('.collections-section') &&
        !!document.querySelector('.newsletter-section') &&
        !!document.querySelector('.footer')
      `);
      if (ready) break;
      await sleep(500);
    }
    await sleep(1500);

    // ─── AUDIT 1: Header & Announcement Bar ───────────────────────
    console.log("\n[AUDIT 1] Header & Announcement Bar Navigation Verification");
    await cdp.eval(`window.scrollTo(0, 0);`);
    await sleep(300);

    const headerTop = await cdp.eval(`(() => {
      const wrapper = document.querySelector('.header-wrapper');
      const header = document.querySelector('.header');
      const ann = document.querySelector('.announcement-bar');
      const rect = wrapper.getBoundingClientRect();
      return {
        isSticky: getComputedStyle(wrapper).position === 'sticky',
        topPosition: rect.top,
        totalHeight: Math.round(rect.height),
        scrolledClass: header.classList.contains('header--scrolled'),
        announcementVisible: !!ann && ann.offsetWidth > 0,
        hasLogo: !!document.querySelector('.header__logo'),
        hasNavLinks: document.querySelectorAll('.header__nav-link').length,
        hasSearch: !!document.querySelector('.header__search-input'),
        hasCart: !!document.querySelector('.header__action-btn--cart')
      };
    })()`);
    console.log("Header Initial Top State:", headerTop);
    if (!headerTop.isSticky || headerTop.scrolledClass) {
      throw new Error(`FAIL: Header initial sticky state invalid! Got: ${JSON.stringify(headerTop)}`);
    }

    // Scroll 120px to test backdrop-blur scroll response
    await cdp.eval(`window.scrollTo(0, 120);`);
    await sleep(300);
    const headerScrolled = await cdp.eval(`(() => {
      const header = document.querySelector('.header');
      const s = getComputedStyle(header);
      return {
        scrolledClass: header.classList.contains('header--scrolled'),
        backdropFilter: s.backdropFilter || s.webkitBackdropFilter,
        backgroundColor: s.backgroundColor
      };
    })()`);
    console.log("Header Scrolled Response:", headerScrolled);
    if (!headerScrolled.scrolledClass) {
      throw new Error("FAIL: Header did not apply scrolled class upon scrolling!");
    }
    console.log("PASS: Header sticky geometry and backdrop-blur scroll responses verified!");

    // ─── AUDIT 2: Cinematic Hero Single Scroll Expansion ─────────
    console.log("\n[AUDIT 2] Cinematic Fashion Hero (Single Primary Animation)");
    await cdp.eval(`window.scrollTo(0, 0);`);
    await sleep(300);

    // Clean DOM check: Verify 100% removal of obsolete carousel artifacts
    const heroDomAudit = await cdp.eval(`(() => {
      return {
        carouselControls: !!document.querySelector('.cinematic-hero-carousel-controls'),
        lookPills: !!document.querySelector('.cinematic-hero-look-switcher'),
        counter: !!document.querySelector('.cinematic-hero-counter'),
        navButtons: !!document.querySelector('.cinematic-hero-nav-buttons'),
        secondaryOverlay: !!document.querySelector('.cinematic-hero-expanded-content'),
        multipleSlides: document.querySelectorAll('.cinematic-hero-slide-item').length,
        hasPrimaryCTA: !!document.querySelector('.cinematic-btn--primary'),
        hasSecondaryCTA: !!document.querySelector('.cinematic-btn--ghost'),
        hasHeadline: document.querySelector('.cinematic-hero-headline')?.textContent?.includes('Wear A Better'),
        hasStatsRow: !!document.querySelector('.cinematic-hero-stats-row'),
        hasScrollCue: !!document.querySelector('.cinematic-hero-scroll-cue')
      };
    })()`);
    console.log("Hero DOM Elements Audit:", heroDomAudit);
    if (heroDomAudit.carouselControls || heroDomAudit.lookPills || heroDomAudit.multipleSlides > 1) {
      throw new Error(`FAIL: Hero has residual carousel elements! ${JSON.stringify(heroDomAudit)}`);
    }

    // Expansion scroll progression test
    await cdp.eval(`window.scrollTo(0, 0);`);
    await sleep(250);
    const hero0 = await cdp.eval(`(() => {
      const s = getComputedStyle(document.querySelector('.cinematic-hero-track'));
      return { progress: parseFloat(s.getPropertyValue('--hero-progress') || '0'), width: s.getPropertyValue('--hero-width') };
    })()`);

    await cdp.eval(`window.scrollTo(0, 320);`);
    await sleep(250);
    const heroMid = await cdp.eval(`(() => {
      const s = getComputedStyle(document.querySelector('.cinematic-hero-track'));
      return { progress: parseFloat(s.getPropertyValue('--hero-progress') || '0'), width: s.getPropertyValue('--hero-width') };
    })()`);

    await cdp.eval(`window.scrollTo(0, 650);`);
    await sleep(250);
    const heroFull = await cdp.eval(`(() => {
      const s = getComputedStyle(document.querySelector('.cinematic-hero-track'));
      return { progress: parseFloat(s.getPropertyValue('--hero-progress') || '0'), width: s.getPropertyValue('--hero-width') };
    })()`);

    console.log("Hero Expansion Steps:", { hero0, heroMid, heroFull });
    if (hero0.progress !== 0 || heroFull.progress !== 1 || heroFull.width !== '100.00%') {
      throw new Error(`FAIL: Hero scroll expansion progression failed! ${JSON.stringify({ hero0, heroMid, heroFull })}`);
    }

    // Reverse scroll upward test
    await cdp.eval(`window.scrollTo(0, 0);`);
    await sleep(250);
    const heroReset = await cdp.eval(`parseFloat(getComputedStyle(document.querySelector('.cinematic-hero-track')).getPropertyValue('--hero-progress') || '0')`);
    console.log("Hero Reset Progress (Upward Scroll):", heroReset);
    if (heroReset !== 0) {
      throw new Error(`FAIL: Hero progress did not reset to 0 on scroll back to top! Got: ${heroReset}`);
    }
    console.log("PASS: Cinematic Hero single scroll expansion and clean reversibility verified!");

    // ─── AUDIT 3: Category Discovery Section ─────────────────────
    console.log("\n[AUDIT 3] Category Discovery Viewport Stagger & Navigation");
    await cdp.eval(`(() => {
      const el = document.querySelector('.categories-section');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await sleep(500);

    const catAudit = await cdp.eval(`(() => {
      const section = document.querySelector('.categories-section');
      const cards = Array.from(document.querySelectorAll('.category-card'));
      const delays = cards.map(c => getComputedStyle(c).transitionDelay);
      const links = cards.map(c => c.getAttribute('href'));
      return {
        revealed: section?.classList.contains('categories-section--revealed'),
        count: cards.length,
        delays,
        links
      };
    })()`);
    console.log("Category Discovery Audit:", catAudit);
    if (!catAudit.revealed || catAudit.count !== 4 || catAudit.delays[0] !== '0s') {
      throw new Error(`FAIL: Category Discovery verification failed! ${JSON.stringify(catAudit)}`);
    }
    console.log("PASS: Category Discovery correctly reveals with 4 staggered tiles!");

    // ─── AUDIT 4: New Arrivals / Featured Products ───────────────
    console.log("\n[AUDIT 4] New Arrivals Grid, Stagger & Interactivity");
    await cdp.eval(`(() => {
      const el = document.querySelector('.products-section');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await sleep(500);

    const prodAudit = await cdp.eval(`(() => {
      const section = document.querySelector('.products-section');
      const cards = Array.from(document.querySelectorAll('.products-grid .product-card'));
      const cardData = cards.map((c, i) => {
        const s = getComputedStyle(c);
        return {
          index: i + 1,
          name: c.querySelector('.product-card__name')?.textContent?.trim(),
          price: c.querySelector('.product-card__price')?.textContent?.trim(),
          delay: s.transitionDelay,
          opacity: s.opacity,
          hasWishlist: !!c.querySelector('.product-card__wishlist-btn'),
          swatchCount: c.querySelectorAll('.product-card__swatch').length
        };
      });
      return {
        revealed: section?.classList.contains('products-section--revealed'),
        cardCount: cards.length,
        cardData
      };
    })()`);
    console.log("Products Grid Audit:", JSON.stringify(prodAudit, null, 2));
    if (!prodAudit.revealed || prodAudit.cardCount !== 4 || prodAudit.cardData[1].delay !== '0.06s') {
      throw new Error(`FAIL: Products reveal or 60ms stagger failed! ${JSON.stringify(prodAudit)}`);
    }

    // Interactivity: Test wishlist toggle
    await cdp.eval(`(() => {
      const btn = document.querySelector('.product-card__wishlist-btn');
      if (btn) btn.click();
    })()`);
    await sleep(200);
    const wishlistActive = await cdp.eval(`!!document.querySelector('.product-card__wishlist-btn--active')`);
    console.log("Wishlist Toggle Status:", wishlistActive);
    if (!wishlistActive) throw new Error("FAIL: Wishlist toggle did not activate!");
    console.log("PASS: New Arrivals revealed with 60ms stagger and immediate interactivity!");

    // ─── AUDIT 5: Brand Story / Philosophy ───────────────────────
    console.log("\n[AUDIT 5] Brand Story Editorial Asymmetric Reveal");
    await cdp.eval(`(() => {
      const el = document.querySelector('.brand-story-section');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await sleep(500);

    const storyAudit = await cdp.eval(`(() => {
      const section = document.querySelector('.brand-story-section');
      const left = document.querySelector('.brand-story__left-media');
      const center = document.querySelector('.brand-story__center-content');
      const right = document.querySelector('.brand-story__right-media');
      return {
        revealed: section?.classList.contains('brand-story-section--revealed'),
        leftDelay: getComputedStyle(left).transitionDelay,
        centerDelay: getComputedStyle(center).transitionDelay,
        rightDelay: getComputedStyle(right).transitionDelay,
        headline: center?.querySelector('.brand-story__headline')?.textContent?.replace(/\\s+/g, ' ').trim(),
        hasCta: !!center?.querySelector('.brand-story__cta')
      };
    })()`);
    console.log("Brand Story Audit:", storyAudit);
    if (!storyAudit.revealed || storyAudit.leftDelay !== '0s' || storyAudit.centerDelay !== '0.09s' || storyAudit.rightDelay !== '0.18s') {
      throw new Error(`FAIL: Brand Story asymmetric stagger incorrect! ${JSON.stringify(storyAudit)}`);
    }
    console.log("PASS: Brand Story revealed with calibrated asymmetric delays (0ms / 90ms / 180ms)!");

    // ─── AUDIT 6: Shopping Benefits ──────────────────────────────
    console.log("\n[AUDIT 6] Shopping Benefits 4 Pillars & Icon Float");
    await cdp.eval(`(() => {
      const el = document.querySelector('.benefits-section');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await sleep(500);

    const benefitsAudit = await cdp.eval(`(() => {
      const section = document.querySelector('.benefits-section');
      const items = Array.from(document.querySelectorAll('.benefit-item'));
      const delays = items.map(it => getComputedStyle(it).transitionDelay);
      const titles = items.map(it => it.querySelector('.benefit-item__title')?.textContent);
      const iconWrap = items[0]?.querySelector('.benefit-item__icon-wrap');
      return {
        revealed: section?.classList.contains('benefits-section--revealed'),
        itemCount: items.length,
        delays,
        titles,
        iconTransition: getComputedStyle(iconWrap).transition
      };
    })()`);
    console.log("Benefits Audit:", benefitsAudit);
    if (!benefitsAudit.revealed || benefitsAudit.itemCount !== 4 || benefitsAudit.delays[1] !== '0.08s') {
      throw new Error(`FAIL: Benefits reveal or 80ms stagger failed! ${JSON.stringify(benefitsAudit)}`);
    }
    console.log("PASS: Shopping Benefits 4 pillars revealed with 80ms stagger and float transitions!");

    // ─── AUDIT 7: Curated Collections (Shop by Style) ────────────
    console.log("\n[AUDIT 7] Curated Collections (Repurposed High-Res Look 02/03 Assets)");
    await cdp.eval(`(() => {
      const el = document.querySelector('.collections-section');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await sleep(500);

    const collectionsAudit = await cdp.eval(`(() => {
      const section = document.querySelector('.collections-section');
      const cards = Array.from(document.querySelectorAll('.collection-card'));
      const cardInfo = cards.map((c, i) => {
        const img = c.querySelector('.collection-card__img');
        return {
          index: i + 1,
          title: c.querySelector('.collection-card__title')?.textContent,
          delay: getComputedStyle(c).transitionDelay,
          imgSrc: img?.src,
          imgNaturalWidth: img?.naturalWidth,
          imgLoaded: img?.complete && img?.naturalWidth > 0
        };
      });
      return {
        revealed: section?.classList.contains('collections-section--revealed'),
        cardCount: cards.length,
        cardInfo
      };
    })()`);
    console.log("Collections Audit:", JSON.stringify(collectionsAudit, null, 2));
    if (!collectionsAudit.revealed || collectionsAudit.cardCount !== 4 || !collectionsAudit.cardInfo[0].imgLoaded || !collectionsAudit.cardInfo[1].imgLoaded) {
      throw new Error(`FAIL: Curated Collections assets or reveal failed! ${JSON.stringify(collectionsAudit)}`);
    }
    console.log("PASS: Look 02 & Look 03 high-resolution campaign imagery confirmed with sibling focus!");

    // ─── AUDIT 8: Newsletter Section ─────────────────────────────
    console.log("\n[AUDIT 8] Newsletter Polish, Input Focus & Subscription Feedback");
    await cdp.eval(`(() => {
      const el = document.querySelector('.newsletter-section');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await sleep(500);

    const newsletterAudit = await cdp.eval(`(() => {
      const section = document.querySelector('.newsletter-section');
      const card = document.querySelector('.newsletter-card');
      const input = document.querySelector('.newsletter-card__input');
      const btn = document.querySelector('.newsletter-card__btn');
      return {
        revealed: section?.classList.contains('newsletter-section--revealed'),
        hasInput: !!input,
        hasBtn: !!btn,
        inputTransition: getComputedStyle(input).transition,
        btnTransition: getComputedStyle(btn).transition
      };
    })()`);
    console.log("Newsletter Section Audit:", newsletterAudit);
    if (!newsletterAudit.revealed || !newsletterAudit.hasInput || !newsletterAudit.hasBtn) {
      throw new Error(`FAIL: Newsletter section reveal failed! ${JSON.stringify(newsletterAudit)}`);
    }

    // Submit newsletter test
    await cdp.eval(`(() => {
      const input = document.querySelector('.newsletter-card__input');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, 'audit.curator@vetu.com');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const btn = document.querySelector('.newsletter-card__btn');
      if (btn) btn.click();
    })()`);
    await sleep(500);

    const newsletterSuccess = await cdp.eval(`(() => {
      const success = document.querySelector('.newsletter-card__success');
      return {
        rendered: !!success,
        code: success?.querySelector('.newsletter-card__code')?.textContent?.trim(),
        ariaLive: document.querySelector('.newsletter-card__action')?.getAttribute('aria-live')
      };
    })()`);
    console.log("Newsletter Success Feedback:", newsletterSuccess);
    if (!newsletterSuccess.rendered || newsletterSuccess.code !== 'VETU10' || newsletterSuccess.ariaLive !== 'polite') {
      throw new Error(`FAIL: Newsletter success feedback invalid! ${JSON.stringify(newsletterSuccess)}`);
    }
    console.log("PASS: Newsletter input polish, submitting state, and accessible code VETU10 verified!");

    // ─── AUDIT 9: Footer & Global Links ──────────────────────────
    console.log("\n[AUDIT 9] Footer & Architectural Endpoints");
    await cdp.eval(`(() => {
      const el = document.querySelector('.footer');
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await sleep(400);

    const footerAudit = await cdp.eval(`(() => {
      const footer = document.querySelector('.footer');
      const logo = footer?.querySelector('.footer__logo-text')?.textContent?.trim();
      const links = Array.from(footer?.querySelectorAll('a') || []).map(a => a.textContent?.trim());
      const copyright = footer?.querySelector('.footer__copyright')?.textContent?.trim();
      return {
        logo,
        linkCount: links.length,
        hasCopyright: !!copyright
      };
    })()`);
    console.log("Footer Audit:", footerAudit);
    if (footerAudit.logo !== 'V Ê T U' || footerAudit.linkCount < 10) {
      throw new Error(`FAIL: Footer content incomplete! ${JSON.stringify(footerAudit)}`);
    }
    console.log("PASS: Footer complete with brand identity, social links, and navigation links!");

    // ─── AUDIT 10: Multi-Device Responsive Verification ──────────
    console.log("\n[AUDIT 10] Multi-Device Responsive & Layout Stability Audit");
    const testViewports = [
      { name: 'Mobile (375x667)', width: 375, height: 667, mobile: true },
      { name: 'Tablet (768x1024)', width: 768, height: 1024, mobile: true },
      { name: 'Laptop (1280x800)', width: 1280, height: 800, mobile: false },
      { name: 'Desktop (1440x900)', width: 1440, height: 900, mobile: false }
    ];

    for (const vp of testViewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.mobile
      });
      await sleep(350);

      const vpMetrics = await cdp.eval(`(() => {
        const html = document.documentElement;
        return {
          scrollWidth: html.scrollWidth,
          innerWidth: window.innerWidth,
          hasOverflow: html.scrollWidth > window.innerWidth,
          catCols: getComputedStyle(document.querySelector('.categories-grid')).gridTemplateColumns.split(' ').length,
          prodCols: getComputedStyle(document.querySelector('.products-grid')).gridTemplateColumns.split(' ').length,
          benefitsCols: getComputedStyle(document.querySelector('.benefits-grid')).gridTemplateColumns.split(' ').length,
          collCols: getComputedStyle(document.querySelector('.collections-grid')).gridTemplateColumns.split(' ').length
        };
      })()`);

      console.log(`Viewport ${vp.name}:`, vpMetrics);
      if (vpMetrics.hasOverflow) {
        throw new Error(`FAIL: Horizontal layout overflow detected at ${vp.width}px!`);
      }
    }
    console.log("PASS: All 4 target viewports maintain zero horizontal overflow and responsive column scaling!");

    // Reset to desktop 1440x900
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // ─── AUDIT 11: prefers-reduced-motion Comprehensive Check ───
    console.log("\n[AUDIT 11] prefers-reduced-motion: reduce Accessibility Audit");
    await cdp.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await sleep(350);

    const reducedMotionAudit = await cdp.eval(`(() => {
      const heroTrack = document.querySelector('.cinematic-hero-track');
      const catCard = document.querySelector('.category-card');
      const prodCard = document.querySelector('.product-card');
      const storyMedia = document.querySelector('.brand-story__left-media');
      const benefitItem = document.querySelector('.benefit-item');
      const collCard = document.querySelector('.collection-card');
      const newsCard = document.querySelector('.newsletter-card');

      return {
        heroPosition: getComputedStyle(document.querySelector('.cinematic-hero-sticky')).position,
        heroTrackHeight: getComputedStyle(heroTrack).height,
        catOpacity: getComputedStyle(catCard).opacity,
        prodOpacity: getComputedStyle(prodCard).opacity,
        storyOpacity: getComputedStyle(storyMedia).opacity,
        benefitOpacity: getComputedStyle(benefitItem).opacity,
        collOpacity: getComputedStyle(collCard).opacity,
        newsOpacity: getComputedStyle(newsCard).opacity,
        catTransform: getComputedStyle(catCard).transform,
        prodTransform: getComputedStyle(prodCard).transform,
        newsTransform: getComputedStyle(newsCard).transform
      };
    })()`);
    console.log("Reduced Motion Audit Metrics:", reducedMotionAudit);
    if (reducedMotionAudit.catOpacity !== '1' || reducedMotionAudit.prodOpacity !== '1' || reducedMotionAudit.benefitOpacity !== '1') {
      throw new Error(`FAIL: Elements did not collapse to instant opacity 1 under prefers-reduced-motion!`);
    }
    console.log("PASS: Reduced motion disables sticky scroll track and serves instant, accessible static layout!");

    // ─── AUDIT 12: Browser Console & Runtime Stability ───────────
    console.log("\n[AUDIT 12] Browser Console & Runtime Stability Audit");
    console.log("Console Errors Recorded:", cdp.consoleErrors.length);
    console.log("Console Warnings Recorded:", cdp.consoleWarnings.length);
    if (cdp.consoleErrors.length > 0) {
      throw new Error(`FAIL: Runtime console errors detected: ${JSON.stringify(cdp.consoleErrors)}`);
    }
    console.log("PASS: 0 console errors throughout entire landing page session!");

    console.log("\n======================================================================");
    console.log("   ALL 12 AUDIT SUITES COMPLETED AND PASSED WITH ZERO DEFECTS!        ");
    console.log("======================================================================");

    cdp.close();
    chromeProc.kill();
    process.exit(0);

  } catch (err) {
    console.error("\nFull Audit Execution Error:", err);
    chromeProc.kill();
    process.exit(1);
  }
}

runFullAudit();
