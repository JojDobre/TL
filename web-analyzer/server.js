'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { analyze } = require('./src/analyzer');
const { UserError } = require('./src/fetcher');
const a11yApi = require('./src/a11y/api');
const site = require('./src/site');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' https: data:; style-src 'self'; font-src 'self'; script-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
};

/* ---- jednoduchý rate limit (na IP) a krátka cache výsledkov ---- */
const hits = new Map();
const RATE_WINDOW = 60_000, RATE_MAX = 10;
function rateLimited(ip, max = RATE_MAX) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > max;
}
const cache = new Map();
const CACHE_TTL = 5 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) if (now - v.at > CACHE_TTL) cache.delete(k);
  for (const [k, v] of hits) if (!v.some((t) => now - t < RATE_WINDOW)) hits.delete(k);
}, 60_000).unref();

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS });
  res.end(JSON.stringify(data));
}

async function handleAnalyze(req, res, url) {
  const ip = req.socket.remoteAddress || 'unknown';
  const target = url.searchParams.get('url');
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'sk';
  const L = (sk, en) => (lang === 'en' ? en : sk);
  const fresh = url.searchParams.get('fresh') === '1';
  const key = lang + '|' + String(target || '').trim().toLowerCase().replace(/\/+$/, '');

  if (!fresh && cache.has(key)) return sendJson(res, 200, { ...cache.get(key).data, cached: true });
  if (rateLimited(ip)) return sendJson(res, 429, { error: L('Príliš veľa požiadaviek. Skúste to o minútu znova.', 'Too many requests. Please try again in a minute.') });

  try {
    const data = await analyze(target, lang);
    cache.set(key, { at: Date.now(), data });
    sendJson(res, 200, data);
  } catch (err) {
    if (err instanceof UserError) return sendJson(res, 400, { error: err.text(lang) });
    const code = err?.cause?.code ? ` (${err.cause.code})` : '';
    const msg = err?.name === 'TimeoutError' || err?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT'
      ? L('Web neodpovedal včas (timeout).', 'The website did not respond in time (timeout).')
      : L(`Web sa nepodarilo načítať${code}.`, `The website could not be loaded${code}.`);
    console.error('[analyze]', target, err?.cause?.code || err?.message);
    sendJson(res, 502, { error: msg });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/analyze' && req.method === 'GET') return void handleAnalyze(req, res, url);
  if (url.pathname.startsWith('/api/a11y/') || url.pathname.startsWith('/api/admin/') || url.pathname === '/api/stripe/webhook') {
    return void a11yApi.handle(req, res, url, rateLimited);
  }
  if (url.pathname === '/api/health') return sendJson(res, 200, { ok: true });
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  site.handle(req, res, url, SECURITY_HEADERS);
});

server.listen(PORT, () => {
  console.log(`Web Analyzer beží na http://localhost:${PORT}`);
  a11yApi.start();
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await require('./src/a11y/browser').closeBrowser();
    process.exit(0);
  });
}
