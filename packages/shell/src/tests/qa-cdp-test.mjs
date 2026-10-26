import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\HARSHAL\\AppData\\Local\\Temp\\chrome_qa_cdp_profile";
const PORT = 9222;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      if (res.ok) {
        const list = await res.json();
        if (list.length > 0 && list[0].webSocketDebuggerUrl) {
          return list[0].webSocketDebuggerUrl;
        }
      }
    } catch {}
    await sleep(250);
  }
  throw new Error("Could not connect to Chrome debugging port");
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
    this.consoleLogs = [];

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        this.consoleLogs.push(msg.params);
      }
    };
  }

  ready() {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  }

  async screenshot(filepath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filepath, buffer);
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  console.log("Launching headless Chrome on port", PORT);
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${USER_DATA}`,
    '--window-size=1440,900',
    'http://localhost:3000/'
  ]);

  try {
    const wsUrl = await getWsUrl();
    console.log("Connected to CDP:", wsUrl);
    const client = new CdpClient(wsUrl);
    await client.ready();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('DOM.enable');

    console.log("Waiting for page load...");
    await sleep(2500); // Allow React and images to settle

    // 1. Inspect DOM & Dimensions
    const headerInfo = await client.evaluate(`
      (() => {
        const header = document.querySelector('.header-wrapper');
        const hero = document.querySelector('.cinematic-hero-track');
        const sticky = document.querySelector('.cinematic-hero-sticky');
        const media = document.querySelector('.cinematic-hero-media-wrapper');
        return {
          headerHeight: header ? header.getBoundingClientRect().height : null,
          heroTrackHeight: hero ? hero.getBoundingClientRect().height : null,
          stickyTop: sticky ? window.getComputedStyle(sticky).top : null,
          stickyHeight: sticky ? sticky.getBoundingClientRect().height : null,
          mediaWidth: media ? media.getBoundingClientRect().width : null,
          mediaHeight: media ? media.getBoundingClientRect().height : null,
          windowHeight: window.innerHeight,
          scrollY: window.scrollY
        };
      })()
    `);
    console.log("Initial Geometry:", JSON.stringify(headerInfo, null, 2));

    const artifactDir = "C:\\Users\\HARSHAL\\.gemini\\antigravity-ide\\brain\\707ae936-6e69-409a-93cb-dcd54058a035";
    await client.screenshot(path.join(artifactDir, "qa_cdp_initial_settled.png"));

    // 2. Test Carousel Click: Next Slide
    console.log("Clicking Next Slide button...");
    await client.evaluate(`
      (() => {
        const nextBtn = document.querySelector('button[aria-label="Next campaign look"]');
        if (nextBtn) nextBtn.click();
      })()
    `);
    await sleep(800);

    const slide2Info = await client.evaluate(`
      (() => {
        const counter = document.querySelector('.cinematic-counter-current')?.textContent;
        const headline = document.querySelector('.cinematic-hero-headline')?.textContent?.trim();
        return { counter, headline };
      })()
    `);
    console.log("Slide 2 Info:", slide2Info);
    await client.screenshot(path.join(artifactDir, "qa_cdp_slide_2.png"));

    // 3. Test Scroll Expansion: Step through scroll positions
    console.log("Testing scroll progression...");
    const scrollSteps = [300, 600, 900, 1200, 1600];
    const scrollResults = [];

    for (const y of scrollSteps) {
      await client.evaluate(`window.scrollTo(0, ${y})`);
      await sleep(250); // RAF settle

      const stepData = await client.evaluate(`
        (() => {
          const hero = document.querySelector('.cinematic-hero-track');
          const sticky = document.querySelector('.cinematic-hero-sticky');
          const media = document.querySelector('.cinematic-hero-media-wrapper');
          const initialContent = document.querySelector('.cinematic-hero-initial-content');
          const expandedContent = document.querySelector('.cinematic-hero-expanded-content');
          const style = hero ? window.getComputedStyle(hero) : null;
          return {
            scrollY: window.scrollY,
            progressVar: style?.getPropertyValue('--hero-progress')?.trim(),
            bgYVar: style?.getPropertyValue('--hero-bg-y')?.trim(),
            fgYVar: style?.getPropertyValue('--hero-fg-y')?.trim(),
            widthVar: style?.getPropertyValue('--hero-width')?.trim(),
            initialOpacity: window.getComputedStyle(initialContent).opacity,
            expandedOpacity: window.getComputedStyle(expandedContent).opacity,
            mediaWidth: media.getBoundingClientRect().width,
            mediaHeight: media.getBoundingClientRect().height,
          };
        })()
      `);
      scrollResults.push(stepData);
    }
    console.log("Scroll Steps Results:", JSON.stringify(scrollResults, null, 2));
    await client.screenshot(path.join(artifactDir, "qa_cdp_expanded_max.png"));

    // 4. Test Scroll Reversal: Scroll back to top
    console.log("Testing scroll reversal back to 0...");
    await client.evaluate(`window.scrollTo(0, 0)`);
    await sleep(350);

    const reversedInfo = await client.evaluate(`
      (() => {
        const hero = document.querySelector('.cinematic-hero-track');
        const style = hero ? window.getComputedStyle(hero) : null;
        return {
          scrollY: window.scrollY,
          progressVar: style?.getPropertyValue('--hero-progress')?.trim(),
          bgYVar: style?.getPropertyValue('--hero-bg-y')?.trim(),
          fgYVar: style?.getPropertyValue('--hero-fg-y')?.trim()
        };
      })()
    `);
    console.log("Reversed Info:", reversedInfo);
    await client.screenshot(path.join(artifactDir, "qa_cdp_reversed_top.png"));

    // 5. Console errors check
    console.log("Captured Console Logs:", client.consoleLogs.length);
    if (client.consoleLogs.length > 0) {
      console.log(JSON.stringify(client.consoleLogs, null, 2));
    }

    client.close();
  } finally {
    chromeProc.kill();
  }
}

main().catch(err => {
  console.error("CDP Test failed:", err);
  process.exit(1);
});
