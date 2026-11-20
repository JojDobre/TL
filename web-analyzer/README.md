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

## Spustenie

Potrebuješ Node.js 18.17+. Projekt nemá žiadne závislosti.

```bash
cd web-analyzer
npm start
```

Otvor <http://localhost:3000>. Port zmeníš premennou `PORT`.
Výsledok sa dá zdieľať odkazom `/?url=example.com`.

## API

`GET /api/analyze?url=example.com` vráti JSON s výsledkami (`&fresh=1` obíde 5-minútovú cache).

## Štruktúra

```
server.js          HTTP server, statické súbory, API, rate limit, cache
src/fetcher.js     sťahovanie stránok, presmerovania, SSRF ochrana, TLS certifikát
src/analyzer.js    všetky kontroly a výpočet skóre
src/html.js        ľahký HTML parser
src/tech.js        detekcia technológií
public/            frontend (index.html, styles.css, app.js)
```

## Obmedzenia

- Analyzuje sa HTML zo servera – obsah generovaný JavaScriptom (SPA) sa nevyhodnotí.
- Weby s ochranou proti botom (napr. Cloudflare challenge) môžu vrátiť 403.
- Výkon sa meria zo servera, kde aplikácia beží, nie z prehliadača návštevníka.
- SSRF ochrana blokuje privátne a lokálne IP adresy; pri verejnom nasadení odporúčame
  ešte reverse proxy s vlastným rate limitom.
