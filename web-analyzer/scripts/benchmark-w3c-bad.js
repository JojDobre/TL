'use strict';

/*
 * Benchmark presnosti na W3C „Before and After Demonstration“ (BAD):
 * https://www.w3.org/WAI/demos/bad/
 * Verzia „before“ obsahuje zámerne vložené chyby, verzia „after“ je opravená.
 * Dobrý nástroj nájde veľa chýb na „before“ a čo najmenej na „after“.
 *
 * w3.org blokuje headless prehliadače (Cloudflare), preto stránky aj ich CSS
 * a obrázky sťahuje Node a prehliadač ich načíta z lokálneho zrkadla – obsah je
 * identický s originálom.
 *
 * Spustenie: npm run benchmark
 */

process.env.WA_ALLOW_PRIVATE_HOSTS = '1';

const http = require('http');
const { scanPage, aggregate } = require('../src/a11y/scanner');
const { closeBrowser } = require('../src/a11y/browser');

const PAGES = ['home', 'news', 'tickets', 'survey'];
const ORIGIN = 'https://www.w3.org';
const cache = new Map();

function mirror() {
  const server = http.createServer(async (req, res) => {
    const path = new URL(req.url, 'http://x').pathname;
    if (!path.startsWith('/WAI/')) { res.writeHead(404); return res.end(); }
    try {
      if (!cache.has(path)) {
        const r = await fetch(ORIGIN + path, { headers: { 'user-agent': 'Mozilla/5.0 WebAnalyzer-benchmark' } });
        cache.set(path, { status: r.status, type: r.headers.get('content-type') || 'application/octet-stream', body: Buffer.from(await r.arrayBuffer()) });
      }
      const c = cache.get(path);
      res.writeHead(c.status, { 'content-type': c.type });
      res.end(c.body);
    } catch { res.writeHead(502); res.end(); }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

(async () => {
  const server = await mirror();
  const base = `http://127.0.0.1:${server.address().port}/WAI/demos/bad`;
  const rows = [];
  const all = { before: [], after: [] };
  for (const page of PAGES) {
    const row = { page };
    for (const v of ['before', 'after']) {
      const r = await scanPage(`${base}/${v}/${page}.html`, { keyboard: true, reflow: true });
      all[v].push(r);
      row[v] = { types: r.violations.length, nodes: r.violations.reduce((s, x) => s + x.nodeCount, 0) };
    }
    rows.push(row);
    console.error(`  ${page}: before ${row.before.types} typov / ${row.before.nodes} výskytov · after ${row.after.types} / ${row.after.nodes}`);
  }
  const before = aggregate(all.before), after = aggregate(all.after);

  console.log('\n| Stránka | Before – typy / výskyty | After – typy / výskyty |');
  console.log('|---|---|---|');
  for (const r of rows) console.log(`| ${r.page} | ${r.before.types} / ${r.before.nodes} | ${r.after.types} / ${r.after.nodes} |`);
  console.log(`| **spolu** | **${before.issues.length} / ${before.totalNodes}** | **${after.issues.length} / ${after.totalNodes}** |`);
  console.log(`\nSkóre: before ${before.score}, after ${after.score}`);
  console.log('\nPravidlá – before:', before.issues.map((i) => `${i.id} (${i.nodeCount})`).join(', '));
  console.log('\nPravidlá – after: ', after.issues.map((i) => `${i.id} (${i.nodeCount})`).join(', ') || 'žiadne');
  for (const i of after.issues) {
    console.log(`\n[after] ${i.id} – ${i.title}`);
    for (const e of i.examples.slice(0, 3)) console.log(`   ${e.page.replace(base, '')} :: ${e.html.slice(0, 160).replace(/\s+/g, ' ')}\n      ${(e.summary || '').slice(0, 220).replace(/\s+/g, ' ')}`);
  }
  await closeBrowser();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
