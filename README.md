# Tiperliga

Webová platforma na tipovanie športových zápasov. Používatelia tipujú výsledky
zápasov, zbierajú body podľa nastaviteľného bodovacieho systému a súťažia
v rebríčkoch v rámci hierarchie **sezóna → liga → kolo → zápas → tip**.

Aplikácia je **server-rendered** (Node.js + Express + EJS šablóny) — beží ako
jeden celok, ktorý vracia hotové HTML stránky aj JSON API pre akcie cez `fetch`.

## Funkcie

- **Sezóny a ligy** – oficiálne aj komunitné súťaže, klasické sezóny aj
  samostatné turnaje (standalone), súkromné súťaže chránené heslom a kódom.
- **Šablóny líg** – admin pripraví oficiálnu ligu, ktorú si používatelia
  naklonujú; výsledky sa do klonov propagujú z originálu.
- **Tipovanie** – presný výsledok (1:0) aj tip na víťaza (1 / X / 2, prípadne
  1 / 2 bez remízy pre tenis, šípky a pod.).
- **Bodovanie** – nastaviteľný systém (presný výsledok, správny víťaz, gólový
  rozdiel, počet gólov tímu); po štarte kola sa uzamkne.
- **Rebríčky** – globálne, sezónne, ligové aj po kolách, vrátane váženej presnosti tipov.
- **Štatistiky a profily** – história tipov, porovnanie hráčov, verejné profily.
- **Achievementy** – odznaky udeľované automaticky podľa reálnych dát.
- **Notifikácie** – nové kolá, uzávierky, výsledky, posuny v rebríčku.
- **Blog** – články spravované adminom.
- **Roly** – `admin`, `vip`, `player`; ochrana stránok aj API cez session.
- **Obnova hesla** – e-mailom cez Resend (voliteľné).

## Tech stack

**Backend / aplikácia**
- Node.js + Express
- EJS (server-side šablóny vo `views/`)
- Sequelize ORM
- **MariaDB** (10.11 LTS)
- `express-session` autentifikácia (session cookie), `bcrypt` na hashovanie hesiel
- `helmet`, `morgan`, `express-validator`
- Resend na odosielanie e-mailov (voliteľné)

**Frontend**
- Žiadny samostatný SPA framework — UI tvoria EJS šablóny renderované serverom.
- Klientske vylepšenia (animácie, odpočty, dropdowny, téma) rieši
  `public/js/enhance.js`; štýly sú v `public/css/`.

> ℹ **Poznámka k histórii:** staršie verzie tohto README chybne uvádzali
> Django + MongoDB, neskôr React + PostgreSQL + JWT. Skutočný a aktuálny stack
> je uvedený vyššie (Express + EJS + MariaDB + session-auth).

## Štruktúra projektu

```
TL/
├── backend/                 # Celá aplikácia (Express + EJS)
│   ├── index.js             # Vstupný bod servera
│   ├── .env.example         # Vzor konfigurácie
│   ├── public/              # Statické súbory (CSS, enhance.js, obrázky, ikony)
│   ├── views/               # EJS šablóny stránok
│   │   └── partials/        # Spoločné časti (navbar, footer, hlavičky…)
│   └── src/
│       ├── config/          # Konfigurácia DB (db.config.js) a sync (db.sync.js)
│       ├── controllers/     # Logika stránok (*Page) aj JSON API
│       ├── middleware/      # Auth (session/JWT), validácia, error handling
│       ├── models/          # Sequelize modely a asociácie
│       ├── routes/          # API routy (/api/*) a stránkové routy
│       ├── seeds/           # Počiatočné/testovacie dáta
│       ├── services/        # E-mail (Resend)
│       └── utils/           # Bodovanie, presnosť, achievement engine, notifikácie
└── docker-compose.yml       # MariaDB + Adminer pre vývoj
```

## Požiadavky

- Node.js 18+ a npm
- Docker + Docker Compose (na databázu MariaDB)

## Rýchle spustenie (vývoj)

### 1. Databáza (Docker)

V koreňovom priečinku projektu:

```bash
docker compose up -d
```

Spustí sa **MariaDB** na porte `3306` a **Adminer** na
`http://localhost:8080` (server `db`, user `tiperliga`, heslo `tiperliga_dev`,
databáza `tiperliga`).

### 2. Aplikácia

```bash
cd backend
cp .env.example .env        # uprav hodnoty podľa potreby
npm install
npm run dev                  # nodemon na http://localhost:5000
```

Aplikácia beží na `http://localhost:5000` — odtiaľ sa otvárajú všetky stránky.

> **Prvé spustenie:** v `backend/.env` dočasne nastav `DB_SYNC=force`, aby sa
> vytvorili tabuľky a vložil testovací seed. Po prvom úspešnom štarte prepni
> späť na `DB_SYNC=alter`, inak sa pri každom reštarte DB zmaže a naseeduje nanovo.

### npm skripty

| Príkaz | Popis |
|--------|-------|
| `npm run dev` | Vývojový režim s automatickým reštartom (nodemon) |
| `npm start` | Produkčný štart (`node index.js`) |
| `npm run seed:teams` | Voliteľné naseedovanie tímov samostatne |

## Testovacie účty

Po seedovaní (`DB_SYNC=force`) sú k dispozícii prednastavené účty. Prihlasuje sa
**e-mailom a heslom**. Heslo je pre všetky účty `password123`.

| Rola   | E-mail               |
|--------|----------------------|
| admin  | `admin@tiperliga.sk` |
| vip    | `vip@tiperliga.sk`   |
| player | `peter@tiperliga.sk` |
| player | `jana@tiperliga.sk`  |
| player | `marek@tiperliga.sk` |
| player | `lucia@tiperliga.sk` |

> Pred produkčným nasadením tieto účty zmeň alebo odstráň.

## Premenné prostredia (`backend/.env`)

| Premenná | Povinné | Popis |
|----------|---------|-------|
| `NODE_ENV` | – | `development` / `production`; v produkcii zapne `secure` cookie |
| `PORT` | – | Port aplikácie (predvolene `5000`) |
| `DB_HOST` / `DB_PORT` | ✓ | Adresa MariaDB (`localhost` / `3306`) |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | ✓ | Prístup k DB (musí sedieť s `docker-compose.yml`) |
| `DB_SYNC` | – | `force` = zmazať a vytvoriť tabuľky + seed, `alter` = zachovať dáta |
| `SESSION_SECRET` | ✓ | Tajný kľúč na podpis session cookie |
| `JWT_SECRET` | – | Voliteľné; len pre JWT-chránené API endpointy cez Bearer token |
| `RESEND_API_KEY` | – | Voliteľné; bez neho sa e-maily (obnova hesla) neodošlú |
| `EMAIL_FROM` / `CONTACT_TO` / `APP_URL` | – | Voliteľné nastavenia e-mailov a odkazov |

Tajný kľúč vygeneruješ napr.:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Zastavenie databázy

```bash
docker compose down       # zastaví kontajnery, dáta zostanú
docker compose down -v    # zastaví a zmaže aj dáta (čistý štart)
```

## Autentifikácia

Aplikácia používa **server-side session** (`express-session`, cookie `httpOnly`).
Stránky chráni `requireLogin` / `requireAdmin`, JSON akcie `apiRequireLogin` /
`apiRequireAdmin`. JWT modul je v kóde ponechaný len ako voliteľný doplnok pre
prípadných API klientov a aktivuje sa iba pri nastavenom `JWT_SECRET`.

## Stav vývoja

Hotová je celá základná hierarchia (sezóna → liga → kolo → zápas → tip),
bodovanie, rebríčky, štatistiky, profily, história tipov, notifikácie,
achievementy, blog a admin panel.

