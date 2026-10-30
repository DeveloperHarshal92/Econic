import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getDebuggerUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) {
        const data = await res.json();
        return data.webSocketDebuggerUrl;
      }
    } catch (e) {
      // retry
    }
    await wait(500);
  }
  throw new Error('Chrome remote debugging not available');
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message));
        } else {
          resolve(msg.result);
        }
      }
    };
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async navigate(url, waitMs = 2500) {
    await this.send('Page.navigate', { url });
    await wait(waitMs);
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await wait(500);
  }

  async captureScreenshot(outputPath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(outputPath, Buffer.from(res.data, 'base64'));
  }

  async close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  console.log('===========================================================');
  console.log('VÊTU CATALOG PRODUCT GRID — RESPONSIVE & VISUAL AUDIT');
  console.log('===========================================================');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ], { stdio: 'ignore' });

  const results = [];
  function record(name, pass, detail = '') {
    results.push({ name, pass, detail });
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'}: ${name}${detail ? ' — ' + detail : ''}`);
  }

  try {
    const wsUrl = await getDebuggerUrl();
    const newPageRes = await fetch('http://127.0.0.1:9222/json/new', { method: 'PUT' });
    const pageData = await newPageRes.json();

    const client = new CDPClient(pageData.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    const viewports = [
      { name: '1440px Desktop', width: 1440, height: 900 },
      { name: '1280px Laptop', width: 1280, height: 800 },
      { name: '768px Tablet', width: 768, height: 1024 },
      { name: '390px Mobile', width: 390, height: 844 },
      { name: '375px Mobile', width: 375, height: 667 },
    ];

    const artifactsDir = path.resolve('docs');

    for (const vp of viewports) {
      console.log(`\n--- Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
      await client.setViewport(vp.width, vp.height);
      await client.navigate('http://localhost:3000/catalog', 2000);

      const metrics = await client.evaluate(`
        (() => {
          const cards = Array.from(document.querySelectorAll('.product-card'));
          const scrollWidth = document.documentElement.scrollWidth;
          const innerWidth = window.innerWidth;
          const hasOverflow = scrollWidth > innerWidth + 1;

          const visibilities = cards.map(c => {
            const s = window.getComputedStyle(c);
            const r = c.getBoundingClientRect();
            return {
              opacity: parseFloat(s.opacity),
              visibility: s.visibility,
              width: r.width,
              height: r.height,
              top: r.top,
              left: r.left,
            };
          });

          const allVisible = visibilities.length > 0 && visibilities.every(v => v.opacity === 1 && v.visibility === 'visible' && v.height > 100);

          // Check aspect ratio of image containers
          const imgContainers = Array.from(document.querySelectorAll('.product-card__image-container'));
          const aspectRatios = imgContainers.map(ic => {
            const r = ic.getBoundingClientRect();
            return r.width > 0 ? (r.height / r.width) : 0;
          });
          const validAspect = aspectRatios.every(ar => Math.abs(ar - 4/3) < 0.1);

          // Check header & announcement bar
          const ann = document.querySelector('.announcement-bar');
          const hdr = document.querySelector('.header');

          return {
            cardCount: cards.length,
            allVisible,
            hasOverflow,
            scrollWidth,
            innerWidth,
            validAspect,
            countText: document.querySelector('.product-list__count')?.textContent?.trim(),
            annHeight: ann ? ann.getBoundingClientRect().height : 0,
            hdrHeight: hdr ? hdr.getBoundingClientRect().height : 0,
          };
        })()
      `);

      record(`${vp.name} card visibility`, metrics.allVisible, `${metrics.cardCount} cards rendered and fully visible (opacity 1)`);
      record(`${vp.name} zero horizontal overflow`, !metrics.hasOverflow, `scrollWidth: ${metrics.scrollWidth}px, innerWidth: ${metrics.innerWidth}px`);
      record(`${vp.name} 3:4 portrait image aspect ratio`, metrics.validAspect);
      record(`${vp.name} announcement bar & header rhythm`, metrics.annHeight > 30 && metrics.hdrHeight === 76, `ann: ${metrics.annHeight}px, hdr: ${metrics.hdrHeight}px`);

      if (vp.width === 1440 || vp.width === 390) {
        const screenshotPath = path.join(artifactsDir, `catalog-${vp.width}px.png`);
        await client.captureScreenshot(screenshotPath);
        console.log(`Saved screenshot: ${screenshotPath}`);
      }
    }

    // TEST: PAGINATION (Navigate to Page 2)
    console.log('\n--- Testing Pagination (Page 2) ---');
    await client.setViewport(1440, 900);
    await client.navigate('http://localhost:3000/catalog?page=2', 2000);

    const page2Metrics = await client.evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.product-card'));
        const countText = document.querySelector('.product-list__count')?.textContent?.trim();
        const allVisible = cards.length > 0 && cards.every(c => window.getComputedStyle(c).opacity === '1');
        const firstSlug = cards[0]?.querySelector('a')?.getAttribute('href');

        return {
          cardCount: cards.length,
          countText,
          allVisible,
          firstSlug
        };
      })()
    `);

    record('Page 2 cards visibly rendered', page2Metrics.allVisible, `${page2Metrics.cardCount} cards visible`);
    record('Page 2 count text accurately reflects range', page2Metrics.countText === 'Showing 13–24 of 200 curated pieces', `text: "${page2Metrics.countText}"`);

    // TEST: PRODUCT DETAIL NAVIGATION FROM CATALOG
    console.log('\n--- Testing Navigation to PDP from Catalog ---');
    await client.navigate('http://localhost:3000/catalog', 2000);
    await client.evaluate(`document.querySelector('.product-card a').click()`);
    await wait(2000);

    const pdpMetrics = await client.evaluate(`
      (() => {
        const name = document.querySelector('.product-detail__name')?.textContent?.trim();
        const price = document.querySelector('.product-detail__price')?.textContent?.trim();
        const addBtn = document.querySelector('.product-detail__add-to-cart');
        return {
          name,
          price,
          hasAddBtn: addBtn !== null,
          url: window.location.pathname
        };
      })()
    `);

    record('PDP opens cleanly from catalog card click', !!pdpMetrics.name && pdpMetrics.hasAddBtn, `product: "${pdpMetrics.name}", route: ${pdpMetrics.url}`);

    // TEST: REDUCED MOTION PREFERENCE
    console.log('\n--- Testing prefers-reduced-motion ---');
    await client.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await client.navigate('http://localhost:3000/catalog', 2000);
    const reducedMotionVisible = await client.evaluate(`
      (() => {
        const cards = Array.from(document.querySelectorAll('.product-card'));
        return cards.length > 0 && cards.every(c => window.getComputedStyle(c).opacity === '1');
      })()
    `);
    record('Cards remain 100% visible with prefers-reduced-motion: reduce', reducedMotionVisible);

    // SUMMARY
    console.log('\n===========================================================');
    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    const failed = total - passed;
    console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('===========================================================\n');

    await client.close();
    if (failed > 0) process.exitCode = 1;
  } finally {
    chromeProc.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

