# Nasadenie, zálohy a monitoring

## 1. Automatické nasadenie z GitHubu

Po každom pushnutí (alebo zlúčení pull requestu) do vetvy `main` spustí GitHub
Actions ([`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)):

1. **kontrolu kódu**: syntax JS a skompilovanie všetkých EJS šablón
   (`npm run check`). Ak kontrola zlyhá, na server sa nič nenasadí.
2. **nasadenie cez SSH**: na serveri sa spustí [`deploy.sh`](deploy.sh). Skript:
   - stiahne novú verziu (`git merge --ff-only`, lokálne zmeny na serveri
     nikdy neprepíše),
   - nainštaluje závislosti (`npm ci`), ak sa zmenil `package-lock.json`,
   - spustí migrácie databázy,
   - reštartuje aplikáciu cez `pm2 reload`,
   - overí `/health`. Ak aplikácia do 60 s neodpovedá,
     **automaticky vráti predchádzajúcu verziu**.

Nasadenie sa dá spustiť aj ručne: GitHub → **Actions** → **Deploy** → **Run workflow**.

### Jednorazové nastavenie

**a) SSH kľúč pre GitHub** (na svojom počítači alebo na serveri):

```bash
ssh-keygen -t ed25519 -f tifo-deploy -N "" -C "github-deploy"
```

Obsah `tifo-deploy.pub` pridaj na serveri do `~/.ssh/authorized_keys`
používateľa, pod ktorým beží pm2. Súkromný kľúč (`tifo-deploy`) vlož do GitHubu.

**b) GitHub Secrets**: repozitár → Settings → Secrets and variables → Actions → *New repository secret*:

| Secret | Hodnota |
|---|---|
| `VPS_HOST` | IP adresa alebo doména servera |
| `VPS_USER` | používateľ na serveri |
| `VPS_SSH_KEY` | celý obsah súboru `tifo-deploy` (vrátane riadkov BEGIN/END) |
| `VPS_APP_DIR` | cesta k repozitáru na serveri, napr. `/home/tifo/TL` |
| `VPS_PORT` | *(voliteľné)* SSH port, ak nie je 22 |
| `PM2_APP` | *(voliteľné)* názov procesu v pm2, predvolene `tiperliga` |

> Prihlasovacie údaje k serveru nikomu neposielaj. Patria len do GitHub Secrets.

**c) Server**: repozitár musí byť naklonovaný cez `git clone` a vetva `main`
musí mať nastavený `origin`. Pri súkromnom repozitári pridaj serveru
*deploy key* s právom na čítanie (repozitár → Settings → Deploy keys).

**d) pm2**: zisti, pod akým názvom aplikácia beží (`pm2 ls`). Máš dve možnosti:
- nastav secret `PM2_APP` na existujúci názov, alebo
- prejdi na pripravenú konfiguráciu (z koreňa repozitára):

  ```bash
  pm2 delete <starý-názov>
  ```

  ```bash
  pm2 start deploy/ecosystem.config.js && pm2 save
  ```

## 2. Odporúčané nastavenia v `backend/.env` na serveri

- `DB_SYNC=off`: schému mení len migrácia, nie `alter` pri každom štarte.
- `NODE_ENV=production`: v chybových odpovediach API sa neukazuje stack trace
  a cookie sú `secure`. **Vyžaduje HTTPS** (nginx) a vlastný `SESSION_SECRET`.
- `AUTO_RESULTS_*` a `TSDB_*`: automatické výsledky, viď `backend/.env.example`.

## 3. Zálohy databázy

[`backup-db.sh`](backup-db.sh) vytvorí komprimovanú zálohu (`mariadb-dump
--single-transaction`, bez zamknutia tabuliek) a zmaže zálohy staršie ako
14 dní. Údaje k DB číta z `backend/.env`.

Pridaj do cronu na serveri (`crontab -e`), napríklad každý deň o 3:17:

```
17 3 * * * /bin/bash /home/tifo/TL/deploy/backup-db.sh >> /home/tifo/TL/backups/backup.log 2>&1
```

Obnova zo zálohy:

```bash
gunzip -c backups/tiperliga-2026-11-18-0317.sql.gz | mariadb -u tiperliga -p tiperliga
```

Tip: zálohy občas skopíruj aj mimo servera (napr. `rclone` na Google Drive).

## 4. Monitoring

- **Dostupnosť**: endpoint `GET /health` vráti `200 {"status":"ok"}`, keď beží
  aplikácia aj databáza, inak `503`. Zadaj ho do bezplatného
  [UptimeRobot](https://uptimerobot.com) (kontrola každých 5 min, upozornenie e-mailom).
- **Chyby**: po nastavení `SENTRY_DSN` v `backend/.env` sa chyby servera
  (HTTP 5xx, neošetrené výnimky) posielajú do [Sentry](https://sentry.io)
  (bezplatný plán stačí). Bez `SENTRY_DSN` sa nič neodosiela.
- **Pomalé stránky**: requesty dlhšie ako `SLOW_REQUEST_MS` (predvolene 800 ms)
  sa zapíšu do `pm2 logs` ako `[slow]`. Každá odpoveď má hlavičku `Server-Timing`.
