#!/usr/bin/env bash
# deploy/backup-db.sh — denná záloha databázy (gzip) s rotáciou.
#
# Cron (každý deň o 3:17), napr. `crontab -e`:
#   17 3 * * * /bin/bash /cesta/k/TL/deploy/backup-db.sh >> /cesta/k/TL/backups/backup.log 2>&1
#
# Premenné (voliteľné):
#   BACKUP_DIR   – kam ukladať (predvolene <repo>/backups)
#   KEEP_DAYS    – koľko dní zálohy držať (predvolene 14)
# Prihlasovacie údaje k DB sa čítajú z backend/.env (DB_HOST, DB_PORT, DB_USER,
# DB_PASSWORD, DB_NAME) a heslo sa neobjaví v zozname procesov.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

val() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e 's/[[:space:]]*#.*$//' -e 's/^"//' -e 's/"$//' | tr -d '\r'; }
DB_HOST="$(val DB_HOST)"; DB_PORT="$(val DB_PORT)"; DB_USER="$(val DB_USER)"
DB_PASSWORD="$(val DB_PASSWORD)"; DB_NAME="$(val DB_NAME)"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
CNF="$(mktemp)"
trap 'rm -f "$CNF"' EXIT
chmod 600 "$CNF"
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword=%s\n' "${DB_HOST:-localhost}" "${DB_PORT:-3306}" "$DB_USER" "$DB_PASSWORD" > "$CNF"

DUMP="$(command -v mariadb-dump || command -v mysqldump)"
FILE="$BACKUP_DIR/${DB_NAME}-$(date +%F-%H%M).sql.gz"
# --single-transaction: konzistentná záloha bez zamknutia tabuliek (InnoDB)
"$DUMP" --defaults-extra-file="$CNF" --single-transaction --routines --triggers --quick "$DB_NAME" | gzip -9 > "$FILE"
chmod 600 "$FILE"

# kontrola, že záloha nie je prázdna
if [ "$(gzip -cd "$FILE" | head -c 1000 | wc -c)" -lt 100 ]; then
  echo "[backup] CHYBA: záloha $FILE je prázdna"; exit 1
fi
find "$BACKUP_DIR" -name "${DB_NAME}-*.sql.gz" -mtime +"$KEEP_DAYS" -delete
echo "[backup] $(date '+%F %T') OK: $FILE ($(du -h "$FILE" | cut -f1))"
