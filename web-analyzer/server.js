'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { analyze } = require('./src/analyzer');
const { UserError } = require('./src/fetcher');
const a11y = require('./src/a11y/orders');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' https: data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
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
  const fresh = url.searchParams.get('fresh') === '1';
  const key = String(target || '').trim().toLowerCase().replace(/\/+$/, '');

  if (!fresh && cache.has(key)) return sendJson(res, 200, { ...cache.get(key).data, cached: true });
  if (rateLimited(ip)) return sendJson(res, 429, { error: 'Príliš veľa požiadaviek. Skús to o minútu znova.' });

  try {
    const data = await analyze(target);
    cache.set(key, { at: Date.now(), data });
    sendJson(res, 200, data);
  } catch (err) {
    if (err instanceof UserError) return sendJson(res, 400, { error: err.message });
    const msg = err?.name === 'TimeoutError' || err?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT'
      ? 'Web neodpovedal včas (timeout).'
      : `Web sa nepodarilo načítať${err?.cause?.code ? ` (${err.cause.code})` : ''}.`;
    console.error('[analyze]', target, err?.cause?.code || err?.message);
    sendJson(res, 502, { error: msg });
  }
}

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
      return res.end('404 – nenájdené');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      ...SECURITY_HEADERS,
    });
    res.end(buf);
  });
}

/* ---- Audit prístupnosti (EAA / WCAG) ---- */

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new a11y.PublicError('Príliš veľká požiadavka.', 413)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  const proto = process.env.TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${proto}://${req.headers.host || `localhost:${PORT}`}`;
}

async function handleA11y(req, res, url) {
  const ip = req.socket.remoteAddress || 'unknown';
  const p = url.pathname;
  try {
    if (p === '/api/a11y/config' && req.method === 'GET') return sendJson(res, 200, a11y.config());

    if (p === '/api/a11y/preview' && req.method === 'POST') {
      if (rateLimited('pv:' + ip, 6)) return sendJson(res, 429, { error: 'Príliš veľa testov. Skús to o minútu znova.' });
      const { url: target } = JSON.parse((await readBody(req, 8 * 1024)) || '{}');
      return sendJson(res, 200, await a11y.createPreview(target));
    }

    if (p === '/api/a11y/checkout' && req.method === 'POST') {
      if (rateLimited('co:' + ip, 10)) return sendJson(res, 429, { error: 'Príliš veľa požiadaviek.' });
      const body = JSON.parse((await readBody(req, 8 * 1024)) || '{}');
      return sendJson(res, 200, await a11y.createOrder(body, baseUrl(req)));
    }

    if (p === '/api/stripe/webhook' && req.method === 'POST') {
      const raw = await readBody(req, 1024 * 1024);
      await a11y.handleWebhook(raw, req.headers['stripe-signature']);
      return sendJson(res, 200, { received: true });
    }

    let m = /^\/api\/a11y\/orders\/([a-f0-9-]{36})(\/report\.pdf|\/retry)?$/.exec(p);
    if (m) {
      const token = url.searchParams.get('token');
      if (!m[2] && req.method === 'GET') return sendJson(res, 200, await a11y.getOrder(m[1], token));
      if (m[2] === '/retry' && req.method === 'POST') return sendJson(res, 200, await a11y.retryOrder(m[1], token));
      if (m[2] === '/report.pdf' && req.method === 'GET') {
        const { pdf, filename } = await a11y.getReport(m[1], token);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${url.searchParams.get('inline') ? 'inline' : 'attachment'}; filename="${filename}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        return res.end(pdf);
      }
    }
    sendJson(res, 404, { error: 'Nenájdené.' });
  } catch (e) {
    if (e instanceof a11y.PublicError) return sendJson(res, e.status, { error: e.message });
    if (e instanceof SyntaxError) return sendJson(res, 400, { error: 'Neplatný JSON.' });
    console.error('[a11y api]', e);
    sendJson(res, 500, { error: 'Interná chyba servera.' });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/analyze' && req.method === 'GET') return void handleAnalyze(req, res, url);
  if (url.pathname.startsWith('/api/a11y/') || url.pathname === '/api/stripe/webhook') return void handleA11y(req, res, url);
  if (url.pathname === '/api/health') return sendJson(res, 200, { ok: true });
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Web Analyzer beží na http://localhost:${PORT}`);
  a11y.resumeJobs().catch((e) => console.error('[a11y resume]', e));
});
setInterval(() => a11y.cleanupPreviews().catch(() => {}), 3600_000).unref();

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await require('./src/a11y/browser').closeBrowser();
    process.exit(0);
  });
}
