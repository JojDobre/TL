'use strict';

/*
 * Vlastné kontroly nad rámec axe-core. Každá vracia výsledky v rovnakom tvare
 * ako axe ({ id, impact, tags, nodes, nodeCount }), aby sa dali spolu agregovať.
 *
 * Zásada: radšej problém prehliadnuť, než nahlásiť falošný. Kde si nie sme istí,
 * výsledok ide do zoznamu „na manuálne overenie“, nie medzi chyby.
 */

/** Pravidlá, ktoré pridávame k axe-core (pre tabuľku kritérií). */
const CUSTOM_RULES = [
  { ruleId: 'wa-focus-visible', tags: ['wcag2aa', 'wcag247'], impact: 'serious' },
  { ruleId: 'wa-keyboard-trap', tags: ['wcag2a', 'wcag212'], impact: 'critical' },
  { ruleId: 'wa-not-focusable', tags: ['wcag2a', 'wcag211'], impact: 'serious' },
  { ruleId: 'wa-focus-obscured', tags: ['wcag22aa', 'wcag2411'], impact: 'serious' },
  { ruleId: 'wa-reflow', tags: ['wcag21aa', 'wcag1410'], impact: 'serious' },
];
const RULE = Object.fromEntries(CUSTOM_RULES.map((r) => [r.ruleId, r]));

function violation(id, nodes, extra = {}) {
  const r = RULE[id];
  return { id, impact: r.impact, tags: r.tags, help: id, description: '', helpUrl: '', nodeCount: nodes.length, nodes: nodes.slice(0, 12), ...extra };
}

/* ======================= Cookie lišta ======================= */

const CONSENT_SELECTORS = [
  '#onetrust-accept-btn-handler',
  '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
  '#CybotCookiebotDialogBodyButtonAccept',
  '#didomi-notice-agree-button',
  '.cky-btn-accept',
  '.cc-nb-okagree',
  '.cmplz-accept',
  '#cookie_action_close_header',
  '.qc-cmp2-summary-buttons button[mode="primary"]',
  '[data-cookiefirst-action="accept"]',
  '.fc-cta-consent',
  '#axeptio_btn_acceptAll',
  '.iubenda-cs-accept-btn',
  '#cookiescript_accept',
];

const ACCEPT_TEXT = /^\s*(prijať\s*(všetk[oye])?|prijat\s*(vsetk[oye])?|súhlasím|suhlasim|súhlasím so všetkým|akceptovať\s*(všetk[oye])?|akceptujem|povoliť\s*(všetk[oye])?|rozumiem|ok|accept(\s+all)?(\s+cookies)?|allow\s+all|agree|i\s+agree|got\s+it|souhlasím|přijmout\s+vše|alle\s+akzeptieren|zustimmen)\s*[!.]?\s*$/i;

/**
 * Pokúsi sa zavrieť cookie lištu kliknutím na „Prijať“. Vráti { dismissed, label }.
 * Prechádza aj iframy (niektoré CMP bežia v rámci).
 */
async function dismissConsent(page) {
  for (const frame of page.frames()) {
    for (const sel of CONSENT_SELECTORS) {
      const loc = frame.locator(sel).first();
      if (await loc.isVisible().catch(() => false)) {
        const label = (await loc.innerText().catch(() => '')).trim().slice(0, 40);
        if (await loc.click({ timeout: 2500 }).then(() => true, () => false)) {
          await page.waitForTimeout(700);
          return { dismissed: true, label: label || sel };
        }
      }
    }
  }
  // Všeobecné hľadanie tlačidla v kontajneri, ktorý vyzerá ako cookie lišta
  for (const frame of page.frames()) {
    const found = await frame.evaluate((src) => {
      const re = new RegExp(src, 'i');
      const ctxRe = /cookie|consent|gdpr|súhlas|suhlas|privacy|souhlas/i;
      const cands = [...document.querySelectorAll('button, a[role="button"], [role="button"], input[type="button"], input[type="submit"], a')];
      for (const el of cands) {
        const text = (el.innerText || el.value || '').trim();
        if (!text || text.length > 40 || !re.test(text)) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        let p = el, ok = false;
        for (let i = 0; p && i < 8; i++, p = p.parentElement) {
          if (ctxRe.test((p.id || '') + ' ' + (typeof p.className === 'string' ? p.className : '') + ' ' + (p.getAttribute('aria-label') || ''))) { ok = true; break; }
        }
        if (!ok && !ctxRe.test(document.body.innerText.slice(0, 20000))) continue;
        if (!ok) continue;
        el.setAttribute('data-wa-consent', '1');
        return text;
      }
      return null;
    }, ACCEPT_TEXT.source).catch(() => null);
    if (found) {
      const ok = await frame.locator('[data-wa-consent="1"]').first().click({ timeout: 2500 }).then(() => true, () => false);
      if (ok) { await page.waitForTimeout(700); return { dismissed: true, label: found }; }
    }
  }
  return { dismissed: false, label: null };
}

/* ======================= Pomocné funkcie v stránke ======================= */

// Vloží sa do stránky ako window.__wa (cssPath, popis aktívneho prvku)
const PAGE_HELPERS = `
window.__wa = window.__wa || {
  path(e) {
    const parts = [];
    while (e && e.nodeType === 1 && parts.length < 10) {
      let s = e.tagName.toLowerCase();
      if (e.id && /^[A-Za-z][\\w-]*$/.test(e.id) && document.querySelectorAll('#' + e.id).length === 1) { parts.unshift('#' + e.id); break; }
      const p = e.parentElement;
      if (p) { const sib = [...p.children].filter((c) => c.tagName === e.tagName); if (sib.length > 1) s += ':nth-of-type(' + (sib.indexOf(e) + 1) + ')'; }
      parts.unshift(s);
      e = p;
    }
    return parts.join(' > ');
  },
  active() {
    const el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    const r = el.getBoundingClientRect();
    let obscuredBy = null;
    if (r.width >= 6 && r.height >= 6 && el.tagName !== 'IFRAME') {
      const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 3, r.top + 3], [r.right - 3, r.top + 3], [r.left + 3, r.bottom - 3], [r.right - 3, r.bottom - 3]];
      let covered = 0, by = null, inView = 0;
      for (const [x, y] of pts) {
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        inView++;
        const top = document.elementFromPoint(x, y);
        if (top && top !== el && !el.contains(top) && !top.contains(el)) { covered++; by = top; }
      }
      if (inView === pts.length && covered === pts.length && by) obscuredBy = this.path(by);
    }
    const cls = typeof el.className === 'string' ? el.className : '';
    return {
      key: this.path(el),
      tag: el.tagName,
      sig: el.tagName + '|' + cls.split(/\\s+/).sort().join('.') + '|' + (el.getAttribute('role') || ''),
      rect: { x: r.left, y: r.top, w: r.width, h: r.height },
      html: el.outerHTML.slice(0, 300),
      obscuredBy,
      vw: innerWidth, vh: innerHeight,
    };
  },
};`;

/* ======================= Test klávesnice ======================= */

/**
 * Prejde stránku klávesom Tab a overí:
 *  - 2.4.7 viditeľný fokus (porovnanie snímky prvku s fokusom a bez neho),
 *  - 2.1.2 pascu pre klávesnicu (fokus uviazne na jednom prvku),
 *  - 2.4.11 fokus úplne zakrytý iným prvkom (sticky hlavička, lišta),
 *  - 2.1.1 prvky s rolou/onclick, ktoré nie sú dostupné klávesnicou.
 */
async function keyboardChecks(page, { maxSteps = 60, maxVisualTests = 25 } = {}) {
  await page.evaluate(PAGE_HELPERS);
  // Východiskový bod: dočasný prvok na začiatku <body>, z ktorého Tab pokračuje na prvý prvok stránky
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    const s = document.createElement('span');
    s.id = '__wa_start'; s.tabIndex = -1;
    document.body.prepend(s);
    s.focus({ preventScroll: true });
  });

  const seen = new Set();
  const testedSigs = new Map();
  const noFocus = [], obscured = [], steps = [];
  let trap = null, prevKey = null, repeat = 0, visualTests = 0;

  for (let i = 0; i < maxSteps; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(90);
    if (i === 0) await page.evaluate(() => document.getElementById('__wa_start')?.remove()).catch(() => {});
    const a = await page.evaluate(() => window.__wa && window.__wa.active()).catch(() => null);
    if (!a) {
      if (steps.length) break; // fokus opustil dokument = koniec cyklu
      continue;
    }
    if (a.key === prevKey && a.tag !== 'IFRAME') {
      repeat++;
      if (repeat >= 3) { trap = a; break; }
      continue;
    }
    repeat = 0;
    if (seen.has(a.key)) break; // prešli sme dokola
    seen.add(a.key);
    prevKey = a.key;
    steps.push(a.key);

    if (a.obscuredBy) {
      // Potvrdenie: reklamy a dočítavaný obsah môžu prvok zakryť len na okamih
      await page.waitForTimeout(500);
      const again = await page.evaluate(() => window.__wa.active()).catch(() => null);
      if (again && again.key === a.key && again.obscuredBy) {
        obscured.push({ html: a.html, target: a.key, summary: `Prvok s fokusom je úplne zakrytý prvkom: ${again.obscuredBy}`, sel: a.key });
      } else a.obscuredBy = null;
    }

    // Vizuálny test fokusu – max. 2 prvky s rovnakým vzhľadom (rovnaký tag + triedy)
    const n = testedSigs.get(a.sig) || 0;
    const visible = a.rect.w >= 6 && a.rect.h >= 6 && a.rect.x >= 0 && a.rect.y >= 0 && a.rect.x + a.rect.w <= a.vw && a.rect.y + a.rect.h <= a.vh;
    if (visible && !a.obscuredBy && a.tag !== 'IFRAME' && n < 2 && visualTests < maxVisualTests) {
      testedSigs.set(a.sig, n + 1);
      visualTests++;
      const pad = 8;
      const clip = {
        x: Math.max(0, a.rect.x - pad), y: Math.max(0, a.rect.y - pad),
        width: Math.min(a.vw - Math.max(0, a.rect.x - pad), a.rect.w + pad * 2),
        height: Math.min(a.vh - Math.max(0, a.rect.y - pad), a.rect.h + pad * 2),
      };
      if (clip.width >= 4 && clip.height >= 4) {
        const focused = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' }).catch(() => null);
        // Odober fokus z prvku bez pohybu stránky a porovnaj
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
        await page.waitForTimeout(90);
        const scrollSame = await page.evaluate((r) => {
          const el = document.querySelector(r.key);
          if (!el) return false;
          const b = el.getBoundingClientRect();
          return Math.abs(b.left - r.rect.x) < 1 && Math.abs(b.top - r.rect.y) < 1;
        }, a).catch(() => false);
        const blurred = scrollSame ? await page.screenshot({ clip, animations: 'disabled', caret: 'hide' }).catch(() => null) : null;
        if (focused && blurred && focused.equals(blurred)) {
          noFocus.push({ html: a.html, target: a.key, summary: 'Pri zameraní klávesnicou sa vzhľad prvku nezmení – chýba viditeľný indikátor fokusu.', sel: a.key });
        }
        // Vráť fokus späť na prvok, aby Tab pokračoval v poradí
        await page.evaluate((k) => { const el = document.querySelector(k); if (el) el.focus({ preventScroll: true }); }, a.key).catch(() => {});
        const back = await page.evaluate(() => window.__wa.active()?.key).catch(() => null);
        if (back !== a.key) break;
      }
    }
  }

  // 2.1.1 – interaktívne prvky mimo poradia Tab (vysoká istota: explicitná rola alebo onclick)
  const notFocusable = await page.evaluate(() => {
    const focusableSel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,iframe,[contenteditable=""],[contenteditable="true"]';
    const isTabbable = (el) => el.matches(focusableSel) ? el.tabIndex >= 0 : (el.hasAttribute('tabindex') && el.tabIndex >= 0);
    const out = [];
    const els = document.querySelectorAll('[onclick],[role="button"],[role="link"],[role="tab"],[role="menuitem"],[role="checkbox"],[role="switch"],[role="radio"]');
    for (const el of els) {
      if (el === document.body || el === document.documentElement) continue;
      if (isTabbable(el) || el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') continue;
      if (el.hasAttribute('tabindex')) continue; // tabindex="-1" = zámerne riadený fokus (roving tabindex)
      if (el.closest('[aria-activedescendant],[role="listbox"],[role="tree"],[role="grid"],[role="menu"],[role="menubar"],[role="tablist"],[role="radiogroup"]')) continue;
      if (el.querySelector(focusableSel)) continue; // obal s fokusovateľným obsahom
      const anc = el.parentElement && el.parentElement.closest(focusableSel);
      if (anc && isTabbable(anc)) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      out.push({ html: el.outerHTML.slice(0, 300), target: window.__wa.path(el), summary: 'Prvok sa správa ako ovládací prvok (rola alebo onclick), ale nedá sa naň dostať klávesom Tab.', sel: window.__wa.path(el) });
      if (out.length >= 30) break;
    }
    return out;
  }).catch(() => []);

  const violations = [];
  if (noFocus.length) violations.push(violation('wa-focus-visible', noFocus));
  if (trap) violations.push(violation('wa-keyboard-trap', [{ html: trap.html, target: trap.key, summary: 'Fokus po stlačení Tab zostáva na tomto prvku – klávesnicou sa nedá pokračovať.', sel: trap.key }]));
  if (obscured.length) violations.push(violation('wa-focus-obscured', obscured));
  if (notFocusable.length) violations.push(violation('wa-not-focusable', notFocusable));

  const passes = [];
  if (steps.length) {
    if (!trap) passes.push('wa-keyboard-trap');
    if (!obscured.length) passes.push('wa-focus-obscured');
    if (visualTests && !noFocus.length) passes.push('wa-focus-visible');
  }
  if (!notFocusable.length) passes.push('wa-not-focusable');

  return { violations, passes, stats: { tabStops: steps.length, visualTests } };
}

/* ======================= Reflow (1.4.10) ======================= */

/** Pri šírke 320 CSS px nesmie obsah vyžadovať vodorovné skrolovanie (výnimky: tabuľky, mapy, kód…). */
async function reflowCheck(page) {
  const orig = page.viewportSize();
  await page.evaluate(PAGE_HELPERS);
  await page.setViewportSize({ width: 320, height: 640 });
  await page.waitForTimeout(600);
  const res = await page.evaluate(() => {
    const doc = document.scrollingElement || document.documentElement;
    const vw = doc.clientWidth;
    if (doc.scrollWidth - vw <= 2) return { overflow: 0, nodes: [] };
    const offenders = [];
    for (const el of document.body.getElementsByTagName('*')) {
      const r = el.getBoundingClientRect();
      if (r.right <= vw + 2 || r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.visibility === 'hidden') continue;
      let allowed = false;
      for (let p = el; p && p !== document.body; p = p.parentElement) {
        if (/^(TABLE|PRE|CODE|CANVAS|VIDEO|IFRAME|svg|math)$/i.test(p.tagName)) { allowed = true; break; }
        if (p !== el && /(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) { allowed = true; break; }
      }
      if (!allowed) offenders.push(el);
      if (offenders.length > 300) break;
    }
    const outer = offenders.filter((e) => !offenders.some((o) => o !== e && o.contains(e)));
    return {
      overflow: doc.scrollWidth - vw,
      nodes: outer.slice(0, 8).map((el) => ({ html: el.outerHTML.slice(0, 300), target: window.__wa.path(el), summary: `Pri šírke 320 px prvok presahuje obrazovku (šírka ${Math.round(el.getBoundingClientRect().width)} px, pravý okraj na ${Math.round(el.getBoundingClientRect().right)} px)${el.innerText.trim() ? '' : ' – prvok je prázdny, pravdepodobne má pevne nastavenú šírku'} a vynúti vodorovné skrolovanie.` })),
    };
  }).catch(() => ({ overflow: 0, nodes: [] }));
  await page.setViewportSize(orig);
  await page.waitForTimeout(300);
  if (res.nodes.length) return { violations: [violation('wa-reflow', res.nodes)], passes: [] };
  return { violations: [], passes: ['wa-reflow'] };
}

/* ======================= Snímka chybného prvku ======================= */

/** Zvýrazní prvok rámikom, stmaví okolie a vráti JPEG (base64) výrezu. */
async function elementShot(page, sel) {
  const box = await page.evaluate((s) => {
    let el;
    try { el = document.querySelector(s); } catch { return null; }
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    const o = document.createElement('div');
    o.id = '__wa_hl';
    const st = o.style;
    st.position = 'fixed'; st.left = (r.left - 4) + 'px'; st.top = (r.top - 4) + 'px';
    st.width = (r.width + 8) + 'px'; st.height = (r.height + 8) + 'px';
    st.border = '3px solid #ff2d55'; st.borderRadius = '6px';
    st.boxShadow = '0 0 0 9999px rgba(15,19,32,.28)'; st.zIndex = '2147483647'; st.pointerEvents = 'none';
    document.documentElement.appendChild(o);
    return { x: r.left, y: r.top, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight };
  }, sel).catch(() => null);
  if (!box) return null;
  const W = Math.min(box.vw, 860), H = Math.min(box.vh, 360);
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const x = Math.max(0, Math.min(box.vw - W, cx - W / 2));
  const y = Math.max(0, Math.min(box.vh - H, cy - H / 2));
  const buf = await page.screenshot({ type: 'jpeg', quality: 58, clip: { x, y, width: W, height: H }, animations: 'disabled' }).catch(() => null);
  await page.evaluate(() => document.getElementById('__wa_hl')?.remove()).catch(() => {});
  return buf ? buf.toString('base64') : null;
}

module.exports = { CUSTOM_RULES, dismissConsent, keyboardChecks, reflowCheck, elementShot };
