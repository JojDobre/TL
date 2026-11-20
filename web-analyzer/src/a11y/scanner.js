'use strict';

const fs = require('fs');
const { withPage } = require('./browser');
const { normalizeUrl, assertPublicHost } = require('../fetcher');
const { SC, tagToSc, IMPACT, RULES, PRINCIPLES } = require('./wcag');

const AXE_SOURCE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const MAX_NODES = 12;

const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|avif|svg|zip|rar|7z|docx?|xlsx?|pptx?|mp[34]|mov|avi|xml|json|txt|csv|ics|exe|dmg)$/i;
const PRIORITY = /(kontakt|contact|o-nas|onas|about|sluzb|services|produkt|product|obchod|shop|kosik|cart|checkout|pokladn|registr|register|prihlas|login|blog|clank|faq|cennik|pricing|podmienk|terms|ochrana|privacy|gdpr|pristupn|accessib|search|hladat)/i;

/* ======================= Sken jednej stránky ======================= */

async function scanPage(url, { screenshot = false } = {}) {
  await assertPublicHost(new URL(url).hostname);
  return withPage(async (page) => {
    const t0 = Date.now();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(400);

    const finalUrl = page.url();
    await assertPublicHost(new URL(finalUrl).hostname);

    // page.evaluate obchádza CSP stránky, takže axe sa dá vložiť aj na prísne weby
    await page.evaluate(AXE_SOURCE);
    const raw = await page.evaluate(async ({ tags, maxNodes }) => {
      /* global axe */
      const r = await axe.run(document, {
        runOnly: { type: 'tag', values: tags },
        resultTypes: ['violations', 'incomplete'],
        elementRef: false,
      });
      const slim = (list) => list.map((v) => ({
        id: v.id,
        impact: v.impact,
        tags: v.tags,
        help: v.help,
        description: v.description,
        helpUrl: v.helpUrl,
        nodeCount: v.nodes.length,
        nodes: v.nodes.slice(0, maxNodes).map((n) => ({
          html: (n.html || '').slice(0, 400),
          target: (n.target || []).flat().join(' ').slice(0, 300),
          summary: (n.failureSummary || '').slice(0, 500),
        })),
      }));
      return {
        violations: slim(r.violations),
        incomplete: r.incomplete.map((v) => ({ id: v.id, impact: v.impact, tags: v.tags, help: v.help, nodeCount: v.nodes.length })),
        passes: r.passes.map((p) => p.id),
        inapplicable: r.inapplicable.length,
      };
    }, { tags: AXE_TAGS, maxNodes: MAX_NODES });

    const meta = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href]')].map((a) => a.href).slice(0, 800);
      return { title: document.title || '', lang: document.documentElement.lang || '', links };
    });

    let shot = null;
    if (screenshot) {
      shot = (await page.screenshot({ type: 'jpeg', quality: 62, clip: { x: 0, y: 0, width: 1280, height: 800 } }).catch(() => null))?.toString('base64') || null;
    }

    return {
      url: finalUrl,
      status: res ? res.status() : null,
      title: meta.title.slice(0, 200),
      lang: meta.lang,
      links: meta.links,
      screenshot: shot,
      durationMs: Date.now() - t0,
      ...raw,
      score: scoreFrom(raw.violations),
    };
  });
}

/* ======================= Skóre ======================= */

function ruleWeight(v) {
  const w = (IMPACT[v.impact] || IMPACT.moderate).weight;
  return w * (1 + 0.25 * Math.min(Math.log2(Math.max(1, v.nodeCount)), 4));
}

/** 100 = bez automaticky zistených chýb; každé porušené pravidlo znižuje skóre podľa závažnosti. */
function scoreFrom(violations) {
  const penalty = violations.reduce((s, v) => s + ruleWeight(v), 0);
  return Math.round(100 * Math.exp(-penalty / 45));
}

function conformance(violations) {
  const has = (lvl) => violations.some((v) => v.impact === lvl);
  if (has('critical') || has('serious')) {
    return { key: 'fail', label: 'Nevyhovuje', text: 'Web obsahuje kritické alebo závažné bariéry, ktoré bránia časti používateľov v jeho používaní. Pred splnením požiadaviek EAA je potrebná náprava.' };
  }
  if (violations.length) {
    return { key: 'partial', label: 'Čiastočne vyhovuje', text: 'Automatický test našiel menej závažné nedostatky. Po ich odstránení a manuálnom overení môže web požiadavky splniť.' };
  }
  return { key: 'pass', label: 'Bez zistených automatických chýb', text: 'Automatický test nenašiel žiadne porušenia. Plnú zhodu je ešte potrebné overiť manuálnym testovaním.' };
}

/* ======================= Agregácia výsledkov ======================= */

function scOf(tags) {
  return [...new Set(tags.map(tagToSc).filter((s) => s && SC[s]))];
}

function translate(v) {
  const t = RULES[v.id];
  return { title: t ? t[0] : v.help, fix: t ? t[1] : v.description, affects: t ? t[2] : '' };
}

function aggregate(pages) {
  const issues = new Map();
  for (const p of pages) {
    for (const v of p.violations) {
      let it = issues.get(v.id);
      if (!it) {
        const sc = scOf(v.tags);
        it = {
          id: v.id,
          impact: v.impact,
          ...translate(v),
          helpEn: v.help,
          helpUrl: v.helpUrl,
          sc: sc.map((s) => SC[s]),
          level: sc.some((s) => SC[s].level === 'A') ? 'A' : 'AA',
          pages: [],
          nodeCount: 0,
          examples: [],
        };
        issues.set(v.id, it);
      }
      if ((IMPACT[v.impact]?.order ?? 9) < (IMPACT[it.impact]?.order ?? 9)) it.impact = v.impact;
      it.pages.push(p.url);
      it.nodeCount += v.nodeCount;
      for (const n of v.nodes) if (it.examples.length < 6) it.examples.push({ page: p.url, ...n });
    }
  }
  const list = [...issues.values()].sort((a, b) =>
    (IMPACT[a.impact]?.order ?? 9) - (IMPACT[b.impact]?.order ?? 9) || b.pages.length - a.pages.length || b.nodeCount - a.nodeCount);

  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const nodeCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const it of list) { counts[it.impact] = (counts[it.impact] || 0) + 1; nodeCounts[it.impact] = (nodeCounts[it.impact] || 0) + it.nodeCount; }

  // Prehľad podľa princípov WCAG
  const principles = Object.fromEntries(Object.entries(PRINCIPLES).map(([k, p]) => [k, { ...p, issues: 0, nodes: 0 }]));
  for (const it of list) {
    for (const pr of new Set(it.sc.map((s) => s.principle))) { principles[pr].issues++; principles[pr].nodes += it.nodeCount; }
  }

  // Stav jednotlivých kritérií, ktoré automat dokáže testovať
  const passed = new Set(pages.flatMap((p) => p.passes));
  const failedSc = new Set(list.flatMap((it) => it.sc.map((s) => s.id)));
  const testedSc = new Set();
  const axe = require('axe-core');
  for (const r of axe.getRules(AXE_TAGS)) if (passed.has(r.ruleId) || issues.has(r.ruleId)) scOf(r.tags).forEach((s) => testedSc.add(s));
  const criteria = Object.values(SC).map((s) => ({
    ...s,
    status: failedSc.has(s.id) ? 'fail' : testedSc.has(s.id) ? 'pass' : 'manual',
  }));

  // Celkové skóre: priemer stránok vážený s globálnym pohľadom
  const avgPage = pages.length ? pages.reduce((s, p) => s + p.score, 0) / pages.length : 100;
  const global = scoreFrom(list.map((it) => ({ impact: it.impact, nodeCount: it.nodeCount / Math.max(1, pages.length) })));
  const score = Math.round(avgPage * 0.6 + global * 0.4);

  const incomplete = new Map();
  for (const p of pages) for (const v of p.incomplete) {
    const e = incomplete.get(v.id) || { id: v.id, title: translate(v).title, sc: scOf(v.tags), nodeCount: 0 };
    e.nodeCount += v.nodeCount;
    incomplete.set(v.id, e);
  }

  return {
    score,
    conformance: conformance(list),
    counts,
    nodeCounts,
    totalNodes: Object.values(nodeCounts).reduce((a, b) => a + b, 0),
    issues: list,
    principles,
    criteria,
    incomplete: [...incomplete.values()].sort((a, b) => b.nodeCount - a.nodeCount).slice(0, 15),
    pages: pages.map((p) => ({
      url: p.url, title: p.title, status: p.status, score: p.score,
      violations: p.violations.length, nodes: p.violations.reduce((s, v) => s + v.nodeCount, 0),
      error: p.error || null,
    })),
  };
}

/* ======================= Crawler ======================= */

function canonical(u) {
  try {
    const x = new URL(u);
    x.hash = '';
    x.search = '';
    x.pathname = x.pathname.replace(/\/index\.(html?|php)$/i, '/').replace(/(.)\/$/, '$1');
    return x.href;
  } catch { return null; }
}

function candidateLinks(links, origin) {
  const out = [];
  for (const l of links) {
    let u;
    try { u = new URL(l); } catch { continue; }
    if (u.origin !== origin || SKIP_EXT.test(u.pathname)) continue;
    if (/\/(wp-admin|wp-login|logout|odhlas|cdn-cgi)\b/i.test(u.pathname)) continue;
    out.push(canonical(u.href));
  }
  return [...new Set(out.filter(Boolean))]
    .sort((a, b) => {
      const pa = PRIORITY.test(a) ? 0 : 1, pb = PRIORITY.test(b) ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const da = new URL(a).pathname.split('/').length, db = new URL(b).pathname.split('/').length;
      return da - db || a.length - b.length;
    });
}

/**
 * Prejde až `maxPages` podstránok (BFS od úvodnej stránky) a vráti agregovaný audit.
 * onProgress({ done, total, url })
 */
async function crawlAndScan(input, maxPages, onProgress = () => {}) {
  const start = normalizeUrl(input);
  const first = await scanPage(start.href, { screenshot: true });
  const origin = new URL(first.url).origin;
  const pages = [first];
  const seen = new Set([canonical(start.href), canonical(first.url)]);
  const queue = candidateLinks(first.links, origin).filter((u) => !seen.has(u));
  queue.forEach((u) => seen.add(u));
  onProgress({ done: 1, total: Math.min(maxPages, 1 + queue.length), url: first.url });

  const worker = async () => {
    while (pages.length < maxPages && queue.length) {
      const next = queue.shift();
      try {
        const r = await scanPage(next);
        if (pages.length >= maxPages) break;
        if (new URL(r.url).origin !== origin) continue;
        pages.push(r);
        for (const l of candidateLinks(r.links, origin)) if (!seen.has(l)) { seen.add(l); queue.push(l); }
      } catch (e) {
        if (pages.length < maxPages) pages.push({ url: next, title: '', status: null, score: 0, violations: [], incomplete: [], passes: [], error: shortErr(e), failed: true });
      }
      onProgress({ done: pages.length, total: Math.min(maxPages, pages.length + queue.length), url: next });
    }
  };
  await Promise.all([worker(), worker()]);

  const ok = pages.filter((p) => !p.failed);
  const result = aggregate(ok);
  result.pages = pages.map((p) => ({
    url: p.url, title: p.title, status: p.status, score: p.failed ? null : p.score,
    violations: p.violations.length, nodes: p.violations.reduce((s, v) => s + v.nodeCount, 0), error: p.error || null,
  }));
  return {
    url: first.url,
    host: new URL(first.url).host,
    title: first.title,
    lang: first.lang,
    screenshot: first.screenshot,
    scannedAt: new Date().toISOString(),
    axeVersion: require('axe-core').version,
    ...result,
  };
}

/** Rýchly bezplatný náhľad – len úvodná stránka. */
async function quickScan(input) {
  const start = normalizeUrl(input);
  const p = await scanPage(start.href, { screenshot: false });
  const agg = aggregate([p]);
  const origin = new URL(p.url).origin;
  return {
    url: p.url,
    host: new URL(p.url).host,
    title: p.title,
    scannedAt: new Date().toISOString(),
    discoveredPages: candidateLinks(p.links, origin).length + 1,
    ...agg,
  };
}

function shortErr(e) {
  const m = String(e?.message || e);
  if (/Timeout/i.test(m)) return 'Stránka sa nenačítala včas';
  if (/ERR_NAME_NOT_RESOLVED|DNS/i.test(m)) return 'Doména neexistuje';
  if (/ERR_CONNECTION|ECONN/i.test(m)) return 'Server odmietol spojenie';
  if (/Lokálne|interné/i.test(m)) return m;
  return 'Stránku sa nepodarilo načítať';
}

module.exports = { scanPage, crawlAndScan, quickScan, shortErr };
