'use strict';

const { request, tryRequest, normalizeUrl, getCertificate } = require('./fetcher');
const { Doc, toText } = require('./html');
const { detectTech } = require('./tech');
const { L_ } = require('./site/i18n');

const PASS = 'pass', WARN = 'warn', FAIL = 'fail', INFO = 'info';

/** Pomocník na skladanie zoznamu kontrol. */
function checklist() {
  const items = [];
  const add = (id, label, status, { value = null, detail = '', fix = '', weight = 1 } = {}) =>
    items.push({ id, label, status, value, detail, fix, weight });
  return { items, add };
}

function score(items) {
  let total = 0, got = 0;
  for (const c of items) {
    if (c.status === INFO) continue;
    total += c.weight;
    got += c.weight * (c.status === PASS ? 1 : c.status === WARN ? 0.5 : 0);
  }
  return total ? Math.round((got / total) * 100) : 100;
}

const fmtBytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);
const ms = (n) => `${Math.round(n)} ms`;

/* ======================================================================= */

async function analyze(input, lang = 'sk') {
  const L = L_(lang);
  const target = normalizeUrl(input);
  const t0 = Date.now();

  // Hlavná požiadavka (chyby tu sú fatálne – web je nedostupný)
  const main = await request(target.href);
  const final = new URL(main.url);
  const html = main.body.toString('utf8');
  const doc = new Doc(html);
  const h = main.headers;
  const ctype = (h.get('content-type') || '').toLowerCase();

  const origin = final.origin;
  const httpVariant = new URL(final.href);
  httpVariant.protocol = 'http:';

  // Paralelné doplnkové požiadavky
  const [robots, sitemap, securityTxt, httpRes, notFound, cert] = await Promise.all([
    tryRequest(origin + '/robots.txt', { limit: 512 * 1024 }),
    tryRequest(origin + '/sitemap.xml', { limit: 256 * 1024 }),
    tryRequest(origin + '/.well-known/security.txt', { limit: 64 * 1024 }),
    final.protocol === 'https:' ? tryRequest(httpVariant.href, { readBody: false }) : Promise.resolve(null),
    tryRequest(origin + '/__webanalyzer-404-test-' + Date.now(), { limit: 64 * 1024 }),
    final.protocol === 'https:' ? getCertificate(final.hostname, final.port || 443) : Promise.resolve(null),
  ]);

  const ctx = { L, main, final, html, doc, h, ctype, robots, sitemap, securityTxt, httpRes, notFound, cert };

  const security = securityChecks(ctx);
  const seo = seoChecks(ctx);
  const performance = performanceChecks(ctx);
  const accessibility = a11yChecks(ctx);
  const social = socialChecks(ctx);

  const categories = {
    security: { title: L('Bezpečnosť', 'Security'), checks: security, score: score(security) },
    seo: { title: 'SEO', checks: seo, score: score(seo) },
    performance: { title: L('Výkon', 'Performance'), checks: performance, score: score(performance) },
    accessibility: { title: L('Prístupnosť', 'Accessibility'), checks: accessibility, score: score(accessibility) },
    social: { title: L('Sociálne siete', 'Social media'), checks: social, score: score(social) },
  };

  const weights = { security: 0.27, seo: 0.27, performance: 0.2, accessibility: 0.16, social: 0.1 };
  const overall = Math.round(Object.entries(weights).reduce((s, [k, w]) => s + categories[k].score * w, 0));

  // Odporúčania: zlyhané a varovania zoradené podľa závažnosti
  const recommendations = Object.entries(categories)
    .flatMap(([cat, c]) => c.checks.filter((x) => x.status === FAIL || x.status === WARN).map((x) => ({ cat, catTitle: c.title, ...x })))
    .filter((x) => x.fix)
    .sort((a, b) => (a.status === b.status ? b.weight - a.weight : a.status === FAIL ? -1 : 1))
    .slice(0, 12);

  return {
    url: final.href,
    inputUrl: target.href,
    analyzedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    overall,
    grade: grade(overall),
    categories,
    recommendations,
    overview: overview(ctx),
    tech: detectTech(ctx),
    headers: [...h.entries()].map(([k, v]) => ({ name: k, value: v.length > 300 ? v.slice(0, 300) + '…' : v })),
    redirects: [...main.chain, { url: main.url, status: main.status }],
    certificate: cert,
  };
}

function grade(s) {
  return s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 65 ? 'C' : s >= 50 ? 'D' : s >= 35 ? 'E' : 'F';
}

/* ---------------------------- PREHĽAD ---------------------------------- */

function overview({ main, final, doc, h, html }) {
  const title = toText(doc.first('title', { inner: true })?.inner || '');
  const text = doc.text();
  const words = text ? text.split(/\s+/).filter((w) => w.length > 1).length : 0;
  const anchors = doc.all('a').map((a) => a.attrs.href).filter(Boolean);
  let internal = 0, external = 0;
  for (const href of anchors) {
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    try { new URL(href, final).host === final.host ? internal++ : external++; } catch { /* ignore */ }
  }
  const icon = doc.links('icon')[0] || doc.links('apple-touch-icon')[0];
  let favicon;
  try { favicon = new URL(icon?.attrs.href || '/favicon.ico', final).href; } catch { favicon = null; }
  let ogImage = doc.meta('og:image');
  try { ogImage = ogImage ? new URL(ogImage, final).href : null; } catch { ogImage = null; }

  return {
    title,
    description: doc.meta('description') || '',
    host: final.host,
    ip: main.ip,
    status: main.status,
    server: h.get('server') || null,
    contentType: h.get('content-type') || null,
    ttfb: Math.round(main.ttfb),
    totalTime: Math.round(main.total),
    htmlBytes: Buffer.byteLength(html),
    transferBytes: Number(h.get('content-length')) || null,
    compression: h.get('content-encoding') || null,
    words,
    links: { internal, external },
    images: doc.all('img').length,
    scripts: doc.all('script', { source: 'raw' }).length,
    stylesheets: doc.links('stylesheet').length,
    lang: doc.htmlAttrs().lang || null,
    favicon,
    ogImage,
    redirects: main.chain.length,
  };
}

/* ---------------------------- BEZPEČNOSŤ ------------------------------- */

function securityChecks({ L, main, final, doc, h, httpRes, cert, securityTxt, notFound }) {
  const { items, add } = checklist();
  const https = final.protocol === 'https:';

  add('https', L('HTTPS šifrovanie', 'HTTPS encryption'), https ? PASS : FAIL, {
    weight: 5,
    value: https ? L('Áno', 'Yes') : L('Nie', 'No'),
    detail: https ? L('Stránka sa načítava cez zabezpečené spojenie.', 'The page loads over a secure connection.') : L('Stránka beží na nezabezpečenom HTTP.', 'The page runs on insecure HTTP.'),
    fix: L('Nasaď TLS certifikát (napr. zadarmo cez Let’s Encrypt) a presmeruj všetku prevádzku na HTTPS.', 'Install a TLS certificate (e.g. free from Let’s Encrypt) and redirect all traffic to HTTPS.'),
  });

  if (https) {
    const redirects = httpRes && httpRes.url.startsWith('https://');
    add('http-redirect', L('Presmerovanie HTTP → HTTPS', 'HTTP → HTTPS redirect'), httpRes ? (redirects ? PASS : FAIL) : WARN, {
      weight: 3,
      value: httpRes ? (redirects ? L('Áno', 'Yes') : L('Nie', 'No')) : L('Neoverené', 'Not verified'),
      detail: httpRes ? (redirects ? L('Verzia cez HTTP automaticky presmeruje na HTTPS.', 'The HTTP version redirects to HTTPS automatically.') : L('HTTP verzia stránky ostáva nešifrovaná.', 'The HTTP version of the page stays unencrypted.')) : L('HTTP verziu sa nepodarilo načítať.', 'The HTTP version could not be loaded.'),
      fix: L('Nastav na serveri trvalé (301) presmerovanie z http:// na https://.', 'Set up a permanent (301) redirect from http:// to https:// on the server.'),
    });
  }

  if (cert) {
    const st = !cert.authorized ? FAIL : cert.daysLeft < 0 ? FAIL : cert.daysLeft < 14 ? WARN : PASS;
    add('cert', L('SSL certifikát', 'SSL certificate'), st, {
      weight: 4,
      value: cert.daysLeft < 0 ? L('Expirovaný', 'Expired') : L(`${cert.daysLeft} dní`, `${cert.daysLeft} days`),
      detail: cert.authorized
        ? L(`Vydal ${cert.issuer || 'neznámy'}, platný do ${new Date(cert.validTo).toLocaleDateString('sk-SK')}. Protokol ${cert.protocol || '?'}.`, `Issued by ${cert.issuer || 'unknown'}, valid until ${new Date(cert.validTo).toLocaleDateString('en-GB')}. Protocol ${cert.protocol || '?'}.`)
        : L(`Certifikát nie je dôveryhodný: ${cert.authError || 'neznáma chyba'}.`, `The certificate is not trusted: ${cert.authError || 'unknown error'}.`),
      fix: L('Obnov alebo oprav SSL certifikát a zapni automatické obnovovanie.', 'Renew or fix the SSL certificate and enable automatic renewal.'),
    });
    if (cert.protocol) {
      const old = /TLSv1(\.0|\.1)?$/.test(cert.protocol);
      add('tls', L('Verzia TLS', 'TLS version'), old ? FAIL : PASS, {
        weight: 2,
        value: cert.protocol,
        detail: old ? L('Zastaraný protokol so známymi slabinami.', 'Outdated protocol with known weaknesses.') : L('Moderná verzia protokolu.', 'Modern protocol version.'),
        fix: L('Vypni TLS 1.0/1.1 a povoľ TLS 1.2 a 1.3.', 'Disable TLS 1.0/1.1 and enable TLS 1.2 and 1.3.'),
      });
    }
  } else if (https) {
    add('cert', L('SSL certifikát', 'SSL certificate'), INFO, { value: L('Neoverené', 'Not verified'), detail: L('Detaily certifikátu sa nepodarilo získať priamym TLS spojením.', 'Certificate details could not be retrieved via a direct TLS connection.') });
  }

  const hsts = h.get('strict-transport-security');
  const maxAge = Number((/max-age=(\d+)/i.exec(hsts || '') || [])[1] || 0);
  add('hsts', 'HSTS (Strict-Transport-Security)', !hsts ? FAIL : maxAge < 15552000 ? WARN : PASS, {
    weight: 3,
    value: hsts ? L(`max-age ${Math.round(maxAge / 86400)} dní`, `max-age ${Math.round(maxAge / 86400)} days`) : L('Chýba', 'Missing'),
    detail: hsts ? hsts : L('Prehliadač nemá pokyn vynútiť HTTPS pri ďalších návštevách.', 'The browser is not told to enforce HTTPS on future visits.'),
    fix: L('Pridaj hlavičku Strict-Transport-Security: max-age=31536000; includeSubDomains', 'Add the header Strict-Transport-Security: max-age=31536000; includeSubDomains'),
  });

  const csp = h.get('content-security-policy');
  const cspMeta = doc.meta('content-security-policy');
  const cspVal = csp || cspMeta;
  const weakCsp = cspVal && /'unsafe-inline'|'unsafe-eval'|\*/.test(cspVal) && !/'nonce-|'strict-dynamic'/.test(cspVal);
  add('csp', 'Content-Security-Policy', !cspVal ? FAIL : weakCsp ? WARN : PASS, {
    weight: 3,
    value: !cspVal ? L('Chýba', 'Missing') : weakCsp ? L('Slabá', 'Weak') : L('Nastavená', 'Set'),
    detail: cspVal ? cspVal.slice(0, 220) : L('CSP výrazne znižuje riziko XSS útokov.', 'CSP greatly reduces the risk of XSS attacks.'),
    fix: L('Definuj Content-Security-Policy, ktorá povolí len dôveryhodné zdroje skriptov a štýlov (bez unsafe-inline).', 'Define a Content-Security-Policy that only allows trusted script and style sources (no unsafe-inline).'),
  });

  const xfo = h.get('x-frame-options');
  const fa = /frame-ancestors/i.test(csp || '');
  add('xfo', L('Ochrana proti clickjackingu', 'Clickjacking protection'), xfo || fa ? PASS : FAIL, {
    weight: 2,
    value: xfo ? xfo : fa ? 'CSP frame-ancestors' : L('Chýba', 'Missing'),
    detail: L('Bráni vloženiu stránky do cudzieho <iframe>.', 'Prevents the page from being embedded in a foreign <iframe>.'),
    fix: L('Pridaj X-Frame-Options: SAMEORIGIN alebo CSP direktívu frame-ancestors \'self\'.', 'Add X-Frame-Options: SAMEORIGIN or the CSP directive frame-ancestors \'self\'.'),
  });

  const xcto = (h.get('x-content-type-options') || '').toLowerCase();
  add('xcto', 'X-Content-Type-Options', xcto === 'nosniff' ? PASS : FAIL, {
    weight: 1.5,
    value: xcto || L('Chýba', 'Missing'),
    detail: L('Zabraňuje prehliadaču hádať MIME typ súborov.', 'Stops the browser from guessing the MIME type of files.'),
    fix: L('Pridaj hlavičku X-Content-Type-Options: nosniff', 'Add the header X-Content-Type-Options: nosniff'),
  });

  const rp = h.get('referrer-policy');
  add('referrer', 'Referrer-Policy', rp ? (/unsafe-url/.test(rp) ? WARN : PASS) : WARN, {
    weight: 1,
    value: rp || L('Chýba', 'Missing'),
    detail: L('Určuje, koľko informácií o URL sa posiela iným webom.', 'Controls how much URL information is sent to other sites.'),
    fix: L('Pridaj Referrer-Policy: strict-origin-when-cross-origin', 'Add Referrer-Policy: strict-origin-when-cross-origin'),
  });

  const pp = h.get('permissions-policy');
  add('permissions', 'Permissions-Policy', pp ? PASS : WARN, {
    weight: 1,
    value: pp ? L('Nastavená', 'Set') : L('Chýba', 'Missing'),
    detail: L('Obmedzuje prístup k API ako kamera, mikrofón či geolokácia.', 'Restricts access to APIs such as camera, microphone and geolocation.'),
    fix: L('Pridaj Permissions-Policy, napr. camera=(), microphone=(), geolocation=()', 'Add a Permissions-Policy, e.g. camera=(), microphone=(), geolocation=()'),
  });

  const coop = h.get('cross-origin-opener-policy');
  add('coop', 'Cross-Origin-Opener-Policy', coop ? PASS : INFO, {
    weight: 0.5,
    value: coop || L('Chýba', 'Missing'),
    detail: L('Izoluje okno stránky od cudzích okien (ochrana pred XS-Leaks).', 'Isolates the page window from foreign windows (protects against XS-Leaks).'),
  });

  const server = h.get('server') || '';
  const powered = h.get('x-powered-by') || h.get('x-aspnet-version') || '';
  const leaks = /\d/.test(server) || powered;
  add('disclosure', L('Únik informácií o serveri', 'Server information disclosure'), leaks ? WARN : PASS, {
    weight: 1,
    value: [server, powered].filter(Boolean).join(' · ') || L('Skryté', 'Hidden'),
    detail: leaks ? L('Hlavičky prezrádzajú softvér alebo jeho verziu, čo uľahčuje cielené útoky.', 'Headers reveal the software or its version, which makes targeted attacks easier.') : L('Server neprezrádza verziu softvéru.', 'The server does not reveal its software version.'),
    fix: L('Skry verziu servera (napr. server_tokens off v nginx) a odstráň hlavičku X-Powered-By.', 'Hide the server version (e.g. server_tokens off in nginx) and remove the X-Powered-By header.'),
  });

  // Cookies
  const cookies = main.setCookies || [];
  if (cookies.length) {
    const bad = cookies.filter((c) => (https && !/;\s*secure/i.test(c)) || !/;\s*httponly/i.test(c) || !/;\s*samesite/i.test(c));
    add('cookies', L('Zabezpečenie cookies', 'Cookie security'), bad.length === 0 ? PASS : bad.length === cookies.length ? FAIL : WARN, {
      weight: 2,
      value: L(`${cookies.length - bad.length}/${cookies.length} v poriadku`, `${cookies.length - bad.length}/${cookies.length} OK`),
      detail: bad.length ? L(`Chýbajúce príznaky pri: ${bad.map((c) => c.split('=')[0]).slice(0, 5).join(', ')}`, `Missing flags on: ${bad.map((c) => c.split('=')[0]).slice(0, 5).join(', ')}`) : L('Všetky cookies majú Secure, HttpOnly a SameSite.', 'All cookies have Secure, HttpOnly and SameSite.'),
      fix: L('Nastav cookies s príznakmi Secure; HttpOnly; SameSite=Lax (alebo Strict).', 'Set cookies with the flags Secure; HttpOnly; SameSite=Lax (or Strict).'),
    });
  } else {
    add('cookies', L('Zabezpečenie cookies', 'Cookie security'), INFO, { value: L('Žiadne', 'None'), detail: L('Pri prvej návšteve server nenastavil žiadne cookies.', 'The server set no cookies on the first visit.') });
  }

  // Zmiešaný obsah
  if (https) {
    const mixed = [];
    for (const [tag, attr] of [['script', 'src'], ['link', 'href'], ['img', 'src'], ['iframe', 'src'], ['source', 'src'], ['video', 'src'], ['audio', 'src']]) {
      for (const el of doc.all(tag, { source: 'raw' })) {
        const v = el.attrs[attr];
        if (v && /^http:\/\//i.test(v) && !(tag === 'link' && /canonical|alternate/.test(el.attrs.rel || ''))) mixed.push(v);
      }
    }
    add('mixed', L('Zmiešaný obsah (HTTP na HTTPS)', 'Mixed content (HTTP on HTTPS)'), mixed.length ? FAIL : PASS, {
      weight: 2,
      value: mixed.length ? L(`${mixed.length} zdrojov`, `${mixed.length} resources`) : L('Žiadny', 'None'),
      detail: mixed.length ? mixed.slice(0, 3).join(', ') : L('Všetky zdroje sa načítavajú bezpečne.', 'All resources load securely.'),
      fix: L('Zmeň odkazy na zdroje z http:// na https://.', 'Change resource links from http:// to https://.'),
    });
  }

  // Externé skripty bez SRI
  const ext = doc.all('script', { source: 'raw' }).filter((s) => {
    if (!s.attrs.src) return false;
    try { return new URL(s.attrs.src, final).host !== final.host; } catch { return false; }
  });
  if (ext.length) {
    const noSri = ext.filter((s) => !s.attrs.integrity);
    add('sri', 'Subresource Integrity (SRI)', noSri.length === 0 ? PASS : noSri.length === ext.length ? WARN : PASS, {
      weight: 1,
      value: L(`${ext.length - noSri.length}/${ext.length} s integrity`, `${ext.length - noSri.length}/${ext.length} with integrity`),
      detail: L('SRI chráni pred podvrhnutím externých skriptov (napr. z CDN).', 'SRI protects against tampered external scripts (e.g. from a CDN).'),
      fix: L('Pre statické skripty z CDN pridaj atribút integrity="sha384-…" a crossorigin="anonymous".', 'For static CDN scripts add integrity="sha384-…" and crossorigin="anonymous".'),
    });
  }

  const sec = securityTxt && securityTxt.status === 200 && /contact:/i.test(securityTxt.body.toString('utf8'));
  add('securitytxt', 'security.txt', sec ? PASS : INFO, {
    weight: 0.5,
    value: sec ? L('Nájdený', 'Found') : L('Chýba', 'Missing'),
    detail: L('Súbor /.well-known/security.txt hovorí výskumníkom, kam hlásiť zraniteľnosti.', 'The /.well-known/security.txt file tells researchers where to report vulnerabilities.'),
  });

  if (notFound) {
    add('soft404', L('Správny kód pre neexistujúce stránky', 'Correct status for missing pages'), notFound.status === 404 || notFound.status === 410 ? PASS : WARN, {
      weight: 1,
      value: `HTTP ${notFound.status}`,
      detail: notFound.status === 404 ? L('Neexistujúce URL vracajú 404.', 'Non-existent URLs return 404.') : L('Neexistujúce URL nevracajú 404 („soft 404“), čo mätie vyhľadávače aj skenery.', 'Non-existent URLs do not return 404 (“soft 404”), which confuses search engines and scanners.'),
      fix: L('Zabezpeč, aby neexistujúce stránky vracali HTTP status 404.', 'Make sure non-existent pages return HTTP status 404.'),
    });
  }

  return items;
}

/* ------------------------------- SEO ----------------------------------- */

function seoChecks({ L, main, final, doc, ctype, robots, sitemap }) {
  const { items, add } = checklist();

  add('status', 'HTTP status', main.status === 200 ? PASS : main.status < 400 ? WARN : FAIL, {
    weight: 3,
    value: String(main.status),
    detail: main.status === 200 ? L('Stránka odpovedá korektne.', 'The page responds correctly.') : L('Stránka nevracia status 200.', 'The page does not return status 200.'),
    fix: L('Zabezpeč, aby hlavná stránka vracala HTTP 200.', 'Make sure the main page returns HTTP 200.'),
  });

  const title = toText(doc.first('title', { inner: true })?.inner || '');
  add('title', L('Titulok stránky (title)', 'Page title'), !title ? FAIL : title.length < 10 || title.length > 65 ? WARN : PASS, {
    weight: 4,
    value: title ? L(`${title.length} znakov`, `${title.length} characters`) : L('Chýba', 'Missing'),
    detail: title || L('Stránka nemá element <title>.', 'The page has no <title> element.'),
    fix: L('Napíš jedinečný titulok s dĺžkou 10–60 znakov s hlavným kľúčovým slovom na začiatku.', 'Write a unique title of 10–60 characters with the main keyword near the start.'),
  });

  const desc = doc.meta('description');
  add('description', L('Meta popis (description)', 'Meta description'), !desc ? FAIL : desc.length < 50 || desc.length > 165 ? WARN : PASS, {
    weight: 3,
    value: desc ? L(`${desc.length} znakov`, `${desc.length} characters`) : L('Chýba', 'Missing'),
    detail: desc || L('Vyhľadávač si popis vytvorí sám z obsahu stránky.', 'Search engines will generate a description from the page content.'),
    fix: L('Pridaj <meta name="description"> s výstižným popisom dlhým 50–160 znakov.', 'Add a <meta name="description"> with a concise 50–160 character summary.'),
  });

  const h1s = doc.all('h1', { inner: true }).map((x) => toText(x.inner)).filter(Boolean);
  add('h1', L('Nadpis H1', 'H1 heading'), h1s.length === 1 ? PASS : h1s.length === 0 ? FAIL : WARN, {
    weight: 3,
    value: `${h1s.length}×`,
    detail: h1s.length ? h1s.slice(0, 3).join(' | ').slice(0, 200) : L('Stránka nemá hlavný nadpis H1.', 'The page has no main H1 heading.'),
    fix: h1s.length ? L('Používaj na stránke práve jeden nadpis H1.', 'Use exactly one H1 heading per page.') : L('Pridaj jeden nadpis H1 popisujúci obsah stránky.', 'Add one H1 heading describing the page content.'),
  });

  const levels = [];
  doc.clean.replace(/<h([1-6])\b/gi, (_, l) => levels.push(Number(l)));
  let skips = 0;
  for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) skips++;
  add('headings', L('Hierarchia nadpisov', 'Heading hierarchy'), levels.length === 0 ? WARN : skips ? WARN : PASS, {
    weight: 1,
    value: L(`${levels.length} nadpisov`, `${levels.length} headings`),
    detail: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((t, i) => `${t.toUpperCase()}: ${levels.filter((l) => l === i + 1).length}`).join(' · ') + (skips ? L(` · ${skips} preskočených úrovní`, ` · ${skips} skipped levels`) : ''),
    fix: L('Nadpisy používaj v logickom poradí (H1 → H2 → H3) bez preskakovania úrovní.', 'Use headings in logical order (H1 → H2 → H3) without skipping levels.'),
  });

  const canonical = doc.links('canonical')[0]?.attrs.href;
  add('canonical', L('Kanonická URL', 'Canonical URL'), canonical ? PASS : WARN, {
    weight: 2,
    value: canonical ? L('Nastavená', 'Set') : L('Chýba', 'Missing'),
    detail: canonical || L('Bez canonical môžu vznikať duplicity obsahu.', 'Without a canonical URL, duplicate content may arise.'),
    fix: L('Pridaj <link rel="canonical" href="…"> s preferovanou URL stránky.', 'Add <link rel="canonical" href="…"> with the preferred page URL.'),
  });

  const lang = doc.htmlAttrs().lang;
  add('lang', L('Jazyk stránky', 'Page language'), lang ? PASS : WARN, {
    weight: 1.5,
    value: lang || L('Chýba', 'Missing'),
    detail: L('Atribút lang na elemente <html> pomáha vyhľadávačom aj čítačkám.', 'The lang attribute on <html> helps search engines and screen readers.'),
    fix: L('Doplň atribút lang, napr. <html lang="sk">.', 'Add the lang attribute, e.g. <html lang="en">.'),
  });

  const viewport = doc.meta('viewport');
  add('viewport', L('Mobilná optimalizácia (viewport)', 'Mobile optimization (viewport)'), viewport && /width=device-width/.test(viewport) ? PASS : FAIL, {
    weight: 3,
    value: viewport ? L('Áno', 'Yes') : L('Chýba', 'Missing'),
    detail: viewport || L('Bez viewportu sa stránka na mobiloch zobrazí zmenšená.', 'Without a viewport, the page is shown zoomed out on mobile.'),
    fix: L('Pridaj <meta name="viewport" content="width=device-width, initial-scale=1">.', 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.'),
  });

  const robotsMeta = (doc.meta('robots') || '').toLowerCase();
  const xRobots = (main.headers.get('x-robots-tag') || '').toLowerCase();
  const noindex = /noindex/.test(robotsMeta + xRobots);
  add('indexable', L('Indexovateľnosť', 'Indexability'), noindex ? FAIL : PASS, {
    weight: 4,
    value: noindex ? 'noindex' : L('Povolená', 'Allowed'),
    detail: noindex ? L('Stránka zakazuje vyhľadávačom indexovanie.', 'The page blocks search engines from indexing it.') : L('Vyhľadávače môžu stránku indexovať.', 'Search engines can index the page.'),
    fix: L('Odstráň noindex z meta robots / X-Robots-Tag, ak má byť stránka vo vyhľadávaní.', 'Remove noindex from meta robots / X-Robots-Tag if the page should appear in search.'),
  });

  const robotsOk = robots && robots.status === 200 && !/text\/html/i.test(robots.headers.get('content-type') || '');
  const robotsTxt = robotsOk ? robots.body.toString('utf8') : '';
  const blocksAll = /user-agent:\s*\*[\s\S]*?^\s*disallow:\s*\/\s*$/im.test(robotsTxt);
  add('robots', 'robots.txt', !robotsOk ? WARN : blocksAll ? FAIL : PASS, {
    weight: 2,
    value: robotsOk ? (blocksAll ? L('Blokuje všetko', 'Blocks everything') : L('Nájdený', 'Found')) : L('Chýba', 'Missing'),
    detail: robotsOk ? robotsTxt.split('\n').slice(0, 4).join(' · ').slice(0, 200) : L('Súbor /robots.txt sa nenašiel.', 'No /robots.txt file found.'),
    fix: blocksAll ? L('robots.txt blokuje celý web (Disallow: /). Over, či je to zámer.', 'robots.txt blocks the whole site (Disallow: /). Check that this is intended.') : L('Vytvor /robots.txt s pravidlami pre roboty a odkazom na sitemap.', 'Create /robots.txt with crawler rules and a link to your sitemap.'),
  });

  const smInRobots = (/^\s*sitemap:\s*(\S+)/im.exec(robotsTxt) || [])[1];
  const smOk = (sitemap && sitemap.status === 200 && /<(urlset|sitemapindex)/i.test(sitemap.body.toString('utf8'))) || !!smInRobots;
  add('sitemap', 'XML Sitemap', smOk ? PASS : WARN, {
    weight: 2,
    value: smOk ? L('Nájdená', 'Found') : L('Chýba', 'Missing'),
    detail: smInRobots ? L(`Uvedená v robots.txt: ${smInRobots}`, `Listed in robots.txt: ${smInRobots}`) : smOk ? '/sitemap.xml' : L('Sitemap pomáha vyhľadávačom nájsť všetky stránky.', 'A sitemap helps search engines find all pages.'),
    fix: L('Vygeneruj /sitemap.xml a uveď ju v robots.txt (Sitemap: https://…/sitemap.xml).', 'Generate /sitemap.xml and reference it in robots.txt (Sitemap: https://…/sitemap.xml).'),
  });

  const imgs = doc.all('img');
  const noAlt = imgs.filter((i) => i.attrs.alt === undefined);
  add('alt', L('Alternatívne texty obrázkov', 'Image alt texts'), imgs.length === 0 ? INFO : noAlt.length === 0 ? PASS : noAlt.length / imgs.length > 0.3 ? FAIL : WARN, {
    weight: 2,
    value: imgs.length ? `${imgs.length - noAlt.length}/${imgs.length}` : L('Bez obrázkov', 'No images'),
    detail: noAlt.length ? L(`${noAlt.length} obrázkov nemá atribút alt.`, `${noAlt.length} images have no alt attribute.`) : L('Všetky obrázky majú alt.', 'All images have alt text.'),
    fix: L('Doplň každému obrázku atribút alt s popisom (dekoratívnym alt="").', 'Give every image an alt attribute with a description (decorative ones alt="").'),
  });

  const jsonLd = doc.all('script', { inner: true, source: 'raw' }).filter((s) => /ld\+json/i.test(s.attrs.type || ''));
  const types = new Set();
  for (const s of jsonLd) {
    try {
      const data = JSON.parse(s.inner);
      const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o['@type']) [].concat(o['@type']).forEach((t) => types.add(t)); if (o['@graph']) walk(o['@graph']); } };
      walk(data);
    } catch { /* neplatné JSON-LD */ }
  }
  const microdata = /itemscope/i.test(doc.clean);
  add('schema', L('Štruktúrované dáta', 'Structured data'), jsonLd.length || microdata ? PASS : WARN, {
    weight: 1.5,
    value: types.size ? [...types].slice(0, 4).join(', ') : microdata ? 'Microdata' : L('Chýbajú', 'Missing'),
    detail: L('Schema.org dáta umožňujú rozšírené výsledky vo vyhľadávaní (hviezdičky, FAQ, …).', 'Schema.org data enables rich results in search (stars, FAQ, …).'),
    fix: L('Pridaj JSON-LD so Schema.org (Organization, WebSite, Article, Product…).', 'Add Schema.org JSON-LD (Organization, WebSite, Article, Product…).'),
  });

  const words = doc.text().split(/\s+/).filter((w) => w.length > 1).length;
  add('content', L('Množstvo textu', 'Content length'), words >= 300 ? PASS : words >= 100 ? WARN : FAIL, {
    weight: 1.5,
    value: L(`${words} slov`, `${words} words`),
    detail: words < 100 ? L('Málo textu – vyhľadávače nemajú čo indexovať (alebo sa obsah generuje JavaScriptom).', 'Little text – search engines have nothing to index (or the content is rendered by JavaScript).') : L('Dostatočné množstvo obsahu.', 'Sufficient content.'),
    fix: L('Rozšír textový obsah stránky (ideálne 300+ slov) alebo zvaž server-side rendering.', 'Expand the page text (ideally 300+ words) or consider server-side rendering.'),
  });

  const pathLen = final.pathname.length + final.search.length;
  add('url', L('Čitateľná URL', 'Readable URL'), pathLen > 100 || /[A-Z_]/.test(final.pathname) || final.search.length > 50 ? WARN : PASS, {
    weight: 0.5,
    value: L(`${final.href.length} znakov`, `${final.href.length} characters`),
    detail: final.href,
    fix: L('Používaj krátke URL s malými písmenami a pomlčkami.', 'Use short lowercase URLs with hyphens.'),
  });

  const favicon = doc.links('icon').length || doc.links('shortcut').length || doc.links('apple-touch-icon').length;
  add('favicon', 'Favicon', favicon ? PASS : WARN, {
    weight: 0.5,
    value: favicon ? L('Áno', 'Yes') : L('Nenájdený v HTML', 'Not found in HTML'),
    detail: L('Ikona sa zobrazuje v záložkách aj vo výsledkoch vyhľadávania.', 'The icon appears in browser tabs and in search results.'),
    fix: 'Pridaj <link rel="icon" href="/favicon.svg">.',
  });

  const hreflang = doc.links('alternate').filter((l) => l.attrs.hreflang);
  add('hreflang', L('Jazykové verzie (hreflang)', 'Language versions (hreflang)'), hreflang.length ? PASS : INFO, {
    value: hreflang.length ? hreflang.map((l) => l.attrs.hreflang).slice(0, 6).join(', ') : L('Nepoužité', 'Not used'),
    detail: L('Relevantné len pre viacjazyčné weby.', 'Only relevant for multilingual sites.'),
  });

  if (!/html/.test(ctype)) {
    add('ctype', L('Typ obsahu', 'Content type'), WARN, { weight: 1, value: ctype || '?', detail: L('Odpoveď nie je HTML dokument.', 'The response is not an HTML document.'), fix: L('Over, či URL vedie na HTML stránku.', 'Check that the URL points to an HTML page.') });
  }
  return items;
}

/* ------------------------------ VÝKON ---------------------------------- */

function performanceChecks({ L, main, html, doc, h }) {
  const { items, add } = checklist();

  add('ttfb', L('Čas odozvy servera (TTFB)', 'Server response time (TTFB)'), main.ttfb < 600 ? PASS : main.ttfb < 1500 ? WARN : FAIL, {
    weight: 4,
    value: ms(main.ttfb),
    detail: L('Čas do prijatia prvej odpovede (merané z nášho servera, vrátane DNS a TLS).', 'Time to first byte (measured from our server, incl. DNS and TLS).'),
    fix: L('Zrýchli server: cache na strane servera, CDN, optimalizácia databázových dopytov.', 'Speed up the server: server-side caching, a CDN, optimized database queries.'),
  });

  add('total', L('Celkový čas načítania HTML', 'Total HTML load time'), main.total < 1500 ? PASS : main.total < 3500 ? WARN : FAIL, {
    weight: 2,
    value: ms(main.total),
    detail: main.chain.length ? L(`Vrátane ${main.chain.length} presmerovaní.`, `Including ${main.chain.length} redirects.`) : L('Bez presmerovaní.', 'No redirects.'),
    fix: L('Skráť cestu k obsahu – menej presmerovaní, rýchlejší hosting, CDN.', 'Shorten the path to content – fewer redirects, faster hosting, a CDN.'),
  });

  const size = Buffer.byteLength(html);
  add('size', L('Veľkosť HTML', 'HTML size'), size < 100 * 1024 ? PASS : size < 500 * 1024 ? WARN : FAIL, {
    weight: 2,
    value: fmtBytes(size) + (main.truncated ? '+' : ''),
    detail: L('Nekomprimovaná veľkosť HTML dokumentu.', 'Uncompressed size of the HTML document.'),
    fix: L('Zmenši HTML – odstráň inline dáta, nepoužité časti a veľké vložené SVG/štýly.', 'Shrink the HTML – remove inline data, unused parts and large embedded SVG/styles.'),
  });

  const enc = h.get('content-encoding');
  add('compression', L('Kompresia (gzip / brotli)', 'Compression (gzip / brotli)'), enc && /br|gzip|zstd|deflate/.test(enc) ? PASS : size < 1500 ? INFO : FAIL, {
    weight: 3,
    value: enc || L('Žiadna', 'None'),
    detail: enc ? L('Odpoveď je komprimovaná.', 'The response is compressed.') : L('Text sa prenáša nekomprimovaný.', 'Text is transferred uncompressed.'),
    fix: L('Zapni na serveri Brotli alebo gzip kompresiu pre text/html, CSS a JS.', 'Enable Brotli or gzip compression for text/html, CSS and JS on the server.'),
  });

  add('redirects', L('Počet presmerovaní', 'Number of redirects'), main.chain.length === 0 ? PASS : main.chain.length === 1 ? PASS : main.chain.length <= 2 ? WARN : FAIL, {
    weight: 1.5,
    value: String(main.chain.length),
    detail: main.chain.map((c) => `${c.status} ${c.url}`).join(' → ') || L('Žiadne.', 'None.'),
    fix: L('Odkazuj priamo na finálnu URL a zlúč reťaz presmerovaní do jedného kroku.', 'Link directly to the final URL and collapse the redirect chain into one step.'),
  });

  const cc = h.get('cache-control');
  add('cache', L('Cache hlavičky', 'Cache headers'), cc || h.get('etag') || h.get('last-modified') ? PASS : WARN, {
    weight: 1,
    value: cc || (h.get('etag') ? 'ETag' : L('Chýba', 'Missing')),
    detail: L('Umožňuje prehliadačom a CDN znovu použiť stiahnutý obsah.', 'Lets browsers and CDNs reuse downloaded content.'),
    fix: L('Nastav Cache-Control (a ETag) – pre statické súbory dlhú platnosť s verzovaním v názve.', 'Set Cache-Control (and ETag) – long lifetimes for static files with versioned names.'),
  });

  const head = doc.head();
  const blocking = [];
  head.replace(/<script\b([^>]*)>/gi, (m, a) => {
    if (/\bsrc=/i.test(a) && !/\b(async|defer)\b/i.test(a) && !/type=["']?module/i.test(a)) blocking.push(a);
    return m;
  });
  add('blocking', L('Blokujúce skripty v <head>', 'Render-blocking scripts in <head>'), blocking.length === 0 ? PASS : blocking.length <= 2 ? WARN : FAIL, {
    weight: 2,
    value: String(blocking.length),
    detail: blocking.length ? L('Tieto skripty zastavia vykresľovanie, kým sa nestiahnu.', 'These scripts halt rendering until they are downloaded.') : L('Žiadne skripty neblokujú vykresľovanie.', 'No scripts block rendering.'),
    fix: L('Pridaj skriptom atribút defer alebo async, prípadne ich presuň na koniec <body>.', 'Add defer or async to scripts, or move them to the end of <body>.'),
  });

  const scripts = doc.all('script', { source: 'raw' }).filter((s) => s.attrs.src).length;
  const css = doc.links('stylesheet').length;
  const req = scripts + css;
  add('requests', L('Externé JS a CSS súbory', 'External JS and CSS files'), req <= 15 ? PASS : req <= 35 ? WARN : FAIL, {
    weight: 1.5,
    value: `${scripts} JS · ${css} CSS`,
    detail: L('Každý súbor je samostatná požiadavka, ktorú musí prehliadač spracovať.', 'Each file is a separate request the browser has to process.'),
    fix: L('Zlúč a minifikuj súbory, odstráň nepoužívané knižnice.', 'Bundle and minify files, remove unused libraries.'),
  });

  const inlineBytes = doc.all('script', { inner: true, source: 'raw' }).reduce((s, x) => s + (x.attrs.src ? 0 : x.inner.length), 0)
    + doc.all('style', { inner: true, source: 'raw' }).reduce((s, x) => s + x.inner.length, 0);
  add('inline', L('Inline skripty a štýly', 'Inline scripts and styles'), inlineBytes < 50 * 1024 ? PASS : inlineBytes < 200 * 1024 ? WARN : FAIL, {
    weight: 1,
    value: fmtBytes(inlineBytes),
    detail: L('Veľké inline bloky sa nedajú cachovať a zväčšujú HTML.', 'Large inline blocks cannot be cached and bloat the HTML.'),
    fix: L('Presuň veľké inline skripty a štýly do externých cachovateľných súborov.', 'Move large inline scripts and styles into external, cacheable files.'),
  });

  const imgs = doc.all('img');
  if (imgs.length > 3) {
    const lazy = imgs.filter((i) => i.attrs.loading === 'lazy' || i.attrs['data-src'] || i.attrs['data-lazy-src']).length;
    add('lazy', L('Lazy loading obrázkov', 'Image lazy loading'), lazy >= imgs.length / 3 ? PASS : lazy ? WARN : WARN, {
      weight: 1,
      value: `${lazy}/${imgs.length}`,
      detail: L('Obrázky mimo obrazovky sa môžu načítať až pri skrolovaní.', 'Off-screen images can load only when scrolled into view.'),
      fix: L('Pridaj obrázkom pod zlomom atribút loading="lazy".', 'Add loading="lazy" to images below the fold.'),
    });
    const dims = imgs.filter((i) => i.attrs.width && i.attrs.height).length;
    add('dimensions', L('Rozmery obrázkov', 'Image dimensions'), dims >= imgs.length * 0.7 ? PASS : WARN, {
      weight: 1,
      value: `${dims}/${imgs.length}`,
      detail: L('Uvedené width/height zabraňujú poskakovaniu layoutu (CLS).', 'Declared width/height prevent layout shifts (CLS).'),
      fix: L('Doplň obrázkom atribúty width a height.', 'Add width and height attributes to images.'),
    });
    const modern = imgs.filter((i) => /\.(webp|avif)(\?|$)/i.test(i.attrs.src || '')).length + doc.all('source').filter((s) => /webp|avif/i.test(s.attrs.type || s.attrs.srcset || '')).length;
    add('formats', L('Moderné formáty obrázkov', 'Modern image formats'), modern ? PASS : INFO, {
      weight: 1,
      value: modern ? `${modern}× WebP/AVIF` : L('Nezistené', 'Not detected'),
      detail: L('WebP a AVIF bývajú o 25–50 % menšie ako JPEG/PNG.', 'WebP and AVIF are typically 25–50% smaller than JPEG/PNG.'),
      fix: L('Konvertuj obrázky do formátu WebP alebo AVIF.', 'Convert images to WebP or AVIF.'),
    });
  }

  const preconnect = doc.links('preconnect').length + doc.links('dns-prefetch').length + doc.links('preload').length;
  add('hints', 'Resource hints (preload / preconnect)', preconnect ? PASS : INFO, {
    weight: 0.5,
    value: preconnect ? `${preconnect}×` : L('Nepoužité', 'Not used'),
    detail: L('Pomáhajú prehliadaču skôr nadviazať spojenie s dôležitými zdrojmi.', 'They help the browser connect to important origins earlier.'),
  });

  return items;
}

/* ---------------------------- PRÍSTUPNOSŤ ------------------------------ */

function a11yChecks({ L, doc }) {
  const { items, add } = checklist();

  const lang = doc.htmlAttrs().lang;
  add('lang', L('Jazyk dokumentu', 'Document language'), lang ? PASS : FAIL, {
    weight: 3, value: lang || L('Chýba', 'Missing'),
    detail: L('Čítačky obrazovky podľa neho volia výslovnosť.', 'Screen readers use it to choose pronunciation.'),
    fix: L('Pridaj atribút lang na <html>.', 'Add the lang attribute to <html>.'),
  });

  const title = toText(doc.first('title', { inner: true })?.inner || '');
  add('title', L('Titulok dokumentu', 'Document title'), title ? PASS : FAIL, { weight: 2, value: title ? L('Áno', 'Yes') : L('Chýba', 'Missing'), detail: L('Titulok pomáha orientácii medzi kartami.', 'The title helps users tell tabs apart.'), fix: L('Pridaj element <title>.', 'Add a <title> element.') });

  const imgs = doc.all('img');
  const noAlt = imgs.filter((i) => i.attrs.alt === undefined).length;
  add('alt', L('Obrázky s alt textom', 'Images with alt text'), imgs.length === 0 ? INFO : noAlt === 0 ? PASS : noAlt / imgs.length > 0.3 ? FAIL : WARN, {
    weight: 3, value: imgs.length ? `${imgs.length - noAlt}/${imgs.length}` : '—',
    detail: L('Nevidiaci používatelia sa o obrázkoch dozvedia len z alt textu.', 'Blind users learn about images only from their alt text.'),
    fix: L('Doplň obrázkom atribút alt.', 'Add alt attributes to images.'),
  });

  const viewport = doc.meta('viewport') || '';
  const noZoom = /user-scalable\s*=\s*(no|0)/i.test(viewport) || /maximum-scale\s*=\s*1(\.0)?\b/i.test(viewport);
  add('zoom', L('Povolené priblíženie', 'Zoom allowed'), noZoom ? FAIL : PASS, {
    weight: 2, value: noZoom ? L('Zakázané', 'Disabled') : L('Povolené', 'Allowed'),
    detail: noZoom ? L('Viewport bráni používateľom zväčšiť text.', 'The viewport prevents users from enlarging text.') : L('Používatelia si môžu stránku priblížiť.', 'Users can zoom the page.'),
    fix: L('Odstráň z viewportu user-scalable=no a maximum-scale=1.', 'Remove user-scalable=no and maximum-scale=1 from the viewport.'),
  });

  // Formuláre
  const inputs = doc.all('input').filter((i) => !['hidden', 'submit', 'button', 'reset', 'image'].includes((i.attrs.type || 'text').toLowerCase()))
    .concat(doc.all('select'), doc.all('textarea'));
  if (inputs.length) {
    const labelFor = new Set(doc.all('label').map((l) => l.attrs.for).filter(Boolean));
    const unlabeled = inputs.filter((i) => !(i.attrs['aria-label'] || i.attrs['aria-labelledby'] || i.attrs.title || (i.attrs.id && labelFor.has(i.attrs.id)))).length;
    // vnorené <label><input></label>
    const nested = (doc.clean.match(/<label\b[^>]*>(?:(?!<\/label>)[\s\S])*?<(input|select|textarea)\b/gi) || []).length;
    const bad = Math.max(0, unlabeled - nested);
    add('labels', L('Popisy formulárových polí', 'Form field labels'), bad === 0 ? PASS : bad / inputs.length > 0.3 ? FAIL : WARN, {
      weight: 2, value: `${inputs.length - bad}/${inputs.length}`,
      detail: L('Každé pole formulára potrebuje priradený <label> alebo aria-label.', 'Every form field needs an associated <label> or aria-label.'),
      fix: L('Prepoj polia s <label for="id"> alebo doplň aria-label.', 'Connect fields with <label for="id"> or add aria-label.'),
    });
  }

  const buttons = doc.all('button', { inner: true });
  const emptyBtn = buttons.filter((b) => !toText(b.inner) && !b.attrs['aria-label'] && !b.attrs.title && !/alt=["'][^"']+/.test(b.inner)).length;
  const links = doc.all('a', { inner: true });
  const emptyLinks = links.filter((a) => a.attrs.href && !toText(a.inner) && !a.attrs['aria-label'] && !a.attrs.title && !/alt=["'][^"']+|aria-label/.test(a.inner)).length;
  const emptyTotal = emptyBtn + emptyLinks;
  add('names', L('Odkazy a tlačidlá s textom', 'Links and buttons with text'), emptyTotal === 0 ? PASS : emptyTotal <= 3 ? WARN : FAIL, {
    weight: 2, value: emptyTotal ? L(`${emptyTotal} bez textu`, `${emptyTotal} without text`) : L('V poriadku', 'OK'),
    detail: L(`${emptyLinks} odkazov a ${emptyBtn} tlačidiel nemá čitateľný názov.`, `${emptyLinks} links and ${emptyBtn} buttons have no readable name.`),
    fix: L('Ikonovým odkazom a tlačidlám doplň aria-label alebo skrytý text.', 'Add aria-label or hidden text to icon links and buttons.'),
  });

  const generic = links.filter((a) => /^(klikni|klik|tu|viac|čítaj viac|click here|here|more|read more)$/i.test(toText(a.inner))).length;
  add('linktext', L('Popisné texty odkazov', 'Descriptive link text'), generic === 0 ? PASS : WARN, {
    weight: 1, value: generic ? L(`${generic} všeobecných`, `${generic} generic`) : L('V poriadku', 'OK'),
    detail: L('Texty ako „klikni tu“ nedávajú zmysel mimo kontextu.', 'Text like “click here” makes no sense out of context.'),
    fix: L('Používaj odkazové texty, ktoré popisujú cieľ (napr. „Cenník služieb“).', 'Use link text that describes the destination (e.g. “Service pricing”).'),
  });

  const landmarks = ['main', 'nav', 'header', 'footer'].filter((t) => new RegExp(`<${t}\\b|role=["']${t === 'main' ? 'main' : t === 'nav' ? 'navigation' : t === 'header' ? 'banner' : 'contentinfo'}`, 'i').test(doc.clean));
  add('landmarks', L('Sémantické oblasti (landmarks)', 'Landmarks'), landmarks.includes('main') && landmarks.length >= 3 ? PASS : landmarks.length ? WARN : FAIL, {
    weight: 1.5, value: landmarks.length ? landmarks.join(', ') : L('Žiadne', 'None'),
    detail: L('Elementy <main>, <nav>, <header>, <footer> uľahčujú navigáciu čítačkám.', 'The <main>, <nav>, <header> and <footer> elements make screen reader navigation easier.'),
    fix: L('Obal hlavný obsah do <main> a použi <header>, <nav>, <footer>.', 'Wrap the main content in <main> and use <header>, <nav>, <footer>.'),
  });

  const skip = /<a\b[^>]*href=["']#(main|content|obsah|skip)[^"']*["']/i.test(doc.clean);
  add('skiplink', L('Odkaz „Preskočiť na obsah“', '“Skip to content” link'), skip ? PASS : INFO, {
    weight: 0.5, value: skip ? L('Áno', 'Yes') : L('Nenájdený', 'Not found'),
    detail: L('Umožňuje používateľom klávesnice preskočiť navigáciu.', 'Lets keyboard users skip the navigation.'),
  });

  const tabindex = (doc.clean.match(/tabindex=["']?[1-9]/gi) || []).length;
  add('tabindex', L('Poradie fokusu (tabindex)', 'Focus order (tabindex)'), tabindex ? WARN : PASS, {
    weight: 1, value: tabindex ? L(`${tabindex}× kladný tabindex`, `${tabindex}× positive tabindex`) : L('V poriadku', 'OK'),
    detail: L('Kladný tabindex narúša prirodzené poradie navigácie klávesnicou.', 'Positive tabindex breaks the natural keyboard navigation order.'),
    fix: L('Nepoužívaj tabindex väčší ako 0.', 'Do not use tabindex greater than 0.'),
  });

  const iframes = doc.all('iframe');
  if (iframes.length) {
    const noTitle = iframes.filter((f) => !f.attrs.title).length;
    add('iframes', L('Titulky iframe', 'Iframe titles'), noTitle ? WARN : PASS, {
      weight: 1, value: `${iframes.length - noTitle}/${iframes.length}`,
      detail: L('Vložené rámce potrebujú atribút title.', 'Embedded frames need a title attribute.'),
      fix: L('Doplň každému <iframe> atribút title.', 'Add a title attribute to every <iframe>.'),
    });
  }

  return items;
}

/* --------------------------- SOCIÁLNE SIETE ---------------------------- */

function socialChecks({ L, doc }) {
  const { items, add } = checklist();
  const og = (k) => doc.meta('og:' + k);
  const tw = (k) => doc.meta('twitter:' + k);

  add('og:title', L('Open Graph titulok', 'Open Graph title'), og('title') ? PASS : FAIL, { weight: 3, value: og('title') ? L('Áno', 'Yes') : L('Chýba', 'Missing'), detail: og('title') || L('Titulok pri zdieľaní na Facebooku, LinkedIne, …', 'The title shown when shared on Facebook, LinkedIn, …'), fix: L('Pridaj <meta property="og:title" content="…">.', 'Add <meta property="og:title" content="…">.') });
  add('og:description', L('Open Graph popis', 'Open Graph description'), og('description') ? PASS : WARN, { weight: 2, value: og('description') ? L('Áno', 'Yes') : L('Chýba', 'Missing'), detail: og('description') || '', fix: L('Pridaj <meta property="og:description" content="…">.', 'Add <meta property="og:description" content="…">.') });
  add('og:image', L('Open Graph obrázok', 'Open Graph image'), og('image') ? PASS : FAIL, { weight: 3, value: og('image') ? L('Áno', 'Yes') : L('Chýba', 'Missing'), detail: og('image') || L('Bez obrázka vyzerá zdieľaný odkaz nevýrazne.', 'Without an image, shared links look bland.'), fix: L('Pridaj og:image s obrázkom 1200×630 px.', 'Add an og:image of 1200×630 px.') });
  add('og:url', 'Open Graph URL', og('url') ? PASS : WARN, { weight: 1, value: og('url') ? L('Áno', 'Yes') : L('Chýba', 'Missing'), detail: og('url') || '', fix: L('Pridaj <meta property="og:url"> s kanonickou adresou.', 'Add <meta property="og:url"> with the canonical URL.') });
  add('og:type', L('Open Graph typ', 'Open Graph type'), og('type') ? PASS : WARN, { weight: 0.5, value: og('type') || L('Chýba', 'Missing'), fix: L('Pridaj <meta property="og:type" content="website">.', 'Add <meta property="og:type" content="website">.') });
  add('twitter:card', 'X / Twitter Card', tw('card') ? PASS : WARN, { weight: 1.5, value: tw('card') || L('Chýba', 'Missing'), detail: L('Určuje vzhľad náhľadu na sieti X.', 'Controls how the preview looks on X.'), fix: L('Pridaj <meta name="twitter:card" content="summary_large_image">.', 'Add <meta name="twitter:card" content="summary_large_image">.') });

  const themeColor = doc.meta('theme-color');
  add('theme', L('Farba témy (theme-color)', 'Theme color (theme-color)'), themeColor ? PASS : INFO, { value: themeColor || L('Nenastavená', 'Not set'), detail: L('Farbí lištu prehliadača na mobiloch.', 'Colours the browser bar on mobile.') });

  const manifest = doc.links('manifest').length;
  add('manifest', 'Web App Manifest', manifest ? PASS : INFO, { value: manifest ? L('Áno', 'Yes') : L('Nie', 'No'), detail: L('Umožňuje pridať web na plochu ako aplikáciu (PWA).', 'Lets users add the site to their home screen as an app (PWA).') });

  return items;
}

module.exports = { analyze };
