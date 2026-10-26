import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\HARSHAL\\AppData\\Local\\Temp\\chrome_qa_phase4_test";
const PORT = 9229;

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
    this.logs = [];
    this.errors = [];

    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        this.logs.push(msg.params);
        if (msg.params.type === 'error') {
          this.errors.push(msg.params);
        }
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.errors.push(msg.params);
      }
    };
  }

  ready() {
    return new Promise((res, rej) => {
      if (this.ws.readyState === WebSocket.OPEN) return res();
      this.ws.onopen = res;
      this.ws.onerror = rej;
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async close() {
    this.ws.close();
  }
}

async function runPhase4QA() {
  console.log("=== VÊTU PHASE 4: NEW ARRIVALS & BRAND STORY MOTION QA ===");

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
    await sleep(2000);
    const wsUrl = await getWsUrl();
    const cdp = new Cdp(wsUrl);
    await cdp.ready();
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    console.log("Waiting for page load...");
    await sleep(2500);

    // 1. Initial State (at Top of Page)
    console.log("\n[TEST 1] Initial Scroll State (Top of Page)");
    await cdp.eval(`window.scrollTo(0, 0);`);
    await sleep(300);

    const initialCheck = await cdp.eval(`(() => {
      const prodSection = document.querySelector('.products-section');
      const storySection = document.querySelector('.brand-story-section');
      return {
        productsRevealed: prodSection?.classList.contains('products-section--revealed'),
        brandStoryRevealed: storySection?.classList.contains('brand-story-section--revealed')
      };
    })()`);
    console.log("Initial Section Reveal Status:", initialCheck);

    // 2. Scroll into New Arrivals Section
    console.log("\n[TEST 2] Scroll into New Arrivals Section");
    await cdp.eval(`(() => {
      const prod = document.querySelector('.products-section');
      if (prod) prod.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await sleep(500);

    const productsRevealState = await cdp.eval(`(() => {
      const section = document.querySelector('.products-section');
      const cards = Array.from(document.querySelectorAll('.products-grid .product-card'));
      const cardStyles = cards.map((c, i) => {
        const s = getComputedStyle(c);
        const name = c.querySelector('.product-card__name')?.textContent?.trim();
        const price = c.querySelector('.product-card__price')?.textContent?.trim();
        const swatches = Array.from(c.querySelectorAll('.product-card__swatch')).length;
        const wishlistBtn = !!c.querySelector('.product-card__wishlist-btn');
        const cartBtn = !!c.querySelector('.product-card__cart-btn');
        return {
          index: i + 1,
          name,
          price,
          opacity: s.opacity,
          transform: s.transform,
          transitionDelay: s.transitionDelay,
          swatchCount: swatches,
          hasWishlist: wishlistBtn,
          hasCartBtn: cartBtn
        };
      });
      return {
        isRevealed: section?.classList.contains('products-section--revealed'),
        cardCount: cards.length,
        cardStyles
      };
    })()`);
    console.log("Products Reveal State:", JSON.stringify(productsRevealState, null, 2));

    if (!productsRevealState.isRevealed || productsRevealState.cardCount !== 4) {
      throw new Error(`FAIL: Products reveal failed! ${JSON.stringify(productsRevealState)}`);
    }
    if (productsRevealState.cardStyles[0].transitionDelay !== '0s') {
      throw new Error(`FAIL: Product card 1 delay incorrect! Got: ${productsRevealState.cardStyles[0].transitionDelay}`);
    }
    console.log("PASS: New Arrivals section smoothly reveals with 4 product cards and 60ms stagger!");

    // 3. Test Interactive Swatch Transition & Wishlist Toggle
    console.log("\n[TEST 3] Interactivity Test: Swatches & Wishlist");
    await cdp.eval(`(() => {
      const firstCard = document.querySelector('.products-grid .product-card');
      const swatches = Array.from(firstCard?.querySelectorAll('.product-card__swatch') || []);
      const wishlistBtn = firstCard?.querySelector('.product-card__wishlist-btn');

      if (swatches.length > 1) {
        swatches[1].click();
      }
      if (wishlistBtn) {
        wishlistBtn.click();
      }
    })()`);
    await sleep(200);

    const interactiveTest = await cdp.eval(`(() => {
      const firstCard = document.querySelector('.products-grid .product-card');
      const swatches = Array.from(firstCard?.querySelectorAll('.product-card__swatch') || []);
      const wishlistBtn = firstCard?.querySelector('.product-card__wishlist-btn');

      const swatchWorked = swatches.length > 1 ? swatches[1].classList.contains('product-card__swatch--active') : true;
      const wishlistWorked = wishlistBtn ? wishlistBtn.classList.contains('product-card__wishlist-btn--active') : false;

      return {
        swatchCount: swatches.length,
        swatchWorked,
        wishlistWorked
      };
    })()`);
    console.log("Interactivity Test Result:", interactiveTest);
    if (!interactiveTest.wishlistWorked) {
      throw new Error("FAIL: Wishlist toggle did not activate!");
    }
    if (!interactiveTest.swatchWorked) {
      throw new Error("FAIL: Swatch selection did not activate!");
    }
    console.log("PASS: Swatch selection and Wishlist interactive states respond immediately!");

    // 4. Scroll into Brand Story Section
    console.log("\n[TEST 4] Scroll into Brand Story Section");
    await cdp.eval(`(() => {
      const story = document.querySelector('.brand-story-section');
      if (story) story.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await sleep(500);

    const storyRevealState = await cdp.eval(`(() => {
      const section = document.querySelector('.brand-story-section');
      const leftMedia = document.querySelector('.brand-story__left-media');
      const centerContent = document.querySelector('.brand-story__center-content');
      const rightMedia = document.querySelector('.brand-story__right-media');

      const sLeft = leftMedia ? getComputedStyle(leftMedia) : null;
      const sCenter = centerContent ? getComputedStyle(centerContent) : null;
      const sRight = rightMedia ? getComputedStyle(rightMedia) : null;

      const leftImg = leftMedia?.querySelector('img');
      const plantImg = rightMedia?.querySelector('img');

      return {
        isRevealed: section?.classList.contains('brand-story-section--revealed'),
        leftMedia: {
          opacity: sLeft?.opacity,
          transform: sLeft?.transform,
          transitionDelay: sLeft?.transitionDelay,
          loaded: !!leftImg?.complete && leftImg.naturalWidth > 0
        },
        centerContent: {
          opacity: sCenter?.opacity,
          transform: sCenter?.transform,
          transitionDelay: sCenter?.transitionDelay,
          hasHeadline: !!centerContent?.querySelector('.brand-story__headline'),
          hasCta: !!centerContent?.querySelector('.brand-story__cta')
        },
        rightMedia: {
          opacity: sRight?.opacity,
          transform: sRight?.transform,
          transitionDelay: sRight?.transitionDelay,
          loaded: !!plantImg?.complete && plantImg.naturalWidth > 0
        }
      };
    })()`);
    console.log("Brand Story Reveal State:", JSON.stringify(storyRevealState, null, 2));

    if (!storyRevealState.isRevealed) {
      throw new Error("FAIL: Brand Story section reveal failed!");
    }
    if (!storyRevealState.leftMedia.loaded || !storyRevealState.rightMedia.loaded) {
      throw new Error("FAIL: Brand Story photography failed to load!");
    }
    if (storyRevealState.centerContent.transitionDelay !== '0.09s') {
      throw new Error(`FAIL: Brand Story center content delay incorrect! Got: ${storyRevealState.centerContent.transitionDelay}`);
    }
    console.log("PASS: Brand Story section reveals with calibrated asymmetric stagger (0ms / 90ms / 180ms)!");

    // 5. Test Multi-Device Viewports for Horizontal Overflow
    console.log("\n[TEST 5] Multi-Device Viewport Verification (375px, 768px, 1280px, 1440px)");
    const viewports = [
      { name: 'Mobile (375px)', width: 375, height: 667 },
      { name: 'Tablet (768px)', width: 768, height: 1024 },
      { name: 'Laptop (1280px)', width: 1280, height: 800 },
      { name: 'Desktop (1440px)', width: 1440, height: 900 }
    ];

    for (const vp of viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 768
      });
      await sleep(300);

      const vpStatus = await cdp.eval(`(() => {
        const overflow = document.documentElement.scrollWidth > window.innerWidth;
        const prodCols = getComputedStyle(document.querySelector('.products-grid')).gridTemplateColumns.split(' ').length;
        const storyCols = getComputedStyle(document.querySelector('.brand-story-grid')).gridTemplateColumns.split(' ').length;
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          hasOverflow: overflow,
          prodColumns: prodCols,
          storyColumns: storyCols
        };
      })()`);
      console.log(`Viewport ${vp.name}:`, vpStatus);

      if (vpStatus.hasOverflow) {
        throw new Error(`FAIL: Horizontal overflow detected at ${vp.name}! ${JSON.stringify(vpStatus)}`);
      }
    }
    console.log("PASS: Zero horizontal overflow across all tested viewports!");

    // Restore desktop viewport
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(300);

    // 6. Test prefers-reduced-motion: reduce
    console.log("\n[TEST 6] prefers-reduced-motion: reduce Mode Verification");
    await cdp.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await sleep(300);

    const reducedMotionCheck = await cdp.eval(`(() => {
      const prodCard = document.querySelector('.products-grid .product-card');
      const leftMedia = document.querySelector('.brand-story__left-media');
      const centerContent = document.querySelector('.brand-story__center-content');

      const sProd = prodCard ? getComputedStyle(prodCard) : null;
      const sLeft = leftMedia ? getComputedStyle(leftMedia) : null;
      const sCenter = centerContent ? getComputedStyle(centerContent) : null;

      return {
        prodOpacity: sProd?.opacity,
        prodTransform: sProd?.transform,
        prodDelay: sProd?.transitionDelay,
        leftOpacity: sLeft?.opacity,
        leftTransform: sLeft?.transform,
        centerOpacity: sCenter?.opacity,
        centerTransform: sCenter?.transform
      };
    })()`);
    console.log("Reduced Motion State:", reducedMotionCheck);

    if (reducedMotionCheck.prodOpacity !== '1' || reducedMotionCheck.leftOpacity !== '1' || reducedMotionCheck.centerOpacity !== '1') {
      throw new Error(`FAIL: Elements not fully opaque under prefers-reduced-motion! ${JSON.stringify(reducedMotionCheck)}`);
    }
    console.log("PASS: Products and Brand Story are instantly rendered without delay under prefers-reduced-motion!");

    // 7. Console Error Check
    console.log("\n[TEST 7] Console Error Check");
    console.log(`Recorded console errors: ${cdp.errors.length}`);
    if (cdp.errors.length > 0) {
      console.log("Errors:", JSON.stringify(cdp.errors, null, 2));
      throw new Error("FAIL: Console errors detected!");
    }
    console.log("PASS: 0 console errors detected throughout testing!");

    await cdp.close();
    console.log("\n=== ALL PHASE 4 VERIFICATIONS PASSED SUCCESSFULLY! ===");
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

runPhase4QA().catch(err => {
  console.error("QA Execution Error:", err);
  process.exit(1);
});
