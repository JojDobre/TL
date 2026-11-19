# Tifo – Android appka (Google Play)

Appka je **TWA (Trusted Web Activity)**: otvorí tifo.sk na celú obrazovku
cez Chrome, bez adresného riadku. Obsah appky je teda web (`/app/*`), takže
**zmeny na webe sa v appke prejavia hneď**, bez novej verzie v obchode.
Novú verziu do obchodu treba len pri zmene ikony, názvu alebo Android nastavení.

| | |
|---|---|
| Balík (nemenný) | `sk.tifo.app` |
| Názov v obchode | Tifo – Tipovacia liga |
| Názov pod ikonou | Tifo |
| Štartovacia adresa | `https://tifo.sk/app?source=twa` |
| Android | od 7.0 (API 24), cieľ Android 16 (API 36) |

Projekt vygeneroval nástroj Bubblewrap od Googlu z `twa-manifest.json`.

---

## 1. Podpisový kľúč (upload key)

Súbor `tifo-upload.jks` a jeho heslo **nikdy nedávaj do repozitára**. Ulož si
ich bezpečne (správca hesiel + záloha). Pri Google Play App Signing je to
len „nahrávací" kľúč: ak sa stratí, Google ho na požiadanie vymení.

Odtlačok SHA-256 nahrávacieho kľúča (je už v `/.well-known/assetlinks.json`):

```
23:F0:4C:CB:54:FB:7D:6D:8C:66:C3:AD:0F:B9:2C:07:42:7A:4D:FB:04:DC:A0:6B:D7:11:0B:33:24:D3:6F:2A
```

## 2. Prvé nahratie do Google Play Console

1. **Vytvor aplikáciu**: Play Console → *Vytvoriť aplikáciu* → názov
   `Tifo – Tipovacia liga`, jazyk slovenčina, *Aplikácia*, *Zadarmo*.
2. **Testovanie → Uzavreté testovanie** → vytvor stopu (napr. „Testeri") →
   *Vytvoriť nové vydanie* → nahraj `app-release.aab`.
   Google Play App Signing nechaj zapnuté (predvolené).
3. **Dôležité – odtlačok od Googlu:** *Nastavenie → Integrita aplikácie →
   Podpisovanie aplikácie* → skopíruj **SHA-256 odtlačok „Kľúč na podpisovanie
   aplikácie"** a na serveri ho pridaj do `backend/.env`:

   ```
   TWA_SHA256=AA:BB:CC:...
   ```

   potom `pm2 restart tiperliga`. Over na
   https://tifo.sk/.well-known/assetlinks.json, že sú tam oba odtlačky.
   Bez tohto kroku appka z Google Play ukáže hore adresný riadok.
4. **Testeri:** nový osobný účet musí mať **aspoň 12 testerov prihlásených
   14 dní za sebou** v uzavretom teste, až potom môžeš požiadať o produkciu.
   Testerov pridáš e-mailom (Google účty) alebo cez Google skupinu; pošli im
   odkaz na pripojenie k testu z Play Console.
5. Po 14 dňoch: *Produkcia → Požiadať o prístup k produkcii* → vyplň dotazník
   o testovaní → nahraj vydanie do produkcie.

## 3. Stránka v obchode (Hlavný záznam v obchode)

Súbory sú v `android/store/`:

| Položka | Súbor |
|---|---|
| Ikona aplikácie 512×512 | `store_icon.png` |
| Hlavná grafika 1024×500 | `store/feature-graphic.png` |
| Snímky obrazovky telefónu (2–8) | `store/screenshots/*.png` (1080×1920) |

**Krátky popis** (max. 80 znakov):

```
Tipuj výsledky zápasov, súťaž s kamarátmi a stúpaj v rebríčkoch.
```

**Úplný popis:**

```
Tifo je tipovacia liga pre fanúšikov futbalu, hokeja a ďalších športov. Tipuj výsledky zápasov, zbieraj body a porovnaj sa s kamarátmi aj s celou komunitou.

• Oficiálne súťaže aj vlastné ligy pre partiu z práce či z ihriska
• Tipovanie presného výsledku alebo víťaza – tip zmeníš až do výkopu
• Automatické vyhodnocovanie výsledkov a prideľovanie bodov
• Rebríčky líg, sezón aj celkový rebríček s posunmi v poradí
• Pripomienky pred uzávierkou, aby ti neušiel žiadny zápas
• Štatistiky, presnosť tipov a odznaky za úspechy

Účasť je zadarmo a nehrá sa o peniaze – Tifo nie je stávková aplikácia. V niektorých ligách môžu organizátori venovať vecné ceny; pravidlá nájdeš priamo v detaile ligy.
```

Kategória: **Šport**. Kontakt: e-mail podpory, web `https://tifo.sk`.

### Anglický preklad záznamu (English, en-US)

Appka sa pri prvom spustení prepne do jazyka zariadenia (slovenčina pre sk/cs,
inak angličtina), preto pridaj v Play Console → *Hlavný záznam v obchode* →
*Spravovať preklady* aj angličtinu:

**Short description** (max. 80 characters):

```
Predict match scores, compete with friends and climb the leaderboards.
```

**Full description:**

```
Tifo is a prediction league for fans of football, ice hockey and other sports. Predict match scores, collect points and compare yourself with your friends and the whole community.

• Official competitions and private leagues for your friends or colleagues
• Predict the exact score or the winner – change your prediction until kick-off
• Results are scored automatically and points are awarded instantly
• League, season and overall leaderboards with position changes
• Deadline reminders, so you never miss a match
• Statistics, prediction accuracy and achievement badges

Taking part is free and no money is involved – Tifo is not a betting app. In some leagues the organisers may offer non-cash prizes; the rules are shown in each league.
```

Poznámka: obrazovky appky, prihlásenie, registrácia a spodná lišta sú
preložené; podstránky otvárané z appky (detail kola, nastavenia, sezóny)
sú zatiaľ po slovensky.

## 4. Obsah aplikácie (dotazníky v Play Console)

- **Zásady ochrany súkromia:** `https://tifo.sk/sukromie`
- **Zmazanie účtu** (povinné pri appkách s účtami):
  - v appke: *Profil → Nastavenia → Vymazať účet*,
  - webová adresa: `https://tifo.sk/zmazanie-uctu`.
- **Reklamy:** *Nie, aplikácia neobsahuje reklamy* (kým v appke nie je AdSense).
- **Prístup k aplikácii:** časť funkcií je za prihlásením → zadaj testovací
  účet pre recenzentov Google (vytvor napr. `recenzia@tifo.sk` s heslom
  a členstvom v oficiálnej lige).
- **Hodnotenie obsahu (IARC):** kategória „Iné/Šport"; žiadne násilie,
  sex, vulgarizmy. Na otázky o hazarde: **nie** – žiadne stávky ani hra
  o skutočné peniaze, žiadne simulované kasíno. Používatelia medzi sebou
  komunikujú? **Nie** (ak niet chatu/komentárov).
- **Cieľová skupina:** 18+ (odporúčané pre súťaže s cenami).
- **Bezpečnosť údajov (Data safety):**
  - Zbiera appka údaje? **Áno.** Šifrované pri prenose? **Áno** (HTTPS).
    Môžu používatelia požiadať o zmazanie? **Áno.**
  - *Osobné údaje:* e-mailová adresa, meno (voliteľné), ID používateľa –
    účel: správa účtu, funkčnosť aplikácie. Povinné (e-mail), voliteľné (meno).
  - *Aktivita v aplikácii:* tipy a interakcie v aplikácii – funkčnosť,
    analytika.
  - *Fotky:* nie (profilová fotka je len odkaz na URL, ktorý zadá používateľ).
  - Ak je na webe zapnutá Google Analytics (`GA_MEASUREMENT_ID`): pridaj
    *Analytika* ako účel pri „Aktivite v aplikácii" a „ID zariadenia
    alebo iné ID".
  - Zdieľanie s tretími stranami: **nie** (poskytovatelia služieb, ktorí
    spracúvajú údaje v mene prevádzkovateľa, sa za zdieľanie nepovažujú).
- **Súťaže s cenami:** Google vyžaduje, aby pravidlá súťaže boli dostupné
  a jasne uvádzali, že Google nie je sponzor. V pravidlách sezón s cenami
  uveď vetu: *„Google nie je sponzorom tejto súťaže ani sa na nej nijako
  nepodieľa."*

## 5. Nová verzia appky

Nová verzia je potrebná len pri zmene ikony, názvu, farieb či Android
nastavení (obsah sa mení cez web).

1. GitHub Secrets (raz): `ANDROID_KEYSTORE_BASE64` (obsah `tifo-upload.jks`
   v base64) a `ANDROID_KEYSTORE_PASSWORD`.
2. GitHub → **Actions → Android appka → Run workflow** → zadaj vyššie číslo
   zostavenia (2, 3, …) a verziu (napr. 1.0.1).
3. Stiahni `.aab` z *Artifacts* a nahraj ho do Play Console.

Lokálne zostavenie (vyžaduje JDK 17+ a Android SDK):

```bash
cd android
```

```bash
TIFO_KEYSTORE=/cesta/tifo-upload.jks TIFO_KEYSTORE_PASSWORD='heslo' ./gradlew bundleRelease
```
