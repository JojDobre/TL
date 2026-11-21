'use strict';

const { L_, routePath } = require('../i18n');
const { breadcrumb, SITE_NAME } = require('../layout');
const { faq, ticks } = require('./common');
const client = require('../client-i18n');

module.exports = function home(ctx) {
  const L = L_(ctx.lang);
  const audit = routePath('audit', ctx.lang);

  const cats = [
    ['security', L('Bezpečnosť', 'Security'), L('HTTPS a presmerovanie, SSL certifikát a verzia TLS, HSTS, Content-Security-Policy, ochrana proti clickjackingu, cookies, zmiešaný obsah, únik verzie servera, security.txt.', 'HTTPS and redirects, SSL certificate and TLS version, HSTS, Content-Security-Policy, clickjacking protection, cookies, mixed content, server version disclosure, security.txt.')],
    ['seo', 'SEO', L('Titulok a meta popis, nadpisy H1–H6, kanonická URL, jazyk, mobilný viewport, indexovateľnosť, robots.txt, XML sitemap, štruktúrované dáta, alt texty a množstvo obsahu.', 'Title and meta description, H1–H6 headings, canonical URL, language, mobile viewport, indexability, robots.txt, XML sitemap, structured data, alt texts and content length.')],
    ['performance', L('Výkon', 'Performance'), L('Čas odozvy servera (TTFB), veľkosť HTML, kompresia gzip/Brotli, cache hlavičky, presmerovania, skripty blokujúce vykreslenie, lazy loading a formáty obrázkov.', 'Server response time (TTFB), HTML size, gzip/Brotli compression, cache headers, redirects, render-blocking scripts, lazy loading and image formats.')],
    ['accessibility', L('Prístupnosť', 'Accessibility'), L('Jazyk dokumentu, alternatívne texty, popisy formulárov, názvy odkazov a tlačidiel, sémantické oblasti a možnosť priblíženia. Hĺbkový test podľa EAA ponúkame samostatne.', 'Document language, alt texts, form labels, link and button names, landmarks and zoom. An in-depth EAA test is available separately.')],
    ['social', L('Sociálne siete', 'Social media'), L('Open Graph a X (Twitter) Card – ako bude vyzerať odkaz na váš web pri zdieľaní na Facebooku, LinkedIne či v Slacku.', 'Open Graph and X (Twitter) Card – how a link to your site looks when shared on Facebook, LinkedIn or Slack.')],
    ['tech', L('Technológie', 'Tech stack'), L('Rozpoznáme vyše 70 technológií: CMS (WordPress, Shopify, Shoptet…), frameworky, analytiku, CDN, hosting a webový server.', 'We detect 70+ technologies: CMS (WordPress, Shopify, Wix…), frameworks, analytics, CDN, hosting and web server.')],
  ];

  const f = faq([
    [L('Je analýza webu zadarmo?', 'Is the website check free?'),
      L('Áno. Rýchla analýza je bezplatná, bez registrácie a bez obmedzenia funkcií. Platený je len hĺbkový <a href="' + audit + '">audit prístupnosti podľa EAA</a> s PDF správou.', 'Yes. The quick check is free, with no sign-up and no feature limits. Only the in-depth <a href="' + audit + '">EAA accessibility audit</a> with a PDF report is paid.')],
    [L('Čo všetko analýza kontroluje?', 'What does the check cover?'),
      L('Viac ako 60 kontrol v kategóriách bezpečnosť, SEO, výkon, prístupnosť a sociálne siete, plus detekciu technológií, SSL certifikát, HTTP hlavičky a cestu presmerovaní. Každá kontrola má vysvetlenie a návod na opravu.', 'More than 60 checks across security, SEO, performance, accessibility and social media, plus tech stack detection, the SSL certificate, HTTP headers and the redirect chain. Every check comes with an explanation and a fix.')],
    [L('Prečo sa výsledok líši od Google PageSpeed alebo Lighthouse?', 'Why does the result differ from Google PageSpeed or Lighthouse?'),
      L('Lighthouse meria vykreslenie stránky v prehliadači so simulovaným pomalým pripojením. My kontrolujeme HTML a HTTP hlavičky zo servera – bezpečnosť, technické SEO a konfiguráciu. Nástroje sa dopĺňajú; odporúčame používať oba.', 'Lighthouse measures page rendering in a browser on a throttled connection. We check the HTML and HTTP headers from the server – security, technical SEO and configuration. The tools complement each other; we recommend using both.')],
    [L('Ukladáte adresy webov, ktoré analyzujem?', 'Do you store the URLs I check?'),
      L('Nie. Výsledok držíme len 5 minút v pamäti servera, aby opakované zobrazenie bolo rýchle. Do databázy nič neukladáme a nepoužívame sledovacie cookies.', 'No. Results are kept in server memory for 5 minutes so repeated views are fast. Nothing is stored in a database and we use no tracking cookies.')],
    [L('Prečo sa niektorý web nedá analyzovať?', 'Why can’t some websites be checked?'),
      L('Najčastejšie pre ochranu proti botom (napr. Cloudflare), ktorá blokuje automatické požiadavky, alebo pre pomalú odpoveď servera. Interné a lokálne adresy z bezpečnostných dôvodov neanalyzujeme.', 'Usually because of bot protection (e.g. Cloudflare) that blocks automated requests, or because the server responds too slowly. For security reasons we do not check internal or local addresses.')],
    [L('Ako zlepším skóre bezpečnosti?', 'How do I improve my security score?'),
      L('Najväčší vplyv má HTTPS s presmerovaním, hlavička HSTS, Content-Security-Policy a X-Content-Type-Options. Presné hodnoty hlavičiek nájdete v odporúčaniach pri každej kontrole – väčšinu nastavíte na serveri alebo v CDN za pár minút.', 'The biggest wins are HTTPS with a redirect, the HSTS header, Content-Security-Policy and X-Content-Type-Options. The recommendations show the exact header values – most can be set on your server or CDN in minutes.')],
    [L('Je analýza vhodná aj pre e-shopy a WordPress?', 'Does it work for online stores and WordPress?'),
      L('Áno. Nástroj rozpozná WordPress, WooCommerce, Shopify, Shoptet a ďalšie platformy. E-shopom navyše odporúčame <a href="' + audit + '">audit prístupnosti</a> – od júna 2025 sa na ne vzťahuje Európsky akt o prístupnosti.', 'Yes. The tool detects WordPress, WooCommerce, Shopify, Wix and other platforms. For online stores we also recommend the <a href="' + audit + '">accessibility audit</a> – the European Accessibility Act applies to them since June 2025.')],
  ], { title: L('Časté otázky', 'Frequently asked questions') });

  const body = `
    <section class="hero" id="hero">
      <span class="pill">${L('Bezpečnosť · SEO · Výkon · Prístupnosť · Technológie', 'Security · SEO · Performance · Accessibility · Tech stack')}</span>
      <h1>${L('Analýza webu zadarmo', 'Free website analyzer')}<br><span class="grad">${L('za pár sekúnd', 'in seconds')}</span></h1>
      <p class="lead">${L('Zadajte adresu ľubovoľnej stránky a získate prehľadné hodnotenie SEO, bezpečnosti a rýchlosti s konkrétnymi odporúčaniami, čo zlepšiť.', 'Enter any URL and get a clear rating of SEO, security and speed with concrete recommendations on what to fix.')}</p>

      <form class="search" id="form" autocomplete="off" role="search">
        <svg class="search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
        <label for="url" class="sr-only">${L('Adresa webu', 'Website address')}</label>
        <input id="url" name="url" type="text" inputmode="url" placeholder="${L('napr. example.com', 'e.g. example.com')}" required spellcheck="false">
        <button type="submit" id="go">
          <span>${L('Analyzovať', 'Analyze')}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </form>
      <div class="examples">
        ${L('Skúste', 'Try')}: <button type="button" data-ex="wikipedia.org">wikipedia.org</button>
        <button type="button" data-ex="mozilla.org">mozilla.org</button>
        <button type="button" data-ex="wordpress.org">wordpress.org</button>
      </div>
      <p class="error" id="error" role="alert" hidden></p>
    </section>

    <section class="bento" id="loading" hidden aria-live="polite">
      <div class="card skel span-4 row-2"><div class="loader-ring"></div><p class="loader-text" id="loaderText"></p></div>
      <div class="card skel span-5 row-2"></div>
      <div class="card skel span-3 row-2"></div>
      <div class="card skel span-12 short"></div>
      <div class="card skel span-7 row-2"></div>
      <div class="card skel span-5 row-2"></div>
    </section>

    <section class="bento" id="results" hidden aria-label="${L('Výsledky analýzy', 'Analysis results')}"></section>

    <div id="about">
      <section class="content-section" aria-labelledby="checks-title">
        <div class="section-head">
          <h2 id="checks-title">${L('Čo analýza webu kontroluje', 'What the website check covers')}</h2>
          <p class="sub">${L('Viac ako 60 automatických kontrol, ktoré inak robí technik ručne. Každá s vysvetlením a návodom na opravu.', 'More than 60 automated checks a technician would otherwise do by hand. Each one with an explanation and a fix.')}</p>
        </div>
        <div class="bento">
          ${cats.map(([k, t, d]) => `
          <article class="card span-4 feature-card fc-${k}">
            <h3 class="card-title"><span class="ico" aria-hidden="true">${k === 'tech' ? '&lt;/&gt;' : '●'}</span>${t}</h3>
            <p class="sub">${d}</p>
          </article>`).join('')}
        </div>
      </section>

      <section class="content-section" aria-labelledby="how-title">
        <div class="section-head"><h2 id="how-title">${L('Ako to funguje', 'How it works')}</h2></div>
        <ol class="steps steps-wide">
          <li><span>1</span><div><h3>${L('Zadáte adresu', 'Enter a URL')}</h3><p>${L('Stačí doména, napríklad mojweb.sk. Registrácia nie je potrebná.', 'Just the domain, e.g. mysite.com. No sign-up needed.')}</p></div></li>
          <li><span>2</span><div><h3>${L('Server web otestuje', 'We test the site')}</h3><p>${L('Stiahneme stránku, robots.txt, sitemap a certifikát a vyhodnotíme 60+ pravidiel.', 'We fetch the page, robots.txt, sitemap and certificate and evaluate 60+ rules.')}</p></div></li>
          <li><span>3</span><div><h3>${L('Dostanete odporúčania', 'Get recommendations')}</h3><p>${L('Skóre, známku A–F a zoradený zoznam úloh od najdôležitejšej.', 'A score, an A–F grade and a prioritized task list.')}</p></div></li>
        </ol>
      </section>

      <section class="content-section">
        <a class="card eaa-promo" href="${audit}">
          <div>
            <h2 class="promo-title">${L('Spĺňa váš web Európsky akt o prístupnosti?', 'Does your website meet the European Accessibility Act?')}</h2>
            <p class="sub">${L('Od 28. júna 2025 musia byť e-shopy a ďalšie služby prístupné podľa WCAG 2.1 AA. Otestujte to zadarmo.', 'Since 28 June 2025, online stores and other services must be accessible under WCAG 2.1 AA. Test it for free.')}</p>
          </div>
          <span class="cta">${L('Bezplatný EAA test →', 'Free EAA test →')}</span>
        </a>
      </section>

      ${f.html}
    </div>`;

  return {
    title: L(`Analýza webu zadarmo – SEO, bezpečnosť a rýchlosť | ${SITE_NAME}`, `Free Website Checker – SEO, Security & Speed | ${SITE_NAME}`),
    ogTitle: L('Analýza webu zadarmo – SEO, bezpečnosť a rýchlosť', 'Free Website Analyzer – SEO, Security & Speed'),
    description: L('Bezplatná online analýza webu: SEO, bezpečnostné hlavičky, SSL, rýchlosť, prístupnosť a technológie. Skóre a konkrétne odporúčania za pár sekúnd.',
      'Free online website audit: SEO, security headers, SSL, performance, accessibility and tech stack. Get a score and concrete fixes in seconds.'),
    body,
    scripts: ['/i18n.js', '/app.js'],
    client: client.app[ctx.lang],
    jsonLd: [
      {
        '@type': 'WebApplication',
        name: L('Analýza webu', 'Website Analyzer'),
        url: ctx.base + routePath('home', ctx.lang),
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript',
        inLanguage: ctx.lang,
        description: L('Bezplatná analýza SEO, bezpečnosti, výkonu a prístupnosti webu.', 'Free SEO, security, performance and accessibility check for any website.'),
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        publisher: { '@id': `${ctx.base}/#organization` },
      },
      f.jsonLd,
    ],
  };
};
