'use strict';

/*
 * Jednoduchá detekcia technológií podľa signatúr v HTML, hlavičkách a cookies.
 * Formát: [názov, kategória, test(html, headers, cookies) => boolean | verzia]
 */

const H = (name, re) => (html, h) => re.test(h.get(name) || '');
const R = (re) => (html) => re.test(html);
const C = (re) => (html, h, cookies) => cookies.some((c) => re.test(c));

const SIGNATURES = [
  // CMS a e-shopy
  ['WordPress', 'CMS', (html) => /\/wp-(content|includes)\//i.test(html) || /<meta[^>]+generator[^>]+WordPress/i.test(html)],
  ['WooCommerce', 'E-shop', R(/woocommerce/i)],
  ['Shopify', 'E-shop', (html, h) => /cdn\.shopify\.com|Shopify\.theme/i.test(html) || h.has('x-shopid')],
  ['Shoptet', 'E-shop', R(/cdn\.myshoptet\.com|shoptet/i)],
  ['PrestaShop', 'E-shop', R(/prestashop/i)],
  ['Magento', 'E-shop', R(/Mage\.Cookies|\/static\/version\d+\/frontend\//i)],
  ['Joomla', 'CMS', R(/<meta[^>]+generator[^>]+Joomla|\/media\/jui\//i)],
  ['Drupal', 'CMS', (html, h) => /Drupal\.settings|\/sites\/default\/files\//i.test(html) || /drupal/i.test(h.get('x-generator') || '')],
  ['Wix', 'Tvorca webov', (html, h) => /static\.wixstatic\.com|wix-bolt/i.test(html) || h.has('x-wix-request-id')],
  ['Squarespace', 'Tvorca webov', R(/static1\.squarespace\.com|Squarespace/)],
  ['Webflow', 'Tvorca webov', R(/data-wf-page|webflow\.com/i)],
  ['Ghost', 'CMS', R(/<meta[^>]+generator[^>]+Ghost/i)],
  ['Webnode', 'Tvorca webov', R(/webnode/i)],

  // Frameworky
  ['Next.js', 'Framework', (html, h) => /__NEXT_DATA__|\/_next\/static/.test(html) || /next\.js/i.test(h.get('x-powered-by') || '')],
  ['Nuxt', 'Framework', R(/__NUXT__|\/_nuxt\//)],
  ['Gatsby', 'Framework', R(/___gatsby/)],
  ['Astro', 'Framework', R(/astro-island|data-astro-/)],
  ['SvelteKit', 'Framework', R(/__sveltekit|data-sveltekit/)],
  ['Remix', 'Framework', R(/__remixContext/)],
  ['React', 'JS knižnica', R(/data-reactroot|react-dom|__NEXT_DATA__|_reactListening/)],
  ['Vue.js', 'JS knižnica', R(/data-v-[0-9a-f]{8}|vue(\.min|\.runtime)?\.js|__VUE__/)],
  ['Angular', 'JS knižnica', R(/ng-version=|ng-app/)],
  ['Svelte', 'JS knižnica', R(/svelte-[a-z0-9]{6}/)],
  ['Alpine.js', 'JS knižnica', R(/x-data=|alpinejs/)],
  ['htmx', 'JS knižnica', R(/hx-(get|post|swap)=|htmx\.org/)],
  ['jQuery', 'JS knižnica', R(/jquery[.-]?(\d[\d.]*)?(\.min)?\.js/i)],
  ['Laravel', 'Backend', C(/laravel_session|XSRF-TOKEN/)],
  ['PHP', 'Backend', (html, h, c) => /php/i.test(h.get('x-powered-by') || '') || c.some((x) => /PHPSESSID/.test(x))],
  ['ASP.NET', 'Backend', (html, h, c) => /asp\.net/i.test(h.get('x-powered-by') || '') || h.has('x-aspnet-version') || /__VIEWSTATE/.test(html) || c.some((x) => /ASP\.NET_SessionId/.test(x))],
  ['Express', 'Backend', H('x-powered-by', /express/i)],
  ['Django', 'Backend', C(/csrftoken|django/i)],
  ['Ruby on Rails', 'Backend', (html, h, c) => /csrf-param[^>]+authenticity_token/.test(html) || c.some((x) => /_rails|_session_id/.test(x))],

  // CSS
  ['Bootstrap', 'CSS framework', R(/bootstrap(\.min)?\.(css|js)|class="[^"]*\b(container-fluid|navbar-expand|col-md-\d)/)],
  ['Tailwind CSS', 'CSS framework', R(/tailwind|class="[^"]*\b(flex|grid) [^"]*\b(px|py|mx|my)-\d[^"]*\b(text|bg)-(gray|slate|zinc|neutral|blue)-\d{3}/)],
  ['Bulma', 'CSS framework', R(/bulma(\.min)?\.css/)],
  ['Font Awesome', 'Ikony', R(/font-?awesome|fa-solid|fa-brands/i)],
  ['Google Fonts', 'Písma', R(/fonts\.googleapis\.com/)],

  // Analytika a marketing
  ['Google Analytics', 'Analytika', R(/google-analytics\.com|gtag\(['"]config['"],\s*['"]G-|googletagmanager\.com\/gtag/)],
  ['Google Tag Manager', 'Tag manager', R(/googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/)],
  ['Meta Pixel', 'Marketing', R(/connect\.facebook\.net\/[^"']+\/fbevents\.js|fbq\(/)],
  ['Hotjar', 'Analytika', R(/static\.hotjar\.com|hjSiteSettings/)],
  ['Microsoft Clarity', 'Analytika', R(/clarity\.ms/)],
  ['Plausible', 'Analytika', R(/plausible\.io\/js/)],
  ['Matomo', 'Analytika', R(/matomo\.js|piwik\.js|_paq\.push/)],
  ['Smartlook', 'Analytika', R(/smartlook/i)],
  ['Google Ads', 'Marketing', R(/googleadservices\.com|AW-\d{6,}/)],
  ['TikTok Pixel', 'Marketing', R(/analytics\.tiktok\.com/)],
  ['LinkedIn Insight', 'Marketing', R(/snap\.licdn\.com/)],
  ['Cookiebot', 'Cookie lišta', R(/consent\.cookiebot\.com/)],
  ['OneTrust', 'Cookie lišta', R(/onetrust|optanon/i)],
  ['CookieYes', 'Cookie lišta', R(/cookieyes/i)],
  ['Google reCAPTCHA', 'Zabezpečenie', R(/google\.com\/recaptcha|grecaptcha/)],
  ['Cloudflare Turnstile', 'Zabezpečenie', R(/challenges\.cloudflare\.com\/turnstile/)],
  ['Intercom', 'Chat', R(/widget\.intercom\.io|intercomSettings/)],
  ['Smartsupp', 'Chat', R(/smartsuppchat|smartsupp/i)],
  ['Tawk.to', 'Chat', R(/embed\.tawk\.to/)],
  ['Stripe', 'Platby', R(/js\.stripe\.com/)],
  ['YouTube', 'Médiá', R(/youtube(-nocookie)?\.com\/embed/)],
  ['Google Maps', 'Mapy', R(/maps\.googleapis\.com|google\.com\/maps\/embed/)],

  // Infraštruktúra
  ['Cloudflare', 'CDN', (html, h) => h.has('cf-ray') || /cloudflare/i.test(h.get('server') || '')],
  ['Vercel', 'Hosting', (html, h) => h.has('x-vercel-id') || /vercel/i.test(h.get('server') || '')],
  ['Netlify', 'Hosting', (html, h) => h.has('x-nf-request-id') || /netlify/i.test(h.get('server') || '')],
  ['GitHub Pages', 'Hosting', (html, h) => /github\.com/i.test(h.get('server') || '') || h.has('x-github-request-id')],
  ['Amazon CloudFront', 'CDN', (html, h) => h.has('x-amz-cf-id')],
  ['Fastly', 'CDN', (html, h) => /fastly/i.test(h.get('x-served-by') || '') || h.has('x-fastly-request-id')],
  ['Akamai', 'CDN', (html, h) => /akamai/i.test(h.get('server') || '') || h.has('x-akamai-transformed')],
  ['Varnish', 'Cache', (html, h) => h.has('x-varnish') || /varnish/i.test(h.get('via') || '')],
  ['Nginx', 'Web server', H('server', /nginx/i)],
  ['Apache', 'Web server', H('server', /apache/i)],
  ['LiteSpeed', 'Web server', H('server', /litespeed/i)],
  ['Microsoft IIS', 'Web server', H('server', /iis/i)],
  ['Caddy', 'Web server', H('server', /caddy/i)],
  ['HTTP/3', 'Protokol', H('alt-svc', /h3/)],
];

const CAT_EN = {
  Analytika: 'Analytics', 'Cookie lišta': 'Cookie banner', 'E-shop': 'E-commerce', Ikony: 'Icons', 'JS knižnica': 'JS library',
  Mapy: 'Maps', Médiá: 'Media', Platby: 'Payments', Protokol: 'Protocol', Písma: 'Fonts', 'Tvorca webov': 'Website builder',
  Zabezpečenie: 'Security', Generátor: 'Generator',
};

function detectTech({ html, h, main, L }) {
  const en = L && L('sk', 'en') === 'en';
  const cookies = main.setCookies || [];
  const found = [];
  for (const [name, category, test] of SIGNATURES) {
    try { if (test(html, h, cookies)) found.push({ name, category: en ? CAT_EN[category] || category : category }); } catch { /* ignore */ }
  }
  // Generator meta tag (napr. presná verzia CMS)
  const gen = /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i.exec(html)
    || /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']generator["']/i.exec(html);
  if (gen) found.push({ name: gen[1].slice(0, 60), category: en ? 'Generator' : 'Generátor' });
  return found;
}

module.exports = { detectTech };
