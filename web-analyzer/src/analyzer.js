'use strict';

const { request, tryRequest, normalizeUrl, getCertificate } = require('./fetcher');
const { Doc, toText } = require('./html');
const { detectTech } = require('./tech');

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

async function analyze(input) {
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

  const ctx = { main, final, html, doc, h, ctype, robots, sitemap, securityTxt, httpRes, notFound, cert };

  const security = securityChecks(ctx);
  const seo = seoChecks(ctx);
  const performance = performanceChecks(ctx);
  const accessibility = a11yChecks(ctx);
  const social = socialChecks(ctx);

  const categories = {
    security: { title: 'Bezpečnosť', checks: security, score: score(security) },
    seo: { title: 'SEO', checks: seo, score: score(seo) },
    performance: { title: 'Výkon', checks: performance, score: score(performance) },
    accessibility: { title: 'Prístupnosť', checks: accessibility, score: score(accessibility) },
    social: { title: 'Sociálne siete', checks: social, score: score(social) },
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

function securityChecks({ main, final, doc, h, httpRes, cert, securityTxt, notFound }) {
  const { items, add } = checklist();
  const https = final.protocol === 'https:';

  add('https', 'HTTPS šifrovanie', https ? PASS : FAIL, {
    weight: 5,
    value: https ? 'Áno' : 'Nie',
    detail: https ? 'Stránka sa načítava cez zabezpečené spojenie.' : 'Stránka beží na nezabezpečenom HTTP.',
    fix: 'Nasaď TLS certifikát (napr. zadarmo cez Let’s Encrypt) a presmeruj všetku prevádzku na HTTPS.',
  });

  if (https) {
    const redirects = httpRes && httpRes.url.startsWith('https://');
    add('http-redirect', 'Presmerovanie HTTP → HTTPS', httpRes ? (redirects ? PASS : FAIL) : WARN, {
      weight: 3,
      value: httpRes ? (redirects ? 'Áno' : 'Nie') : 'Neoverené',
      detail: httpRes ? (redirects ? 'Verzia cez HTTP automaticky presmeruje na HTTPS.' : 'HTTP verzia stránky ostáva nešifrovaná.') : 'HTTP verziu sa nepodarilo načítať.',
      fix: 'Nastav na serveri trvalé (301) presmerovanie z http:// na https://.',
    });
  }

  if (cert) {
    const st = !cert.authorized ? FAIL : cert.daysLeft < 0 ? FAIL : cert.daysLeft < 14 ? WARN : PASS;
    add('cert', 'SSL certifikát', st, {
      weight: 4,
      value: cert.daysLeft < 0 ? 'Expirovaný' : `${cert.daysLeft} dní`,
      detail: cert.authorized
        ? `Vydal ${cert.issuer || 'neznámy'}, platný do ${new Date(cert.validTo).toLocaleDateString('sk-SK')}. Protokol ${cert.protocol || '?'}.`
        : `Certifikát nie je dôveryhodný: ${cert.authError || 'neznáma chyba'}.`,
      fix: 'Obnov alebo oprav SSL certifikát a zapni automatické obnovovanie.',
    });
    if (cert.protocol) {
      const old = /TLSv1(\.0|\.1)?$/.test(cert.protocol);
      add('tls', 'Verzia TLS', old ? FAIL : PASS, {
        weight: 2,
        value: cert.protocol,
        detail: old ? 'Zastaraný protokol so známymi slabinami.' : 'Moderná verzia protokolu.',
        fix: 'Vypni TLS 1.0/1.1 a povoľ TLS 1.2 a 1.3.',
      });
    }
  } else if (https) {
    add('cert', 'SSL certifikát', INFO, { value: 'Neoverené', detail: 'Detaily certifikátu sa nepodarilo získať priamym TLS spojením.' });
  }

  const hsts = h.get('strict-transport-security');
  const maxAge = Number((/max-age=(\d+)/i.exec(hsts || '') || [])[1] || 0);
  add('hsts', 'HSTS (Strict-Transport-Security)', !hsts ? FAIL : maxAge < 15552000 ? WARN : PASS, {
    weight: 3,
    value: hsts ? `max-age ${Math.round(maxAge / 86400)} dní` : 'Chýba',
    detail: hsts ? hsts : 'Prehliadač nemá pokyn vynútiť HTTPS pri ďalších návštevách.',
    fix: 'Pridaj hlavičku Strict-Transport-Security: max-age=31536000; includeSubDomains',
  });

  const csp = h.get('content-security-policy');
  const cspMeta = doc.meta('content-security-policy');
  const cspVal = csp || cspMeta;
  const weakCsp = cspVal && /'unsafe-inline'|'unsafe-eval'|\*/.test(cspVal) && !/'nonce-|'strict-dynamic'/.test(cspVal);
  add('csp', 'Content-Security-Policy', !cspVal ? FAIL : weakCsp ? WARN : PASS, {
    weight: 3,
    value: !cspVal ? 'Chýba' : weakCsp ? 'Slabá' : 'Nastavená',
    detail: cspVal ? cspVal.slice(0, 220) : 'CSP výrazne znižuje riziko XSS útokov.',
    fix: 'Definuj Content-Security-Policy, ktorá povolí len dôveryhodné zdroje skriptov a štýlov (bez unsafe-inline).',
  });

  const xfo = h.get('x-frame-options');
  const fa = /frame-ancestors/i.test(csp || '');
  add('xfo', 'Ochrana proti clickjackingu', xfo || fa ? PASS : FAIL, {
    weight: 2,
    value: xfo ? xfo : fa ? 'CSP frame-ancestors' : 'Chýba',
    detail: 'Bráni vloženiu stránky do cudzieho <iframe>.',
    fix: 'Pridaj X-Frame-Options: SAMEORIGIN alebo CSP direktívu frame-ancestors \'self\'.',
  });

  const xcto = (h.get('x-content-type-options') || '').toLowerCase();
  add('xcto', 'X-Content-Type-Options', xcto === 'nosniff' ? PASS : FAIL, {
    weight: 1.5,
    value: xcto || 'Chýba',
    detail: 'Zabraňuje prehliadaču hádať MIME typ súborov.',
    fix: 'Pridaj hlavičku X-Content-Type-Options: nosniff',
  });

  const rp = h.get('referrer-policy');
  add('referrer', 'Referrer-Policy', rp ? (/unsafe-url/.test(rp) ? WARN : PASS) : WARN, {
    weight: 1,
    value: rp || 'Chýba',
    detail: 'Určuje, koľko informácií o URL sa posiela iným webom.',
    fix: 'Pridaj Referrer-Policy: strict-origin-when-cross-origin',
  });

  const pp = h.get('permissions-policy');
  add('permissions', 'Permissions-Policy', pp ? PASS : WARN, {
    weight: 1,
    value: pp ? 'Nastavená' : 'Chýba',
    detail: 'Obmedzuje prístup k API ako kamera, mikrofón či geolokácia.',
    fix: 'Pridaj Permissions-Policy, napr. camera=(), microphone=(), geolocation=()',
  });

  const coop = h.get('cross-origin-opener-policy');
  add('coop', 'Cross-Origin-Opener-Policy', coop ? PASS : INFO, {
    weight: 0.5,
    value: coop || 'Chýba',
    detail: 'Izoluje okno stránky od cudzích okien (ochrana pred XS-Leaks).',
  });

  const server = h.get('server') || '';
  const powered = h.get('x-powered-by') || h.get('x-aspnet-version') || '';
  const leaks = /\d/.test(server) || powered;
  add('disclosure', 'Únik informácií o serveri', leaks ? WARN : PASS, {
    weight: 1,
    value: [server, powered].filter(Boolean).join(' · ') || 'Skryté',
    detail: leaks ? 'Hlavičky prezrádzajú softvér alebo jeho verziu, čo uľahčuje cielené útoky.' : 'Server neprezrádza verziu softvéru.',
    fix: 'Skry verziu servera (napr. server_tokens off v nginx) a odstráň hlavičku X-Powered-By.',
  });

  // Cookies
  const cookies = main.setCookies || [];
  if (cookies.length) {
    const bad = cookies.filter((c) => (https && !/;\s*secure/i.test(c)) || !/;\s*httponly/i.test(c) || !/;\s*samesite/i.test(c));
    add('cookies', 'Zabezpečenie cookies', bad.length === 0 ? PASS : bad.length === cookies.length ? FAIL : WARN, {
      weight: 2,
      value: `${cookies.length - bad.length}/${cookies.length} v poriadku`,
      detail: bad.length ? `Chýbajúce príznaky pri: ${bad.map((c) => c.split('=')[0]).slice(0, 5).join(', ')}` : 'Všetky cookies majú Secure, HttpOnly a SameSite.',
      fix: 'Nastav cookies s príznakmi Secure; HttpOnly; SameSite=Lax (alebo Strict).',
    });
  } else {
    add('cookies', 'Zabezpečenie cookies', INFO, { value: 'Žiadne', detail: 'Pri prvej návšteve server nenastavil žiadne cookies.' });
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
    add('mixed', 'Zmiešaný obsah (HTTP na HTTPS)', mixed.length ? FAIL : PASS, {
      weight: 2,
      value: mixed.length ? `${mixed.length} zdrojov` : 'Žiadny',
      detail: mixed.length ? mixed.slice(0, 3).join(', ') : 'Všetky zdroje sa načítavajú bezpečne.',
      fix: 'Zmeň odkazy na zdroje z http:// na https://.',
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
      value: `${ext.length - noSri.length}/${ext.length} s integrity`,
      detail: 'SRI chráni pred podvrhnutím externých skriptov (napr. z CDN).',
      fix: 'Pre statické skripty z CDN pridaj atribút integrity="sha384-…" a crossorigin="anonymous".',
    });
  }

  const sec = securityTxt && securityTxt.status === 200 && /contact:/i.test(securityTxt.body.toString('utf8'));
  add('securitytxt', 'security.txt', sec ? PASS : INFO, {
    weight: 0.5,
    value: sec ? 'Nájdený' : 'Chýba',
    detail: 'Súbor /.well-known/security.txt hovorí výskumníkom, kam hlásiť zraniteľnosti.',
  });

  if (notFound) {
    add('soft404', 'Správny kód pre neexistujúce stránky', notFound.status === 404 || notFound.status === 410 ? PASS : WARN, {
      weight: 1,
      value: `HTTP ${notFound.status}`,
      detail: notFound.status === 404 ? 'Neexistujúce URL vracajú 404.' : 'Neexistujúce URL nevracajú 404 („soft 404“), čo mätie vyhľadávače aj skenery.',
      fix: 'Zabezpeč, aby neexistujúce stránky vracali HTTP status 404.',
    });
  }

  return items;
}

/* ------------------------------- SEO ----------------------------------- */

function seoChecks({ main, final, doc, ctype, robots, sitemap }) {
  const { items, add } = checklist();

  add('status', 'HTTP status', main.status === 200 ? PASS : main.status < 400 ? WARN : FAIL, {
    weight: 3,
    value: String(main.status),
    detail: main.status === 200 ? 'Stránka odpovedá korektne.' : 'Stránka nevracia status 200.',
    fix: 'Zabezpeč, aby hlavná stránka vracala HTTP 200.',
  });

  const title = toText(doc.first('title', { inner: true })?.inner || '');
  add('title', 'Titulok stránky (title)', !title ? FAIL : title.length < 10 || title.length > 65 ? WARN : PASS, {
    weight: 4,
    value: title ? `${title.length} znakov` : 'Chýba',
    detail: title || 'Stránka nemá element <title>.',
    fix: 'Napíš jedinečný titulok s dĺžkou 10–60 znakov s hlavným kľúčovým slovom na začiatku.',
  });

  const desc = doc.meta('description');
  add('description', 'Meta popis (description)', !desc ? FAIL : desc.length < 50 || desc.length > 165 ? WARN : PASS, {
    weight: 3,
    value: desc ? `${desc.length} znakov` : 'Chýba',
    detail: desc || 'Vyhľadávač si popis vytvorí sám z obsahu stránky.',
    fix: 'Pridaj <meta name="description"> s výstižným popisom dlhým 50–160 znakov.',
  });

  const h1s = doc.all('h1', { inner: true }).map((x) => toText(x.inner)).filter(Boolean);
  add('h1', 'Nadpis H1', h1s.length === 1 ? PASS : h1s.length === 0 ? FAIL : WARN, {
    weight: 3,
    value: `${h1s.length}×`,
    detail: h1s.length ? h1s.slice(0, 3).join(' | ').slice(0, 200) : 'Stránka nemá hlavný nadpis H1.',
    fix: h1s.length ? 'Používaj na stránke práve jeden nadpis H1.' : 'Pridaj jeden nadpis H1 popisujúci obsah stránky.',
  });

  const levels = [];
  doc.clean.replace(/<h([1-6])\b/gi, (_, l) => levels.push(Number(l)));
  let skips = 0;
  for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) skips++;
  add('headings', 'Hierarchia nadpisov', levels.length === 0 ? WARN : skips ? WARN : PASS, {
    weight: 1,
    value: `${levels.length} nadpisov`,
    detail: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((t, i) => `${t.toUpperCase()}: ${levels.filter((l) => l === i + 1).length}`).join(' · ') + (skips ? ` · ${skips} preskočených úrovní` : ''),
    fix: 'Nadpisy používaj v logickom poradí (H1 → H2 → H3) bez preskakovania úrovní.',
  });

  const canonical = doc.links('canonical')[0]?.attrs.href;
  add('canonical', 'Kanonická URL', canonical ? PASS : WARN, {
    weight: 2,
    value: canonical ? 'Nastavená' : 'Chýba',
    detail: canonical || 'Bez canonical môžu vznikať duplicity obsahu.',
    fix: 'Pridaj <link rel="canonical" href="…"> s preferovanou URL stránky.',
  });

  const lang = doc.htmlAttrs().lang;
  add('lang', 'Jazyk stránky', lang ? PASS : WARN, {
    weight: 1.5,
    value: lang || 'Chýba',
    detail: 'Atribút lang na elemente <html> pomáha vyhľadávačom aj čítačkám.',
    fix: 'Doplň atribút lang, napr. <html lang="sk">.',
  });

  const viewport = doc.meta('viewport');
  add('viewport', 'Mobilná optimalizácia (viewport)', viewport && /width=device-width/.test(viewport) ? PASS : FAIL, {
    weight: 3,
    value: viewport ? 'Áno' : 'Chýba',
    detail: viewport || 'Bez viewportu sa stránka na mobiloch zobrazí zmenšená.',
    fix: 'Pridaj <meta name="viewport" content="width=device-width, initial-scale=1">.',
  });

  const robotsMeta = (doc.meta('robots') || '').toLowerCase();
  const xRobots = (main.headers.get('x-robots-tag') || '').toLowerCase();
  const noindex = /noindex/.test(robotsMeta + xRobots);
  add('indexable', 'Indexovateľnosť', noindex ? FAIL : PASS, {
    weight: 4,
    value: noindex ? 'noindex' : 'Povolená',
    detail: noindex ? 'Stránka zakazuje vyhľadávačom indexovanie.' : 'Vyhľadávače môžu stránku indexovať.',
    fix: 'Odstráň noindex z meta robots / X-Robots-Tag, ak má byť stránka vo vyhľadávaní.',
  });

  const robotsOk = robots && robots.status === 200 && !/text\/html/i.test(robots.headers.get('content-type') || '');
  const robotsTxt = robotsOk ? robots.body.toString('utf8') : '';
  const blocksAll = /user-agent:\s*\*[\s\S]*?^\s*disallow:\s*\/\s*$/im.test(robotsTxt);
  add('robots', 'robots.txt', !robotsOk ? WARN : blocksAll ? FAIL : PASS, {
    weight: 2,
    value: robotsOk ? (blocksAll ? 'Blokuje všetko' : 'Nájdený') : 'Chýba',
    detail: robotsOk ? robotsTxt.split('\n').slice(0, 4).join(' · ').slice(0, 200) : 'Súbor /robots.txt sa nenašiel.',
    fix: blocksAll ? 'robots.txt blokuje celý web (Disallow: /). Over, či je to zámer.' : 'Vytvor /robots.txt s pravidlami pre roboty a odkazom na sitemap.',
  });

  const smInRobots = (/^\s*sitemap:\s*(\S+)/im.exec(robotsTxt) || [])[1];
  const smOk = (sitemap && sitemap.status === 200 && /<(urlset|sitemapindex)/i.test(sitemap.body.toString('utf8'))) || !!smInRobots;
  add('sitemap', 'XML Sitemap', smOk ? PASS : WARN, {
    weight: 2,
    value: smOk ? 'Nájdená' : 'Chýba',
    detail: smInRobots ? `Uvedená v robots.txt: ${smInRobots}` : smOk ? '/sitemap.xml' : 'Sitemap pomáha vyhľadávačom nájsť všetky stránky.',
    fix: 'Vygeneruj /sitemap.xml a uveď ju v robots.txt (Sitemap: https://…/sitemap.xml).',
  });

  const imgs = doc.all('img');
  const noAlt = imgs.filter((i) => i.attrs.alt === undefined);
  add('alt', 'Alternatívne texty obrázkov', imgs.length === 0 ? INFO : noAlt.length === 0 ? PASS : noAlt.length / imgs.length > 0.3 ? FAIL : WARN, {
    weight: 2,
    value: imgs.length ? `${imgs.length - noAlt.length}/${imgs.length}` : 'Bez obrázkov',
    detail: noAlt.length ? `${noAlt.length} obrázkov nemá atribút alt.` : 'Všetky obrázky majú alt.',
    fix: 'Doplň každému obrázku atribút alt s popisom (dekoratívnym alt="").',
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
  add('schema', 'Štruktúrované dáta', jsonLd.length || microdata ? PASS : WARN, {
    weight: 1.5,
    value: types.size ? [...types].slice(0, 4).join(', ') : microdata ? 'Microdata' : 'Chýbajú',
    detail: 'Schema.org dáta umožňujú rozšírené výsledky vo vyhľadávaní (hviezdičky, FAQ, …).',
    fix: 'Pridaj JSON-LD so Schema.org (Organization, WebSite, Article, Product…).',
  });

  const words = doc.text().split(/\s+/).filter((w) => w.length > 1).length;
  add('content', 'Množstvo textu', words >= 300 ? PASS : words >= 100 ? WARN : FAIL, {
    weight: 1.5,
    value: `${words} slov`,
    detail: words < 100 ? 'Málo textu – vyhľadávače nemajú čo indexovať (alebo sa obsah generuje JavaScriptom).' : 'Dostatočné množstvo obsahu.',
    fix: 'Rozšír textový obsah stránky (ideálne 300+ slov) alebo zvaž server-side rendering.',
  });

  const pathLen = final.pathname.length + final.search.length;
  add('url', 'Čitateľná URL', pathLen > 100 || /[A-Z_]/.test(final.pathname) || final.search.length > 50 ? WARN : PASS, {
    weight: 0.5,
    value: `${final.href.length} znakov`,
    detail: final.href,
    fix: 'Používaj krátke URL s malými písmenami a pomlčkami.',
  });

  const favicon = doc.links('icon').length || doc.links('shortcut').length || doc.links('apple-touch-icon').length;
  add('favicon', 'Favicon', favicon ? PASS : WARN, {
    weight: 0.5,
    value: favicon ? 'Áno' : 'Nenájdený v HTML',
    detail: 'Ikona sa zobrazuje v záložkách aj vo výsledkoch vyhľadávania.',
    fix: 'Pridaj <link rel="icon" href="/favicon.svg">.',
  });

  const hreflang = doc.links('alternate').filter((l) => l.attrs.hreflang);
  add('hreflang', 'Jazykové verzie (hreflang)', hreflang.length ? PASS : INFO, {
    value: hreflang.length ? hreflang.map((l) => l.attrs.hreflang).slice(0, 6).join(', ') : 'Nepoužité',
    detail: 'Relevantné len pre viacjazyčné weby.',
  });

  if (!/html/.test(ctype)) {
    add('ctype', 'Typ obsahu', WARN, { weight: 1, value: ctype || '?', detail: 'Odpoveď nie je HTML dokument.', fix: 'Over, či URL vedie na HTML stránku.' });
  }
  return items;
}

/* ------------------------------ VÝKON ---------------------------------- */

function performanceChecks({ main, html, doc, h }) {
  const { items, add } = checklist();

  add('ttfb', 'Čas odozvy servera (TTFB)', main.ttfb < 600 ? PASS : main.ttfb < 1500 ? WARN : FAIL, {
    weight: 4,
    value: ms(main.ttfb),
    detail: 'Čas do prijatia prvej odpovede (merané z nášho servera, vrátane DNS a TLS).',
    fix: 'Zrýchli server: cache na strane servera, CDN, optimalizácia databázových dopytov.',
  });

  add('total', 'Celkový čas načítania HTML', main.total < 1500 ? PASS : main.total < 3500 ? WARN : FAIL, {
    weight: 2,
    value: ms(main.total),
    detail: main.chain.length ? `Vrátane ${main.chain.length} presmerovaní.` : 'Bez presmerovaní.',
    fix: 'Skráť cestu k obsahu – menej presmerovaní, rýchlejší hosting, CDN.',
  });

  const size = Buffer.byteLength(html);
  add('size', 'Veľkosť HTML', size < 100 * 1024 ? PASS : size < 500 * 1024 ? WARN : FAIL, {
    weight: 2,
    value: fmtBytes(size) + (main.truncated ? '+' : ''),
    detail: 'Nekomprimovaná veľkosť HTML dokumentu.',
    fix: 'Zmenši HTML – odstráň inline dáta, nepoužité časti a veľké vložené SVG/štýly.',
  });

  const enc = h.get('content-encoding');
  add('compression', 'Kompresia (gzip / brotli)', enc && /br|gzip|zstd|deflate/.test(enc) ? PASS : size < 1500 ? INFO : FAIL, {
    weight: 3,
    value: enc || 'Žiadna',
    detail: enc ? 'Odpoveď je komprimovaná.' : 'Text sa prenáša nekomprimovaný.',
    fix: 'Zapni na serveri Brotli alebo gzip kompresiu pre text/html, CSS a JS.',
  });

  add('redirects', 'Počet presmerovaní', main.chain.length === 0 ? PASS : main.chain.length === 1 ? PASS : main.chain.length <= 2 ? WARN : FAIL, {
    weight: 1.5,
    value: String(main.chain.length),
    detail: main.chain.map((c) => `${c.status} ${c.url}`).join(' → ') || 'Žiadne.',
    fix: 'Odkazuj priamo na finálnu URL a zlúč reťaz presmerovaní do jedného kroku.',
  });

  const cc = h.get('cache-control');
  add('cache', 'Cache hlavičky', cc || h.get('etag') || h.get('last-modified') ? PASS : WARN, {
    weight: 1,
    value: cc || (h.get('etag') ? 'ETag' : 'Chýba'),
    detail: 'Umožňuje prehliadačom a CDN znovu použiť stiahnutý obsah.',
    fix: 'Nastav Cache-Control (a ETag) – pre statické súbory dlhú platnosť s verzovaním v názve.',
  });

  const head = doc.head();
  const blocking = [];
  head.replace(/<script\b([^>]*)>/gi, (m, a) => {
    if (/\bsrc=/i.test(a) && !/\b(async|defer)\b/i.test(a) && !/type=["']?module/i.test(a)) blocking.push(a);
    return m;
  });
  add('blocking', 'Blokujúce skripty v <head>', blocking.length === 0 ? PASS : blocking.length <= 2 ? WARN : FAIL, {
    weight: 2,
    value: String(blocking.length),
    detail: blocking.length ? 'Tieto skripty zastavia vykresľovanie, kým sa nestiahnu.' : 'Žiadne skripty neblokujú vykresľovanie.',
    fix: 'Pridaj skriptom atribút defer alebo async, prípadne ich presuň na koniec <body>.',
  });

  const scripts = doc.all('script', { source: 'raw' }).filter((s) => s.attrs.src).length;
  const css = doc.links('stylesheet').length;
  const req = scripts + css;
  add('requests', 'Externé JS a CSS súbory', req <= 15 ? PASS : req <= 35 ? WARN : FAIL, {
    weight: 1.5,
    value: `${scripts} JS · ${css} CSS`,
    detail: 'Každý súbor je samostatná požiadavka, ktorú musí prehliadač spracovať.',
    fix: 'Zlúč a minifikuj súbory, odstráň nepoužívané knižnice.',
  });

  const inlineBytes = doc.all('script', { inner: true, source: 'raw' }).reduce((s, x) => s + (x.attrs.src ? 0 : x.inner.length), 0)
    + doc.all('style', { inner: true, source: 'raw' }).reduce((s, x) => s + x.inner.length, 0);
  add('inline', 'Inline skripty a štýly', inlineBytes < 50 * 1024 ? PASS : inlineBytes < 200 * 1024 ? WARN : FAIL, {
    weight: 1,
    value: fmtBytes(inlineBytes),
    detail: 'Veľké inline bloky sa nedajú cachovať a zväčšujú HTML.',
    fix: 'Presuň veľké inline skripty a štýly do externých cachovateľných súborov.',
  });

  const imgs = doc.all('img');
  if (imgs.length > 3) {
    const lazy = imgs.filter((i) => i.attrs.loading === 'lazy' || i.attrs['data-src'] || i.attrs['data-lazy-src']).length;
    add('lazy', 'Lazy loading obrázkov', lazy >= imgs.length / 3 ? PASS : lazy ? WARN : WARN, {
      weight: 1,
      value: `${lazy}/${imgs.length}`,
      detail: 'Obrázky mimo obrazovky sa môžu načítať až pri skrolovaní.',
      fix: 'Pridaj obrázkom pod zlomom atribút loading="lazy".',
    });
    const dims = imgs.filter((i) => i.attrs.width && i.attrs.height).length;
    add('dimensions', 'Rozmery obrázkov', dims >= imgs.length * 0.7 ? PASS : WARN, {
      weight: 1,
      value: `${dims}/${imgs.length}`,
      detail: 'Uvedené width/height zabraňujú poskakovaniu layoutu (CLS).',
      fix: 'Doplň obrázkom atribúty width a height.',
    });
    const modern = imgs.filter((i) => /\.(webp|avif)(\?|$)/i.test(i.attrs.src || '')).length + doc.all('source').filter((s) => /webp|avif/i.test(s.attrs.type || s.attrs.srcset || '')).length;
    add('formats', 'Moderné formáty obrázkov', modern ? PASS : INFO, {
      weight: 1,
      value: modern ? `${modern}× WebP/AVIF` : 'Nezistené',
      detail: 'WebP a AVIF bývajú o 25–50 % menšie ako JPEG/PNG.',
      fix: 'Konvertuj obrázky do formátu WebP alebo AVIF.',
    });
  }

  const preconnect = doc.links('preconnect').length + doc.links('dns-prefetch').length + doc.links('preload').length;
  add('hints', 'Resource hints (preload / preconnect)', preconnect ? PASS : INFO, {
    weight: 0.5,
    value: preconnect ? `${preconnect}×` : 'Nepoužité',
    detail: 'Pomáhajú prehliadaču skôr nadviazať spojenie s dôležitými zdrojmi.',
  });

  return items;
}

/* ---------------------------- PRÍSTUPNOSŤ ------------------------------ */

function a11yChecks({ doc }) {
  const { items, add } = checklist();

  const lang = doc.htmlAttrs().lang;
  add('lang', 'Jazyk dokumentu', lang ? PASS : FAIL, {
    weight: 3, value: lang || 'Chýba',
    detail: 'Čítačky obrazovky podľa neho volia výslovnosť.',
    fix: 'Pridaj atribút lang na <html>.',
  });

  const title = toText(doc.first('title', { inner: true })?.inner || '');
  add('title', 'Titulok dokumentu', title ? PASS : FAIL, { weight: 2, value: title ? 'Áno' : 'Chýba', detail: 'Titulok pomáha orientácii medzi kartami.', fix: 'Pridaj element <title>.' });

  const imgs = doc.all('img');
  const noAlt = imgs.filter((i) => i.attrs.alt === undefined).length;
  add('alt', 'Obrázky s alt textom', imgs.length === 0 ? INFO : noAlt === 0 ? PASS : noAlt / imgs.length > 0.3 ? FAIL : WARN, {
    weight: 3, value: imgs.length ? `${imgs.length - noAlt}/${imgs.length}` : '—',
    detail: 'Nevidiaci používatelia sa o obrázkoch dozvedia len z alt textu.',
    fix: 'Doplň obrázkom atribút alt.',
  });

  const viewport = doc.meta('viewport') || '';
  const noZoom = /user-scalable\s*=\s*(no|0)/i.test(viewport) || /maximum-scale\s*=\s*1(\.0)?\b/i.test(viewport);
  add('zoom', 'Povolené priblíženie', noZoom ? FAIL : PASS, {
    weight: 2, value: noZoom ? 'Zakázané' : 'Povolené',
    detail: noZoom ? 'Viewport bráni používateľom zväčšiť text.' : 'Používatelia si môžu stránku priblížiť.',
    fix: 'Odstráň z viewportu user-scalable=no a maximum-scale=1.',
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
    add('labels', 'Popisy formulárových polí', bad === 0 ? PASS : bad / inputs.length > 0.3 ? FAIL : WARN, {
      weight: 2, value: `${inputs.length - bad}/${inputs.length}`,
      detail: 'Každé pole formulára potrebuje priradený <label> alebo aria-label.',
      fix: 'Prepoj polia s <label for="id"> alebo doplň aria-label.',
    });
  }

  const buttons = doc.all('button', { inner: true });
  const emptyBtn = buttons.filter((b) => !toText(b.inner) && !b.attrs['aria-label'] && !b.attrs.title && !/alt=["'][^"']+/.test(b.inner)).length;
  const links = doc.all('a', { inner: true });
  const emptyLinks = links.filter((a) => a.attrs.href && !toText(a.inner) && !a.attrs['aria-label'] && !a.attrs.title && !/alt=["'][^"']+|aria-label/.test(a.inner)).length;
  const emptyTotal = emptyBtn + emptyLinks;
  add('names', 'Odkazy a tlačidlá s textom', emptyTotal === 0 ? PASS : emptyTotal <= 3 ? WARN : FAIL, {
    weight: 2, value: emptyTotal ? `${emptyTotal} bez textu` : 'V poriadku',
    detail: `${emptyLinks} odkazov a ${emptyBtn} tlačidiel nemá čitateľný názov.`,
    fix: 'Ikonovým odkazom a tlačidlám doplň aria-label alebo skrytý text.',
  });

  const generic = links.filter((a) => /^(klikni|klik|tu|viac|čítaj viac|click here|here|more|read more)$/i.test(toText(a.inner))).length;
  add('linktext', 'Popisné texty odkazov', generic === 0 ? PASS : WARN, {
    weight: 1, value: generic ? `${generic} všeobecných` : 'V poriadku',
    detail: 'Texty ako „klikni tu“ nedávajú zmysel mimo kontextu.',
    fix: 'Používaj odkazové texty, ktoré popisujú cieľ (napr. „Cenník služieb“).',
  });

  const landmarks = ['main', 'nav', 'header', 'footer'].filter((t) => new RegExp(`<${t}\\b|role=["']${t === 'main' ? 'main' : t === 'nav' ? 'navigation' : t === 'header' ? 'banner' : 'contentinfo'}`, 'i').test(doc.clean));
  add('landmarks', 'Sémantické oblasti (landmarks)', landmarks.includes('main') && landmarks.length >= 3 ? PASS : landmarks.length ? WARN : FAIL, {
    weight: 1.5, value: landmarks.length ? landmarks.join(', ') : 'Žiadne',
    detail: 'Elementy <main>, <nav>, <header>, <footer> uľahčujú navigáciu čítačkám.',
    fix: 'Obal hlavný obsah do <main> a použi <header>, <nav>, <footer>.',
  });

  const skip = /<a\b[^>]*href=["']#(main|content|obsah|skip)[^"']*["']/i.test(doc.clean);
  add('skiplink', 'Odkaz „Preskočiť na obsah“', skip ? PASS : INFO, {
    weight: 0.5, value: skip ? 'Áno' : 'Nenájdený',
    detail: 'Umožňuje používateľom klávesnice preskočiť navigáciu.',
  });

  const tabindex = (doc.clean.match(/tabindex=["']?[1-9]/gi) || []).length;
  add('tabindex', 'Poradie fokusu (tabindex)', tabindex ? WARN : PASS, {
    weight: 1, value: tabindex ? `${tabindex}× kladný tabindex` : 'V poriadku',
    detail: 'Kladný tabindex narúša prirodzené poradie navigácie klávesnicou.',
    fix: 'Nepoužívaj tabindex väčší ako 0.',
  });

  const iframes = doc.all('iframe');
  if (iframes.length) {
    const noTitle = iframes.filter((f) => !f.attrs.title).length;
    add('iframes', 'Titulky iframe', noTitle ? WARN : PASS, {
      weight: 1, value: `${iframes.length - noTitle}/${iframes.length}`,
      detail: 'Vložené rámce potrebujú atribút title.',
      fix: 'Doplň každému <iframe> atribút title.',
    });
  }

  return items;
}

/* --------------------------- SOCIÁLNE SIETE ---------------------------- */

function socialChecks({ doc }) {
  const { items, add } = checklist();
  const og = (k) => doc.meta('og:' + k);
  const tw = (k) => doc.meta('twitter:' + k);

  add('og:title', 'Open Graph titulok', og('title') ? PASS : FAIL, { weight: 3, value: og('title') ? 'Áno' : 'Chýba', detail: og('title') || 'Titulok pri zdieľaní na Facebooku, LinkedIne, …', fix: 'Pridaj <meta property="og:title" content="…">.' });
  add('og:description', 'Open Graph popis', og('description') ? PASS : WARN, { weight: 2, value: og('description') ? 'Áno' : 'Chýba', detail: og('description') || '', fix: 'Pridaj <meta property="og:description" content="…">.' });
  add('og:image', 'Open Graph obrázok', og('image') ? PASS : FAIL, { weight: 3, value: og('image') ? 'Áno' : 'Chýba', detail: og('image') || 'Bez obrázka vyzerá zdieľaný odkaz nevýrazne.', fix: 'Pridaj og:image s obrázkom 1200×630 px.' });
  add('og:url', 'Open Graph URL', og('url') ? PASS : WARN, { weight: 1, value: og('url') ? 'Áno' : 'Chýba', detail: og('url') || '', fix: 'Pridaj <meta property="og:url"> s kanonickou adresou.' });
  add('og:type', 'Open Graph typ', og('type') ? PASS : WARN, { weight: 0.5, value: og('type') || 'Chýba', fix: 'Pridaj <meta property="og:type" content="website">.' });
  add('twitter:card', 'X / Twitter Card', tw('card') ? PASS : WARN, { weight: 1.5, value: tw('card') || 'Chýba', detail: 'Určuje vzhľad náhľadu na sieti X.', fix: 'Pridaj <meta name="twitter:card" content="summary_large_image">.' });

  const themeColor = doc.meta('theme-color');
  add('theme', 'Farba témy (theme-color)', themeColor ? PASS : INFO, { value: themeColor || 'Nenastavená', detail: 'Farbí lištu prehliadača na mobiloch.' });

  const manifest = doc.links('manifest').length;
  add('manifest', 'Web App Manifest', manifest ? PASS : INFO, { value: manifest ? 'Áno' : 'Nie', detail: 'Umožňuje pridať web na plochu ako aplikáciu (PWA).' });

  return items;
}

module.exports = { analyze };
