# SEO: čo je hotové a čo treba urobiť

## ✅ Čo je v kóde hotové

**Technické SEO**
- Čisté adresy `/cista-mzda/` (fungujú rovnako na Cloudflare Pages, Netlify aj GitHub Pages), presmerovania starých `*.html` adries (`_redirects`).
- Unikátny `title` a `description` na každej stránke, napísané podľa reálnych fráz z vyhľadávania Google.
- `canonical`, `hreflang="sk"`, `robots` (ochrana súkromia a 404 majú `noindex`).
- `sitemap.xml` s dátumom aktualizácie, `robots.txt`, stránka 404 so stavovým kódom 404.
- Štruktúrované dáta (JSON-LD): `WebSite` + `Organization` (úvod), `WebApplication` (kalkulačky), `Article` (e-faktúra, minimálna mzda), `BreadcrumbList` (omrvinky vo výsledkoch Google), `FAQPage`.
- Open Graph a Twitter karty s vlastným náhľadovým obrázkom 1200×630 pre každú stránku (pekný náhľad pri zdieľaní na Facebooku, WhatsAppe a Messengeri).
- Favicon (SVG + PNG 48 px pre Google), ikona pre iPhone, `site.webmanifest`.
- `_headers`: dlhé cache pre CSS a JS (s verziou v adrese), bezpečnostné hlavičky, `noindex` pre testy a nástroje.

**Rýchlosť a prístupnosť:** Lighthouse **100 / 100 / 100 / 100** (výkon, prístupnosť, osvedčené postupy, SEO) na všetkých 15 indexovaných stránkach. Web nemá žiadne externé fonty ani knižnice. Stránka vrátane štýlov a skriptov má okolo 40 kB a po kompresii približne 12 kB.

**Obsah a dôveryhodnosť (E-E-A-T):** financie patria pre Google medzi témy „Your Money or Your Life“, kde veľmi záleží na dôveryhodnosti. Preto web obsahuje:
- stránku **O nás a metodika** so zoznamom zákonov,
- pri každej kalkulačke **zdroje** (Finančná správa, Sociálna poisťovňa…) a **dátum poslednej kontroly**,
- vysvetlenie výpočtu, vzorce, tabuľky a časté otázky.

**Interné prepojenie:** omrvinky, blok „Súvisiace kalkulačky“, pätička so všetkými kalkulačkami, odkazy v textoch.

**Nové stránky podľa vyhľadávaní:** minimálna mzda 2026 a 2027, daňový bonus na dieťa 2026, nezdaniteľná časť 2026. Rok 2027 pribudol v PN, materskej a príplatkoch (ľudia ho už hľadajú: „kalkulačka pn 2027“, „materska kalkulacka 2027“, „príplatky 2027“).

---

## 🚀 Čo musíte urobiť pri spustení (asi 1 hodina)

1. **Doména:** v `tools/site.config.js` nastavte `domena`. Doplňte svoje údaje v `o-nas/index.html` a `ochrana-sukromia/index.html` a spustite `node tools/build.js`.
2. **Nahrajte web** (Cloudflare Pages alebo Netlify). Priečinky `tests/` a `tools/` môžu zostať, majú `noindex`.
3. **Google Search Console** (search.google.com/search-console):
   - pridajte doménu a overte ju (DNS záznam, alebo meta tag: vložte kód do `googleVerifikacia` v konfigurácii a spustite build),
   - v časti *Sitemapy* odošlite `https://vasa-domena.sk/sitemap.xml`,
   - cez *Kontrola webovej adresy → Požiadať o indexovanie* pošlite najdôležitejšie stránky: úvod, čistá mzda, PN, minimálna mzda, e-faktúra.
4. **Bing Webmaster Tools** (bing.com/webmasters): importujte web zo Search Console jedným kliknutím. Bing poháňa aj vyhľadávanie v ChatGPT a Copilote.
5. **Cloudflare:** zapnite *Crawler Hints* (IndexNow), aby Bing a ďalšie vyhľadávače dostávali zmeny okamžite.
6. **Náhľady pri zdieľaní** si overte na developers.facebook.com/tools/debug.

---

## 🔑 Mapa kľúčových slov (reálne frázy z našepkávača Google)

| Stránka | Hlavné frázy |
|---|---|
| Čistá mzda | výpočet čistej mzdy 2026, čistá mzda kalkulačka, hrubá mzda na čistú, čistá mzda z minimálnej mzdy, *(od decembra: čistá mzda 2027)* |
| PN | kalkulačka pn 2026, výpočet pn z platu, výpočet pn prvých 10 dní, nemocenská 2026, kalkulačka pn 2027 |
| Materská | materská kalkulačka 2026, materská 2027, rodičovský príspevok 2026 |
| Minimálna mzda | minimálna mzda 2026, minimálna mzda 2027, minimálna mzda v čistom, stupne náročnosti |
| Príplatky | príplatky za sobotu a nedeľu 2026, príplatky 2027, príplatok za nedeľu, príplatky za nadčas |
| Odvody SZČO | odvody živnostníka 2026, odvody szčo od 1.7.2026, mikroodvod 2026, odvody živnostníka 2027 |
| DPH | dph kalkulačka, výpočet dph zo sumy, výpočet dph vzorec |
| Cestovné náhrady | stravné 2026, stravné pri pracovnej ceste 2026, cestovné náhrady 2026 auto |
| Daňový bonus | daňový bonus na dieťa 2026, daňový bonus 2027 |
| Nezdaniteľná časť | nezdaniteľná časť základu dane 2026, nezdaniteľná časť 2026 mesačne |
| E-faktúra | e-faktúra 2027, e-faktúra od 1.1.2027, e-faktúra finančná správa |
| Sporenie, hypotéka | úroková kalkulačka sporenie, hypotekárna kalkulačka, hypotéka splátka výpočet |

**Pozor:** hľadanosť frázy s rokom 2027 bude prudko rásť od decembra. Kto má v januári aktuálne čísla ako prvý, získa návštevnosť na celý rok.

---

## 📅 Kalendár aktualizácií (rozhoduje o pozíciách)

| Kedy | Čo urobiť |
|---|---|
| **december 2026** | Po zverejnení parametrov 2027 (životné minimum, daňové pásma, nezdaniteľná časť) aktualizovať `assets/calc.js` a prepnúť titulky čistej mzdy, daňového bonusu a nezdaniteľnej časti na „2027“. Pridať 2027 do odvodov SZČO (zdravotné od 1. 1. 2027). |
| **1. 1. 2027** | Predvolený rok v PN, materskej a príplatkoch sa prepne na 2027 automaticky. Zmeniť `aktualizovane` v konfigurácii a spustiť build. |
| **jún 2027** | Odvody SZČO od 1. 7. 2027 (minimum približne 322,22 €, mikroodvod 139,61 €). |
| **každý mesiac** | Úrok hypoték v texte podľa štatistiky NBS. Pozrieť Search Console: ktoré otázky ľudia hľadajú a doplniť ich do častých otázok. |

Po každej vecnej zmene upravte `aktualizovane` v `tools/site.config.js` a spustite `node tools/build.js`. Dátum sa prepíše na stránkach, v štruktúrovaných dátach aj v sitemape.

---

## 🔗 Spätné odkazy (bez nich sa nový web presadzuje ťažko)

Odkazy z iných webov sú pre nový web najväčšia brzda. Bezpečné spôsoby, ako ich získať:
1. **Odpovedajte na otázky** v FB skupinách pre živnostníkov, mamičky na materskej či účtovníkov, na fóre Modrý koník a na Reddite r/Slovakia. Pomôžte konkrétnou odpoveďou a odkaz pridajte, len keď skutočne pomôže. Nespamujte.
2. **Ponúknite kalkulačky blogom a účtovníkom** na vloženie na ich web s odkazom „Zdroj: SpočítajSi“. Takýto widget viem pripraviť.
3. **Zaraďte web do katalógov:** Zoznam.sk katalóg, Atlas.sk, Azet katalóg a podobné.
4. **Napíšte tlačovú správu** k zmenám („Čo sa mení v roku 2027“) pre regionálne a ekonomické weby. Novinári radi citujú konkrétne čísla.
5. **Oslovte partnerov affiliate programov** (fakturačné programy, banky). Často majú blog a zoznam nástrojov.

**Čo nerobiť:** nekupujte odkazy, nevytvárajte stovky automaticky generovaných stránok a nekopírujte texty z iných webov. Google za to web penalizuje.

---

## 📈 Realistické očakávania

- Nový web sa začína zobrazovať o **2 až 8 týždňov**, stabilnejšie pozície prichádzajú po **3 až 6 mesiacoch**.
- Pri silnej konkurencii (platy.sk, finančné portály, banky) má nový web najväčšiu šancu na **dlhších a aktuálnych frázach**: „kalkulačka pn 2027“, „mikroodvod 2026“, „stravné od 1.12.2026“, „minimálna mzda 2027 v čistom“.
- **Rozšírené výsledky:** omrvinky a dátumy Google zobrazuje bežne. Rozbaľovacie často kladené otázky (FAQ) dnes ukazuje takmer výlučne pri webových stránkach štátu a zdravotníckych inštitúcií. Dáta sú však užitočné pre iné vyhľadávače a AI asistentov, preto ich web obsahuje.
