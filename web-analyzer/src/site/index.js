'use strict';

/* Web: lokalizované stránky, presmerovania, robots.txt, sitemap.xml, manifesty, 404. */

const { LANGS, ROUTES, REDIRECTS, matchRoute, routePath, L_ } = require('./i18n');
const { layout, SITE_NAME } = require('./layout');
const { send, entryFrom, serveStatic, assetUrl } = require('./static');

const PAGES = {
  home: require('./pages/home'),
  audit: require('./pages/audit'),
  terms: require('./pages/legal').terms,
  privacy: require('./pages/legal').privacy,
};
const notFoundPage = require('./pages/legal').notFound;

const NOINDEX_PARAMS = ['url', 'order', 'sub', 'token', 'canceled', 'session_id', 'fresh'];
const BUILD_DATE = new Date().toISOString().slice(0, 10);
const renderCache = new Map();

function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  const proto = process.env.TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${proto}://${req.headers.host || 'localhost'}`;
}

function render(id, lang, base, noindex, pageFn) {
  const key = `${id}|${lang}|${base}|${noindex}`;
  if (renderCache.has(key) && process.env.NODE_ENV !== 'development') return renderCache.get(key);
  const ctx = { id, lang, base, noindex };
  const html = layout(ctx, (pageFn || PAGES[id])(ctx));
  const entry = entryFrom(html, 'text/html; charset=utf-8');
  renderCache.set(key, entry);
  return entry;
}

function robotsTxt(base) {
  return `# ${SITE_NAME}
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin.html

Sitemap: ${base}/sitemap.xml
`;
}

function sitemapXml(base) {
  const urls = [];
  for (const id of Object.keys(ROUTES)) {
    for (const lang of LANGS) {
      urls.push(`  <url>
    <loc>${base}${ROUTES[id][lang]}</loc>
    <lastmod>${BUILD_DATE}</lastmod>
    <changefreq>${id === 'home' || id === 'audit' ? 'weekly' : 'yearly'}</changefreq>
    <priority>${id === 'home' ? '1.0' : id === 'audit' ? '0.9' : '0.3'}</priority>
${LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${base}${ROUTES[id][l]}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${base}${ROUTES[id].en}"/>
  </url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>
`;
}

function manifest(lang) {
  const L = L_(lang);
  return JSON.stringify({
    name: `${SITE_NAME} – ${L('analýza webu a audit prístupnosti', 'website check & accessibility audit')}`,
    short_name: SITE_NAME,
    description: L('Bezplatná analýza SEO, bezpečnosti a rýchlosti webu a audit prístupnosti podľa EAA.', 'Free SEO, security and speed check plus an EAA accessibility audit.'),
    lang,
    start_url: routePath('home', lang),
    scope: '/',
    display: 'standalone',
    background_color: '#0a0c11',
    theme_color: '#6d5dfc',
    icons: [
      { src: assetUrl('/img/icon-192.png'), sizes: '192x192', type: 'image/png' },
      { src: assetUrl('/img/icon-512.png'), sizes: '512x512', type: 'image/png' },
      { src: assetUrl('/img/icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2);
}

/** Vráti true, ak požiadavku obslúžil. */
function handle(req, res, url, headers) {
  const p = url.pathname;
  const base = baseUrl(req);
  const extra = { ...headers };
  if (base.startsWith('https://')) extra['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';

  // 301 zo starých adries (zachová query – napr. návrat zo Stripe na …pristupnost.html?order=…)
  if (REDIRECTS[p]) {
    res.writeHead(301, { Location: REDIRECTS[p] + url.search, 'Cache-Control': 'public, max-age=86400', ...extra });
    res.end();
    return true;
  }

  const route = matchRoute(p);
  if (route) {
    const noindex = NOINDEX_PARAMS.some((k) => url.searchParams.has(k));
    send(req, res, render(route.id, route.lang, base, noindex), { headers: { ...extra, 'Content-Language': route.lang } });
    return true;
  }

  if (p === '/robots.txt') { send(req, res, entryFrom(robotsTxt(base), 'text/plain; charset=utf-8'), { headers: { ...extra, 'Cache-Control': 'public, max-age=3600' } }); return true; }
  if (p === '/sitemap.xml') { send(req, res, entryFrom(sitemapXml(base), 'application/xml; charset=utf-8'), { headers: { ...extra, 'Cache-Control': 'public, max-age=3600' } }); return true; }
  const m = /^\/manifest-(sk|en)\.webmanifest$/.exec(p);
  if (m) { send(req, res, entryFrom(manifest(m[1]), 'application/manifest+json; charset=utf-8'), { headers: { ...extra, 'Cache-Control': 'public, max-age=86400' } }); return true; }

  // Pôvodné HTML súbory stránok sa už neservírujú priamo (renderuje ich server)
  if (/\.html$/.test(p) && p !== '/admin.html') return notFound(req, res, url, extra);
  if (serveStatic(req, res, url, extra)) return true;
  return notFound(req, res, url, extra);
}

function notFound(req, res, url, headers) {
  const lang = url.pathname.startsWith('/en/') ? 'en' : 'sk';
  const entry = render('home', lang, baseUrl(req), true, notFoundPage);
  send(req, res, entry, { status: 404, headers: { ...headers, 'Cache-Control': 'no-store' } });
  return true;
}

module.exports = { handle, robotsTxt, sitemapXml };
