// backend/src/config/db.sync.js
const db = require('../models');
const seedInitialData = require('../seeds/initial-data.seed');

// Synchronizácia databázy a vloženie počiatočných dát.
//
// POZNÁMKA K REŽIMOM:
//  - force: true  -> pri každom štarte ZMAŽE a znovu vytvorí všetky tabuľky.
//                    Vhodné len pri prvom rozbiehaní alebo keď chceš čistú DB.
//  - alter: true  -> pokúsi sa upraviť existujúce tabuľky podľa modelov a ZACHOVÁ dáta.
//                    Vhodnejšie počas bežného vývoja, keď nechceš strácať dáta.
//
// Režim sa riadi premennou DB_SYNC v .env (hodnoty: "force" alebo "alter").
// Ak nie je nastavená, použije sa bezpečnejší "alter".
const syncDatabase = async () => {
  try {
    const mode = process.env.DB_SYNC === 'force'
      ? { force: true }   // zmaže a vytvorí nanovo
      : { alter: true };  // zachová dáta, len upraví štruktúru

    await db.sequelize.sync(mode);
    console.log(`Databáza synchronizovaná (režim: ${process.env.DB_SYNC || 'alter'}).`);

    // Seed spustíme len pri "force" alebo keď je DB prázdna (žiadni používatelia).
    // Tým zabránime duplicitnému vkladaniu pri každom reštarte v "alter" režime.
    const userCount = await db.User.count();
    if (process.env.DB_SYNC === 'force' || userCount === 0) {
      await seedInitialData();
      console.log('Inicializačné dáta boli vložené.');
    } else {
      console.log('Dáta už existujú, seeding preskočený.');
    }
  } catch (error) {
    console.error('Chyba pri synchronizácii databázy:', error);
    throw error;
  }
};

module.exports = syncDatabase;
