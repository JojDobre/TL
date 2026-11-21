'use strict';

const fs = require('fs');
const { withPage } = require('./browser');
const { normalizeUrl, assertPublicHost } = require('../fetcher');
const { SC, tagToSc, IMPACT, ruleText, scIn, principlesIn } = require('./wcag');
const { UserError } = require('../fetcher');
const { CUSTOM_RULES, dismissConsent, keyboardChecks, reflowCheck, elementShot } = require('./checks');

const AXE_SOURCE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const AXE_VERSION = require('axe-core').version;
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const MAX_NODES = 12;

const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|avif|svg|zip|rar|7z|docx?|xlsx?|pptx?|mp[34]|mov|avi|xml|json|txt|csv|ics|exe|dmg)$/i;
const PRIORITY = /(kontakt|contact|o-nas|onas|about|sluzb|services|produkt|product|obchod|shop|kosik|cart|checkout|pokladn|registr|register|prihlas|login|blog|clank|faq|cennik|pricing|podmienk|terms|ochrana|privacy|gdpr|pristupn|accessib|search|hladat)/i;

/* ======================= axe-core ======================= */

async function runAxe(page) {
  // page.evaluate obchádza CSP stránky, takže axe sa dá vložiť aj na prísne weby
  if (!(await page.evaluate(() => typeof window.axe !== 'undefined').catch(() => false))) await page.evaluate(AXE_SOURCE);
  return page.evaluate(async ({ tags, maxNodes }) => {
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
        sel: n.target && n.target.length === 1 && typeof n.target[0] === 'string' ? n.target[0] : null,
        summary: (n.failureSummary || '').slice(0, 500),
      })),
    }));
    return {
      violations: slim(r.violations),
      incomplete: r.incomplete.map((v) => ({ id: v.id, impact: v.impact, tags: v.tags, help: v.help, nodeCount: v.nodes.length })),
      passes: r.passes.map((p) => p.id),
    };
  }, { tags: AXE_TAGS, maxNodes: MAX_NODES });
}

/** Pridá do `base` porušenia z `extra`, ktoré tam ešte nie sú (podľa pravidla a selektora). */
function mergeViolations(base, extra, note) {
  for (const v of extra) {
    const ex = base.find((b) => b.id === v.id);
    const known = new Set((ex ? ex.nodes : []).map((n) => n.target));
    const fresh = v.nodes.filter((n) => !known.has(n.target)).map((n) => ({ ...n, context: note, summary: note ? `[${note}] ${n.summary}` : n.summary }));
    if (!fresh.length) continue;
    if (ex) { ex.nodes.push(...fresh); ex.nodeCount += fresh.length; } else base.push({ ...v, nodes: fresh, nodeCount: fresh.length });
  }
}

/* ======================= Sken jednej stránky ======================= */

/**
 * opts.mobile     – mobilné zobrazenie (390 × 844, dotyk)
 * opts.keyboard   – test ovládania klávesnicou
 * opts.reflow     – test zobrazenia pri šírke 320 px
 * opts.bannerScan – otestovať aj stav so zobrazenou cookie lištou
 * opts.cover      – snímka stránky na titulku správy
 * opts.shots      – rozpočet snímok chybných prvkov { perRule: Map, max, left }
 */
async function scanPage(url, opts = {}) {
  await assertPublicHost(new URL(url).hostname);
  return withPage(async (page) => {
    const t0 = Date.now();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(500);
    const finalUrl = page.url();
    await assertPublicHost(new URL(finalUrl).hostname);
    // Ochrana proti botom (Cloudflare a pod.) – niekedy sa po pár sekundách sama vyrieši
    if (await looksLikeBotWall(page)) {
      await page.waitForTimeout(6000);
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      if (await looksLikeBotWall(page)) {
        const e = new Error('bot wall');
        e.blocked = true;
        throw e;
      }
    } else if (res && res.status() >= 400) {
      const e = new Error(`HTTP ${res.status()}`);
      e.httpStatus = res.status();
      throw e;
    }
    const ctype = (res && res.headers()['content-type']) || '';
    if (ctype && !/html/i.test(ctype)) {
      const e = new Error(`Nejde o HTML stránku (${ctype.split(';')[0]})`);
      e.notHtml = true;
      throw e;
    }

    // 1) Stav s cookie lištou (aj tá musí byť prístupná), potom ju zavrieme
    const bannerRaw = opts.bannerScan ? await runAxe(page) : null;
    const consent = await dismissConsent(page).catch(() => ({ dismissed: false }));
    if (consent.dismissed) await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

    // 2) Hlavný sken
    const raw = consent.dismissed || !bannerRaw ? await runAxe(page) : bannerRaw;
    if (bannerRaw && consent.dismissed) mergeViolations(raw.violations, bannerRaw.violations, opts.lang === 'en' ? 'cookie banner' : 'cookie lišta');

    // 3) Titulná snímka (už bez lišty)
    let cover = null;
    if (opts.cover) {
      await page.evaluate(() => window.scrollTo(0, 0));
      cover = (await page.screenshot({ type: 'jpeg', quality: 62, clip: { x: 0, y: 0, width: 1280, height: 800 } }).catch(() => null))?.toString('base64') || null;
    }

    // 4) Vlastné kontroly
    let keyboard = null;
    if (opts.keyboard) {
      keyboard = await keyboardChecks(page, { lang: opts.lang }).catch((e) => { console.warn('[keyboard]', e.message); return null; });
      if (keyboard) { raw.violations.push(...keyboard.violations); raw.passes.push(...keyboard.passes); }
    }
    if (opts.reflow) {
      const rf = await reflowCheck(page, opts.lang).catch(() => null);
      if (rf) { raw.violations.push(...rf.violations); raw.passes.push(...rf.passes); }
    }

    // 5) Snímky chybných prvkov (len desktop, podľa rozpočtu)
    if (opts.shots && !opts.mobile) {
      for (const v of raw.violations) {
        for (const n of v.nodes) {
          const used = opts.shots.perRule.get(v.id) || 0;
          if (opts.shots.left <= 0 || used >= opts.shots.max) break;
          const sel = n.sel || (v.id.startsWith('wa-') ? n.target : null);
          if (!sel) continue;
          opts.shots.perRule.set(v.id, used + 1); opts.shots.left--; // rezervácia pred čakaním
          const shot = await elementShot(page, sel);
          if (shot) n.shot = shot;
          else { opts.shots.perRule.set(v.id, (opts.shots.perRule.get(v.id) || 1) - 1); opts.shots.left++; }
        }
      }
    }

    const meta = await page.evaluate(() => ({
      title: document.title || '',
      lang: document.documentElement.lang || '',
      links: [...document.querySelectorAll('a[href]')].map((a) => a.href).slice(0, 800),
    }));

    for (const v of raw.violations) for (const n of v.nodes) delete n.sel;

    return {
      url: finalUrl,
      viewport: opts.mobile ? 'mobile' : 'desktop',
      status: res ? res.status() : null,
      title: meta.title.slice(0, 200),
      lang: meta.lang,
      links: meta.links,
      cover,
      consent,
      keyboardStats: keyboard ? keyboard.stats : null,
      durationMs: Date.now() - t0,
      ...raw,
      score: scoreFrom(raw.violations),
    };
  }, { mobile: !!opts.mobile });
}

const BOT_TITLE = /just a moment|len chvíľu|chvíľku strpenia|attention required|access denied|checking your browser|verify you are (a )?human|ddos protection|are you a robot|security check|captcha/i;

async function looksLikeBotWall(page) {
  return page.evaluate((src) => {
    const re = new RegExp(src, 'i');
    if (re.test(document.title)) return true;
    const html = document.documentElement.innerHTML.slice(0, 50000);
    return /challenges\.cloudflare\.com|cf-chl-|_cf_chl_opt|id="challenge-form"|g-recaptcha.*data-sitekey|hcaptcha\.com\/1\/api/.test(html)
      && document.body.innerText.trim().length < 2000;
  }, BOT_TITLE.source).catch(() => false);
}

/* ======================= Skóre ======================= */

function ruleWeight(v) {
  const w = (IMPACT[v.impact] || IMPACT.moderate).weight;
  return w * (1 + 0.25 * Math.min(Math.log2(Math.max(1, v.nodeCount)), 4));
}

/** 100 = bez automaticky zistených chýb; každé porušené pravidlo znižuje skóre podľa závažnosti a počtu výskytov. */
function scoreFrom(violations) {
  const penalty = violations.reduce((s, v) => s + ruleWeight(v), 0);
  return Math.round(100 * Math.exp(-penalty / 45));
}

function conformance(violations, lang = 'sk') {
  const L = (sk, en) => (lang === 'en' ? en : sk);
  const has = (lvl) => violations.some((v) => v.impact === lvl);
  if (has('critical') || has('serious')) {
    return { key: 'fail', label: L('Nevyhovuje', 'Does not conform'), text: L('Web obsahuje kritické alebo závažné bariéry, ktoré bránia časti používateľov v jeho používaní. Pred splnením požiadaviek EAA je potrebná náprava.', 'The website contains critical or serious barriers that prevent some users from using it. Remediation is needed before it meets EAA requirements.') };
  }
  if (violations.length) {
    return { key: 'partial', label: L('Čiastočne vyhovuje', 'Partially conforms'), text: L('Automatický test našiel menej závažné nedostatky. Po ich odstránení a manuálnom overení môže web požiadavky splniť.', 'The automated test found minor issues. Once they are fixed and manually verified, the website may meet the requirements.') };
  }
  return { key: 'pass', label: L('Bez zistených automatických chýb', 'No automated issues found'), text: L('Automatický test nenašiel žiadne porušenia. Plnú zhodu je ešte potrebné overiť manuálnym testovaním.', 'The automated test found no violations. Full conformance still needs to be verified by manual testing.') };
}

/* ======================= Agregácia výsledkov ======================= */

const scOf = (tags) => [...new Set(tags.map(tagToSc).filter((s) => s && SC[s]))];

function translate(v, lang) {
  const t = ruleText(v.id, lang);
  return { title: t ? t[0] : v.help, fix: t ? t[1] : v.description, affects: t ? t[2] : '' };
}

const ALL_RULES = [...require('axe-core').getRules(AXE_TAGS).map((r) => ({ ruleId: r.ruleId, tags: r.tags })), ...CUSTOM_RULES];

function aggregate(pages, lang = 'sk') {
  const issues = new Map();
  for (const p of pages) {
    for (const v of p.violations) {
      let it = issues.get(v.id);
      if (!it) {
        const sc = scOf(v.tags);
        it = {
          id: v.id,
          impact: v.impact,
          ...translate(v, lang),
          helpEn: v.help,
          helpUrl: v.helpUrl,
          custom: v.id.startsWith('wa-'),
          sc: sc.map((s) => scIn(s, lang)),
          level: sc.some((s) => SC[s].level === 'A') ? 'A' : 'AA',
          pages: [],
          viewports: [],
          nodeCount: 0,
          examples: [],
          _seen: new Set(),
        };
        issues.set(v.id, it);
      }
      if ((IMPACT[v.impact]?.order ?? 9) < (IMPACT[it.impact]?.order ?? 9)) it.impact = v.impact;
      if (!it.pages.includes(p.url)) it.pages.push(p.url);
      if (!it.viewports.includes(p.viewport)) it.viewports.push(p.viewport);
      // rovnaký prvok na rovnakej stránke v desktop aj mobil počítame raz
      const fresh = v.nodes.filter((n) => { const k = p.url + '|' + n.target; if (it._seen.has(k)) return false; it._seen.add(k); return true; });
      it.nodeCount += p.viewport === 'mobile' ? fresh.length : v.nodeCount;
      for (const n of fresh) it.examples.push({ page: p.url, viewport: p.viewport, ...n });
    }
  }
  const list = [...issues.values()].map((it) => {
    delete it._seen;
    it.examples = [...it.examples.filter((e) => e.shot), ...it.examples.filter((e) => !e.shot)].slice(0, 8);
    return it;
  }).sort((a, b) =>
    (IMPACT[a.impact]?.order ?? 9) - (IMPACT[b.impact]?.order ?? 9) || b.pages.length - a.pages.length || b.nodeCount - a.nodeCount);

  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  const nodeCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const it of list) { counts[it.impact]++; nodeCounts[it.impact] += it.nodeCount; }

  const principles = Object.fromEntries(Object.entries(principlesIn(lang)).map(([k, p]) => [k, { ...p, issues: 0, nodes: 0 }]));
  for (const it of list) for (const pr of new Set(it.sc.map((s) => s.principle))) { principles[pr].issues++; principles[pr].nodes += it.nodeCount; }

  // Stav kritérií: fail = zistené porušenie, pass = testovateľné pravidlá prebehli bez chyby, manual = automat neoverí
  const passed = new Set(pages.flatMap((p) => p.passes));
  const failedSc = new Set(list.flatMap((it) => it.sc.map((s) => s.id)));
  const testedSc = new Set();
  for (const r of ALL_RULES) if (passed.has(r.ruleId) || issues.has(r.ruleId)) scOf(r.tags).forEach((s) => testedSc.add(s));
  const criteria = Object.keys(SC).map((id) => scIn(id, lang)).map((s) => ({ ...s, status: failedSc.has(s.id) ? 'fail' : testedSc.has(s.id) ? 'pass' : 'manual' }));

  const desktop = pages.filter((p) => p.viewport !== 'mobile');
  const avgPage = desktop.length ? desktop.reduce((s, p) => s + p.score, 0) / desktop.length : 100;
  const global = scoreFrom(list.map((it) => ({ impact: it.impact, nodeCount: it.nodeCount / Math.max(1, desktop.length) })));
  const score = Math.round(avgPage * 0.6 + global * 0.4);

  const incomplete = new Map();
  for (const p of pages) for (const v of p.incomplete) {
    const e = incomplete.get(v.id) || { id: v.id, title: translate(v, lang).title, sc: scOf(v.tags), nodeCount: 0 };
    e.nodeCount += v.nodeCount;
    incomplete.set(v.id, e);
  }

  const pageRow = (p) => ({
    url: p.url, title: p.title, status: p.status, score: p.failed ? null : p.score, viewport: p.viewport,
    violations: p.violations.length, nodes: p.violations.reduce((s, v) => s + v.nodeCount, 0), error: p.error || null,
    keyboard: p.keyboardStats || null,
  });

  return {
    score,
    conformance: conformance(list, lang),
    counts,
    nodeCounts,
    totalNodes: Object.values(nodeCounts).reduce((a, b) => a + b, 0),
    issues: list,
    principles,
    criteria,
    incomplete: [...incomplete.values()].sort((a, b) => b.nodeCount - a.nodeCount).slice(0, 15),
    pages: desktop.map(pageRow),
    mobilePages: pages.filter((p) => p.viewport === 'mobile').map(pageRow),
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
  return [...new Set(out.filter(Boolean))].sort((a, b) => {
    const pa = PRIORITY.test(a) ? 0 : 1, pb = PRIORITY.test(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const da = new URL(a).pathname.split('/').length, db = new URL(b).pathname.split('/').length;
    return da - db || a.length - b.length;
  });
}

/**
 * Plný audit: až `maxPages` podstránok (desktop), na prvých `deepPages` aj test
 * klávesnice, reflow a mobilné zobrazenie.
 */
async function crawlAndScan(input, { maxPages = 5, deepPages = 1, examples = 4, lang = 'sk' } = {}, onProgress = () => {}) {
  const start = normalizeUrl(input);
  const shots = { perRule: new Map(), max: Math.min(examples, 4), left: 45 };
  const totalSteps = () => Math.min(maxPages, pages.length + queue.length) + deepUrls.length;
  const pages = [];
  const deepUrls = [];
  let queue = [];

  const first = await scanPage(start.href, { cover: true, bannerScan: true, keyboard: true, reflow: true, shots, lang });
  const origin = new URL(first.url).origin;
  pages.push(first);
  deepUrls.push(first.url);
  const seen = new Set([canonical(start.href), canonical(first.url)]);
  queue = candidateLinks(first.links, origin).filter((u) => !seen.has(u));
  queue.forEach((u) => seen.add(u));
  onProgress({ done: 1, total: totalSteps(), url: first.url, phase: 'scan' });

  let started = 1;
  const worker = async () => {
    while (pages.length < maxPages && queue.length) {
      const next = queue.shift();
      const deep = started < deepPages;
      started++;
      try {
        const r = await scanPage(next, { keyboard: deep, reflow: deep, shots, lang });
        if (pages.length >= maxPages) break;
        if (new URL(r.url).origin !== origin) continue;
        pages.push(r);
        if (deep) deepUrls.push(r.url);
        for (const l of candidateLinks(r.links, origin)) if (!seen.has(l)) { seen.add(l); queue.push(l); }
      } catch (e) {
        if (e.notHtml) continue; // RSS, XML, PDF… preskočíme bez započítania
        if (pages.length < maxPages) pages.push({ url: next, viewport: 'desktop', title: '', status: null, score: 0, violations: [], incomplete: [], passes: [], error: shortErr(e, lang), failed: true });
      }
      onProgress({ done: pages.length, total: totalSteps(), url: next, phase: 'scan' });
    }
  };
  await Promise.all([worker(), worker()]);

  // Mobilné zobrazenie kľúčových stránok
  let done = pages.length;
  for (const u of deepUrls) {
    try {
      pages.push(await scanPage(u, { mobile: true, lang }));
    } catch (e) {
      console.warn('[mobile]', u, e.message);
    }
    onProgress({ done: ++done, total: pages.filter((p) => p.viewport !== 'mobile').length + deepUrls.length, url: u + ' (mobil)', phase: 'scan' });
  }

  const ok = pages.filter((p) => !p.failed);
  const result = aggregate(ok, lang);
  const failed = pages.filter((p) => p.failed).map((p) => ({ url: p.url, title: '', status: null, score: null, viewport: 'desktop', violations: 0, nodes: 0, error: p.error }));
  result.pages.push(...failed);
  return {
    url: first.url,
    host: new URL(first.url).host,
    title: first.title,
    lang: first.lang,
    screenshot: first.cover,
    consent: first.consent,
    keyboard: first.keyboardStats,
    scannedAt: new Date().toISOString(),
    lang,
    axeVersion: AXE_VERSION,
    ...result,
  };
}

/** Rýchly bezplatný náhľad – úvodná stránka vrátane testu klávesnice a reflow. */
async function quickScan(input, lang = 'sk') {
  const start = normalizeUrl(input);
  const p = await scanPage(start.href, { bannerScan: true, keyboard: true, reflow: true, lang });
  const agg = aggregate([p], lang);
  return {
    url: p.url,
    host: new URL(p.url).host,
    title: p.title,
    consent: p.consent,
    keyboard: p.keyboardStats,
    scannedAt: new Date().toISOString(),
    discoveredPages: candidateLinks(p.links, new URL(p.url).origin).length + 1,
    ...agg,
  };
}

/* ======================= Porovnanie dvoch auditov ======================= */

function compareAudits(prev, cur) {
  const before = new Map(prev.issues.map((i) => [i.id, i]));
  const after = new Map(cur.issues.map((i) => [i.id, i]));
  const pick = (i) => ({ id: i.id, title: i.title, impact: i.impact, nodeCount: i.nodeCount });
  return {
    previousDate: prev.scannedAt,
    previousScore: prev.score,
    scoreDelta: cur.score - prev.score,
    newIssues: cur.issues.filter((i) => !before.has(i.id)).map(pick),
    fixedIssues: prev.issues.filter((i) => !after.has(i.id)).map(pick),
    changed: cur.issues.filter((i) => before.has(i.id) && before.get(i.id).nodeCount !== i.nodeCount)
      .map((i) => ({ ...pick(i), before: before.get(i.id).nodeCount, after: i.nodeCount })),
  };
}

function shortErr(e, lang = 'sk') {
  const L = (sk, en) => (lang === 'en' ? en : sk);
  if (e instanceof UserError) return e.text(lang);
  if (e?.blocked) return L('Web blokuje automatické testovanie (ochrana proti botom, napr. Cloudflare). Audit nie je možné vykonať – výsledok by nezodpovedal skutočnému webu', 'The website blocks automated testing (bot protection, e.g. Cloudflare). The audit cannot be performed – the result would not reflect the real website');
  if (e?.httpStatus) return L(`Stránka vrátila chybu HTTP ${e.httpStatus}`, `The page returned HTTP error ${e.httpStatus}`);
  const m = String(e?.message || e);
  if (/Timeout/i.test(m)) return L('Stránka sa nenačítala včas', 'The page did not load in time');
  if (/ERR_NAME_NOT_RESOLVED|DNS/i.test(m)) return L('Doména neexistuje', 'The domain does not exist');
  if (/ERR_CONNECTION|ECONN/i.test(m)) return L('Server odmietol spojenie', 'The server refused the connection');
  return L('Stránku sa nepodarilo načítať', 'The page could not be loaded');
}

module.exports = { scanPage, crawlAndScan, quickScan, compareAudits, aggregate, scoreFrom, conformance, candidateLinks, shortErr, AXE_VERSION };
