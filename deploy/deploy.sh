#!/usr/bin/env bash
# deploy/deploy.sh — nasadenie novej verzie na serveri (spúšťa GitHub Actions cez SSH,
# dá sa spustiť aj ručne: `bash deploy/deploy.sh`).
#
# Kroky: stiahne vetvu z GitHubu → npm ci → migrácie DB → pm2 reload → health check.
# Ak sa aplikácia po reštarte neozve, automaticky sa vráti predchádzajúca verzia.
#
# Premenné (voliteľné):
#   DEPLOY_BRANCH  – vetva na nasadenie (predvolene main)
#   PM2_APP        – názov procesu v pm2 (predvolene tiperliga)
set -euo pipefail

# APP_ROOT = koreň repozitára (workflow spúšťa skript priamo z origin/main)
ROOT="${APP_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRANCH="${DEPLOY_BRANCH:-main}"
APP="${PM2_APP:-tiperliga}"
cd "$ROOT"

# pm2/node bývajú v ~/.nvm alebo /usr/local — pri SSH bez interaktívneho shellu
# nemusia byť v PATH
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
export PATH="$PATH:/usr/local/bin:$HOME/.npm-global/bin"

PORT="$(grep -E '^PORT=' backend/.env 2>/dev/null | head -1 | cut -d= -f2 | tr -d '[:space:]"' || true)"
PORT="${PORT:-5000}"

log() { echo "[deploy $(date '+%F %T')] $*"; }

health() {
  for _ in $(seq 1 30); do
    if curl -fsS --noproxy '*' "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  return 1
}

reload_app() {
  if pm2 describe "$APP" >/dev/null 2>&1; then
    # reload (bez výpadku); ak proces padá v slučke, reload zlyhá → tvrdý reštart
    pm2 reload "$APP" --update-env \
      || pm2 restart "$APP" --update-env \
      || { pm2 delete "$APP" >/dev/null 2>&1 || true; PM2_APP="$APP" pm2 start deploy/ecosystem.config.js; }
  else
    PM2_APP="$APP" pm2 start deploy/ecosystem.config.js
  fi
  pm2 save >/dev/null 2>&1 || true
}

install_deps() {
  (cd backend && npm ci --omit=dev --no-audit --no-fund)
}

PREV="$(git rev-parse HEAD)"
log "aktuálna verzia: ${PREV:0:7}, sťahujem origin/${BRANCH}"
git fetch --prune origin "$BRANCH"
git checkout -q "$BRANCH"
# len fast-forward — lokálne zmeny na serveri sa nikdy neprepíšu potichu
git merge --ff-only "origin/${BRANCH}"
NEW="$(git rev-parse HEAD)"

if [ "$PREV" = "$NEW" ]; then
  log "žiadne zmeny, kontrolujem len beh aplikácie"
fi

if ! git diff --quiet "$PREV" "$NEW" -- backend/package-lock.json || [ ! -d backend/node_modules ]; then
  log "inštalujem závislosti"
  install_deps
fi

log "migrácie databázy"
(cd backend && node src/config/migrate.js)

log "reštart aplikácie (${APP})"
reload_app

if health; then
  log "OK — beží verzia ${NEW:0:7}"
  exit 0
fi

log "CHYBA: aplikácia neodpovedá na /health — vraciam verziu ${PREV:0:7}"
git reset -q --hard "$PREV"
if ! git diff --quiet "$PREV" "$NEW" -- backend/package-lock.json; then install_deps || true; fi
reload_app || true
if health; then log "predchádzajúca verzia obnovená"; else log "POZOR: ani predchádzajúca verzia neodpovedá, skontroluj: pm2 logs ${APP}"; fi
exit 1
