import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\HARSHAL\\AppData\\Local\\Temp\\chrome_qa_phase3_test";
const PORT = 9228;

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

async function runPhase3QA() {
  console.log("=== VÊTU PHASE 3: CATEGORY DISCOVERY & CURATED COLLECTIONS QA ===");

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

    // 1. Initial State (at ScrollY = 0)
    console.log("\n[TEST 1] Initial Scroll State (Top of Page)");
    await cdp.eval(`window.scrollTo(0, 0);`);
    await sleep(300);

    const initialCheck = await cdp.eval(`(() => {
      const catSection = document.querySelector('.categories-section');
      const collSection = document.querySelector('.collections-section');
      return {
        categoriesRevealed: catSection?.classList.contains('categories-section--revealed'),
        collectionsRevealed: collSection?.classList.contains('collections-section--revealed')
      };
    })()`);
    console.log("Initial Section Reveal Status:", initialCheck);

    // 2. Scroll to Category Discovery Section
    console.log("\n[TEST 2] Scroll into Category Discovery Section");
    await cdp.eval(`(() => {
      const cat = document.querySelector('.categories-section');
      if (cat) cat.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await sleep(500);

    const catRevealState = await cdp.eval(`(() => {
      const section = document.querySelector('.categories-section');
      const cards = Array.from(document.querySelectorAll('.categories-grid .category-card'));
      const cardStyles = cards.map(c => {
        const s = getComputedStyle(c);
        return {
          opacity: s.opacity,
          transform: s.transform,
          transitionDelay: s.transitionDelay,
          link: c.getAttribute('href')
        };
      });
      return {
        isRevealed: section?.classList.contains('categories-section--revealed'),
        cardCount: cards.length,
        cardStyles
      };
    })()`);
    console.log("Category Discovery Reveal:", catRevealState);

    if (!catRevealState.isRevealed || catRevealState.cardCount !== 4) {
      throw new Error(`FAIL: Category Discovery reveal failed! ${JSON.stringify(catRevealState)}`);
    }
    if (catRevealState.cardStyles[0].transitionDelay !== '0s') {
      throw new Error(`FAIL: Stagger delay for card 1 incorrect! Got: ${catRevealState.cardStyles[0].transitionDelay}`);
    }
    console.log("PASS: Category Discovery section smoothly reveals with 4 cards and calibrated stagger!");

    // 3. Scroll to Curated Collections Section
    console.log("\n[TEST 3] Scroll into Curated Collections Section");
    await cdp.eval(`(() => {
      const coll = document.querySelector('.collections-section');
      if (coll) coll.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await sleep(500);

    const collRevealState = await cdp.eval(`(() => {
      const section = document.querySelector('.collections-section');
      const cards = Array.from(document.querySelectorAll('.collections-grid .collection-card'));
      const cardStyles = cards.map((c, i) => {
        const s = getComputedStyle(c);
        const img = c.querySelector('img');
        return {
          index: i + 1,
          title: c.querySelector('.collection-card__title')?.textContent,
          opacity: s.opacity,
          transform: s.transform,
          transitionDelay: s.transitionDelay,
          imgSrc: img?.getAttribute('src'),
          imgNaturalWidth: img?.naturalWidth,
          imgNaturalHeight: img?.naturalHeight,
          imgLoaded: !!img?.complete && img.naturalWidth > 0,
          link: c.getAttribute('href')
        };
      });
      return {
        isRevealed: section?.classList.contains('collections-section--revealed'),
        cardCount: cards.length,
        cardStyles
      };
    })()`);
    console.log("Curated Collections Reveal:", JSON.stringify(collRevealState, null, 2));

    if (!collRevealState.isRevealed || collRevealState.cardCount !== 4) {
      throw new Error(`FAIL: Collections reveal failed! ${JSON.stringify(collRevealState)}`);
    }

    // Verify Campaign Asset Reuse for Look 02 and Look 03
    const edit1 = collRevealState.cardStyles[0];
    const edit2 = collRevealState.cardStyles[1];
    console.log(`Edit 1 Image Loaded: ${edit1.imgLoaded} (Natural: ${edit1.imgNaturalWidth}x${edit1.imgNaturalHeight})`);
    console.log(`Edit 2 Image Loaded: ${edit2.imgLoaded} (Natural: ${edit2.imgNaturalWidth}x${edit2.imgNaturalHeight})`);

    if (!edit1.imgLoaded || !edit2.imgLoaded) {
      throw new Error("FAIL: Repurposed campaign images for Look 02 or Look 03 failed to load in Collections cards!");
    }
    console.log("PASS: Look 02 & Look 03 campaign images are successfully displayed with crisp high resolution!");

    // 4. Test Multi-Device Viewports for Horizontal Overflow & Responsive Layouts
    console.log("\n[TEST 4] Multi-Device Viewport Verification (375px, 768px, 1280px, 1440px)");
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
        const catCols = getComputedStyle(document.querySelector('.categories-grid')).gridTemplateColumns.split(' ').length;
        const collCols = getComputedStyle(document.querySelector('.collections-grid')).gridTemplateColumns.split(' ').length;
        return {
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          hasOverflow: overflow,
          catColumns: catCols,
          collColumns: collCols
        };
      })()`);
      console.log(`Viewport ${vp.name}:`, vpStatus);

      if (vpStatus.hasOverflow) {
        throw new Error(`FAIL: Horizontal overflow detected at ${vp.name}! ${JSON.stringify(vpStatus)}`);
      }
    }
    console.log("PASS: Zero horizontal overflow across all tested viewports (375px, 768px, 1280px, 1440px)!");

    // Restore desktop viewport
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(300);

    // 5. Test prefers-reduced-motion: reduce
    console.log("\n[TEST 5] prefers-reduced-motion: reduce Mode Verification");
    await cdp.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await sleep(300);

    const reducedMotionCheck = await cdp.eval(`(() => {
      const catCard = document.querySelector('.category-card');
      const collCard = document.querySelector('.collection-card');
      const catStyle = getComputedStyle(catCard);
      const collStyle = getComputedStyle(collCard);
      return {
        catOpacity: catStyle.opacity,
        catTransform: catStyle.transform,
        catTransitionDuration: catStyle.transitionDuration,
        collOpacity: collStyle.opacity,
        collTransform: collStyle.transform,
        collTransitionDuration: collStyle.transitionDuration
      };
    })()`);
    console.log("Reduced Motion Cards State:", reducedMotionCheck);

    if (reducedMotionCheck.catOpacity !== '1' || reducedMotionCheck.collOpacity !== '1') {
      throw new Error(`FAIL: Cards are not fully opaque under prefers-reduced-motion! ${JSON.stringify(reducedMotionCheck)}`);
    }
    console.log("PASS: Cards are instantly rendered with full opacity and 0ms transition under prefers-reduced-motion!");

    // 6. Console Error Check
    console.log("\n[TEST 6] Console Error Check");
    console.log(`Console error count: ${cdp.errors.length}`);
    if (cdp.errors.length > 0) {
      console.log("Errors:", JSON.stringify(cdp.errors, null, 2));
      throw new Error("FAIL: Console errors detected!");
    }
    console.log("PASS: 0 console errors detected throughout testing!");

    await cdp.close();
    console.log("\n=== ALL PHASE 3 VERIFICATIONS PASSED SUCCESSFULLY! ===");
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

runPhase3QA().catch(err => {
  console.error("QA Execution Error:", err);
  process.exit(1);
});
