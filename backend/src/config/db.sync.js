// backend/src/config/db.sync.js
const db = require('../models');
const seedInitialData = require('../seeds/initial-data.seed');
const { seedAchievements } = require('../seeds/achievements.seed');
const { seedArticles } = require('../seeds/articles.seed');
const seedTeams = require('../seeds/teams.seed');


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
    const isForce = process.env.DB_SYNC === 'force';
    const mode = isForce
      ? { force: true }   // zmaže a vytvorí nanovo
      : { alter: true };  // zachová dáta, len upraví štruktúru

    if (isForce) {
      // Pri force musíme dočasne vypnúť kontrolu cudzích kľúčov, inak MariaDB
      // nedovolí dropnúť tabuľky, na ktoré odkazujú FK z iných tabuliek
      // (napr. notifications/user_achievements/articles -> users). Bez tohto
      // drop potichu zlyhá, stará tabuľka users ostane a seed admina narazí
      // na duplicitu (ER_DUP_ENTRY 'administrator').
      await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      try {
        await db.sequelize.sync(mode);
      } finally {
        await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      }
    } else {
      await db.sequelize.sync(mode);
    }
    console.log(`Databáza synchronizovaná (režim: ${process.env.DB_SYNC || 'alter'}).`);

    // Definičné dáta (odznaky, články) sa upsertujú VŽDY — sú idempotentné
    // a nezávisia od toho, či je DB prázdna.
    // await seedAchievements();

    // Seed spustíme len pri "force" alebo keď je DB prázdna (žiadni používatelia).
    // Tým zabránime duplicitnému vkladaniu pri každom reštarte v "alter" režime.
    const userCount = await db.User.count();
    if (isForce || userCount === 0) {
      console.log('Začínam testovací seed...');
      await seedInitialData();
      await seedArticles();
      await seedTeams();
      await seedAchievements();
      console.log('Testovacie dáta boli vložené.');
    } else {
      console.log('Dáta už existujú, seeding preskočený.');
    }
  } catch (error) {
    console.error('Chyba pri synchronizácii databázy:', error);
    throw error;
  }
};

module.exports = syncDatabase;