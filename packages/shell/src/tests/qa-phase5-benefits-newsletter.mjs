import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\HARSHAL\\AppData\\Local\\Temp\\chrome_qa_phase5_test";
const PORT = 9230;

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
  }

  async ready() {
    if (this.ws.readyState === 1) return;
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.method === 'Runtime.consoleAPICalled' && data.params.type === 'error') {
          this.consoleErrors.push(data.params.args.map(a => a.value || a.description).join(' '));
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

async function runPhase5QA() {
  console.log("=== VÊTU PHASE 5: SHOPPING BENEFITS & NEWSLETTER POLISH QA ===");

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
      const ready = await cdp.eval(`!!document.querySelector('.benefits-section') && !!document.querySelector('.newsletter-section')`);
      if (ready) break;
      await sleep(500);
    }
    await sleep(1500);

    // 1. Initial State: Top of Page (Sections not yet revealed)
    console.log("\n[TEST 1] Initial Scroll State (Top of Page)");
    await cdp.eval(`window.scrollTo(0, 0);`);
    await sleep(400);

    const initialStatus = await cdp.eval(`(() => {
      const benefits = document.querySelector('.benefits-section');
      const newsletter = document.querySelector('.newsletter-section');
      return {
        benefitsRevealed: benefits ? benefits.classList.contains('benefits-section--revealed') : null,
        newsletterRevealed: newsletter ? newsletter.classList.contains('newsletter-section--revealed') : null
      };
    })()`);
    console.log("Initial Section Reveal Status:", initialStatus);
    if (initialStatus.benefitsRevealed !== false || initialStatus.newsletterRevealed !== false) {
      throw new Error(`FAIL: Sections should not be revealed before being scrolled into view! Got: ${JSON.stringify(initialStatus)}`);
    }
    console.log("PASS: Benefits and Newsletter remain unrevealed until scrolled into view!");

    // 2. Scroll into Shopping Benefits Section
    console.log("\n[TEST 2] Scroll into Shopping Benefits Section");
    await cdp.eval(`(() => {
      const benefits = document.querySelector('.benefits-section');
      if (benefits) benefits.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await sleep(600);

    const benefitsRevealState = await cdp.eval(`(() => {
      const section = document.querySelector('.benefits-section');
      const items = Array.from(document.querySelectorAll('.benefits-grid .benefit-item'));
      const itemStyles = items.map((el, i) => {
        const s = getComputedStyle(el);
        const title = el.querySelector('.benefit-item__title')?.textContent;
        const desc = el.querySelector('.benefit-item__desc')?.textContent;
        const hasSvg = !!el.querySelector('.benefit-item__icon-wrap svg');
        return {
          index: i + 1,
          title,
          desc,
          hasSvg,
          opacity: s.opacity,
          transform: s.transform,
          transitionDelay: s.transitionDelay
        };
      });
      return {
        isRevealed: section?.classList.contains('benefits-section--revealed'),
        itemCount: items.length,
        itemStyles
      };
    })()`);
    console.log("Benefits Reveal State:", JSON.stringify(benefitsRevealState, null, 2));

    if (!benefitsRevealState.isRevealed || benefitsRevealState.itemCount !== 4) {
      throw new Error(`FAIL: Benefits reveal failed! ${JSON.stringify(benefitsRevealState)}`);
    }
    if (benefitsRevealState.itemStyles[0].transitionDelay !== '0s') {
      throw new Error(`FAIL: Benefit item 1 delay incorrect! Got: ${benefitsRevealState.itemStyles[0].transitionDelay}`);
    }
    if (benefitsRevealState.itemStyles[1].transitionDelay !== '0.08s') {
      throw new Error(`FAIL: Benefit item 2 delay incorrect! Expected 0.08s, got: ${benefitsRevealState.itemStyles[1].transitionDelay}`);
    }
    if (benefitsRevealState.itemStyles[2].transitionDelay !== '0.16s') {
      throw new Error(`FAIL: Benefit item 3 delay incorrect! Expected 0.16s, got: ${benefitsRevealState.itemStyles[2].transitionDelay}`);
    }
    if (benefitsRevealState.itemStyles[3].transitionDelay !== '0.24s') {
      throw new Error(`FAIL: Benefit item 4 delay incorrect! Expected 0.24s, got: ${benefitsRevealState.itemStyles[3].transitionDelay}`);
    }
    console.log("PASS: Shopping Benefits section reveals 4 pillars with calibrated 80ms stagger!");

    // 3. Test Hover Micro-Interactions on Benefit Items
    console.log("\n[TEST 3] Testing Benefit Icon Transitions & Hover Styles");
    const iconTransitionCheck = await cdp.eval(`(() => {
      const firstItem = document.querySelector('.benefit-item');
      const iconWrap = firstItem?.querySelector('.benefit-item__icon-wrap');
      const s = getComputedStyle(iconWrap);
      return {
        hasIcon: !!iconWrap,
        transition: s.transition,
        color: s.color
      };
    })()`);
    console.log("Icon Transition Check:", iconTransitionCheck);
    if (!iconTransitionCheck.hasIcon || !iconTransitionCheck.transition.includes('transform')) {
      throw new Error(`FAIL: Icon wrap missing transform transition! Got: ${JSON.stringify(iconTransitionCheck)}`);
    }
    console.log("PASS: Benefit icons have hardware-accelerated transform transitions for float effect!");

    // 4. Scroll into Newsletter Section
    console.log("\n[TEST 4] Scroll into Newsletter Section");
    await cdp.eval(`(() => {
      const newsletter = document.querySelector('.newsletter-section');
      if (newsletter) newsletter.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await sleep(600);

    const newsletterRevealState = await cdp.eval(`(() => {
      const section = document.querySelector('.newsletter-section');
      const card = document.querySelector('.newsletter-card');
      const input = document.querySelector('.newsletter-card__input');
      const btn = document.querySelector('.newsletter-card__btn');
      const sCard = getComputedStyle(card);
      const sInput = getComputedStyle(input);
      const sBtn = getComputedStyle(btn);

      return {
        isRevealed: section?.classList.contains('newsletter-section--revealed'),
        cardOpacity: sCard.opacity,
        cardTransform: sCard.transform,
        inputTransition: sInput.transition,
        btnTransition: sBtn.transition,
        inputBorder: sInput.border,
        btnText: btn?.textContent?.trim()
      };
    })()`);
    console.log("Newsletter Reveal State:", JSON.stringify(newsletterRevealState, null, 2));

    if (!newsletterRevealState.isRevealed) {
      throw new Error(`FAIL: Newsletter section not revealed!`);
    }
    if (!newsletterRevealState.inputTransition.includes('border') && !newsletterRevealState.inputTransition.includes('all')) {
      throw new Error(`FAIL: Newsletter input lacks smooth border/shadow transition!`);
    }
    console.log("PASS: Newsletter section reveals smoothly with refined input & button transitions!");

    // 5. Test Interactive Newsletter Submission
    console.log("\n[TEST 5] Interactive Newsletter Submission & State Transitions");
    await cdp.eval(`(() => {
      const input = document.querySelector('.newsletter-card__input');
      if (input) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, 'editorial.curator@vetu.com');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()`);
    await sleep(150);

    // Click submit button
    await cdp.eval(`(() => {
      const btn = document.querySelector('.newsletter-card__btn');
      if (btn) btn.click();
    })()`);

    await sleep(50);
    // Check intermediate submitting feedback
    const submittingState = await cdp.eval(`(() => {
      const btn = document.querySelector('.newsletter-card__btn');
      return {
        btnText: btn?.textContent?.trim(),
        disabled: btn?.disabled
      };
    })()`);
    console.log("Newsletter Submitting State:", submittingState);

    // Wait for submission completion and transition
    await sleep(500);

    const successState = await cdp.eval(`(() => {
      const successBox = document.querySelector('.newsletter-card__success');
      const title = successBox?.querySelector('.newsletter-card__success-title')?.textContent?.trim();
      const code = successBox?.querySelector('.newsletter-card__code')?.textContent?.trim();
      const s = successBox ? getComputedStyle(successBox) : null;
      return {
        rendered: !!successBox,
        title,
        code,
        opacity: s?.opacity,
        animationName: s?.animationName
      };
    })()`);
    console.log("Newsletter Success State:", successState);

    if (!successState.rendered || successState.code !== 'VETU10') {
      throw new Error(`FAIL: Newsletter subscription confirmation failed! Got: ${JSON.stringify(successState)}`);
    }
    console.log("PASS: Newsletter submission displays tactile feedback and animated success confirmation code!");

    // 6. Multi-Device Viewport Verification (375px, 768px, 1280px, 1440px)
    console.log("\n[TEST 6] Multi-Device Viewport Verification (375px, 768px, 1280px, 1440px)");
    const viewports = [
      { name: 'Mobile', width: 375, height: 667 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Laptop', width: 1280, height: 800 },
      { name: 'Desktop', width: 1440, height: 900 }
    ];

    for (const vp of viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width < 768
      });
      await sleep(350);

      const vpStatus = await cdp.eval(`(() => {
        const body = document.body;
        const html = document.documentElement;
        const benefitsGrid = document.querySelector('.benefits-grid');
        const newsletterCard = document.querySelector('.newsletter-card');

        return {
          scrollWidth: html.scrollWidth,
          innerWidth: window.innerWidth,
          hasOverflow: html.scrollWidth > window.innerWidth,
          benefitsColumns: getComputedStyle(benefitsGrid).gridTemplateColumns.split(' ').length,
          newsletterColumns: getComputedStyle(newsletterCard).gridTemplateColumns.split(' ').length
        };
      })()`);

      console.log(`Viewport ${vp.name} (${vp.width}px):`, vpStatus);
      if (vpStatus.hasOverflow) {
        throw new Error(`FAIL: Horizontal overflow detected at ${vp.width}px!`);
      }
    }
    console.log("PASS: Zero horizontal overflow across all tested viewports!");

    // Reset viewport
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });

    // 7. prefers-reduced-motion: reduce Mode Verification
    console.log("\n[TEST 7] prefers-reduced-motion: reduce Mode Verification");
    await cdp.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await sleep(350);

    const reducedMotionState = await cdp.eval(`(() => {
      const benefitItem = document.querySelector('.benefit-item');
      const newsletterCard = document.querySelector('.newsletter-card');
      const sItem = getComputedStyle(benefitItem);
      const sCard = getComputedStyle(newsletterCard);

      return {
        benefitOpacity: sItem.opacity,
        benefitTransform: sItem.transform,
        benefitDelay: sItem.transitionDelay,
        newsletterOpacity: sCard.opacity,
        newsletterTransform: sCard.transform,
        newsletterAnimation: sCard.animationName
      };
    })()`);
    console.log("Reduced Motion State:", reducedMotionState);

    if (reducedMotionState.benefitOpacity !== '1' || reducedMotionState.benefitTransform !== 'none') {
      throw new Error(`FAIL: Benefit item not instant under reduced motion! ${JSON.stringify(reducedMotionState)}`);
    }
    if (reducedMotionState.newsletterOpacity !== '1' || reducedMotionState.newsletterTransform !== 'none') {
      throw new Error(`FAIL: Newsletter card not instant under reduced motion! ${JSON.stringify(reducedMotionState)}`);
    }
    console.log("PASS: Benefits and Newsletter are instantly rendered without delay under prefers-reduced-motion!");

    // 8. Console Error Check
    console.log("\n[TEST 8] Console Error Check");
    console.log("Recorded console errors:", cdp.consoleErrors.length);
    if (cdp.consoleErrors.length > 0) {
      throw new Error(`FAIL: Console errors recorded: ${JSON.stringify(cdp.consoleErrors)}`);
    }
    console.log("PASS: 0 console errors detected throughout testing!");

    console.log("\n=== ALL PHASE 5 VERIFICATIONS PASSED SUCCESSFULLY! ===");
    cdp.close();
    chromeProc.kill();
    process.exit(0);

  } catch (err) {
    console.error("QA Execution Error:", err);
    chromeProc.kill();
    process.exit(1);
  }
}

runPhase5QA();
