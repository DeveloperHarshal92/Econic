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

  async close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ], { stdio: 'ignore' });

  try {
    const wsUrl = await getDebuggerUrl();
    const newPageRes = await fetch('http://127.0.0.1:9222/json/new', { method: 'PUT' });
    const pageData = await newPageRes.json();

    const client = new CDPClient(pageData.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('Runtime.enable');

    console.log('Navigating to http://localhost:3000/catalog ...');
    await client.navigate('http://localhost:3000/catalog', 3000);

    const diagnostics = await client.evaluate(`
      (() => {
        const grid = document.querySelector('.product-list__grid');
        const cards = Array.from(document.querySelectorAll('.product-card'));
        
        const countText = document.querySelector('.product-list__count')?.textContent;
        const titleText = document.querySelector('.product-list__title')?.textContent;

        const cardDetails = cards.slice(0, 3).map((card, i) => {
          const style = window.getComputedStyle(card);
          const rect = card.getBoundingClientRect();
          const img = card.querySelector('img');
          const imgStyle = img ? window.getComputedStyle(img) : null;
          const imgRect = img ? img.getBoundingClientRect() : null;
          const content = card.querySelector('.product-card__content');
          const contentStyle = content ? window.getComputedStyle(content) : null;
          const title = card.querySelector('.product-card__title');
          const titleStyle = title ? window.getComputedStyle(title) : null;
          const link = card.querySelector('a');

          return {
            index: i,
            href: link ? link.getAttribute('href') : null,
            titleText: title ? title.textContent : null,
            card: {
              rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity,
              color: style.color,
              backgroundColor: style.backgroundColor,
              transform: style.transform,
              position: style.position,
              zIndex: style.zIndex,
              overflow: style.overflow,
              clipPath: style.clipPath,
              animationName: style.animationName,
              animationPlayState: style.animationPlayState,
              animationDuration: style.animationDuration,
              animationFillMode: style.animationFillMode,
            },
            image: img ? {
              src: img.src,
              currentSrc: img.currentSrc,
              complete: img.complete,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              display: imgStyle.display,
              visibility: imgStyle.visibility,
              opacity: imgStyle.opacity,
              rect: imgRect ? { width: imgRect.width, height: imgRect.height } : null,
            } : null,
            content: content ? {
              display: contentStyle.display,
              visibility: contentStyle.visibility,
              opacity: contentStyle.opacity,
              height: contentStyle.height,
            } : null,
            title: title ? {
              display: titleStyle.display,
              visibility: titleStyle.visibility,
              opacity: titleStyle.opacity,
              color: titleStyle.color,
            } : null,
            innerHTMLPreview: card.innerHTML.slice(0, 250),
          };
        });

        const gridStyle = grid ? window.getComputedStyle(grid) : null;
        const gridRect = grid ? grid.getBoundingClientRect() : null;

        return {
          totalCards: cards.length,
          countText,
          titleText,
          grid: grid ? {
            rect: gridRect ? { x: gridRect.x, y: gridRect.y, width: gridRect.width, height: gridRect.height } : null,
            display: gridStyle.display,
            visibility: gridStyle.visibility,
            opacity: gridStyle.opacity,
          } : null,
          cards: cardDetails,
        };
      })()
    `);

    console.log('--- DIAGNOSTICS RESULT ---');
    console.log(JSON.stringify(diagnostics, null, 2));

    await client.close();
  } finally {
    chromeProc.kill();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

