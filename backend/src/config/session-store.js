// backend/src/config/session-store.js
//
// Perzistentný session store v MariaDB (express-mysql-session).
//
// Prečo: predvolený MemoryStore drží sessions v RAM — pri reštarte servera sa
// všetci používatelia odhlásia a pri viacerých inštanciách appky sessions
// nefungujú (a MemoryStore navyše časom "tečie"). Ukladaním do DB sessions
// prežijú reštart a fungujú aj pri škálovaní.
//
// Tabuľku `sessions` si modul vytvorí sám (createDatabaseTable: true).
// Používa rovnaké pripojovacie údaje ako aplikácia (z .env).

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

function createSessionStore() {
  const store = new MySQLStore({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // automaticky vytvorí tabuľku `sessions`, ak neexistuje
    createDatabaseTable: true,
    // upratovanie expirovaných sessions každých 15 minút
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    // životnosť záznamu = zhodná s cookie maxAge (7 dní)
    expiration: 1000 * 60 * 60 * 24 * 7,
  });

  // chyby storu nesmú zhodiť aplikáciu — len ich zalogujeme
  store.on('error', (err) => {
    console.error('[session-store] chyba MySQL session store:', err.message);
  });

  return store;
}

module.exports = { createSessionStore };
