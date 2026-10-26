import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const USER_DATA = "C:\\Users\\HARSHAL\\AppData\\Local\\Temp\\chrome_qa_scroll_test";
const PORT = 9223;

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

    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        this.logs.push(msg.params);
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

  async eval(expr) {
    const res = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return res.result?.value;
  }

  async capture(savePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(savePath, Buffer.from(res.data, 'base64'));
  }

  close() {
    this.ws.close();
  }
}

async function run() {
  console.log("Starting Chrome for scroll testing...");
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${USER_DATA}`,
    '--window-size=1440,900'
  ]);

  try {
    const wsUrl = await getWsUrl();
    const cdp = new Cdp(wsUrl);
    await cdp.ready();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log("Navigating to http://localhost:3000/ ...");
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/' });
    await sleep(2500);

    const artifactDir = "C:\\Users\\HARSHAL\\.gemini\\antigravity-ide\\brain\\707ae936-6e69-409a-93cb-dcd54058a035";

    // Initial screenshot
    await cdp.capture(path.join(artifactDir, "qa_scroll_01_top.png"));
    const initData = await cdp.eval(`(() => ({
      scrollY: window.scrollY,
      headerHeight: document.querySelector('.header-wrapper')?.getBoundingClientRect().height,
      heroTop: document.querySelector('.cinematic-hero-sticky')?.getBoundingClientRect().top,
      progress: getComputedStyle(document.querySelector('.cinematic-hero-track')).getPropertyValue('--hero-progress')
    }))()`);
    console.log("Top (scrollY = 0):", initData);

    // Scroll 300px
    await cdp.eval(`window.scrollTo(0, 300)`);
    await sleep(400);
    await cdp.capture(path.join(artifactDir, "qa_scroll_02_mid.png"));
    const midData = await cdp.eval(`(() => ({
      scrollY: window.scrollY,
      heroTop: document.querySelector('.cinematic-hero-sticky')?.getBoundingClientRect().top,
      progress: getComputedStyle(document.querySelector('.cinematic-hero-track')).getPropertyValue('--hero-progress'),
      mediaWidth: document.querySelector('.cinematic-hero-media-wrapper')?.getBoundingClientRect().width,
      initialOpacity: getComputedStyle(document.querySelector('.cinematic-hero-initial-content')).opacity
    }))()`);
    console.log("Mid (scrollY = 300):", midData);

    // Scroll 600px (Expanded state)
    await cdp.eval(`window.scrollTo(0, 600)`);
    await sleep(400);
    await cdp.capture(path.join(artifactDir, "qa_scroll_03_expanded.png"));
    const expData = await cdp.eval(`(() => ({
      scrollY: window.scrollY,
      heroTop: document.querySelector('.cinematic-hero-sticky')?.getBoundingClientRect().top,
      progress: getComputedStyle(document.querySelector('.cinematic-hero-track')).getPropertyValue('--hero-progress'),
      expandedOpacity: getComputedStyle(document.querySelector('.cinematic-hero-expanded-content')).opacity,
      mediaRadius: getComputedStyle(document.querySelector('.cinematic-hero-media-wrapper')).borderRadius
    }))()`);
    console.log("Expanded (scrollY = 600):", expData);

    // Scroll 1200px (Unpinning into Category Discovery)
    await cdp.eval(`window.scrollTo(0, 1200)`);
    await sleep(400);
    await cdp.capture(path.join(artifactDir, "qa_scroll_04_categories.png"));
    const catData = await cdp.eval(`(() => ({
      scrollY: window.scrollY,
      categoriesTop: document.querySelector('.categories-section')?.getBoundingClientRect().top,
      heroBottom: document.querySelector('.cinematic-hero-track')?.getBoundingClientRect().bottom
    }))()`);
    console.log("Categories Section In View (scrollY = 1200):", catData);

    // Reverse scroll back to top
    await cdp.eval(`window.scrollTo(0, 0)`);
    await sleep(400);
    await cdp.capture(path.join(artifactDir, "qa_scroll_05_reversed.png"));
    const revData = await cdp.eval(`(() => ({
      scrollY: window.scrollY,
      progress: getComputedStyle(document.querySelector('.cinematic-hero-track')).getPropertyValue('--hero-progress'),
      initialOpacity: getComputedStyle(document.querySelector('.cinematic-hero-initial-content')).opacity
    }))()`);
    console.log("Reversed to 0:", revData);

    // Check console logs
    console.log("Console errors/warnings count:", cdp.logs.length);
    if (cdp.logs.length > 0) {
      console.log("Console logs:", cdp.logs);
    }

    cdp.close();
    console.log("QA Automation completed successfully!");
  } finally {
    chrome.kill();
  }
}

run().catch(e => {
  console.error("Test failed:", e);
  process.exit(1);
});
