// Generuje SEO značky, štruktúrované dáta, hlavičku, omrvinky, súvisiace odkazy, pätičku,
// sitemap.xml, robots.txt, manifest, 404 stránku a hlavičky pre hosting.
// Spustenie: node tools/build.js   (bezpečné spúšťať opakovane)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cfg = require('./site.config.js');

const root = path.join(__dirname, '..');
const D = cfg.domena.replace(/\/$/, '');
const ORG_ID = D + '/#organizacia';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const url = slug => D + '/' + (slug ? slug + '/' : '');
const cesta = slug => '/' + (slug ? slug + '/' : '');
const subor = slug => path.join(root, slug ? path.join(slug, 'index.html') : 'index.html');
const stranka = slug => cfg.stranky.find(s => s.slug === slug);
const datumSk = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d}. ${m}. ${y}`; };
const hash = f => crypto.createHash('md5').update(fs.readFileSync(path.join(root, f))).digest('hex').slice(0, 8);
const verzia = { 'assets/style.css': hash('assets/style.css'), 'assets/calc.js': hash('assets/calc.js') };
const ogObrazok = s => `${D}/assets/og/${s.slug || 'domov'}.jpg`;

function nahradBlok(html, meno, obsah) {
  const re = new RegExp(`<!-- ${meno}:START -->[\\s\\S]*?<!-- ${meno}:END -->`);
  if (!re.test(html)) throw new Error(`Chýba značka ${meno} v súbore`);
  return html.replace(re, `<!-- ${meno}:START -->\n${obsah}\n<!-- ${meno}:END -->`);
}

function jsonLd(s) {
  const org = {
    '@type': 'Organization', '@id': ORG_ID, name: cfg.nazov, url: url(''),
    logo: { '@type': 'ImageObject', url: D + '/assets/icons/icon-512.png', width: 512, height: 512 }
  };
  const omrvinky = {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Domov', item: url('') },
      { '@type': 'ListItem', position: 2, name: s.nazov, item: url(s.slug) }
    ]
  };
  const graf = [];
  if (s.typ === 'home') {
    graf.push(org, {
      '@type': 'WebSite', '@id': D + '/#web', name: cfg.nazov, url: url(''), inLanguage: 'sk-SK',
      description: cfg.popis, publisher: { '@id': ORG_ID }
    });
  } else if (s.typ === 'app') {
    graf.push({
      '@type': 'WebApplication', name: s.obrazok || s.nazov, url: url(s.slug), description: s.description,
      applicationCategory: 'FinanceApplication', operatingSystem: 'Všetky (webový prehliadač)', inLanguage: 'sk-SK',
      isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
      dateModified: cfg.aktualizovane, image: ogObrazok(s), publisher: { '@id': ORG_ID }
    }, omrvinky, org);
  } else if (s.typ === 'article') {
    graf.push({
      '@type': 'Article', headline: s.title, description: s.description, inLanguage: 'sk-SK',
      datePublished: s.publikovane || cfg.aktualizovane, dateModified: cfg.aktualizovane,
      image: ogObrazok(s), mainEntityOfPage: url(s.slug),
      author: { '@id': ORG_ID }, publisher: { '@id': ORG_ID }
    }, omrvinky, org);
  } else {
    graf.push({ '@type': 'WebPage', name: s.title, url: url(s.slug), inLanguage: 'sk-SK', dateModified: cfg.aktualizovane }, omrvinky);
  }
  return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graf })}</script>`;
}

function seo(s) {
  const titul = `${s.title} | ${cfg.nazov}`;
  const r = [
    `<title>${esc(titul)}</title>`,
    `<meta name="description" content="${esc(s.description)}">`,
    `<meta name="robots" content="${s.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}">`,
    `<link rel="canonical" href="${url(s.slug)}">`,
    `<link rel="alternate" hreflang="sk" href="${url(s.slug)}">`,
    `<meta name="theme-color" content="${cfg.farba}">`,
    `<meta property="og:locale" content="sk_SK">`,
    `<meta property="og:site_name" content="${esc(cfg.nazov)}">`,
    `<meta property="og:type" content="${s.typ === 'article' ? 'article' : 'website'}">`,
    `<meta property="og:title" content="${esc(s.title)}">`,
    `<meta property="og:description" content="${esc(s.description)}">`,
    `<meta property="og:url" content="${url(s.slug)}">`,
    `<meta property="og:image" content="${ogObrazok(s)}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(s.obrazok || s.title)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`,
    `<link rel="icon" href="/assets/icons/icon-48.png" type="image/png" sizes="48x48">`,
    `<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">`,
    `<link rel="manifest" href="/site.webmanifest">`,
    `<link rel="stylesheet" href="/assets/style.css?v=${verzia['assets/style.css']}">`
  ];
  if (s.typ === 'article') {
    r.push(`<meta property="article:published_time" content="${s.publikovane || cfg.aktualizovane}">`);
    r.push(`<meta property="article:modified_time" content="${cfg.aktualizovane}">`);
  }
  if (cfg.googleVerifikacia) r.push(`<meta name="google-site-verification" content="${esc(cfg.googleVerifikacia)}">`);
  if (cfg.bingVerifikacia) r.push(`<meta name="msvalidate.01" content="${esc(cfg.bingVerifikacia)}">`);
  if (cfg.adsenseClient && !s.noindex) {
    r.push(`<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.adsenseClient)}" crossorigin="anonymous"></script>`);
  }
  r.push(jsonLd(s));
  return r.join('\n');
}

function header(aktivna) {
  const odkazy = cfg.stranky.filter(s => s.menu).map(s =>
    `    <a href="${cesta(s.slug)}"${s.slug === aktivna ? ' aria-current="page"' : ''}>${esc(s.menuNazov || s.nazov)}</a>`).join('\n');
  return `<header class="site"><div class="wrap">
  <a class="logo" href="/" aria-label="${esc(cfg.nazov)} – domov">Spočítaj<span>Si</span></a>
  <nav class="main" aria-label="Hlavná navigácia">
${odkazy}
    <a href="/#vsetky">Všetky kalkulačky</a>
  </nav>
</div></header>`;
}

function footer() {
  const kalk = cfg.stranky.filter(s => s.slug && s.typ !== 'page').map(s => `    <a href="${cesta(s.slug)}">${esc(s.nazov)}</a>`).join('\n');
  return `<footer class="site"><div class="wrap">
  <nav class="links" aria-label="Všetky kalkulačky">
${kalk}
  </nav>
  <div class="links">
    <a href="/o-nas/">O nás a metodika</a>
    <a href="/ochrana-sukromia/">Ochrana súkromia</a>
  </div>
  <p>© 2026 ${esc(cfg.nazov)}. Výpočty sú orientačné a nenahrádzajú odborné daňové ani právne poradenstvo.</p>
</div></footer>`;
}

function omrvinky(s) {
  if (!s.slug) return '';
  return `<nav class="crumbs" aria-label="Omrvinky"><a href="/">Domov</a> <span aria-hidden="true">›</span> <span aria-current="page">${esc(s.nazov)}</span></nav>`;
}

function suvisiace(s) {
  if (s.noindex) return '';
  const casti = [];
  if (s.slug) {
    casti.push(`<p class="updated">Naposledy skontrolované a aktualizované: <time datetime="${cfg.aktualizovane}">${datumSk(cfg.aktualizovane)}</time></p>`);
  }
  if (s.suvisiace && s.suvisiace.length) {
    const karty = s.suvisiace.map(stranka).filter(Boolean).map(x =>
      `    <a class="card" href="${cesta(x.slug)}"><h3>${esc(x.nazov)}</h3><p>${esc(x.podtitul || x.description)}</p></a>`).join('\n');
    casti.push(`<section class="related" aria-labelledby="suvisiace"><h2 id="suvisiace">Súvisiace kalkulačky</h2>\n  <div class="cards">\n${karty}\n  </div>\n</section>`);
  }
  if (s.zdroje && s.zdroje.length && s.typ !== 'page') {
    const z = s.zdroje.map(k => cfg.zdroje[k]).map(x => `<li><a href="${x.url}" rel="noopener" target="_blank">${esc(x.nazov)}</a></li>`).join('');
    casti.push(`<section class="sources"><h2>Zdroje</h2><p>Výpočet vychádza z platných zákonov a údajov týchto inštitúcií. Podrobnosti nájdete v <a href="/o-nas/">metodike</a>.</p><ul>${z}</ul></section>`);
  }
  return casti.join('\n');
}

function domovskeKarty() {
  const karty = cfg.stranky.filter(s => s.slug && s.typ !== 'page').map(s =>
    `    <a class="card" href="${cesta(s.slug)}">${s.badge ? `\n      <span class="badge">${esc(s.badge)}</span>` : ''}
      <h2>${esc(s.obrazok || s.nazov)}</h2>
      <p>${esc(s.description)}</p>
    </a>`).join('\n');
  return `  <div class="cards" id="vsetky">\n${karty}\n  </div>`;
}

let pocet = 0;
for (const s of cfg.stranky) {
  const f = subor(s.slug);
  if (!fs.existsSync(f)) { console.warn('⚠️  chýba súbor pre stránku:', s.slug); continue; }
  let h = fs.readFileSync(f, 'utf8');
  h = nahradBlok(h, 'SEO', seo(s));
  h = nahradBlok(h, 'BREADCRUMB', omrvinky(s));
  h = nahradBlok(h, 'RELATED', suvisiace(s));
  if (!s.slug) h = nahradBlok(h, 'HOMECARDS', domovskeKarty());
  h = h.replace(/<header class="site">[\s\S]*?<\/header>/, header(s.slug));
  h = h.replace(/<footer class="site">[\s\S]*?<\/footer>/, footer());
  h = h.replace(/\/assets\/calc\.js(\?v=\w+)?/g, `/assets/calc.js?v=${verzia['assets/calc.js']}`);
  fs.writeFileSync(f, h);
  pocet++;
}

// 404
const s404 = { slug: '404', nazov: 'Stránka nenájdená', title: 'Stránka nenájdená', description: 'Hľadaná stránka neexistuje.', typ: 'page', noindex: true };
const odkazy404 = cfg.stranky.filter(s => s.slug && s.typ !== 'page').map(s => `<a class="card" href="${cesta(s.slug)}"><h3>${esc(s.nazov)}</h3></a>`).join('\n');
let h404 = `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${seo(s404).replace(/<link rel="canonical"[^>]*>\n|<link rel="alternate"[^>]*>\n|<script type="application\/ld\+json">.*<\/script>/g, '')}
</head>
<body>
${header('404')}
<main><div class="wrap">
  <h1>Stránka sa nenašla</h1>
  <p class="lead">Adresa je nesprávna alebo stránka už neexistuje. Skúste niektorú z kalkulačiek:</p>
  <div class="cards">
${odkazy404}
  </div>
</div></main>
${footer()}
</body>
</html>
`;
fs.writeFileSync(path.join(root, '404.html'), h404);

// sitemap.xml
const indexovane = cfg.stranky.filter(s => !s.noindex);
fs.writeFileSync(path.join(root, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexovane.map(s => `  <url><loc>${url(s.slug)}</loc><lastmod>${cfg.aktualizovane}</lastmod></url>`).join('\n')}
</urlset>
`);

// robots.txt
fs.writeFileSync(path.join(root, 'robots.txt'),
  `User-agent: *
Allow: /
Disallow: /tests/
Disallow: /tools/

Sitemap: ${D}/sitemap.xml
`);

// Web manifest
fs.writeFileSync(path.join(root, 'site.webmanifest'), JSON.stringify({
  name: `${cfg.nazov} – kalkulačky`, short_name: cfg.nazov, lang: 'sk', start_url: '/', display: 'standalone',
  background_color: '#ffffff', theme_color: cfg.farba,
  icons: [
    { src: '/assets/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/assets/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ]
}, null, 2) + '\n');

// Hlavičky (Cloudflare Pages aj Netlify čítajú súbor _headers)
fs.writeFileSync(path.join(root, '_headers'),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/tests/*
  X-Robots-Tag: noindex

/tools/*
  X-Robots-Tag: noindex
`);

// Presmerovania starých adries *.html na nové (Cloudflare Pages aj Netlify čítajú _redirects)
fs.writeFileSync(path.join(root, '_redirects'),
  cfg.stranky.filter(s => s.slug).map(s => `/${s.slug}.html /${s.slug}/ 301`).join('\n') + '\n');

console.log(`✓ ${pocet} stránok, 404, sitemap (${indexovane.length} adries), robots.txt, manifest, _headers, _redirects`);
