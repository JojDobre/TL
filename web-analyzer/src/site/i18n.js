'use strict';

/* Jazyky a lokalizované adresy stránok. */

const LANGS = ['sk', 'en'];
const DEFAULT_LANG = 'sk';

/** Stránky webu: id → cesta v každom jazyku. */
const ROUTES = {
  home: { sk: '/', en: '/en/' },
  audit: { sk: '/pristupnost', en: '/en/accessibility-audit' },
  terms: { sk: '/obchodne-podmienky', en: '/en/terms' },
  privacy: { sk: '/ochrana-osobnych-udajov', en: '/en/privacy' },
};

/** Staré adresy → nové (301, zachová sa query string – napr. návrat zo Stripe). */
const REDIRECTS = {
  '/index.html': '/',
  '/pristupnost.html': '/pristupnost',
  '/obchodne-podmienky.html': '/obchodne-podmienky',
  '/ochrana-osobnych-udajov.html': '/ochrana-osobnych-udajov',
  '/en': '/en/',
  '/en/index.html': '/en/',
  '/en/accessibility-audit/': '/en/accessibility-audit',
  '/pristupnost/': '/pristupnost',
};

const PATH_INDEX = new Map();
for (const [id, paths] of Object.entries(ROUTES)) for (const lang of LANGS) PATH_INDEX.set(paths[lang], { id, lang });

function matchRoute(pathname) {
  return PATH_INDEX.get(pathname) || null;
}

const normLang = (l) => (LANGS.includes(l) ? l : DEFAULT_LANG);

/** Vyberie text podľa jazyka: tr('en', { sk: '…', en: '…' }) alebo tr('en', 'rovnaký text'). */
function tr(lang, v) {
  if (v == null || typeof v !== 'object') return v;
  return v[normLang(lang)] ?? v[DEFAULT_LANG];
}

/** Krátky zápis pre dvojjazyčné texty v kóde: const L = L_(lang); L('slovensky', 'english') */
const L_ = (lang) => (sk, en) => (normLang(lang) === 'en' ? en : sk);

/** Jazyk z Accept-Language (len na návrh, nikdy na automatické presmerovanie). */
function preferredLang(header) {
  const first = String(header || '').split(',')[0].trim().toLowerCase();
  return first.startsWith('sk') || first.startsWith('cs') ? 'sk' : 'en';
}

const routePath = (id, lang) => ROUTES[id][normLang(lang)];

module.exports = { LANGS, DEFAULT_LANG, ROUTES, REDIRECTS, matchRoute, normLang, tr, L_, preferredLang, routePath };
