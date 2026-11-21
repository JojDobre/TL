'use strict';

const { L_, routePath } = require('../i18n');
const { breadcrumb, SITE_NAME } = require('../layout');

const P = (t) => `<span class="placeholder">[${t}]</span>`;
const RETENTION = process.env.RETENTION_DAYS || '180';

function wrap(ctx, title, inner) {
  const L = L_(ctx.lang);
  return `
    <div class="legal">
      <article class="card">
        <p class="demo-banner left">${L('Toto je šablóna. Údaje v žltých [hranatých zátvorkách] doplňte a pred zverejnením dajte text skontrolovať právnikovi.', 'This is a template. Fill in the yellow [bracketed] fields and have a lawyer review the text before publishing.')}</p>
        <h1>${title}</h1>
        ${inner}
      </article>
    </div>`;
}

function terms(ctx) {
  const L = L_(ctx.lang);
  const privacy = routePath('privacy', ctx.lang);
  const sk = `
      <p>Platné od ${P('dátum')}</p>
      <h2>1. Poskytovateľ</h2>
      <p>${P('Obchodné meno')}, so sídlom ${P('adresa')}, IČO: ${P('IČO')}, DIČ: ${P('DIČ')}, IČ DPH: ${P('IČ DPH alebo „nie je platiteľ DPH“')}, zapísaný v ${P('obchodný / živnostenský register, číslo')}.<br>Kontakt: ${P('e-mail')}, ${P('telefón')}.</p>
      <h2>2. Predmet služby</h2>
      <ul>
        <li><b>Bezplatný test</b> – automatická kontrola úvodnej stránky webu s ukážkou výsledkov.</li>
        <li><b>Jednorazový audit</b> (balíky Základ, Štandard, Pro) – automatický audit prístupnosti zvoleného počtu podstránok a správa vo formáte PDF.</li>
        <li><b>Monitoring</b> – predplatné s mesačným opakovaním auditu, porovnaním s predchádzajúcim auditom a zaslaním správy e-mailom.</li>
      </ul>
      <p>Audit sa vykonáva automatizovanými nástrojmi (axe-core a vlastné testy ovládania klávesnicou a zobrazenia). <b>Automatický audit neodhalí všetky bariéry prístupnosti</b>, nenahrádza manuálne testovanie, nie je certifikátom zhody ani právnym stanoviskom. Poskytovateľ nezodpovedá za to, že web po odstránení nájdených chýb splní všetky zákonné požiadavky.</p>
      <h2>3. Objednávka a uzavretie zmluvy</h2>
      <p>Zmluva vzniká zaplatením objednávky. Pred zaplatením zákazník potvrdí súhlas s týmito podmienkami. Zákazník vyhlasuje, že je oprávnený nechať analyzovať zadaný web (najmä že ide o jeho web alebo má súhlas prevádzkovateľa).</p>
      <h2>4. Ceny a platba</h2>
      <p>Ceny sú uvedené pri jednotlivých balíkoch v eurách ${P('vrátane / bez DPH')}. Platba prebieha kartou alebo cez Apple Pay / Google Pay prostredníctvom platobnej brány Stripe. Doklad o platbe zašle Stripe na e-mail zákazníka.</p>
      <h2>5. Dodanie</h2>
      <p>Jednorazový audit sa spúšťa ihneď po zaplatení; PDF správa je spravidla k dispozícii do niekoľkých minút na stránke objednávky (odkaz s tajným kľúčom). Pri monitoringu sa prvý audit vykoná po aktivácii predplatného a ďalšie raz mesačne; správa sa zasiela na zadaný e-mail. Správy sa uchovávajú ${RETENTION} dní, potom sa automaticky vymažú.</p>
      <h2>6. Predplatné (Monitoring)</h2>
      <p>Predplatné sa automaticky obnovuje každý mesiac a platba sa strháva vopred na nasledujúce obdobie. Zákazník ho môže kedykoľvek zrušiť na stránke predplatného; zrušenie nadobudne účinnosť ku koncu zaplateného obdobia. Za začaté obdobie sa platba nevracia.</p>
      <h2>7. Odstúpenie od zmluvy</h2>
      <p>Spotrebiteľ má spravidla právo odstúpiť od zmluvy uzavretej na diaľku do 14 dní. Ide o službu a digitálny obsah dodávaný okamžite: zákazník pred objednávkou výslovne žiada o začatie poskytovania pred uplynutím lehoty na odstúpenie a berie na vedomie, že <b>dodaním správy právo na odstúpenie stráca</b>. ${P('Overiť a doplniť podľa zákona č. 108/2024 Z. z. o ochrane spotrebiteľa')}</p>
      <h2>8. Reklamácie</h2>
      <p>Ak audit neprebehol alebo správa nebola dodaná (napr. technická chyba), zákazník to môže reklamovať na ${P('e-mail')}. Poskytovateľ reklamáciu vybaví do 30 dní, spravidla opakovaním auditu alebo vrátením platby. Za reklamáciu sa nepovažuje nesúhlas s výsledkami automatického testu.</p>
      <h2>9. Alternatívne riešenie sporov</h2>
      <p>Spotrebiteľ sa môže obrátiť na Slovenskú obchodnú inšpekciu alebo iný subjekt alternatívneho riešenia sporov podľa zákona č. 391/2015 Z. z. ${P('doplniť kontakt / subjekt')}</p>
      <h2>10. Záverečné ustanovenia</h2>
      <p>Ochrana osobných údajov sa riadi dokumentom <a href="${privacy}">Ochrana osobných údajov</a>. Poskytovateľ môže tieto podmienky zmeniť; pre objednávku platia podmienky účinné v čase jej vytvorenia.</p>`;
  const en = `
      <p>Effective from ${P('date')}</p>
      <h2>1. Provider</h2>
      <p>${P('Company name')}, registered office ${P('address')}, company ID: ${P('company number')}, VAT ID: ${P('VAT number or “not VAT registered”')}, registered in ${P('commercial register, number')}.<br>Contact: ${P('email')}, ${P('phone')}.</p>
      <h2>2. Services</h2>
      <ul>
        <li><b>Free test</b> – an automated check of the website’s homepage with a preview of the results.</li>
        <li><b>One-time audit</b> (Basic, Standard, Pro plans) – an automated accessibility audit of the selected number of pages and a PDF report.</li>
        <li><b>Monitoring</b> – a subscription with a monthly repeat audit, comparison with the previous audit and the report sent by email.</li>
      </ul>
      <p>Audits are performed by automated tools (axe-core and our own keyboard and layout tests). <b>An automated audit does not detect all accessibility barriers</b>; it does not replace manual testing and is neither a certificate of conformance nor legal advice. The provider is not liable for the website meeting all legal requirements after the reported issues are fixed.</p>
      <h2>3. Orders and conclusion of the contract</h2>
      <p>The contract is concluded upon payment. Before paying, the customer confirms acceptance of these terms. The customer declares that they are entitled to have the website analysed (in particular that it is their website or they have the operator’s consent).</p>
      <h2>4. Prices and payment</h2>
      <p>Prices are shown in euros for each plan ${P('including / excluding VAT')}. Payment is made by card, Apple Pay or Google Pay through the Stripe payment gateway. Stripe sends the receipt to the customer’s email.</p>
      <h2>5. Delivery</h2>
      <p>A one-time audit starts immediately after payment; the PDF report is usually available within minutes on the order page (a link with a secret key). With monitoring, the first audit runs after activation and then once a month; the report is sent to the given email. Reports are kept for ${RETENTION} days and then deleted automatically.</p>
      <h2>6. Subscription (Monitoring)</h2>
      <p>The subscription renews automatically every month and is charged in advance for the next period. The customer can cancel at any time on the subscription page; cancellation takes effect at the end of the paid period. Payments for a started period are not refunded.</p>
      <h2>7. Right of withdrawal</h2>
      <p>Consumers generally have the right to withdraw from a distance contract within 14 days. This is a service and digital content supplied immediately: before ordering, the customer expressly requests performance to begin before the withdrawal period ends and acknowledges that <b>they lose the right of withdrawal once the report has been delivered</b>. ${P('Verify and complete under the applicable consumer protection law')}</p>
      <h2>8. Complaints</h2>
      <p>If an audit did not run or the report was not delivered (e.g. a technical error), the customer may file a complaint at ${P('email')}. The provider resolves complaints within 30 days, usually by repeating the audit or refunding the payment. Disagreement with the results of an automated test is not a valid complaint.</p>
      <h2>9. Alternative dispute resolution</h2>
      <p>Consumers may contact the competent consumer protection authority or an alternative dispute resolution body in their country. ${P('add body / contact')}</p>
      <h2>10. Final provisions</h2>
      <p>Personal data is processed according to the <a href="${privacy}">Privacy policy</a>. The provider may change these terms; each order is governed by the terms in force when it was placed.</p>`;
  return {
    title: L(`Obchodné podmienky | ${SITE_NAME}`, `Terms of Service | ${SITE_NAME}`),
    description: L('Obchodné podmienky služby: bezplatný test, jednorazový audit prístupnosti a predplatné Monitoring.', 'Terms of service: free test, one-time accessibility audit and the Monitoring subscription.'),
    body: wrap(ctx, L('Obchodné podmienky', 'Terms of Service'), L(sk, en)),
    jsonLd: [breadcrumb(ctx, [{ name: SITE_NAME, path: routePath('home', ctx.lang) }, { name: L('Obchodné podmienky', 'Terms of Service'), path: routePath('terms', ctx.lang) }])],
  };
}

function privacy(ctx) {
  const L = L_(ctx.lang);
  const sk = `
      <p>Informácie podľa čl. 13 nariadenia (EÚ) 2016/679 (GDPR) a zákona č. 18/2018 Z. z. o ochrane osobných údajov.</p>
      <h2>Prevádzkovateľ</h2>
      <p>${P('Obchodné meno, sídlo, IČO')}. Kontakt pre otázky k osobným údajom: ${P('e-mail')}.</p>
      <h2>Aké údaje spracúvame a prečo</h2>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Prehľad spracúvaných údajov"><table>
        <thead><tr><th>Údaje</th><th>Účel</th><th>Právny základ</th><th>Doba uchovania</th></tr></thead>
        <tbody>
          <tr><td>Adresa analyzovaného webu, výsledky testu</td><td>bezplatný test</td><td>oprávnený záujem / predzmluvné vzťahy</td><td>24 hodín</td></tr>
          <tr><td>Adresa webu, výsledky auditu, PDF správa, e-mail z platby</td><td>dodanie objednanej služby</td><td>plnenie zmluvy</td><td>${RETENTION} dní</td></tr>
          <tr><td>E-mail, história auditov</td><td>monitoring – zasielanie mesačných správ</td><td>plnenie zmluvy</td><td>počas predplatného a ${RETENTION} dní po jeho skončení</td></tr>
          <tr><td>Údaje o platbe (spracúva Stripe)</td><td>platba, účtovníctvo</td><td>plnenie zmluvy, zákonná povinnosť</td><td>podľa účtovných predpisov (10 rokov)</td></tr>
          <tr><td>IP adresa</td><td>ochrana pred zneužitím (obmedzenie počtu požiadaviek)</td><td>oprávnený záujem</td><td>len v pamäti servera, max. niekoľko minút</td></tr>
        </tbody>
      </table></div>
      <h2>Príjemcovia (sprostredkovatelia)</h2>
      <ul>
        <li><b>Stripe Payments Europe, Ltd.</b> (Írsko) – spracovanie platieb. Údaje o karte nikdy neprechádzajú našim serverom.</li>
        <li><b>Resend</b> (USA) – odosielanie e-mailov s mesačnými správami monitoringu; prenos na základe štandardných zmluvných doložiek / EU-US Data Privacy Framework.</li>
        <li>${P('Poskytovateľ hostingu, krajina')}</li>
      </ul>
      <h2>Cookies</h2>
      <p>Web nepoužíva sledovacie ani reklamné cookies. V prehliadači si ukladáme len zvolenú tému (svetlá / tmavá) v lokálnom úložisku. Platobná brána Stripe môže počas platby používať vlastné nevyhnutné cookies.</p>
      <h2>Vaše práva</h2>
      <p>Máte právo na prístup k údajom, ich opravu, vymazanie, obmedzenie spracúvania, prenosnosť a právo namietať. Žiadosť pošlite na ${P('e-mail')}. Máte tiež právo podať sťažnosť na Úrad na ochranu osobných údajov Slovenskej republiky (dataprotection.gov.sk).</p>
      <h2>Automatizované rozhodovanie</h2>
      <p>Výsledky auditu vznikajú automatizovane, ale týkajú sa webovej stránky, nie vás ako osoby, a nemajú voči vám právne účinky.</p>`;
  const en = `
      <p>Information under Article 13 of Regulation (EU) 2016/679 (GDPR).</p>
      <h2>Controller</h2>
      <p>${P('Company name, address, company ID')}. Contact for data protection questions: ${P('email')}.</p>
      <h2>What data we process and why</h2>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Overview of processed data"><table>
        <thead><tr><th>Data</th><th>Purpose</th><th>Legal basis</th><th>Retention</th></tr></thead>
        <tbody>
          <tr><td>URL of the analysed website, test results</td><td>free test</td><td>legitimate interest / pre-contractual steps</td><td>24 hours</td></tr>
          <tr><td>Website URL, audit results, PDF report, email from the payment</td><td>delivering the ordered service</td><td>performance of a contract</td><td>${RETENTION} days</td></tr>
          <tr><td>Email, audit history</td><td>monitoring – sending monthly reports</td><td>performance of a contract</td><td>during the subscription and ${RETENTION} days after it ends</td></tr>
          <tr><td>Payment data (processed by Stripe)</td><td>payment, accounting</td><td>performance of a contract, legal obligation</td><td>as required by accounting law</td></tr>
          <tr><td>IP address</td><td>abuse prevention (rate limiting)</td><td>legitimate interest</td><td>server memory only, a few minutes at most</td></tr>
        </tbody>
      </table></div>
      <h2>Recipients (processors)</h2>
      <ul>
        <li><b>Stripe Payments Europe, Ltd.</b> (Ireland) – payment processing. Card details never touch our servers.</li>
        <li><b>Resend</b> (USA) – sending monitoring report emails; transfers based on standard contractual clauses / the EU-US Data Privacy Framework.</li>
        <li>${P('Hosting provider, country')}</li>
      </ul>
      <h2>Cookies</h2>
      <p>This website uses no tracking or advertising cookies. We only store your theme choice (light / dark) in your browser’s local storage. The Stripe payment gateway may use its own strictly necessary cookies during payment.</p>
      <h2>Your rights</h2>
      <p>You have the right of access, rectification, erasure, restriction of processing, data portability and the right to object. Send requests to ${P('email')}. You also have the right to lodge a complaint with your data protection supervisory authority.</p>
      <h2>Automated decision-making</h2>
      <p>Audit results are produced automatically, but they concern a website, not you as a person, and have no legal effects on you.</p>`;
  return {
    title: L(`Ochrana osobných údajov | ${SITE_NAME}`, `Privacy Policy | ${SITE_NAME}`),
    description: L('Aké osobné údaje spracúvame pri analýze webu a audite prístupnosti, prečo a ako dlho.', 'Which personal data we process for website checks and accessibility audits, why and for how long.'),
    body: wrap(ctx, L('Ochrana osobných údajov', 'Privacy Policy'), L(sk, en)),
    jsonLd: [breadcrumb(ctx, [{ name: SITE_NAME, path: routePath('home', ctx.lang) }, { name: L('Ochrana osobných údajov', 'Privacy Policy'), path: routePath('privacy', ctx.lang) }])],
  };
}

function notFound(ctx) {
  const L = L_(ctx.lang);
  return {
    title: L(`Stránka sa nenašla | ${SITE_NAME}`, `Page not found | ${SITE_NAME}`),
    description: L('Hľadaná stránka neexistuje.', 'The page you are looking for does not exist.'),
    noindex: true,
    body: `
    <section class="hero">
      <span class="pill">404</span>
      <h1>${L('Stránka sa nenašla', 'Page not found')}</h1>
      <p class="lead">${L('Adresa je nesprávna alebo stránka už neexistuje.', 'The address is wrong or the page no longer exists.')}</p>
      <p><a class="cta" href="${routePath('home', ctx.lang)}">${L('Analyzovať web zadarmo', 'Check a website for free')}</a>
         <a class="ghost-btn" href="${routePath('audit', ctx.lang)}">${L('Audit prístupnosti', 'Accessibility audit')}</a></p>
    </section>`,
  };
}

module.exports = { terms, privacy, notFound };
