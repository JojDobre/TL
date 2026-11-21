# Web Analyzer

🇸🇰 Slovenská a 🇬🇧 anglická verzia (`/` a `/en/`) – web, výsledky analýz, PDF správy aj e-maily.

Webová aplikácia, do ktorej zadáš adresu ľubovoľného webu a dostaneš kompletný audit
v modernom **bento** rozložení (svetlá aj tmavá téma, responzívne).

## Čo kontroluje

| Kategória | Príklady kontrol |
|---|---|
| **Bezpečnosť** | HTTPS, presmerovanie HTTP→HTTPS, SSL certifikát a verzia TLS, HSTS, CSP, ochrana proti clickjackingu, X-Content-Type-Options, Referrer/Permissions-Policy, cookies (Secure/HttpOnly/SameSite), zmiešaný obsah, SRI, únik verzie servera, security.txt, soft 404 |
| **SEO** | HTTP status, title, meta description, H1 a hierarchia nadpisov, canonical, lang, viewport, noindex, robots.txt, sitemap, alt texty, štruktúrované dáta (JSON-LD), množstvo textu, favicon, hreflang |
| **Výkon** | TTFB, čas načítania, veľkosť HTML, kompresia (gzip/brotli), presmerovania, cache hlavičky, blokujúce skripty, počet JS/CSS, inline kód, lazy loading, rozmery a formáty obrázkov |
| **Prístupnosť** | jazyk dokumentu, alt texty, zákaz zoomu, popisy formulárov, odkazy/tlačidlá bez textu, landmarks, tabindex, iframe titulky |
| **Sociálne siete** | Open Graph, X/Twitter Card, theme-color, Web App Manifest |
| **Technológie** | ~75 signatúr: CMS, e-shopy, frameworky, analytika, CDN, hosting, web servery… |

Výstupom je celkové skóre (0–100) so známkou A–F, skóre kategórií, zoradené odporúčania,
náhľad vo vyhľadávaní, HTTP hlavičky a cesta presmerovaní.

## Audit prístupnosti podľa EAA (platený)

Stránka `/pristupnost.html` – hĺbkový audit podľa Európskeho aktu o prístupnosti
(smernica (EÚ) 2019/882, zákon č. 351/2022 Z. z.), normy EN 301 549 a WCAG 2.1 / 2.2 AA.

1. **Bezplatný náhľad** – úvodná stránka sa otestuje v headless Chromiu knižnicou
   [axe-core](https://github.com/dequelabs/axe-core). Zákazník vidí skóre, stav súladu,
   počty chýb podľa závažnosti, princípy WCAG a 3 ukážkové nálezy (ostatné sú zamknuté).
2. **Výber balíka a platba** cez Stripe Checkout.
3. **Plný audit** – crawler prejde podstránky (prioritne kontakt, košík, formuláre, právne info).
4. **PDF správa** po slovensky na stiahnutie (odkaz s tajným tokenom).

| Balík | Cena | Podstránky | Obsah PDF |
|---|---|---|---|
| Základ | 19 € | 5 | zhrnutie, právny rámec, porušené kritériá, chyby so snímkou, návodom a kódom |
| Štandard | 29 € | 15 | + tabuľka všetkých kritérií WCAG ↔ EN 301 549, kontrolný zoznam manuálnych testov |
| Pro | 49 € | 40 | + prioritizovaný plán nápravy, predvyplnená šablóna Vyhlásenia o prístupnosti |
| **Monitoring** | 9 € / mesiac | 15 | mesačný audit, porovnanie (nové / opravené chyby), PDF **e-mailom**, upozornenie pri zhoršení |

### Čo audit testuje

- **axe-core** – 70+ pravidiel WCAG 2.0 / 2.1 / 2.2 A a AA vo vykreslenej stránke.
- **Test klávesnice** (vlastný) – prechod klávesom Tab: viditeľný fokus (porovnanie snímok
  prvku so zameraním a bez neho), pasca pre klávesnicu, fokus zakrytý prekryvom,
  ovládacie prvky (rola / onclick) mimo poradia Tab.
- **Reflow** – zobrazenie pri šírke 320 px bez vodorovného skrolovania.
- **Mobilné zobrazenie** – kľúčové stránky aj v rozlíšení 390 × 844 s dotykom.
- **Cookie lišta** – otestuje sa v zobrazenom stave, potom sa zatvorí, aby neprekrývala obsah.
- **Ochrana proti botom / chybové stránky** – rozpoznajú sa a audit sa odmietne
  (zákazník nezaplatí za nezmyselnú správu).
- **Snímky chýb** – v PDF je výrez stránky so zvýrazneným chybným prvkom.

Ako sme overili presnosť (testovacie stránky so známymi chybami, W3C BAD benchmark,
ručne preverené nálezy) a čo audit negarantuje: **[docs/PRESNOST.md](docs/PRESNOST.md)**.

Ceny a obsah balíkov sa menia v `src/a11y/tiers.js` (cenu nikdy neposiela klient).

### Platby (Stripe)

- Bez `STRIPE_SECRET_KEY` beží **DEMO režim** – objednávky sa spracujú bez platby a stránka
  to zreteľne zobrazuje. **Na produkcii vždy nastav kľúč.**
- V Stripe Dashboarde vytvor webhook na `https://tvoja-domena/api/stripe/webhook`
  s udalosťami `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `customer.subscription.updated`, `customer.subscription.deleted` a `invoice.payment_failed`
  a jeho tajomstvo ulož do `STRIPE_WEBHOOK_SECRET`. Podpis sa overuje (HMAC SHA-256).
- Pre predplatné zapni v Stripe **Customer Portal** (Settings → Billing → Customer portal) –
  zákazník si v ňom mení kartu a ruší predplatné.
- Platba sa overí aj priamo cez Stripe API pri návrate zákazníka, takže audit sa spustí
  aj keď webhook mešká.
- DPH, faktúry a potvrdenia o platbe nastav v Stripe (Stripe Tax, Invoicing, e-mailové potvrdenia).

### Predplatné a e-maily

- Plánovač každých 15 minút spustí audit predplatným, ktorým nastal termín (raz mesačne).
- Pri každom behu sa výsledok porovná s predchádzajúcim a PDF sa pošle e-mailom cez
  [Resend](https://resend.com) (`RESEND_API_KEY`, `MAIL_FROM` s overenou doménou).
  Bez kľúča sa e-maily ukladajú do `DATA_DIR/outbox` (vývoj).
- E-maily sa posielajú **len pri predplatnom**; jednorazové objednávky sa sťahujú zo stránky.
- Stránka predplatného: `/pristupnost.html?sub=…&token=…` (história, PDF, správa platby).

### Administrácia

`/admin.html` – tržby, MRR, objednávky, predplatné, opakovanie neúspešných auditov,
ručné spustenie auditu predplatného, zrušenie. Prístup cez `ADMIN_TOKEN`
(bez neho je admin vypnutý). Odporúčame ho ešte chrániť na úrovni reverse proxy.

### Právne stránky

`/obchodne-podmienky.html` a `/ochrana-osobnych-udajov.html` sú **šablóny** – žlté
[polia] doplň a text daj skontrolovať právnikovi. Pred platbou zákazník povinne
zaškrtne súhlas s podmienkami a so začatím poskytovania služby (ukladá sa k objednávke).

### Dáta

Objednávky, predplatné, audity a PDF sa ukladajú ako súbory do `DATA_DIR` (predvolene `./data`).
Po reštarte servera sa rozpracované audity dokončia. Náhľady sa mažú po 24 hodinách,
nezaplatené objednávky po 7 dňoch, ostatné po `RETENTION_DAYS` (predvolene 180).

## Testy

```bash
npm test            # jednotkové + integračné testy (spúšťajú prehliadač)
npm run test:unit   # len rýchle jednotkové testy
npm run benchmark   # presnosť na W3C Before and After Demonstration
npm run images      # pregeneruje OG obrázky a ikony (po zmene SITE_NAME)
```

### Bezpečnosť

- Každá požiadavka prehliadača (aj obrázky, skripty, presmerovania) prechádza kontrolou,
  ktorá blokuje privátne a lokálne IP adresy (ochrana proti SSRF).
- Prístup k objednávke a PDF len s náhodným 192-bitovým tokenom.
- Rate limit na bezplatné testy (6/min na IP) a objednávky.

## SEO a jazykové verzie

| Stránka | SK | EN |
|---|---|---|
| Analýza webu | `/` | `/en/` |
| Audit prístupnosti | `/pristupnost` | `/en/accessibility-audit` |
| Obchodné podmienky | `/obchodne-podmienky` | `/en/terms` |
| Ochrana osobných údajov | `/ochrana-osobnych-udajov` | `/en/privacy` |

- Stránky renderuje server (`src/site/`) – vyhľadávače vidia celý obsah vrátane cien a FAQ bez JavaScriptu.
- Každá stránka má unikátny titulok a popis, `canonical`, `hreflang` (sk, en, x-default → en),
  Open Graph a X Card s obrázkom 1200×630, štruktúrované dáta (Organization, WebSite,
  WebApplication / Service s cenami, FAQPage, BreadcrumbList).
- `robots.txt`, `sitemap.xml` (s jazykovými alternatívami), web app manifest, ikony.
- Výsledky analýz, objednávky a predplatné (`?url=`, `?order=`, `?sub=`) majú `noindex`.
- Staré adresy `*.html` presmerujú 301 na nové (zachová sa query – napr. návrat zo Stripe).
- Výkon: Brotli/gzip, dlhodobá cache súborov s otlačkom (`?v=hash`), ETag, lokálny
  variabilný font Inter (bez Google Fonts), žiadne blokujúce skripty.
- **Nastav `PUBLIC_URL`** (napr. `https://audit.mojadomena.sk`) – používa sa v canonical,
  hreflang, sitemap a OG. Pri HTTPS server pridá hlavičku HSTS.
- Po spustení pridaj web do **Google Search Console** a **Bing Webmaster Tools** a odošli `/sitemap.xml`.

Overenie (21. 11. 2026, lokálne): Google Lighthouse 100 / 100 / 100 / 100 (výkon, prístupnosť,
osvedčené postupy, SEO) na desktope aj mobile, LCP 0,4 s (desktop) / 1,5–2,0 s (mobil), CLS 0.
Vlastný analyzátor: SEO 100 a audit prístupnosti 100 na všetkých stránkach (desktop aj mobil).

## Spustenie

Potrebuješ Node.js 20+. Základná analýza nemá závislosti; audit prístupnosti potrebuje
`axe-core` a `playwright` s prehliadačom Chromium.

```bash
cd web-analyzer
npm install
npx playwright install --with-deps chromium
npm start
```

Otvor <http://localhost:3000>. Konfigurácia cez premenné prostredia – pozri `.env.example`.

### Docker

```bash
docker build -t web-analyzer .
docker run -p 3000:3000 -v wa-data:/app/data \
  -e PUBLIC_URL=https://audit.mojadomena.sk \
  -e STRIPE_SECRET_KEY=sk_live_... -e STRIPE_WEBHOOK_SECRET=whsec_... \
  web-analyzer
```
Výsledok sa dá zdieľať odkazom `/?url=example.com`.

## API

- `GET /api/analyze?url=example.com` – rýchla analýza (`&fresh=1` obíde 5-minútovú cache)
- `POST /api/a11y/preview` `{ "url": "…" }` – bezplatný náhľad prístupnosti
- `POST /api/a11y/checkout` `{ "previewId": "…", "tier": "basic|standard|pro" }` – vytvorí objednávku / Stripe Checkout
- `GET /api/a11y/orders/:id?token=…` – stav objednávky
- `GET /api/a11y/orders/:id/report.pdf?token=…` – PDF správa
- `POST /api/a11y/subscribe` `{ "previewId", "email", "consent": true }` – predplatné Monitoring
- `GET /api/a11y/subscriptions/:id?token=…` – stav predplatného, `POST …/portal`, `POST …/cancel`
- `GET /api/admin/overview` (Bearer `ADMIN_TOKEN`) – admin prehľad
- `POST /api/stripe/webhook` – Stripe webhook

## Štruktúra

```
server.js          HTTP server, statické súbory, API, rate limit, cache
src/fetcher.js     sťahovanie stránok, presmerovania, SSRF ochrana, TLS certifikát
src/analyzer.js    všetky kontroly a výpočet skóre
src/html.js        ľahký HTML parser
src/tech.js        detekcia technológií
src/a11y/
  wcag.js          kritériá WCAG, mapovanie EN 301 549, slovenské preklady pravidiel, manuálne testy
  browser.js       zdieľaný Chromium (desktop/mobil), SSRF filter požiadaviek, limit súbežnosti
  checks.js        vlastné testy: klávesnica, reflow, cookie lišta, snímky chýb
  scanner.js       axe-core sken, crawler, ochrana proti botom, skóre, agregácia, porovnanie
  report.js        HTML šablóna PDF správy a jej render
  orders.js        náhľady, jednorazové objednávky, fronta auditov, uchovávanie dát
  subscriptions.js predplatné Monitoring, plánovač, e-maily, Stripe udalosti
  api.js           HTTP API vrátane administrácie
  store.js / stripe.js / mailer.js / tiers.js
src/site/
  i18n.js          jazyky a lokalizované adresy
  layout.js        hlavička (SEO metadáta, hreflang, OG, JSON-LD), navigácia, pätička
  pages/           obsah stránok v SK aj EN (analýza, audit, právne stránky, 404)
  client-i18n.js   texty pre JavaScript v prehliadači
  static.js        statické súbory, kompresia, cache
  index.js         smerovanie, presmerovania, robots.txt, sitemap.xml, manifest
src/a11y/wcag-en.js anglické texty WCAG pravidiel a kritérií
public/            app.js, a11y.js, i18n.js, theme.js, admin, styles.css, fonts/, img/
test/              node:test testy a testovacie stránky so známymi chybami
scripts/           benchmark na W3C BAD
docs/PRESNOST.md   ako sme overili presnosť
```

## Obmedzenia

- **Automatický test prístupnosti odhalí len časť problémov** (zložité komponenty,
  zrozumiteľnosť či kvalitu alt textov musí overiť človek) – viac v docs/PRESNOST.md. Správa to jasne uvádza a nie je
  certifikátom zhody ani právnym stanoviskom.

- Analyzuje sa HTML zo servera – obsah generovaný JavaScriptom (SPA) sa nevyhodnotí.
- Weby s ochranou proti botom (napr. Cloudflare challenge) môžu vrátiť 403.
- Výkon sa meria zo servera, kde aplikácia beží, nie z prehliadača návštevníka.
- SSRF ochrana blokuje privátne a lokálne IP adresy; pri verejnom nasadení odporúčame
  ešte reverse proxy s vlastným rate limitom.
