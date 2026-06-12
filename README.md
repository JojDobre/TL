# Tiperliga

Webová platforma na tipovanie športových zápasov. Používatelia tipujú výsledky
zápasov, zbierajú body a súťažia v rebríčkoch v rámci sezón a líg.

## Tech stack

**Backend**
- Node.js + Express (REST API)
- Sequelize ORM
- PostgreSQL
- JWT autentifikácia, bcrypt hashovanie hesiel

**Frontend**
- React
- Material UI (MUI)
- Axios

> Poznámka: Staršia verzia tohto README chybne uvádzala Django + MongoDB.
> Skutočný stack je vyššie uvedený.

## Štruktúra projektu

```
TL/
├── backend/            # Express API
│   ├── index.js        # Vstupný bod servera
│   └── src/
│       ├── config/     # Konfigurácia DB a synchronizácia
│       ├── controllers/# Logika endpointov
│       ├── middleware/  # Auth a kontrola rolí
│       ├── models/     # Sequelize modely
│       ├── routes/     # Definície API ciest
│       └── seeds/      # Počiatočné dáta
├── frontend/           # React aplikácia
│   └── src/
│       ├── components/ # UI komponenty podľa domén
│       ├── contexts/   # AuthContext
│       └── services/   # Volania API
└── docker-compose.yml  # PostgreSQL (+ Adminer) pre vývoj
```

## Požiadavky

- Node.js 18+ a npm
- Docker + Docker Compose (pre databázu)

## Rýchle spustenie (vývoj)

### 1. Databáza (Docker)

V koreňovom priečinku projektu:

```bash
docker compose up -d
```

Tým sa spustí PostgreSQL na porte `5432` a voliteľne Adminer na
`http://localhost:8080` (prihlásenie: server `db`, user `tiperliga`,
heslo `tiperliga_dev`, databáza `tiperliga`).

### 2. Backend

```bash
cd backend
cp .env.example .env        # uprav hodnoty podľa potreby
npm install
npm run dev                  # spustí server s nodemon na http://localhost:5000
```

Pri prvom spustení nastav v `backend/.env` premennú `DB_SYNC=force`, aby sa
vytvorili tabuľky a vložili počiatočné dáta. Po prvom úspešnom štarte ju zmeň
na `DB_SYNC=alter` (alebo ju odstráň), aby si pri ďalších reštartoch neprišiel
o dáta.

### 3. Frontend

V novom termináli:

```bash
cd frontend
cp .env.example .env
npm install
npm start                    # spustí React na http://localhost:3000
```

## Testovacie účty

Po seedovaní sú k dispozícii prednastavené účty (viď `backend/src/seeds/`).
Heslo pre admina a VIP účet je `user`. Ostatné testovacie účty používajú
heslo `password123`. Pred produkčným nasadením tieto účty zmeň alebo odstráň.

## Premenné prostredia

### backend/.env
| Premenná | Popis |
|----------|-------|
| `NODE_ENV` | `development` zapne synchronizáciu DB pri štarte |
| `PORT` | Port API (predvolene 5000) |
| `DB_HOST` / `DB_PORT` | Adresa PostgreSQL (localhost / 5432) |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Prístup k DB (musí sedieť s docker-compose) |
| `DB_SYNC` | `force` = zmazať a vytvoriť tabuľky, `alter` = zachovať dáta |
| `JWT_SECRET` | Tajný kľúč na podpisovanie JWT tokenov |

### frontend/.env
| Premenná | Popis |
|----------|-------|
| `REACT_APP_API_URL` | URL backend API (predvolene http://localhost:5000) |

## Zastavenie databázy

```bash
docker compose down       # zastaví kontajnery, dáta zostanú
docker compose down -v    # zastaví a zmaže aj dáta (čistý štart)
```

## Stav vývoja

Projekt je vo vývoji. Aktuálny plán a fázy nájdeš v dokumente vývojového plánu.
Hotová je základná hierarchia (sezóna → liga → kolo → zápas → tip) a rebríčky.
Pripravované: admin panel, história tipov, štatistiky, notifikácie a achievementy.
