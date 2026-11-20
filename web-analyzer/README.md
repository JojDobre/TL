# Web Analyzer

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
| Základ | 19 € | 5 | zhrnutie, právny rámec, porušené kritériá, chyby s návodom a príkladmi kódu |
| Štandard | 29 € | 15 | + tabuľka všetkých kritérií WCAG ↔ EN 301 549, kontrolný zoznam manuálnych testov |
| Pro | 49 € | 40 | + prioritizovaný plán nápravy, predvyplnená šablóna Vyhlásenia o prístupnosti |

Ceny a obsah balíkov sa menia v `src/a11y/tiers.js` (cenu nikdy neposiela klient).

### Platby (Stripe)

- Bez `STRIPE_SECRET_KEY` beží **DEMO režim** – objednávky sa spracujú bez platby a stránka
  to zreteľne zobrazuje. **Na produkcii vždy nastav kľúč.**
- V Stripe Dashboarde vytvor webhook na `https://tvoja-domena/api/stripe/webhook`
  s udalosťami `checkout.session.completed` a `checkout.session.async_payment_succeeded`
  a jeho tajomstvo ulož do `STRIPE_WEBHOOK_SECRET`. Podpis sa overuje (HMAC SHA-256).
- Platba sa overí aj priamo cez Stripe API pri návrate zákazníka, takže audit sa spustí
  aj keď webhook mešká.
- DPH, faktúry a potvrdenia o platbe nastav v Stripe (Stripe Tax, Invoicing, e-mailové potvrdenia).

### Dáta

Objednávky, audity a PDF sa ukladajú ako súbory do `DATA_DIR` (predvolene `./data`).
Po reštarte servera sa rozpracované audity dokončia. Náhľady sa mažú po 24 hodinách.

### Bezpečnosť

- Každá požiadavka prehliadača (aj obrázky, skripty, presmerovania) prechádza kontrolou,
  ktorá blokuje privátne a lokálne IP adresy (ochrana proti SSRF).
- Prístup k objednávke a PDF len s náhodným 192-bitovým tokenom.
- Rate limit na bezplatné testy (6/min na IP) a objednávky.

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
  browser.js       zdieľaný Chromium, SSRF filter požiadaviek, limit súbežnosti
  scanner.js       axe-core sken, crawler podstránok, skóre a agregácia
  report.js        HTML šablóna PDF správy a jej render
  orders.js        náhľady, objednávky, Stripe, fronta auditov
  tiers.js         cenník balíkov
public/            frontend (index.html + app.js, pristupnost.html + a11y.js, styles.css)
```

## Obmedzenia

- **Automatický test prístupnosti odhalí len časť problémov** (ovládanie klávesnicou,
  zrozumiteľnosť či kvalitu alt textov musí overiť človek). Správa to jasne uvádza a nie je
  certifikátom zhody ani právnym stanoviskom.

- Analyzuje sa HTML zo servera – obsah generovaný JavaScriptom (SPA) sa nevyhodnotí.
- Weby s ochranou proti botom (napr. Cloudflare challenge) môžu vrátiť 403.
- Výkon sa meria zo servera, kde aplikácia beží, nie z prehliadača návštevníka.
- SSRF ochrana blokuje privátne a lokálne IP adresy; pri verejnom nasadení odporúčame
  ešte reverse proxy s vlastným rate limitom.
