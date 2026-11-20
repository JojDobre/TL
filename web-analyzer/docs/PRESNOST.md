# Presnosť auditu prístupnosti

Tento dokument popisuje, ako sme overili, že audit nachádza skutočné chyby a nehlási
falošné. Overenie sa dá kedykoľvek zopakovať (`npm test`, `npm run benchmark`).

## 1. Testovacie stránky so známymi chybami (`npm test`)

V `test/fixtures/` sú stránky, pri ktorých presne vieme, čo je na nich zle.

| Stránka | Čo obsahuje | Očakávaný výsledok | Stav |
|---|---|---|---|
| `bad.html` | 10 zámerne vložených chýb: obrázok bez alt, slabý kontrast, pole bez popisu, tlačidlo a odkaz bez názvu, chýbajúci jazyk, odkaz bez viditeľného fokusu, klikateľný `<div>` mimo klávesnice, prvok zakrytý prekryvom, blok s pevnou šírkou 800 px | nájde všetkých 10 a ukáže na správne prvky | ✅ |
| `trap.html` | pole, z ktorého sa klávesom Tab nedá odísť | nájde pascu, nič iné | ✅ |
| `good.html` | správne postavená stránka (popisy, kontrast, viditeľný fokus, responzívna) | **žiadny nález** na desktope ani na mobile | ✅ |
| `challenge.html` | stránka ochrany proti botom (HTTP 403) | audit sa odmietne | ✅ |

Integračné testy boli spustené opakovane bez rozdielu vo výsledkoch (testy klávesnice sú
citlivé na časovanie, preto to overujeme).

## 2. W3C „Before and After Demonstration“ (`npm run benchmark`)

[W3C BAD](https://www.w3.org/WAI/demos/bad/) je oficiálne demo W3C: rovnaký web v
neprístupnej („before“) a opravenej („after“) verzii. Výsledok (4 stránky, 20. 11. 2026):

| Stránka | Before – typy / výskyty | After – typy / výskyty |
|---|---|---|
| home | 7 / 47 | 2 / 4 |
| news | 6 / 48 | 2 / 4 |
| tickets | 7 / 44 | 2 / 4 |
| survey | 7 / 45 | 2 / 4 |
| **spolu** | **8 / 184** | **2 / 16** |

Skóre: before **19**, after **72**.

**Nálezy na opravenej verzii sme ručne preverili – sú oprávnené:**

- `wa-reflow` (WCAG 2.1 – 1.4.10): opravená verzia z roku 2008 má pevné rozloženie 768 px,
  pri šírke 320 px sa naozaj musí skrolovať do strán. Kritérium pribudlo až vo WCAG 2.1.
- `target-size` (WCAG 2.2 – 2.5.8): odkazy „Report“ v lište dema majú výšku 20 px
  (minimum je 24 px). Kritérium pribudlo vo WCAG 2.2.

Poznámka: w3.org blokuje headless prehliadače (Cloudflare), preto benchmark stránky
sťahuje cez Node a prehliadač ich načíta z lokálneho zrkadla – obsah je totožný.

## 3. Overenie nálezov na reálnych weboch

Pri vývoji sme vlastné kontroly preverili ručne na skutočných weboch:

- **Viditeľný fokus** – na zoznam.sk má odkaz v CSS nastavený `outline`, no na obrazovke
  sa nezobrazí (snímky so zameraním a bez neho sú zhodné). Nález je skutočný – práve
  preto test porovnáva snímky namiesto čítania CSS.
- **Reflow** – na bazos.sk je stránka pri šírke 320 px široká 561 px (prázdne prvky
  našepkávača s pevnou šírkou 328 px). Nález je skutočný.
- **Zakrytý fokus** – prvý návrh hlásil nestabilné nálezy spôsobené reklamami, ktoré
  prvok zakryli len na okamih. Doplnili sme opätovné overenie po 0,5 s; nález sa hlási,
  len ak trvá.
- **Ochrana proti botom** – w3.org vrátil prehliadaču stránku „Len chvíľu…“ (HTTP 403).
  Skener ju pôvodne auditoval ako bežný web. Teraz ju rozpozná a audit odmietne už pri
  bezplatnom teste, takže zákazník za takýto web nezaplatí.

## 4. Čo audit garantuje a čo nie

| Spoľahlivosť | Kontroly |
|---|---|
| **Vysoká** (takmer bez falošných poplachov) | axe-core pravidlá (alt texty, popisy polí, názvy tlačidiel a odkazov, jazyk, ARIA, kontrast), pasca pre klávesnicu, reflow, ovládacie prvky s rolou/onclick mimo klávesnice |
| **Vysoká, s výhradou** | viditeľný fokus – ak sa indikátor zobrazí ďalej než 8 px od prvku (napr. zmena farby celej karty), test ho nevidí a môže hlásiť chybu; zakrytý fokus – overuje sa len úplné zakrytie |
| **Zámerne konzervatívne** (radšej prehliadne) | klikateľné prvky len so `cursor: pointer` sa nehlásia; animácie a pohyblivý obsah vedú k tomu, že fokus sa považuje za viditeľný |
| **Neoverí automat** | zrozumiteľnosť textov, kvalitu alt textov, titulky videí, správanie zložitých komponentov (menu, modálne okná), chybové hlásenia formulárov, obsah za prihlásením |

Automatický audit preto stále odhalí len časť problémov. PDF správa to uvádza a obsahuje
kontrolný zoznam manuálnych testov.

## 5. Skóre

Skóre 0–100 je vlastný vzorec (exponenciálny pokles podľa závažnosti a počtu výskytov),
nie štandard. Slúži na porovnanie v čase (monitoring), nie ako percento splnených kritérií.
