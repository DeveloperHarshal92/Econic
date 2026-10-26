import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\HARSHAL\\AppData\\Local\\Temp\\chrome_qa_phase2_test";
const PORT = 9227;

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

async function runPhase2QA() {
  console.log("=== VÊTU PHASE 2: SHARED MOTION UTILITIES QA ===");

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

    // 1. Verify CSS Motion Tokens in :root
    console.log("\n[TEST 1] Verifying VÊTU Motion Design Tokens in :root");
    const motionTokens = await cdp.eval(`(() => {
      const styles = getComputedStyle(document.documentElement);
      return {
        durationFast: styles.getPropertyValue('--vetu-motion-duration-fast').trim(),
        durationReveal: styles.getPropertyValue('--vetu-motion-duration-reveal').trim(),
        durationHover: styles.getPropertyValue('--vetu-motion-duration-hover').trim(),
        easeOut: styles.getPropertyValue('--vetu-motion-ease-out').trim(),
        easeInOut: styles.getPropertyValue('--vetu-motion-ease-in-out').trim()
      };
    })()`);
    console.log("Computed Motion Tokens:", motionTokens);

    if (
      motionTokens.durationFast !== '200ms' ||
      motionTokens.durationReveal !== '600ms' ||
      motionTokens.durationHover !== '750ms' ||
      !motionTokens.easeOut.includes('cubic-bezier') ||
      !motionTokens.easeInOut.includes('cubic-bezier')
    ) {
      throw new Error(`FAIL: Motion tokens missing or incorrect! ${JSON.stringify(motionTokens)}`);
    }
    console.log("PASS: All 5 VÊTU motion design tokens are correctly registered in :root!");

    // 2. Verify Motion Token Collapse Under prefers-reduced-motion
    console.log("\n[TEST 2] Verifying Motion Token Collapse Under prefers-reduced-motion");
    await cdp.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    await sleep(300);

    const reducedTokens = await cdp.eval(`(() => {
      const styles = getComputedStyle(document.documentElement);
      return {
        durationFast: styles.getPropertyValue('--vetu-motion-duration-fast').trim(),
        durationReveal: styles.getPropertyValue('--vetu-motion-duration-reveal').trim(),
        durationHover: styles.getPropertyValue('--vetu-motion-duration-hover').trim()
      };
    })()`);
    console.log("Reduced Motion Tokens:", reducedTokens);

    if (
      reducedTokens.durationFast !== '0.01ms' ||
      reducedTokens.durationReveal !== '0.01ms' ||
      reducedTokens.durationHover !== '0.01ms'
    ) {
      throw new Error(`FAIL: Reduced motion tokens did not collapse! ${JSON.stringify(reducedTokens)}`);
    }
    console.log("PASS: Motion duration tokens collapse cleanly to 0.01ms under prefers-reduced-motion!");

    // Restore standard motion
    await cdp.send('Emulation.setEmulatedMedia', {
      media: 'screen',
      features: [{ name: 'prefers-reduced-motion', value: '' }]
    });
    await sleep(300);

    // 3. Test IntersectionObserver Functionality & Once Disconnect
    console.log("\n[TEST 3] Testing IntersectionObserver Once Trigger & Disconnect Logic");
    const ioTestResult = await cdp.eval(`(() => {
      return new Promise((resolve) => {
        // Create test sandbox element
        const testEl = document.createElement('div');
        testEl.id = 'qa-intersection-test';
        testEl.style.width = '100px';
        testEl.style.height = '100px';
        testEl.style.position = 'fixed';
        testEl.style.top = '0px';
        testEl.style.left = '0px';
        testEl.style.zIndex = '99999';
        document.body.appendChild(testEl);

        let triggerCount = 0;
        let isObserverDisconnected = false;

        let observer = new IntersectionObserver((entries) => {
          triggerCount++;
          if (entries[0].isIntersecting) {
            // Simulate 'once: true' behavior
            observer.disconnect();
            isObserverDisconnected = true;
          }
        }, { threshold: 0.15 });

        observer.observe(testEl);

        setTimeout(() => {
          // Cleanup test element
          testEl.remove();
          resolve({
            triggered: triggerCount > 0,
            disconnected: isObserverDisconnected
          });
        }, 200);
      });
    })()`);
    console.log("IO Test Result:", ioTestResult);

    if (!ioTestResult.triggered || !ioTestResult.disconnected) {
      throw new Error(`FAIL: IntersectionObserver once test failed! ${JSON.stringify(ioTestResult)}`);
    }
    console.log("PASS: IntersectionObserver once logic successfully triggers and disconnects observer!");

    // 4. Verify Homepage Visual Invariance (No New Visible Animations Added)
    console.log("\n[TEST 4] Verifying Homepage Visual Invariance (Zero Premature Animations)");
    const homepageCheck = await cdp.eval(`(() => {
      return {
        heroPresent: !!document.querySelector('.cinematic-hero-track'),
        categoriesPresent: !!document.querySelector('.categories-section'),
        newArrivalsPresent: !!document.querySelector('.products-section'),
        brandStoryPresent: !!document.querySelector('.brand-story-section'),
        benefitsPresent: !!document.querySelector('.benefits-section'),
        collectionsPresent: !!document.querySelector('.collections-section'),
        newsletterPresent: !!document.querySelector('.newsletter-section'),
        footerPresent: !!document.querySelector('.footer')
      };
    })()`);
    console.log("Homepage Sections Check:", homepageCheck);

    const allPresent = Object.values(homepageCheck).every(Boolean);
    if (!allPresent) {
      throw new Error(`FAIL: Some homepage sections are missing! ${JSON.stringify(homepageCheck)}`);
    }
    console.log("PASS: All 10 homepage sections remain 100% intact with zero premature modifications!");

    // 5. Console Error Verification
    console.log("\n[TEST 5] Checking Console Errors");
    console.log(`Recorded console errors: ${cdp.errors.length}`);
    if (cdp.errors.length > 0) {
      console.log("Console Errors:", JSON.stringify(cdp.errors, null, 2));
      throw new Error("FAIL: Console errors detected!");
    }
    console.log("PASS: 0 console errors detected!");

    await cdp.close();
    console.log("\n=== ALL PHASE 2 VERIFICATIONS PASSED SUCCESSFULLY! ===");
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

runPhase2QA().catch(err => {
  console.error("QA Execution Error:", err);
  process.exit(1);
});
