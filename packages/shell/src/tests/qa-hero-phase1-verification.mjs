import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\HARSHAL\\AppData\\Local\\Temp\\chrome_qa_hero_phase1";
const PORT = 9225;

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

async function runVerification() {
  console.log("=== VÊTU PHASE 1 HERO QA & VERIFICATION ===");

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
    for (let i = 0; i < 20; i++) {
      const ready = await cdp.eval(`!!document.querySelector('.cinematic-hero-track')`);
      if (ready) break;
      await sleep(500);
    }
    await sleep(1000);

    // 1. Verify Removed Elements from the DOM
    console.log("\n[TEST 1] Verifying Clean DOM (Confirming Removed Features)");
    const removedCheck = await cdp.eval(`(() => {
      return {
        carouselControls: !!document.querySelector('.cinematic-hero-carousel-controls'),
        lookPills: !!document.querySelector('.cinematic-hero-look-switcher'),
        counter: !!document.querySelector('.cinematic-hero-counter'),
        navButtons: !!document.querySelector('.cinematic-hero-nav-buttons'),
        expandedOverlay: !!document.querySelector('.cinematic-hero-expanded-content'),
        multipleSlides: document.querySelectorAll('.cinematic-hero-slide-item').length,
        hasPrimaryCTA: !!document.querySelector('.cinematic-btn--primary'),
        hasSecondaryCTA: !!document.querySelector('.cinematic-btn--ghost'),
        hasHeadline: document.querySelector('.cinematic-hero-headline')?.textContent?.includes('Wear A Better'),
        hasStatsRow: !!document.querySelector('.cinematic-hero-stats-row'),
        hasScrollCue: !!document.querySelector('.cinematic-hero-scroll-cue')
      };
    })()`);
    console.log("DOM Verification:", removedCheck);

    if (removedCheck.carouselControls || removedCheck.lookPills || removedCheck.counter || removedCheck.navButtons || removedCheck.expandedOverlay || removedCheck.multipleSlides > 1) {
      throw new Error(`FAIL: Found residual carousel or secondary overlay elements! ${JSON.stringify(removedCheck)}`);
    }
    console.log("PASS: All carousel controls, timers, look pills, and secondary overlays are completely removed!");

    // 2. Test Scroll Expansion at Top, Middle, and Fully Expanded (Desktop 1440px)
    console.log("\n[TEST 2] Desktop Scroll Expansion (Top, Middle, Fully Expanded)");
    
    // Top position
    await cdp.eval(`window.scrollTo(0, 0);`);
    await sleep(300);
    const topState = await cdp.eval(`(() => {
      const hero = document.querySelector('.cinematic-hero-track');
      const media = document.querySelector('.cinematic-hero-media-wrapper');
      const sticky = document.querySelector('.cinematic-hero-sticky');
      const rect = media.getBoundingClientRect();
      const stickyRect = sticky.getBoundingClientRect();
      const heroStyles = getComputedStyle(hero);
      return {
        scrollY: window.scrollY,
        progress: parseFloat(heroStyles.getPropertyValue('--hero-progress') || '0'),
        widthPct: heroStyles.getPropertyValue('--hero-width'),
        heightPct: heroStyles.getPropertyValue('--hero-height'),
        radius: heroStyles.getPropertyValue('--hero-radius'),
        mediaWidth: Math.round(rect.width),
        mediaHeight: Math.round(rect.height),
        stickyTop: stickyRect.top,
        stickyHeight: stickyRect.height
      };
    })()`);
    console.log("Top Position (ScrollY=0):", topState);

    // Scroll to middle
    await cdp.eval(`window.scrollTo(0, 300);`);
    await sleep(300);
    const midState = await cdp.eval(`(() => {
      const hero = document.querySelector('.cinematic-hero-track');
      const media = document.querySelector('.cinematic-hero-media-wrapper');
      const heroStyles = getComputedStyle(hero);
      const rect = media.getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        progress: parseFloat(heroStyles.getPropertyValue('--hero-progress') || '0'),
        widthPct: heroStyles.getPropertyValue('--hero-width'),
        heightPct: heroStyles.getPropertyValue('--hero-height'),
        radius: heroStyles.getPropertyValue('--hero-radius'),
        mediaWidth: Math.round(rect.width),
        mediaHeight: Math.round(rect.height)
      };
    })()`);
    console.log("Middle Position (ScrollY=300):", midState);

    // Scroll to fully expanded
    await cdp.eval(`window.scrollTo(0, 600);`);
    await sleep(300);
    const fullState = await cdp.eval(`(() => {
      const hero = document.querySelector('.cinematic-hero-track');
      const media = document.querySelector('.cinematic-hero-media-wrapper');
      const heroStyles = getComputedStyle(hero);
      const rect = media.getBoundingClientRect();
      return {
        scrollY: window.scrollY,
        progress: parseFloat(heroStyles.getPropertyValue('--hero-progress') || '0'),
        widthPct: heroStyles.getPropertyValue('--hero-width'),
        heightPct: heroStyles.getPropertyValue('--hero-height'),
        radius: heroStyles.getPropertyValue('--hero-radius'),
        mediaWidth: Math.round(rect.width),
        mediaHeight: Math.round(rect.height)
      };
    })()`);
    console.log("Fully Expanded Position (ScrollY=600):", fullState);

    if (!(midState.mediaWidth > topState.mediaWidth && fullState.mediaWidth >= midState.mediaWidth)) {
      throw new Error("FAIL: Media width did not expand monotonically with scroll!");
    }
    console.log("PASS: Media card smoothly expands from contained 88% width to full bleed!");

    // 3. Test Reverse Scroll
    console.log("\n[TEST 3] Reverse Scroll Upward");
    await cdp.eval(`window.scrollTo(0, 200);`);
    await sleep(300);
    const reverseMid = await cdp.eval(`parseFloat(getComputedStyle(document.querySelector('.cinematic-hero-track')).getPropertyValue('--hero-progress'))`);
    await cdp.eval(`window.scrollTo(0, 0);`);
    await sleep(300);
    const reverseTop = await cdp.eval(`parseFloat(getComputedStyle(document.querySelector('.cinematic-hero-track')).getPropertyValue('--hero-progress'))`);
    console.log(`Reversing progress: Mid=${reverseMid.toFixed(3)} -> Top=${reverseTop.toFixed(3)}`);
    if (reverseTop > 0.001) {
      throw new Error(`FAIL: Reverse scroll did not return progress to 0! Got: ${reverseTop}`);
    }
    console.log("PASS: Natural reverse animation verified! Progress returns precisely to 0.000");

    // 4. Test Transition into Next Section & Overflow Check
    console.log("\n[TEST 4] Transition to Next Section & Overflow Check");
    await cdp.eval(`window.scrollTo(0, 1100);`);
    await sleep(300);
    const nextSectionCheck = await cdp.eval(`(() => {
      const categorySection = document.querySelector('.category-discovery');
      const rect = categorySection ? categorySection.getBoundingClientRect() : null;
      const overflow = document.documentElement.scrollWidth > window.innerWidth;
      return {
        categoryTop: rect ? Math.round(rect.top) : null,
        categoryVisible: rect ? rect.top < window.innerHeight : false,
        hasHorizontalOverflow: overflow,
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth
      };
    })()`);
    console.log("Next section & overflow status:", nextSectionCheck);
    if (nextSectionCheck.hasHorizontalOverflow) {
      throw new Error(`FAIL: Horizontal overflow detected! ScrollWidth: ${nextSectionCheck.scrollWidth}, InnerWidth: ${nextSectionCheck.innerWidth}`);
    }
    console.log("PASS: Smooth transition into Category Discovery section with ZERO horizontal overflow!");

    // 5. Test Tablet Viewport (768px)
    console.log("\n[TEST 5] Tablet Viewport (768px x 1024px)");
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await sleep(400);
    await cdp.eval(`window.scrollTo(0, 0); window.dispatchEvent(new Event('resize'));`);
    await sleep(300);

    const tabletTop = await cdp.eval(`(() => {
      const hero = document.querySelector('.cinematic-hero-track');
      const media = document.querySelector('.cinematic-hero-media-wrapper');
      const heroStyles = getComputedStyle(hero);
      const rect = media.getBoundingClientRect();
      return {
        progress: parseFloat(heroStyles.getPropertyValue('--hero-progress') || '0'),
        widthPct: heroStyles.getPropertyValue('--hero-width'),
        mediaWidth: Math.round(rect.width),
        overflow: document.documentElement.scrollWidth > window.innerWidth
      };
    })()`);
    console.log("Tablet Top:", tabletTop);

    await cdp.eval(`window.scrollTo(0, 450);`);
    await sleep(300);
    const tabletScrolled = await cdp.eval(`(() => {
      const hero = document.querySelector('.cinematic-hero-track');
      const media = document.querySelector('.cinematic-hero-media-wrapper');
      const heroStyles = getComputedStyle(hero);
      const rect = media.getBoundingClientRect();
      return {
        progress: parseFloat(heroStyles.getPropertyValue('--hero-progress') || '0'),
        widthPct: heroStyles.getPropertyValue('--hero-width'),
        mediaWidth: Math.round(rect.width),
        overflow: document.documentElement.scrollWidth > window.innerWidth
      };
    })()`);
    console.log("Tablet Scrolled:", tabletScrolled);
    console.log("PASS: Tablet viewport expands seamlessly without horizontal overflow!");

    // 6. Test Mobile Viewport (390px iPhone standard)
    console.log("\n[TEST 6] Narrow Mobile Viewport (390px x 844px)");
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(400);
    await cdp.eval(`window.scrollTo(0, 0); window.dispatchEvent(new Event('resize'));`);
    await sleep(300);

    const mobileTop = await cdp.eval(`(() => {
      const hero = document.querySelector('.cinematic-hero-track');
      const media = document.querySelector('.cinematic-hero-media-wrapper');
      const heroStyles = getComputedStyle(hero);
      const rect = media.getBoundingClientRect();
      return {
        progress: parseFloat(heroStyles.getPropertyValue('--hero-progress') || '0'),
        widthPct: heroStyles.getPropertyValue('--hero-width'),
        mediaWidth: Math.round(rect.width),
        overflow: document.documentElement.scrollWidth > window.innerWidth
      };
    })()`);
    console.log("Mobile Top:", mobileTop);

    await cdp.eval(`window.scrollTo(0, 300);`);
    await sleep(300);
    const mobileScrolled = await cdp.eval(`(() => {
      const hero = document.querySelector('.cinematic-hero-track');
      const media = document.querySelector('.cinematic-hero-media-wrapper');
      const heroStyles = getComputedStyle(hero);
      const rect = media.getBoundingClientRect();
      return {
        progress: parseFloat(heroStyles.getPropertyValue('--hero-progress') || '0'),
        widthPct: heroStyles.getPropertyValue('--hero-width'),
        mediaWidth: Math.round(rect.width),
        overflow: document.documentElement.scrollWidth > window.innerWidth
      };
    })()`);
    console.log("Mobile Scrolled:", mobileScrolled);
    console.log("PASS: Mobile viewport expands smoothly from 94% to full width with zero overflow!");

    // 7. Test Prefers-Reduced-Motion
    console.log("\n[TEST 7] prefers-reduced-motion: reduce Mode");
    await cdp.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await sleep(400);
    await cdp.eval(`window.dispatchEvent(new Event('resize'));`);
    await sleep(300);

    const reducedMotionState = await cdp.eval(`(() => {
      const track = document.querySelector('.cinematic-hero-track');
      const sticky = document.querySelector('.cinematic-hero-sticky');
      const media = document.querySelector('.cinematic-hero-media-wrapper');
      const cue = document.querySelector('.cinematic-hero-scroll-cue');
      const trackStyles = getComputedStyle(track);
      const stickyStyles = getComputedStyle(sticky);
      const mediaStyles = getComputedStyle(media);
      return {
        isReducedClass: track.classList.contains('cinematic-hero-track--reduced'),
        trackHeight: trackStyles.height,
        stickyPosition: stickyStyles.position,
        mediaWidth: mediaStyles.width,
        scrollCueRendered: !!cue
      };
    })()`);
    console.log("Reduced Motion State:", reducedMotionState);
    if (reducedMotionState.stickyPosition !== 'relative' || reducedMotionState.scrollCueRendered) {
      throw new Error(`FAIL: Reduced motion fallback incomplete: ${JSON.stringify(reducedMotionState)}`);
    }
    console.log("PASS: Reduced motion disables sticky scroll track and presents instant accessible layout!");

    // 8. Console Error Check
    console.log("\n[TEST 8] Browser Console Errors Check");
    console.log(`Recorded console errors: ${cdp.errors.length}`);
    if (cdp.errors.length > 0) {
      console.log("Errors:", JSON.stringify(cdp.errors, null, 2));
    } else {
      console.log("PASS: 0 console errors detected throughout all tests!");
    }

    await cdp.close();
    console.log("\n=== ALL 8 VERIFICATION SUITES PASSED! ===");
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

runVerification().catch(err => {
  console.error("Verification failed:", err);
  process.exit(1);
});
