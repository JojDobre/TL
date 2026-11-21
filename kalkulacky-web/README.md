# SpočítajSi – slovenské kalkulačky 2026 a 2027

Statický web (HTML + CSS + JS, bez servera a databázy) so slovenskými kalkulačkami. Zarába na **reklame (Google AdSense)** a **partnerských (affiliate) odkazoch**. Čo je hotové v SEO a čo musíte urobiť vy, popisuje **[SEO.md](SEO.md)**.

## Stránky (každá v priečinku s `index.html`, adresa `/nazov/`)

| Adresa | Čo robí |
|---|---|
| `/` | rozcestník |
| `/cista-mzda/` | čistá mzda z hrubej aj naopak, daňový bonus, cena práce |
| `/hypoteka/` | anuitná splátka, úroky spolu, splátkový kalendár, limity NBS |
| `/pn/` | náhrada príjmu (1. – 14. deň) a nemocenské od 15. dňa, limity 2026 aj 2027 |
| `/materska/` | materské 75 % DVZ, celková suma, rodičovský príspevok, limity 2026 aj 2027 |
| `/odvody-szco/` | odvody živnostníka podľa pravidiel od 1. 7. 2026 (mikroodvod) |
| `/dph/` | DPH 23 / 19 / 5 % |
| `/minimalna-mzda/` | minimálna mzda 2026 a 2027, v čistom, stupne náročnosti |
| `/priplatky/` | príplatky za sobotu, nedeľu, noc, sviatok a nadčas (2026 aj 2027) |
| `/danovy-bonus/` | daňový bonus na dieťa s limitom a krátením |
| `/nezdanitelna-cast/` | nezdaniteľná časť základu dane a úspora na dani |
| `/cestovne-nahrady/` | stravné (do 30. 11. a od 1. 12. 2026), krátenie za jedlo, náhrada za auto |
| `/sporenie/` | zložené úročenie s 19 % zrážkovou daňou z úrokov |
| `/e-faktura-2027/` | sprievodca povinnou e-faktúrou od 1. 1. 2027 |
| `/o-nas/` | o nás a metodika výpočtov (dôveryhodnosť pre Google) |
| `/ochrana-sukromia/` | zásady ochrany súkromia (potrebné pre AdSense) |

## Ako to funguje

- **Sadzby** sú na jednom mieste v `assets/calc.js` (objekty `P`, `D`, `CN`, `MZ`).
- **Doména, názov webu, titulky, popisy pre Google, súvisiace kalkulačky a zdroje** sú v `tools/site.config.js`.
- `node tools/build.js`: vygeneruje SEO značky, štruktúrované dáta, hlavičku, omrvinky, súvisiace kalkulačky, pätičku, karty na úvodnej stránke, `sitemap.xml`, `robots.txt`, manifest, 404, `_headers` a `_redirects`. Spúšťa sa po každej zmene, opakované spustenie je bezpečné.
- `node tools/generate-images.js`: vygeneruje ikony a náhľadové obrázky pre sociálne siete (stačí pri zmene názvov stránok).
- `node tests/calc.test.js`: testy výpočtov porovnané s oficiálnymi sumami (28 testov).
- `node tests/e2e.js`: test všetkých stránok v prehliadači na mobile aj desktope, okrajové vstupy a SEO kontroly (96 testov).

**Nová stránka:** vytvorte `nazov/index.html` podľa existujúcej stránky so značkami `<!-- SEO:START -->`, `<!-- BREADCRUMB:START -->` a `<!-- RELATED:START -->`, pridajte ju do `stranky` v `tools/site.config.js` a spustite `node tools/generate-images.js` a `node tools/build.js`.

---

## Krok za krokom: od kódu k peniazom

### 1. Doména (asi 10 – 15 € ročne)
Vyberte si krátku slovenskú doménu (napr. na websupport.sk alebo webglobe.sk) a overte, či je voľná. Potom ju nastavte v `tools/site.config.js` (`domena`) a spustite:
```bash
node tools/build.js
```
Ak chcete iný názov ako „SpočítajSi“, zmeňte `nazov` v konfigurácii a logo v `tools/build.js`, a potom spustite `node tools/generate-images.js` aj `node tools/build.js`.

### 2. Hosting (zadarmo)
Najjednoduchšie je **Cloudflare Pages** alebo **Netlify**: zaregistrujete sa a priečinok `kalkulacky-web` pretiahnete myšou do prehliadača. Potom pripojíte svoju doménu podľa ich návodu. Hosting je zadarmo aj pri vysokej návštevnosti.

### 3. Google Search Console (zadarmo, hneď po spustení)
Pridajte web na search.google.com/search-console, overte doménu a odošlite `sitemap.xml`. Podrobný postup je v [SEO.md](SEO.md).

### 4. Ochrana súkromia
V `ochrana-sukromia/index.html` a `o-nas/index.html` doplňte svoje meno alebo firmu, adresu a e-mail.

### 5. Google AdSense (keď web beží aspoň niekoľko týždňov)
1. Požiadajte o účet na adsense.google.com.
2. Kód vydavateľa (`ca-pub-…`) vložte do `adsenseClient` v `tools/site.config.js` a spustite `node tools/build.js`. Skript sa pridá na všetky indexované stránky.
3. Pre návštevníkov z EÚ zapnite v AdSense **Ochrana súkromia a správy → GDPR správa (súhlas s cookies)**. Je to Googlom certifikovaný súhlasový banner a vlastný netreba.
4. Reklamné jednotky vkladajte do prázdnych `<div class="ad-slot"></div>` (sú pod kalkulačkami), prípadne zapnite automatické reklamy.

### 6. Affiliate odkazy
Na stránkach sú pripravené boxy `<div class="partner">` s komentárom „Sem vložte affiliate odkaz“. Vhodní partneri:
- **fakturačné a účtovné programy** (e-faktúra 2027 je pre ne obrovská téma),
- **banky a podnikateľské účty** (pre živnostníkov),
- **online účtovníci**.

Mnohé slovenské SaaS firmy majú partnerské programy. Napíšte im a spýtajte sa, poskytnú vám odkaz a províziu.

### 7. Návštevnosť (toto rozhoduje o zárobku)
- **Teraz (november – január)** je ideálny čas: e-faktúra od 1. 1. 2027, nové odvody a mzdy na nový rok. Zdieľajte odkazy v FB skupinách pre živnostníkov a podnikateľov a na Reddite r/Slovakia, kde to dáva zmysel (bez spamu).
- Každý **január** treba aktualizovať sadzby v `assets/calc.js` a texty. Tituly s rokom („… 2027“) si ľudia vyhľadávajú najviac.
- Ďalšie stránky, ktoré je ľahké pridať: daňové priznanie a ročné zúčtovanie, dôchodok, ošetrovné (OČR), dohody o práci mimo pracovného pomeru, prídavok na dieťa.

---

## Realistické očakávania
- Reklama na slovenskom trhu zarába približne **1 – 5 € na 1 000 zobrazení**. 10 000 návštev mesačne teda znamená zhruba **10 – 50 € mesačne** z reklamy, viac s affiliate.
- SEO trvá **3 – 6 mesiacov**, kým Google začne posielať stabilnú návštevnosť. Konkurencia (napr. platy.sk, finančné portály) existuje, preto sa oplatí byť rýchlejší a aktuálnejší a pokryť menšie témy.
- Údržba: asi 1 – 2 hodiny za rok pri zmene sadzieb plus pridávanie nových kalkulačiek.

## Údržba sadzieb
Pri zmene legislatívy upravte objekt `P` v `assets/calc.js`, spustite `node tests/calc.test.js` a aktualizujte texty na stránkach (hľadajte „2026“). Hodnoty v tabuľke čistých miezd v `cista-mzda/index.html` a na stránke minimálnej mzdy sú vygenerované, takže ich po zmene sadzieb vygenerujte znova alebo prepíšte.

## Kedy aktualizovať (dôležité termíny)
- **1. 1. 2027:** nové sumy nemocenských dávok (max. DVZ podľa priemernej mzdy 2025: 1 620 €), minimálna mzda 2027, daňové pásma, nezdaniteľná časť, minimálne zdravotné odvody SZČO.
- **1. 7. 2027:** nové pásma a minimá sociálnych odvodov SZČO.
- Úrokové sadzby hypoték v texte (`hypoteka/index.html`) podľa mesačných štatistík NBS.
- Stravné: stránka už obsahuje sumy platné od 1. 12. 2026.

Výpočty sú orientačné. Zdroje sadzieb 2026: Finančná správa SR (pásma dane), Sociálna poisťovňa (odvody SZČO, nemocenské dávky), MPSVR SR (stravné, minimálna mzda, rodičovský príspevok), zákony č. 595/2003 (daň z príjmov), 461/2003 (sociálne poistenie), 462/2003 (náhrada príjmu), 580/2004 (zdravotné poistenie), 283/2002 (cestovné náhrady), 311/2001 (Zákonník práce) a 571/2009 Z. z. (rodičovský príspevok).
