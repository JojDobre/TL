'use strict';

/*
 * Integračné testy presnosti: skenujeme lokálne stránky so ZNÁMYMI chybami.
 *  - bad.html  – každá vložená chyba musí byť nájdená (záchytnosť),
 *  - trap.html – pasca pre klávesnicu,
 *  - good.html – nesmie byť nahlásená žiadna chyba (falošné poplachy).
 */

process.env.WA_ALLOW_PRIVATE_HOSTS = '1';
process.env.DATA_DIR = require('path').join(require('os').tmpdir(), 'wa-int-' + process.pid);

const test = require('node:test');
const assert = require('node:assert/strict');
const { startFixtureServer } = require('./helpers');
const { quickScan, crawlAndScan, scanPage } = require('../src/a11y/scanner');
const { renderPdf } = require('../src/a11y/report');
const { closeBrowser } = require('../src/a11y/browser');

let srv;
test.before(async () => { srv = await startFixtureServer(); });
test.after(async () => { await closeBrowser(); await srv.close(); });

const ids = (r) => r.issues.map((i) => i.id).sort();

test('bad.html: nájde všetky zámerne vložené chyby', async () => {
  const r = await quickScan(srv.url('bad.html'));
  const found = ids(r);
  const expected = ['button-name', 'color-contrast', 'html-has-lang', 'image-alt', 'label', 'link-name',
    'wa-focus-obscured', 'wa-focus-visible', 'wa-not-focusable', 'wa-reflow'];
  const missing = expected.filter((e) => !found.includes(e));
  assert.deepEqual(missing, [], `nenájdené: ${missing.join(', ')} (nájdené: ${found.join(', ')})`);
  assert.equal(r.conformance.key, 'fail');

  // Vlastné kontroly musia ukazovať na správne prvky
  const ex = (id) => r.issues.find((i) => i.id === id).examples.map((e) => e.html).join('\n');
  assert.match(ex('wa-focus-visible'), /nofocus/);
  assert.match(ex('wa-not-focusable'), /clicky/);
  assert.match(ex('wa-focus-obscured'), /pod-listou/);
  assert.match(ex('wa-reflow'), /wide/);
});

test('trap.html: odhalí pascu pre klávesnicu, iné chyby nehlási', async () => {
  const r = await quickScan(srv.url('trap.html'));
  assert.deepEqual(ids(r), ['wa-keyboard-trap']);
  assert.match(r.issues[0].examples[0].html, /pasca/);
});

test('good.html: žiadne falošné poplachy (desktop aj mobil)', async () => {
  const r = await quickScan(srv.url('good.html'));
  assert.deepEqual(ids(r), [], `falošné nálezy: ${ids(r).join(', ')}`);
  assert.equal(r.score, 100);
  assert.ok(r.keyboard.tabStops >= 4, 'test klávesnice prešiel prvky stránky');
  const m = await scanPage(srv.url('good.html'), { mobile: true });
  assert.deepEqual(m.violations.map((v) => v.id), []);
  // kritériá overené vlastnými testami sa zarátajú ako testované
  const c = Object.fromEntries(r.criteria.map((x) => [x.id, x.status]));
  for (const sc of ['2.1.1', '2.1.2', '2.4.7', '1.4.10']) assert.equal(c[sc], 'pass', `kritérium ${sc}`);
});

test('stránka s ochranou proti botom a chyba 404 sa neauditujú', async () => {
  await assert.rejects(quickScan(srv.url('challenge.html')), (e) => e.blocked === true);
  await assert.rejects(quickScan(srv.url('neexistuje.html')), (e) => e.httpStatus === 404);
});

test('plný audit + PDF: snímky chýb a mobilné zobrazenie', async () => {
  const a = await crawlAndScan(srv.url('bad.html'), { maxPages: 2, deepPages: 1, examples: 2 });
  assert.equal(a.mobilePages.length, 1);
  assert.ok(a.issues.some((i) => i.examples.some((e) => e.shot)), 'aspoň jedna snímka chyby');
  const pdf = await renderPdf(a, { id: '00000000-0000-0000-0000-000000000000', tier: 'pro' });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(pdf.length > 50_000);
});
