'use strict';

/* SEO a jazykové verzie webu: spustí server a overí odpovede. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 39000 + (process.pid % 900);
const BASE = `http://127.0.0.1:${PORT}`;
let proc;

test.before(async () => {
  proc = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT), PUBLIC_URL: 'https://example.test', DATA_DIR: path.join(require('os').tmpdir(), 'wa-site-' + process.pid) },
    stdio: 'ignore',
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/health'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('server sa nespustil');
});
test.after(() => proc.kill());

const get = (p, headers = {}) => fetch(BASE + p, { redirect: 'manual', headers });
const jsonLd = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);

const PAGES = [
  ['/', 'sk'], ['/en/', 'en'], ['/pristupnost', 'sk'], ['/en/accessibility-audit', 'en'],
  ['/obchodne-podmienky', 'sk'], ['/en/terms', 'en'], ['/ochrana-osobnych-udajov', 'sk'], ['/en/privacy', 'en'],
];

test('všetky stránky: jazyk, titulok, popis, canonical, hreflang, OG, jeden H1, platné JSON-LD', async () => {
  const titles = new Set();
  for (const [p, lang] of PAGES) {
    const r = await get(p);
    assert.equal(r.status, 200, p);
    const html = await r.text();
    assert.match(html, new RegExp(`<html lang="${lang}">`), p);
    const title = html.match(/<title>([^<]+)<\/title>/)[1];
    assert.ok(title.length >= 20 && title.length <= 75, `${p}: dĺžka titulku ${title.length}`);
    assert.ok(!titles.has(title), `${p}: duplicitný titulok`);
    titles.add(title);
    const desc = html.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(desc.length >= 70 && desc.length <= 170, `${p}: dĺžka popisu ${desc.length}`);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://example.test${p.replace(/\//g, '\\/')}">`), p);
    for (const hl of ['sk', 'en', 'x-default']) assert.match(html, new RegExp(`hreflang="${hl}" href="https://example.test/`), `${p} hreflang ${hl}`);
    assert.match(html, /<meta property="og:image" content="https:\/\/example\.test\/img\/og-/, p);
    assert.match(html, /<meta name="robots" content="index, follow/, p);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${p}: počet H1`);
    const ld = jsonLd(html);
    assert.ok(ld['@graph'].some((x) => x['@type'] === 'Organization'), p);
    assert.equal(r.headers.get('content-language'), lang);
  }
});

test('stránka auditu: ceny v HTML a štruktúrovaných dátach, FAQ', async () => {
  const html = await (await get('/en/accessibility-audit')).text();
  for (const price of ['€19', '€29', '€49', '€9']) assert.ok(html.includes(price), price);
  const g = jsonLd(html)['@graph'];
  const svc = g.find((x) => x['@type'] === 'Service');
  assert.deepEqual(svc.offers.map((o) => o.price), ['19', '29', '49', '9']);
  assert.ok(g.find((x) => x['@type'] === 'FAQPage').mainEntity.length >= 8);
  assert.ok(g.find((x) => x['@type'] === 'BreadcrumbList'));
});

test('výsledky analýzy a objednávky sa neindexujú', async () => {
  for (const p of ['/?url=example.com', '/pristupnost?order=x&token=y', '/en/accessibility-audit?sub=1&token=2']) {
    const html = await (await get(p)).text();
    assert.match(html, /<meta name="robots" content="noindex, follow">/, p);
  }
});

test('presmerovania starých adries zachovajú parametre', async () => {
  const r = await get('/pristupnost.html?order=abc&token=def');
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), '/pristupnost?order=abc&token=def');
  assert.equal((await get('/en')).headers.get('location'), '/en/');
  assert.equal((await get('/index.html')).headers.get('location'), '/');
});

test('robots.txt a sitemap.xml s jazykovými verziami', async () => {
  const robots = await (await get('/robots.txt')).text();
  assert.match(robots, /Sitemap: https:\/\/example\.test\/sitemap\.xml/);
  assert.match(robots, /Disallow: \/api\//);
  const sm = await (await get('/sitemap.xml')).text();
  assert.equal((sm.match(/<url>/g) || []).length, 8);
  assert.equal((sm.match(/hreflang="x-default"/g) || []).length, 8);
  assert.match(sm, /<loc>https:\/\/example\.test\/en\/accessibility-audit<\/loc>/);
});

test('404 so správnym kódom a noindex', async () => {
  for (const [p, lang] of [['/neexistuje', 'sk'], ['/en/missing', 'en'], ['/index-stary.html', 'sk']]) {
    const r = await get(p);
    assert.equal(r.status, 404, p);
    const html = await r.text();
    assert.match(html, /noindex/);
    assert.match(html, new RegExp(`<html lang="${lang}">`));
  }
});

test('výkon: Brotli, dlhá cache pre súbory s hashom, ETag, HSTS pri https', async () => {
  const r = await get('/en/', { 'accept-encoding': 'br' });
  assert.equal(r.headers.get('content-encoding'), 'br');
  assert.match(r.headers.get('strict-transport-security'), /max-age=31536000/);
  const html = await r.text(); // fetch v Node dekomprimuje automaticky
  const css = html.match(/href="(\/styles\.css\?v=[0-9a-f]+)"/)[1];
  const c = await get(css, { 'accept-encoding': 'gzip' });
  assert.match(c.headers.get('cache-control'), /max-age=31536000, immutable/);
  assert.equal(c.headers.get('content-encoding'), 'gzip');
  const etag = c.headers.get('etag');
  assert.equal((await get(css, { 'if-none-match': etag })).status, 304);
  assert.match((await get('/fonts/inter-latin-wght-normal.woff2')).headers.get('cache-control'), /immutable/);
});

test('API vracia chyby v jazyku požiadavky', async () => {
  const sk = await (await fetch(`${BASE}/api/analyze?url=localhost&lang=sk`)).json();
  const en = await (await fetch(`${BASE}/api/analyze?url=localhost&lang=en`)).json();
  assert.equal(sk.error, 'Neplatná doména.');
  assert.equal(en.error, 'Invalid domain.');
  const cfg = await (await fetch(`${BASE}/api/a11y/config?lang=en`)).json();
  assert.equal(cfg.tiers[0].name, 'Basic');
});
