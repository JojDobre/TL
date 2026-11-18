// backend/src/config/monitoring.js
//
// Monitoring chýb (voliteľný). Keď je v .env nastavené SENTRY_DSN, chyby
// servera (HTTP 5xx, neošetrené výnimky a odmietnuté promisy) sa posielajú do
// Sentry (https://sentry.io — bezplatný plán stačí). Bez SENTRY_DSN sa nič
// neodosiela a modul je no-op.
//
// .env:
//   SENTRY_DSN=https://...@o0.ingest.sentry.io/0
//   SENTRY_ENVIRONMENT=production   (voliteľné)

let Sentry = null;

function init() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  try {
    // eslint-disable-next-line global-require
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
      release: require('../utils/asset-version'),
      tracesSampleRate: 0,          // len chyby, žiadne meranie výkonu (šetrí kvótu)
      sendDefaultPii: false,        // neposielať IP a cookies používateľov
    });
    console.log('[monitoring] Sentry zapnuté');
    return true;
  } catch (e) {
    Sentry = null;
    console.error('[monitoring] Sentry sa nepodarilo zapnúť:', e.message);
    return false;
  }
}

function capture(err, context) {
  if (!Sentry) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch (e) { /* monitoring nesmie zhodiť appku */ }
}

// Globálne poistky — zaloguj (a pošli) a nepadni ticho.
function installProcessHandlers() {
  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
    capture(reason instanceof Error ? reason : new Error(String(reason)));
  });
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    capture(err);
    // po neošetrenej výnimke je stav procesu neistý → nech ho pm2 reštartuje
    const exit = () => process.exit(1);
    if (Sentry) Sentry.flush(2000).then(exit, exit); else exit();
  });
}

module.exports = { init, capture, installProcessHandlers };
