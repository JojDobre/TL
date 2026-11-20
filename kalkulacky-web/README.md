# SpočítajSi – slovenské kalkulačky 2026

Statický web (HTML + CSS + JS, bez servera a databázy) so slovenskými kalkulačkami. Zarába na **reklame (Google AdSense)** a **partnerských (affiliate) odkazoch**.

| Stránka | Čo robí |
|---|---|
| `index.html` | rozcestník |
| `cista-mzda.html` | čistá mzda z hrubej aj naopak, daňový bonus, cena práce |
| `hypoteka.html` | anuitná splátka, úroky spolu, splátkový kalendár, limity NBS |
| `pn.html` | náhrada príjmu (1. – 14. deň) a nemocenské od 15. dňa |
| `materska.html` | materské 75 % DVZ, celková suma, rodičovský príspevok |
| `odvody-szco.html` | odvody živnostníka podľa pravidiel od 1. 7. 2026 (mikroodvod) |
| `dph.html` | DPH 23 / 19 / 5 % |
| `priplatky.html` | príplatky za sobotu, nedeľu, noc, sviatok, nadčas a minimálne mzdové nároky |
| `cestovne-nahrady.html` | stravné (sumy do 30. 11. a od 1. 12. 2026), krátenie za jedlo, náhrada za auto |
| `sporenie.html` | zložené úročenie s 19 % zrážkovou daňou z úrokov |
| `e-faktura-2027.html` | sprievodca povinnou e-faktúrou od 1. 1. 2027 |
| `ochrana-sukromia.html` | zásady ochrany súkromia (potrebné pre AdSense) |

Všetky sadzby sú na jednom mieste v `assets/calc.js` (objekty `P`, `D`, `CN`, `MZ`).

- `node tests/calc.test.js`: testy výpočtov porovnané s oficiálnymi sumami (24 testov)
- `node tests/e2e.js`: test všetkých stránok v prehliadači na mobile aj desktope vrátane okrajových vstupov (58 testov)
- `node tools/build-layout.js`: po pridaní stránky obnoví hlavičku, pätičku a `sitemap.xml` na všetkých stránkach. Novú stránku najprv pridajte do zoznamu `stranky` v skripte.

---

## Krok za krokom: od kódu k peniazom

### 1. Doména (asi 10 – 15 € ročne)
Vyberte si krátku slovenskú doménu (napr. na websupport.sk alebo webglobe.sk) a overte, či je voľná. Potom vo všetkých súboroch nahraďte `VASA-DOMENA.sk` svojou doménou:
```bash
grep -rl "VASA-DOMENA.sk" . | xargs sed -i 's/VASA-DOMENA\.sk/vasadomena.sk/g'
```
Ak chcete iný názov ako „SpočítajSi“, zmeňte ho v hlavičkách a pätičkách stránok.

### 2. Hosting (zadarmo)
Najjednoduchšie je **Cloudflare Pages** alebo **Netlify**: zaregistrujete sa a priečinok `kalkulacky-web` pretiahnete myšou do prehliadača. Potom pripojíte svoju doménu podľa ich návodu. Hosting je zadarmo aj pri vysokej návštevnosti.

### 3. Google Search Console (zadarmo, hneď po spustení)
Pridajte web na search.google.com/search-console, overte doménu a odošlite `sitemap.xml`. Bez toho bude Google web nachádzať pomaly.

### 4. Ochrana súkromia
V `ochrana-sukromia.html` doplňte svoje meno alebo firmu, adresu a e-mail.

### 5. Google AdSense (keď web beží aspoň niekoľko týždňov)
1. Požiadajte o účet na adsense.google.com.
2. Kód, ktorý dostanete, vložte do `<head>` každej stránky (miesto je označené komentárom `<!-- AdSense ... -->`).
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
- Ďalšie stránky, ktoré je ľahké pridať: daňové priznanie a ročné zúčtovanie, dôchodok, ošetrovné (OČR), dohody o práci mimo pracovného pomeru, prídavok na dieťa, minimálna mzda 2027.

---

## Realistické očakávania
- Reklama na slovenskom trhu zarába približne **1 – 5 € na 1 000 zobrazení**. 10 000 návštev mesačne teda znamená zhruba **10 – 50 € mesačne** z reklamy, viac s affiliate.
- SEO trvá **3 – 6 mesiacov**, kým Google začne posielať stabilnú návštevnosť. Konkurencia (napr. platy.sk, finančné portály) existuje, preto sa oplatí byť rýchlejší a aktuálnejší a pokryť menšie témy.
- Údržba: asi 1 – 2 hodiny za rok pri zmene sadzieb plus pridávanie nových kalkulačiek.

## Údržba sadzieb
Pri zmene legislatívy upravte objekt `P` v `assets/calc.js`, spustite `node tests/calc.test.js` a aktualizujte texty na stránkach (hľadajte „2026“). Hodnoty v tabuľke čistých miezd v `cista-mzda.html` sú vygenerované, takže ich po zmene sadzieb vygenerujte znova alebo prepíšte.

## Kedy aktualizovať (dôležité termíny)
- **1. 1. 2027:** nové sumy nemocenských dávok (max. DVZ podľa priemernej mzdy 2025: 1 620 €), minimálna mzda 2027, daňové pásma, nezdaniteľná časť, minimálne zdravotné odvody SZČO.
- **1. 7. 2027:** nové pásma a minimá sociálnych odvodov SZČO.
- Úrokové sadzby hypoték v texte (`hypoteka.html`) podľa mesačných štatistík NBS.
- Stravné: stránka už obsahuje sumy platné od 1. 12. 2026.

Výpočty sú orientačné. Zdroje sadzieb 2026: Finančná správa SR (pásma dane), Sociálna poisťovňa (odvody SZČO, nemocenské dávky), MPSVR SR (stravné, minimálna mzda, rodičovský príspevok), zákony č. 595/2003 (daň z príjmov), 461/2003 (sociálne poistenie), 462/2003 (náhrada príjmu), 580/2004 (zdravotné poistenie), 283/2002 (cestovné náhrady), 311/2001 (Zákonník práce) a 571/2009 Z. z. (rodičovský príspevok).
