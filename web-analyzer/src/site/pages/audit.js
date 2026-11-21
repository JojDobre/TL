'use strict';

const { L_, routePath } = require('../i18n');
const { breadcrumb, esc, SITE_NAME } = require('../layout');
const { faq, ticks } = require('./common');
const { TIERS, MONITORING, localizeTier } = require('../../a11y/tiers');
const client = require('../client-i18n');

module.exports = function audit(ctx) {
  const L = L_(ctx.lang);
  const terms = routePath('terms', ctx.lang), privacy = routePath('privacy', ctx.lang);
  const tiers = Object.values(TIERS).map((t) => localizeTier(t, ctx.lang));
  const mon = localizeTier(MONITORING, ctx.lang);

  const f = faq([
    [L('Od kedy platí Európsky akt o prístupnosti (EAA)?', 'When does the European Accessibility Act (EAA) apply?'),
      L('Smernica (EÚ) 2019/882 sa uplatňuje od 28. júna 2025. Na Slovensku ju preberá zákon č. 351/2022 Z. z. Nové produkty a služby musia požiadavky spĺňať od tohto dátumu.', 'Directive (EU) 2019/882 applies from 28 June 2025. Every EU member state has transposed it into national law. New products and services must comply from that date.')],
    [L('Na koho sa EAA vzťahuje?', 'Who does the EAA apply to?'),
      L('Najmä na e-shopy a online objednávky, bankové a finančné služby pre spotrebiteľov, elektronické komunikácie, e-knihy, prístup k audiovizuálnym službám a vybrané služby osobnej dopravy. Mikropodniky poskytujúce služby (menej ako 10 zamestnancov a obrat do 2 mil. €) sú spravidla vyňaté.', 'Mainly e-commerce and online ordering, consumer banking and financial services, electronic communications, e-books, access to audiovisual media and certain passenger transport services. Micro-enterprises providing services (fewer than 10 employees and turnover up to €2 million) are generally exempt.')],
    [L('Aký štandard musí web spĺňať?', 'Which standard must a website meet?'),
      L('V praxi sa za splnenie požiadaviek považuje súlad s harmonizovanou normou EN 301 549, ktorá pre web preberá WCAG 2.1 na úrovni A a AA. Náš audit hodnotí aj nové kritériá WCAG 2.2.', 'In practice, compliance is presumed when a site conforms to the harmonised standard EN 301 549, which adopts WCAG 2.1 levels A and AA for the web. Our audit also covers the new WCAG 2.2 criteria.')],
    [L('Čo hrozí, ak web požiadavky nespĺňa?', 'What happens if a website does not comply?'),
      L('Dodržiavanie kontrolujú orgány dohľadu nad trhom, ktoré môžu nariadiť nápravu a uložiť sankcie. Výška pokút sa líši podľa krajiny a sektora. Okrem rizika pokuty prichádzate aj o zákazníkov, ktorí web nedokážu použiť.', 'Market surveillance authorities enforce the rules: they can order corrective action and impose penalties, which vary by country and sector. Beyond fines, you lose customers who simply cannot use your site.')],
    [L('Stačí automatický audit na splnenie EAA?', 'Is an automated audit enough for EAA compliance?'),
      L('Nie úplne. Automatické testy spoľahlivo nájdu časť bariér (približne 30–40 %). Správa preto obsahuje aj kontrolný zoznam manuálnych testov. Ako sme overovali presnosť, opisujeme otvorene – testujeme na stránkach so známymi chybami aj na oficiálnom deme W3C.', 'Not entirely. Automated tests reliably find part of the barriers (roughly 30–40%). That is why the report includes a manual testing checklist. We are open about how we validated accuracy – on pages with known issues and on the official W3C demo.')],
    [L('Čo presne testujete?', 'What exactly do you test?'),
      L('Web otvoríme v skutočnom prehliadači a otestujeme ho 70+ pravidlami axe-core. Navyše ho prejdeme klávesnicou (viditeľný fokus, pasce, nedostupné prvky), skontrolujeme zobrazenie na šírke 320 px a na mobile a otestujeme aj cookie lištu.', 'We open your site in a real browser and run 70+ axe-core rules. On top of that we navigate it with the keyboard (visible focus, traps, unreachable controls), check the 320 px and mobile layouts, and test the cookie banner too.')],
    [L('Čo obsahuje PDF správa?', 'What is in the PDF report?'),
      L('Zhrnutie pre vedenie, právny rámec, stav kritérií WCAG a EN 301 549, zoznam problémov so snímkou, ukážkou kódu a postupom opravy, prehľad podstránok a podľa balíka aj plán nápravy a šablónu vyhlásenia o prístupnosti.', 'An executive summary, legal context, the status of WCAG and EN 301 549 criteria, issues with screenshots, code samples and how to fix them, a page overview and – depending on the plan – a remediation plan and an accessibility statement template.')],
    [L('Ako dlho audit trvá?', 'How long does the audit take?'),
      L('Bezplatný test trvá 10–30 sekúnd. Plný audit podľa veľkosti balíka zvyčajne 1–5 minút; priebeh vidíte na stránke objednávky.', 'The free test takes 10–30 seconds. A full audit usually takes 1–5 minutes depending on the plan; you can watch the progress on the order page.')],
    [L('Ako funguje monitoring a dá sa zrušiť?', 'How does monitoring work and can I cancel?'),
      L('Každý mesiac web znova otestujeme, porovnáme s minulým auditom a PDF správu pošleme e-mailom. Ak sa skóre zhorší, upozorníme vás. Predplatné zrušíte kedykoľvek jedným klikom.', 'Every month we re-test your site, compare it with the previous audit and email you the PDF report. If the score drops, we alert you. You can cancel anytime with one click.')],
    [L('Čo ak web blokuje automatické testovanie?', 'What if my site blocks automated testing?'),
      L('Bezplatný test to rozpozná (napr. ochranu Cloudflare) a objednávku vôbec neponúkne, takže nezaplatíte za nepoužiteľnú správu.', 'The free test detects it (e.g. Cloudflare bot protection) and will not offer a purchase, so you never pay for an unusable report.')],
  ], { title: L('Časté otázky o EAA a audite', 'FAQ about the EAA and the audit') });

  const priceCard = (t) => `
      <article class="card price-card${t.popular ? ' popular' : ''}">
        ${t.popular ? `<span class="popular-tag">${L('Najobľúbenejší', 'Most popular')}</span>` : ''}
        <h3>${esc(t.name)}</h3>
        <p class="sub">${esc(t.tagline)}</p>
        <div class="price"><b>${L(`${t.price} €`, `€${t.price}`)}</b><span> ${L('jednorazovo', 'one-time')}</span></div>
        ${ticks(t.features.map(esc))}
        <button class="buy${t.popular ? ' primary' : ''}" type="button" data-tier="${t.key}" data-price="${t.price}">${L('Najprv otestujte web', 'Test your site first')}</button>
      </article>`;

  const body = `
    <section class="hero" id="hero">
      <span class="pill"><span class="live-dot" aria-hidden="true"></span> ${L('Európsky akt o prístupnosti platí od 28. júna 2025', 'The European Accessibility Act applies since 28 June 2025')}</span>
      <h1>${L('Audit prístupnosti webu', 'Website accessibility audit')}<br><span class="grad">${L('podľa EAA a WCAG 2.1', 'for EAA & WCAG 2.1')}</span></h1>
      <p class="lead">${L('Otestujeme web podľa WCAG 2.1 / 2.2 AA a normy EN 301 549. Bezplatný náhľad hneď, podrobná PDF správa s návodom na opravu do pár minút.', 'We test your website against WCAG 2.1 / 2.2 AA and EN 301 549. Free preview instantly, a detailed PDF report with fixes within minutes.')}</p>

      <form class="search" id="form" autocomplete="off">
        <svg class="search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="4.5" r="1.8"/><path d="M5 8.5l7 1.5 7-1.5M12 10v5m0 0-3 6m3-6 3 6"/></svg>
        <label for="url" class="sr-only">${L('Adresa webu', 'Website address')}</label>
        <input id="url" name="url" type="text" inputmode="url" placeholder="${L('napr. mojeshop.sk', 'e.g. myshop.com')}" required spellcheck="false">
        <button type="submit" id="go">
          <span>${L('Otestovať zadarmo', 'Test for free')}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </button>
      </form>
      <ul class="trust">
        <li>✓ ${L('Test úvodnej stránky zadarmo', 'Free homepage test')}</li>
        <li>✓ ${L('Bez registrácie', 'No sign-up')}</li>
        <li>✓ ${L('PDF správa po slovensky', 'PDF report in English')}</li>
      </ul>
      <p class="error" id="error" role="alert" hidden></p>
    </section>

    <section class="bento" id="loading" hidden aria-live="polite">
      <div class="card skel span-4 row-2"><div class="loader-ring"></div><p class="loader-text" id="loaderText"></p></div>
      <div class="card skel span-8"></div>
      <div class="card skel span-8"></div>
      <div class="card skel span-12 short"></div>
    </section>

    <section class="bento" id="preview" hidden aria-live="polite" aria-label="${L('Výsledok testu', 'Test result')}"></section>
    <section class="bento" id="order" hidden aria-live="polite"></section>

    <section class="bento" id="info">
      <article class="card span-5 row-2 info-hero">
        <h2 class="card-title"><span class="ico" aria-hidden="true">§</span>${L('Koho sa EAA týka', 'Who the EAA applies to')}</h2>
        <p class="sub">${L('Zákon č. 351/2022 Z. z. preberá smernicu (EÚ) 2019/882. Prístupné musia byť najmä:', 'Directive (EU) 2019/882 is transposed into national law in every EU country. It mainly covers:')}</p>
        ${ticks([
          L('<b>E-shopy</b> a online objednávky', '<b>Online stores</b> and online ordering'),
          L('<b>Banky</b> a finančné služby', '<b>Banking</b> and financial services'),
          L('<b>Doprava</b> – rezervácie, lístky, informácie', '<b>Transport</b> – bookings, tickets, travel info'),
          L('<b>E-knihy</b>, telekomunikácie a médiá', '<b>E-books</b>, telecoms and media'),
        ])}
        <p class="sub small">${L('Výnimku majú mikropodniky poskytujúce služby (do 10 zamestnancov a 2 mil. € obratu).', 'Micro-enterprises providing services (under 10 staff and €2M turnover) are exempt.')}</p>
      </article>
      <article class="card span-7">
        <h2 class="card-title"><span class="ico" aria-hidden="true">✓</span>${L('Čo kontrolujeme', 'What we check')}</h2>
        <div class="feature-grid">
          <div><b>${L('70+ pravidiel', '70+ rules')}</b><span>${L('WCAG 2.0, 2.1 a 2.2 úrovne A a AA', 'WCAG 2.0, 2.1 and 2.2 levels A and AA')}</span></div>
          <div><b>EN 301 549</b><span>${L('mapovanie na harmonizovanú normu', 'mapped to the harmonised standard')}</span></div>
          <div><b>${L('Klávesnica a mobil', 'Keyboard & mobile')}</b><span>${L('fokus, pasce, reflow 320 px', 'focus, traps, 320 px reflow')}</span></div>
          <div><b>${L('Až 40 podstránok', 'Up to 40 pages')}</b><span>${L('so snímkami chybných prvkov', 'with screenshots of issues')}</span></div>
        </div>
      </article>
      <article class="card span-7">
        <h2 class="card-title"><span class="ico" aria-hidden="true">→</span>${L('Ako to funguje', 'How it works')}</h2>
        <ol class="steps">
          <li><span>1</span><div><b>${L('Bezplatný test', 'Free test')}</b><p>${L('Zadáte adresu, za pár sekúnd uvidíte skóre a počet chýb.', 'Enter a URL and see your score and issue count in seconds.')}</p></div></li>
          <li><span>2</span><div><b>${L('Vyberiete balík', 'Choose a plan')}</b><p>${L('Zaplatíte kartou, Apple Pay alebo Google Pay.', 'Pay by card, Apple Pay or Google Pay.')}</p></div></li>
          <li><span>3</span><div><b>${L('Stiahnete PDF', 'Download the PDF')}</b><p>${L('Prejdeme až 40 podstránok a vygenerujeme správu.', 'We scan up to 40 pages and generate the report.')}</p></div></li>
        </ol>
      </article>
    </section>

    <section id="pricing" class="pricing-wrap" aria-labelledby="pricingTitle">
      <div class="section-head">
        <h2 id="pricingTitle">${L('Cenník auditu prístupnosti', 'Accessibility audit pricing')}</h2>
        <p class="sub">${L('Jednorazový audit alebo mesačný monitoring. Správu môžete poslať vývojárovi alebo použiť ako podklad pre vyhlásenie o prístupnosti.', 'A one-time audit or monthly monitoring. Send the report to your developer or use it as the basis for your accessibility statement.')}</p>
      </div>
      <p class="demo-banner" id="demoBanner" hidden>${L('Demo režim: platobná brána nie je nastavená, objednávka sa spracuje bez platby.', 'Demo mode: no payment gateway configured, orders are processed without payment.')}</p>
      <div class="consent" id="consentBox">
        <input type="checkbox" id="consent">
        <label for="consent">${L(
          `Súhlasím s <a href="${terms}" target="_blank" rel="noopener">obchodnými podmienkami</a> a beriem na vedomie <a href="${privacy}" target="_blank" rel="noopener">spracovanie osobných údajov</a>. Žiadam o začatie poskytovania služby ihneď po zaplatení a beriem na vedomie, že po dodaní správy strácam právo na odstúpenie od zmluvy.`,
          `I agree to the <a href="${terms}" target="_blank" rel="noopener">terms of service</a> and acknowledge the <a href="${privacy}" target="_blank" rel="noopener">privacy policy</a>. I request that the service starts immediately after payment and acknowledge that I lose my right of withdrawal once the report is delivered.`)}</label>
      </div>
      <div class="pricing" id="tiers">
        ${tiers.map(priceCard).join('')}
        <article class="card price-card monitor-card">
          <span class="popular-tag alt">${L('Predplatné', 'Subscription')}</span>
          <div class="monitor-grid">
            <div>
              <h3>${esc(mon.name)}</h3>
              <p class="sub">${esc(mon.tagline)}</p>
              <div class="price"><b>${L(`${mon.price} €`, `€${mon.price}`)}</b><span> / ${L('mesiac', 'month')}</span></div>
              ${ticks(mon.features.map(esc))}
            </div>
            <form class="monitor-form" id="monitorForm">
              <label for="subEmail">${L('E-mail pre mesačné správy', 'Email for monthly reports')}</label>
              <input type="email" id="subEmail" name="email" autocomplete="email" placeholder="${L('vas@email.sk', 'you@example.com')}" required>
              <p class="sub small">${L('Prvý audit prebehne hneď po aktivácii, ďalšie každý mesiac. Správu pošleme e-mailom s PDF v prílohe.', 'The first audit runs right after activation, then every month. We email you the report with the PDF attached.')}</p>
              <button class="buy primary" type="submit" data-monitor="1" data-price="${mon.price}">${L('Najprv otestujte web', 'Test your site first')}</button>
            </form>
          </div>
        </article>
      </div>
    </section>

    <section class="content-section" aria-labelledby="eaa-title">
      <div class="section-head"><h2 id="eaa-title">${L('Čo je Európsky akt o prístupnosti', 'What is the European Accessibility Act')}</h2></div>
      <div class="bento">
        <article class="card span-6">
          <h3>${L('Prečo vznikol', 'Why it exists')}</h3>
          <p class="sub">${L('V EÚ žije viac ako 100 miliónov ľudí so zdravotným postihnutím. EAA zjednocuje požiadavky na prístupnosť produktov a služieb, aby ich mohol používať každý – nevidiaci s čítačkou obrazovky, ľudia ovládajúci počítač len klávesnicou, seniori aj ľudia s dočasným zranením.', 'Over 100 million people in the EU live with a disability. The EAA harmonises accessibility requirements for products and services so everyone can use them – blind users with screen readers, people who navigate by keyboard only, older adults and people with temporary injuries.')}</p>
        </article>
        <article class="card span-6">
          <h3>${L('Čo to znamená pre váš web', 'What it means for your website')}</h3>
          <p class="sub">${L('Web musí byť vnímateľný, ovládateľný, zrozumiteľný a robustný: obrázky s alternatívnym textom, dostatočný kontrast, ovládanie klávesnicou, popísané formuláre, zrozumiteľné chybové hlásenia a zverejnené informácie o prístupnosti.', 'Your site must be perceivable, operable, understandable and robust: images with alt text, sufficient contrast, keyboard operation, labelled forms, clear error messages and published accessibility information.')}</p>
        </article>
      </div>
    </section>

    ${f.html}`;

  const offers = [...tiers, mon].map((t) => ({
    '@type': 'Offer',
    name: `${L('Audit prístupnosti', 'Accessibility audit')} – ${t.name}`,
    description: t.features.join(', '),
    price: String(t.price),
    priceCurrency: 'EUR',
    availability: 'https://schema.org/InStock',
    url: ctx.base + routePath('audit', ctx.lang) + '#pricing',
    ...(t.interval ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: String(t.price), priceCurrency: 'EUR', billingDuration: 'P1M', unitCode: 'MON' } } : {}),
  }));

  return {
    title: L(`Audit prístupnosti webu podľa EAA a WCAG 2.1 | PDF správa od 19 €`, `Accessibility Audit for EAA & WCAG 2.1 | PDF Report from €19`),
    ogTitle: L('Audit prístupnosti webu podľa EAA a WCAG 2.1', 'Website Accessibility Audit for EAA & WCAG 2.1'),
    description: L('Otestujte prístupnosť webu podľa Európskeho aktu o prístupnosti (EAA), zákona 351/2022 Z. z. a WCAG 2.1 AA. Test zadarmo, PDF správa s návodom na opravu.',
      'Check your website against the European Accessibility Act (EAA), EN 301 549 and WCAG 2.1 AA. Free scan, detailed PDF report with fixes from €19.'),
    body,
    bodyClass: 'a11y-page',
    scripts: ['/i18n.js', '/a11y.js'],
    client: client.a11y[ctx.lang],
    jsonLd: [
      {
        '@type': 'Service',
        name: L('Audit prístupnosti webu podľa EAA', 'EAA website accessibility audit'),
        serviceType: L('Audit prístupnosti webu (WCAG 2.1 AA, EN 301 549)', 'Website accessibility audit (WCAG 2.1 AA, EN 301 549)'),
        provider: { '@id': `${ctx.base}/#organization` },
        areaServed: { '@type': 'Place', name: L('Európska únia', 'European Union') },
        availableLanguage: ['sk', 'en'],
        url: ctx.base + routePath('audit', ctx.lang),
        offers,
      },
      breadcrumb(ctx, [
        { name: SITE_NAME, path: routePath('home', ctx.lang) },
        { name: L('Audit prístupnosti', 'Accessibility audit'), path: routePath('audit', ctx.lang) },
      ]),
      f.jsonLd,
    ],
  };
};
