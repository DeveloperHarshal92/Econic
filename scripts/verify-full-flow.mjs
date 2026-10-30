import { spawn } from 'node:child_process';

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
      // wait
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
    this.events = [];
    this.consoleLogs = [];
    this.pageErrors = [];
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
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description).join(' ');
        this.consoleLogs.push(`[CONSOLE ${msg.params.type}] ${text}`);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.pageErrors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
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

  async navigate(url, waitTime = 2500) {
    await this.send('Page.navigate', { url });
    await wait(waitTime);
  }

  async reload(waitTime = 2500) {
    await this.send('Page.reload');
    await wait(waitTime);
  }

  async close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

async function run() {
  console.log('====================================================');
  console.log('VÊTU STOREFRONT - FULL INTEGRATION E2E TEST SUITE');
  console.log('====================================================');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    'about:blank'
  ], { stdio: 'ignore' });

  let results = [];
  function record(name, passed, detail = '') {
    results.push({ name, passed, detail });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark}: ${name}${detail ? ' (' + detail + ')' : ''}`);
  }

  try {
    const wsUrl = await getDebuggerUrl();
    const newPageRes = await fetch('http://127.0.0.1:9222/json/new', { method: 'PUT' });
    const pageData = await newPageRes.json();

    const client = new CDPClient(pageData.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    const headerMeasurements = {};

    async function measureHeader(routeName) {
      return await client.evaluate(`
        (() => {
          const ann = document.querySelector('.announcement-bar');
          const hdr = document.querySelector('.header');
          const annInner = document.querySelector('.announcement-bar__inner');
          const hdrInner = document.querySelector('.header__inner');
          return {
            annHeight: ann ? ann.getBoundingClientRect().height : 0,
            hdrHeight: hdr ? hdr.getBoundingClientRect().height : 0,
            annPaddingTop: annInner ? window.getComputedStyle(annInner).paddingTop : '0',
            annPaddingBottom: annInner ? window.getComputedStyle(annInner).paddingBottom : '0',
            hdrPaddingTop: hdrInner ? window.getComputedStyle(hdrInner).paddingTop : '0',
            hdrPaddingBottom: hdrInner ? window.getComputedStyle(hdrInner).paddingBottom : '0'
          };
        })()
      `);
    }

    // TEST 1: HOME PAGE (http://localhost:3000)
    console.log('\n--- 1. Shell Home (http://localhost:3000) ---');
    await client.navigate('http://localhost:3000');
    const homeTitle = await client.evaluate('document.title');
    record('Home loads with brand title', homeTitle.includes('VÊTU'), `title: "${homeTitle}"`);
    headerMeasurements['home'] = await measureHeader('home');

    // TEST 2: CATALOG PAGE (http://localhost:3000/catalog)
    console.log('\n--- 2. Catalog Remote through Shell (http://localhost:3000/catalog) ---');
    await client.navigate('http://localhost:3000/catalog');
    const catalogCardsCount = await client.evaluate('document.querySelectorAll(".product-card").length');
    record('Catalog renders products list', catalogCardsCount > 0, `${catalogCardsCount} products found`);
    headerMeasurements['catalog'] = await measureHeader('catalog');

    // TEST 3: PRODUCT DETAIL PAGE VIA SLUG (/catalog/:slug)
    console.log('\n--- 3. PDP via Slug (/catalog/essential-cotton-t-shirt) ---');
    await client.navigate('http://localhost:3000/catalog/essential-cotton-t-shirt');
    const pdpName = await client.evaluate('document.querySelector(".product-detail__name")?.textContent?.trim()');
    const pdpPrice = await client.evaluate('document.querySelector(".product-detail__price")?.textContent?.trim()');
    const hasAddBtn = await client.evaluate('document.querySelector(".product-detail__add-to-cart") !== null');
    record('PDP renders product name via slug', !!pdpName && pdpName.length > 0, `name: "${pdpName}"`);
    record('PDP renders product price', !!pdpPrice && pdpPrice.includes('₹'), `price: "${pdpPrice}"`);
    record('PDP renders Add to Bag button', hasAddBtn);
    headerMeasurements['pdp'] = await measureHeader('pdp');

    // TEST 4: PRODUCT DETAIL PAGE VIA ID (/catalog/products/:id)
    console.log('\n--- 4. PDP via MongoDB ID (/catalog/products/68f200000000000000000001) ---');
    await client.navigate('http://localhost:3000/catalog/products/68f200000000000000000001');
    const pdpByIdName = await client.evaluate('document.querySelector(".product-detail__name")?.textContent?.trim()');
    record('PDP renders correctly via ObjectId route', !!pdpByIdName && pdpByIdName.length > 0, `name: "${pdpByIdName}"`);

    // TEST 5: PDP ERROR / NOT FOUND STATE (invalid id/slug)
    console.log('\n--- 5. PDP 404 / Missing Product Handling ---');
    await client.navigate('http://localhost:3000/catalog/non-existent-product-slug-xyz');
    const notFoundText = await client.evaluate('document.body.innerText');
    const handlesNotFound = notFoundText.toLowerCase().includes('not found') || notFoundText.toLowerCase().includes('back to collection');
    record('PDP displays proper Not Found state (no white screen)', handlesNotFound);

    // TEST 6: CART SYNCHRONIZATION (Add item -> Shell Header badge updates)
    console.log('\n--- 6. Add to Bag & Shell Cart Badge Synchronization ---');
    // Navigate back to valid product
    await client.navigate('http://localhost:3000/catalog/essential-cotton-t-shirt');
    
    // Select size 'M' if variant selector exists, then click Add to Bag
    await client.evaluate(`
      (() => {
        // click size button if available
        const sizeBtns = document.querySelectorAll('.product-detail__size-btn');
        if (sizeBtns.length > 0) sizeBtns[0].click();
        
        // click add to bag
        const btn = document.querySelector('.product-detail__add-to-cart');
        if (btn) btn.click();
      })()
    `);
    // Wait for network add to cart & cart:updated event
    await wait(2000);

    const badgeCount = await client.evaluate(`
      (() => {
        const badge = document.querySelector('.header__badge');
        return badge ? badge.textContent.trim() : null;
      })()
    `);
    record('Shell header cart badge updates upon Add to Bag', badgeCount !== null && parseInt(badgeCount, 10) >= 1, `badge: ${badgeCount}`);

    // TEST 7: CART PAGE (http://localhost:3000/cart)
    console.log('\n--- 7. Cart Remote through Shell (http://localhost:3000/cart) ---');
    await client.navigate('http://localhost:3000/cart');
    headerMeasurements['cart'] = await measureHeader('cart');

    const cartItemCount = await client.evaluate('document.querySelectorAll(".cart-item").length');
    record('Cart displays added item from backend', cartItemCount >= 1, `${cartItemCount} item(s) in cart`);

    // Test quantity update (stepper +)
    console.log('Testing Cart quantity increment...');
    await client.evaluate(`
      (() => {
        const plusBtn = document.querySelectorAll('.cart-item__qty-btn')[1]; // second btn is increase
        if (plusBtn) plusBtn.click();
      })()
    `);
    await wait(2000);

    const updatedQty = await client.evaluate(`
      (() => {
        const display = document.querySelector('.cart-item__qty-display');
        return display ? display.textContent.trim() : null;
      })()
    `);
    record('Cart item quantity updates upon clicking stepper', updatedQty === '2', `quantity: ${updatedQty}`);

    // Verify header badge updated to 2
    const badgeAfterInc = await client.evaluate(`
      (() => {
        const badge = document.querySelector('.header__badge');
        return badge ? badge.textContent.trim() : null;
      })()
    `);
    record('Shell header cart badge updates on quantity increase', badgeAfterInc === '2', `badge: ${badgeAfterInc}`);

    // Reload page to test persistence
    console.log('Testing Cart page refresh persistence...');
    await client.reload();
    const cartItemCountAfterReload = await client.evaluate('document.querySelectorAll(".cart-item").length');
    const qtyAfterReload = await client.evaluate(`
      (() => {
        const display = document.querySelector('.cart-item__qty-display');
        return display ? display.textContent.trim() : null;
      })()
    `);
    record('Cart items persist after full page refresh', cartItemCountAfterReload === cartItemCount && qtyAfterReload === '2', `${cartItemCountAfterReload} items retained, qty: ${qtyAfterReload}`);

    // TEST 8: CHECKOUT PAGE (http://localhost:3000/checkout)
    console.log('\n--- 8. Checkout Remote through Shell (http://localhost:3000/checkout) ---');
    await client.navigate('http://localhost:3000/checkout');
    headerMeasurements['checkout'] = await measureHeader('checkout');

    const checkoutSummaryExists = await client.evaluate(`
      (() => {
        const summary = document.querySelector('.checkout-page__summary') || document.querySelector('.order-summary') || document.querySelector('.checkout-page');
        return summary !== null;
      })()
    `);
    const checkoutItemCount = await client.evaluate(`
      (() => {
        return document.querySelectorAll('.order-summary__item, .checkout-item, .summary-item').length;
      })()
    `);
    record('Checkout loads under port 3000 with order summary', checkoutSummaryExists);
    record('Checkout reflects current cart items', checkoutItemCount >= 1, `${checkoutItemCount} item(s) in order summary`);

    // TEST 8B: BROWSER BACK & FORWARD NAVIGATION
    console.log('\n--- 8B. Browser Back and Forward Navigation ---');
    await client.evaluate('window.history.back()');
    await wait(2000);
    const backUrl = await client.evaluate('window.location.pathname');
    record('Browser Back navigates back to /cart', backUrl === '/cart', `path: ${backUrl}`);

    await client.evaluate('window.history.forward()');
    await wait(2000);
    const fwdUrl = await client.evaluate('window.location.pathname');
    record('Browser Forward navigates back to /checkout', fwdUrl === '/checkout', `path: ${fwdUrl}`);

    // TEST 9: HEADER & ANNOUNCEMENT BAR SPACING CONSISTENCY
    console.log('\n--- 9. Header & Announcement Bar Spacing Consistency Across Routes ---');
    console.log('Header measurements across routes:');
    console.table(headerMeasurements);

    const annHeights = Object.values(headerMeasurements).map(m => m.annHeight);
    const hdrHeights = Object.values(headerMeasurements).map(m => m.hdrHeight);
    const annPaddings = Object.values(headerMeasurements).map(m => m.annPaddingTop);
    const hdrPaddings = Object.values(headerMeasurements).map(m => m.hdrPaddingTop);

    const annHeightsUniform = annHeights.every(h => Math.abs(h - annHeights[0]) < 1);
    const hdrHeightsUniform = hdrHeights.every(h => Math.abs(h - hdrHeights[0]) < 1);
    const annPaddingsUniform = annPaddings.every(p => p === annPaddings[0]);
    const hdrPaddingsUniform = hdrPaddings.every(p => p === hdrPaddings[0]);

    record('Announcement Bar height is consistent across all routes', annHeightsUniform, `${annHeights[0]}px`);
    record('Header height is consistent across all routes', hdrHeightsUniform, `${hdrHeights[0]}px`);
    record('Announcement Bar padding is consistent (no leaking .container styles)', annPaddingsUniform, annPaddings[0]);
    record('Header padding is consistent across all routes', hdrPaddingsUniform, hdrPaddings[0]);

    // TEST 10: STANDALONE CATALOG DEVELOPMENT ROUTES (port 3001)
    console.log('\n--- 10. Standalone Catalog Remote (http://localhost:3001) ---');
    await client.navigate('http://localhost:3001/catalog/products/68f200000000000000000001');
    const standalonePdpTitle = await client.evaluate('document.querySelector(".product-detail__name")?.textContent?.trim()');
    record('Standalone Catalog PDP renders directly at /catalog/products/:id', !!standalonePdpTitle, `title: "${standalonePdpTitle}"`);

    await client.navigate('http://localhost:3001/essential-cotton-t-shirt');
    const standaloneSlugTitle = await client.evaluate('document.querySelector(".product-detail__name")?.textContent?.trim()');
    record('Standalone Catalog PDP renders directly at /:slug', !!standaloneSlugTitle, `title: "${standaloneSlugTitle}"`);

    // SUMMARY
    console.log('\n====================================================');
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('====================================================\n');

    await client.close();
    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    chromeProc.kill();
  }
}

run().catch((err) => {
  console.error('Test run error:', err);
  process.exit(1);
});
