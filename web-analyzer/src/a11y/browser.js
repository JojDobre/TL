'use strict';

const { assertPublicHost } = require('../fetcher');

let chromium;
function loadPlaywright() {
  if (!chromium) {
    try { ({ chromium } = require('playwright')); } catch {
      throw new Error('Chýba balík „playwright“. Nainštaluj ho: npm install playwright && npx playwright install chromium');
    }
  }
  return chromium;
}

/* ---------- jeden zdieľaný prehliadač ---------- */
let browserPromise = null;
async function getBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    if (b && b.isConnected()) return b;
  }
  const opts = { args: ['--disable-dev-shm-usage', '--no-sandbox'] };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  browserPromise = loadPlaywright().launch(opts);
  const b = await browserPromise;
  b.on('disconnected', () => { browserPromise = null; });
  return b;
}

/* ---------- semafor: max. N súbežných stránok ---------- */
const MAX_PAGES = Number(process.env.A11Y_CONCURRENCY) || 2;
let active = 0;
const queue = [];
function acquire() {
  if (active < MAX_PAGES) { active++; return Promise.resolve(); }
  return new Promise((r) => queue.push(r));
}
function release() {
  const next = queue.shift();
  if (next) next(); else active--;
}

/**
 * Otvorí izolovaný kontext, všetky požiadavky stránky (aj obrázky, skripty,
 * presmerovania) pustí len na verejné IP adresy.
 */
async function withPage(fn, { viewport = { width: 1280, height: 900 } } = {}) {
  await acquire();
  const browser = await getBrowser().catch((e) => { release(); throw e; });
  const ctx = await browser.newContext({
    viewport,
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 WebAnalyzer-A11y/1.0',
    locale: 'sk-SK',
    acceptDownloads: false,
    serviceWorkers: 'block',
  });
  const hostCache = new Map();
  await ctx.route('**/*', async (route) => {
    const req = route.request();
    let u;
    try { u = new URL(req.url()); } catch { return route.abort(); }
    if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return route.abort();
    if (['media', 'websocket', 'eventsource'].includes(req.resourceType())) return route.abort();
    let ok = hostCache.get(u.hostname);
    if (ok === undefined) {
      ok = await assertPublicHost(u.hostname).then(() => true, () => false);
      hostCache.set(u.hostname, ok);
    }
    return ok ? route.continue() : route.abort('blockedbyclient');
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  try {
    return await fn(page);
  } finally {
    await ctx.close().catch(() => {});
    release();
  }
}

async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    if (b) await b.close().catch(() => {});
  }
}

module.exports = { withPage, getBrowser, closeBrowser };
