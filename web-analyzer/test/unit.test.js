'use strict';

process.env.STRIPE_WEBHOOK_SECRET = 'whsec_unit_test';
process.env.DATA_DIR = require('path').join(require('os').tmpdir(), 'wa-unit-' + process.pid);

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const { Doc } = require('../src/html');
const { detectTech } = require('../src/tech');
const { normalizeUrl } = require('../src/fetcher');
const { tagToSc, SC, RULES } = require('../src/a11y/wcag');
const { scoreFrom, conformance, compareAudits, candidateLinks } = require('../src/a11y/scanner');
const { verifyWebhook } = require('../src/a11y/stripe');
const { CUSTOM_RULES } = require('../src/a11y/checks');

test('HTML parser číta meta, odkazy a text', () => {
  const d = new Doc('<html lang="sk"><head><title>T &amp; T</title><meta name="description" content="Popis"><link rel="canonical icon" href="/c"></head><body><script>var x="<p>skryté</p>"</script><p>Ahoj  svet</p></body></html>');
  assert.equal(d.meta('description'), 'Popis');
  assert.equal(d.htmlAttrs().lang, 'sk');
  assert.equal(d.links('canonical')[0].attrs.href, '/c');
  assert.equal(d.links('icon').length, 1);
  assert.equal(d.text(), 'Ahoj svet');
});

test('detekcia technológií nájde WordPress a Cloudflare', () => {
  const h = new Headers({ server: 'cloudflare', 'cf-ray': '1' });
  const names = detectTech({ html: '<link href="/wp-content/themes/x.css">', h, main: { setCookies: [] } }).map((t) => t.name);
  assert.ok(names.includes('WordPress'));
  assert.ok(names.includes('Cloudflare'));
});

test('normalizeUrl doplní https a odmietne nebezpečné vstupy', () => {
  assert.equal(normalizeUrl('example.com').href, 'https://example.com/');
  assert.throws(() => normalizeUrl('ftp://example.com'));
  assert.throws(() => normalizeUrl('javascript:alert(1)'));
  assert.throws(() => normalizeUrl('https://user:pass@example.com'));
  assert.throws(() => normalizeUrl(''));
});

test('SSRF ochrana blokuje interné adresy (bez testovacieho prepínača)', () => {
  const script = `
    const { assertPublicHost } = require('./src/fetcher');
    (async () => {
      const out = [];
      for (const h of ['127.0.0.1', '10.0.0.5', '169.254.169.254', '192.168.1.1', '::1', 'localhost', '100.64.0.1']) {
        out.push(await assertPublicHost(h).then(() => 'ALLOWED ' + h, () => 'blocked'));
      }
      console.log(JSON.stringify(out));
    })();`;
  const env = { ...process.env };
  delete env.WA_ALLOW_PRIVATE_HOSTS;
  const res = JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd: require('path').join(__dirname, '..'), env, encoding: 'utf8' }).trim().split('\n').pop());
  assert.deepEqual(res, Array(7).fill('blocked'));
});

test('tagToSc prevádza tagy axe na kritériá WCAG', () => {
  assert.equal(tagToSc('wcag143'), '1.4.3');
  assert.equal(tagToSc('wcag1412'), '1.4.12');
  assert.equal(tagToSc('wcag2a'), null);
});

test('každé vlastné pravidlo má preklad a platné kritérium WCAG', () => {
  for (const r of CUSTOM_RULES) {
    assert.ok(RULES[r.ruleId], `chýba preklad ${r.ruleId}`);
    const sc = r.tags.map(tagToSc).filter(Boolean);
    assert.ok(sc.length && sc.every((s) => SC[s]), `neplatné kritérium pri ${r.ruleId}`);
  }
});

test('skóre klesá so závažnosťou a počtom chýb', () => {
  assert.equal(scoreFrom([]), 100);
  const minor = scoreFrom([{ impact: 'minor', nodeCount: 1 }]);
  const critical = scoreFrom([{ impact: 'critical', nodeCount: 1 }]);
  const criticalMany = scoreFrom([{ impact: 'critical', nodeCount: 50 }]);
  assert.ok(minor > critical && critical > criticalMany);
  assert.equal(conformance([]).key, 'pass');
  assert.equal(conformance([{ impact: 'moderate' }]).key, 'partial');
  assert.equal(conformance([{ impact: 'serious' }]).key, 'fail');
});

test('porovnanie auditov nájde nové, opravené a zmenené problémy', () => {
  const prev = { score: 50, scannedAt: '2026-01-01', issues: [{ id: 'a', title: 'A', impact: 'serious', nodeCount: 3 }, { id: 'b', title: 'B', impact: 'minor', nodeCount: 1 }] };
  const cur = { score: 60, issues: [{ id: 'a', title: 'A', impact: 'serious', nodeCount: 1 }, { id: 'c', title: 'C', impact: 'critical', nodeCount: 2 }] };
  const c = compareAudits(prev, cur);
  assert.equal(c.scoreDelta, 10);
  assert.deepEqual(c.newIssues.map((i) => i.id), ['c']);
  assert.deepEqual(c.fixedIssues.map((i) => i.id), ['b']);
  assert.deepEqual(c.changed.map((i) => [i.id, i.before, i.after]), [['a', 3, 1]]);
});

test('crawler berie len stránky z rovnakého webu a uprednostní dôležité', () => {
  const links = ['https://ex.sk/blog/clanok-1', 'https://ex.sk/kontakt', 'https://iny.sk/x', 'https://ex.sk/subor.pdf', 'https://ex.sk/kontakt#mapa', 'https://ex.sk/wp-admin/'];
  assert.deepEqual(candidateLinks(links, 'https://ex.sk'), ['https://ex.sk/kontakt', 'https://ex.sk/blog/clanok-1']);
});

test('Stripe webhook: platný podpis prejde, neplatný a starý nie', () => {
  const body = JSON.stringify({ type: 'test' });
  const sign = (t, secret = 'whsec_unit_test') => `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
  const now = Math.floor(Date.now() / 1000);
  assert.equal(verifyWebhook(body, sign(now)).type, 'test');
  assert.throws(() => verifyWebhook(body, sign(now, 'whsec_zly')));
  assert.throws(() => verifyWebhook(body, sign(now - 3600)));
  assert.throws(() => verifyWebhook(body + ' ', sign(now)));
  assert.throws(() => verifyWebhook(body, ''));
});
