'use strict';

const { LANGS, ROUTES, L_, routePath } = require('./i18n');
const { assetUrl } = require('./static');

const SITE_NAME = process.env.SITE_NAME || 'Web Analyzer';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** JSON do <script> – zneškodní </script> a HTML komentáre. */
const jsonForScript = (o) => JSON.stringify(o).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

const OG_LOCALE = { sk: 'sk_SK', en: 'en_US' };

const ICON = {
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M8 11h6M11 8v6"/></svg>',
  sun: '<svg class="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg class="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
};

/** Spoločné štruktúrované dáta (Organization + WebSite). */
function baseGraph(ctx) {
  return [
    {
      '@type': 'Organization',
      '@id': `${ctx.base}/#organization`,
      name: SITE_NAME,
      url: `${ctx.base}/`,
      logo: { '@type': 'ImageObject', url: `${ctx.base}/img/icon-512.png`, width: 512, height: 512 },
    },
    {
      '@type': 'WebSite',
      '@id': `${ctx.base}/#website-${ctx.lang}`,
      url: ctx.base + routePath('home', ctx.lang),
      name: SITE_NAME,
      inLanguage: ctx.lang,
      publisher: { '@id': `${ctx.base}/#organization` },
    },
  ];
}

function breadcrumb(ctx, items) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: ctx.base + it.path })),
  };
}

/**
 * Celá HTML stránka.
 * page: { title, description, body, jsonLd[], scripts[], client (texty pre JS), ogImage, bodyClass, noindex }
 */
function layout(ctx, page) {
  const { lang, id, base } = ctx;
  const L = L_(lang);
  const canonical = base + ROUTES[id][lang];
  const other = lang === 'sk' ? 'en' : 'sk';
  const ogImage = `${base}/img/${page.ogImage || `og-${id === 'audit' ? 'audit' : 'home'}-${lang}.jpg`}`;
  const robots = page.noindex || ctx.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1';
  const graph = { '@context': 'https://schema.org', '@graph': [...baseGraph(ctx), ...(page.jsonLd || [])] };
  const navLink = (rid, label, extra = '') => `<a href="${routePath(rid, lang)}"${rid === id ? ' aria-current="page"' : ''}>${label}${extra}</a>`;

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.description)}">
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${canonical}">
${LANGS.map((l) => `  <link rel="alternate" hreflang="${l}" href="${base}${ROUTES[id][l]}">`).join('\n')}
  <link rel="alternate" hreflang="x-default" href="${base}${ROUTES[id].en}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(SITE_NAME)}">
  <meta property="og:title" content="${esc(page.ogTitle || page.title)}">
  <meta property="og:description" content="${esc(page.description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(page.ogTitle || page.title)}">
  <meta property="og:locale" content="${OG_LOCALE[lang]}">
  <meta property="og:locale:alternate" content="${OG_LOCALE[other]}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#f4f5f8" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0a0c11" media="(prefers-color-scheme: dark)">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="${assetUrl('/img/icon-192.png')}" type="image/png" sizes="192x192">
  <link rel="apple-touch-icon" href="${assetUrl('/img/apple-touch-icon.png')}">
  <link rel="manifest" href="/manifest-${lang}.webmanifest">
  <link rel="preload" href="/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
${lang === 'sk' ? '  <link rel="preload" href="/fonts/inter-latin-ext-wght-normal.woff2" as="font" type="font/woff2" crossorigin>\n' : ''}  <link rel="stylesheet" href="${assetUrl('/styles.css')}">
  <script src="${assetUrl('/theme.js')}" async></script>
${(page.scripts || []).map((s) => `  <script src="${assetUrl(s)}" defer></script>`).join('\n')}
  <script type="application/ld+json">${jsonForScript(graph)}</script>
${page.client ? `  <script type="application/json" id="i18n">${jsonForScript({ lang, routes: Object.fromEntries(Object.keys(ROUTES).map((r) => [r, routePath(r, lang)])), t: page.client })}</script>\n` : ''}</head>
<body${page.bodyClass ? ` class="${page.bodyClass}"` : ''}>
  <a class="skip" href="#main">${L('Preskočiť na obsah', 'Skip to content')}</a>
  <div class="bg-glow" aria-hidden="true"></div>
  <header class="topbar">
    <a href="${routePath('home', lang)}" class="brand" aria-label="${esc(SITE_NAME)} – ${L('úvod', 'home')}">
      <span class="brand-mark">${ICON.logo}</span>
      ${esc(SITE_NAME).replace(' ', '&nbsp;')}
    </a>
    <nav class="nav" aria-label="${L('Hlavná navigácia', 'Main navigation')}">
      ${navLink('home', L('Analýza webu', 'Website check'))}
      ${navLink('audit', L('Audit prístupnosti', 'Accessibility audit'), ' <span class="nav-badge">EAA</span>')}
    </nav>
    <a class="lang-switch" href="${routePath(id, other)}" hreflang="${other}" lang="${other}" title="${other === 'en' ? 'English version' : 'Slovenská verzia'}">${other.toUpperCase()}</a>
    <button class="icon-btn" id="themeToggle" type="button" aria-label="${L('Prepnúť svetlú / tmavú tému', 'Toggle light / dark theme')}">${ICON.sun}${ICON.moon}</button>
  </header>

  <main id="main">
${page.body}
  </main>

  <footer class="foot">
    <nav class="foot-links" aria-label="${L('Odkazy v pätičke', 'Footer links')}">
      <a href="${routePath('home', lang)}">${L('Analýza webu zadarmo', 'Free website check')}</a>
      <a href="${routePath('audit', lang)}">${L('Audit prístupnosti EAA', 'EAA accessibility audit')}</a>
      <a href="${routePath('terms', lang)}">${L('Obchodné podmienky', 'Terms of service')}</a>
      <a href="${routePath('privacy', lang)}">${L('Ochrana osobných údajov', 'Privacy policy')}</a>
      <a href="${routePath(id, other)}" hreflang="${other}" lang="${other}">${other === 'en' ? 'English' : 'Slovensky'}</a>
    </nav>
    <p>© ${new Date().getFullYear()} ${esc(SITE_NAME)} · ${L('Automatické testy nenahrádzajú manuálne testovanie ani právne poradenstvo.', 'Automated tests do not replace manual testing or legal advice.')}</p>
  </footer>
</body>
</html>
`;
}

module.exports = { layout, breadcrumb, esc, SITE_NAME, ICON };
