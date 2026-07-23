// backend/src/config/db.sync.js
const db = require('../models');
const { seedAchievements } = require('../seeds/achievements.seed');
const seedAdminData = require('../seeds/admin.seed');
//const seedTeams = require('../seeds/teams.seed');


// Synchronizácia databázy a vloženie počiatočných dát.
//
// POZNÁMKA K REŽIMOM (premenná DB_SYNC v .env):
//  - force -> pri každom štarte ZMAŽE a znovu vytvorí všetky tabuľky.
//             Vhodné len pri prvom rozbiehaní alebo keď chceš čistú DB.
//  - alter -> pokúsi sa upraviť existujúce tabuľky podľa modelov a ZACHOVÁ dáta.
//             Vhodné počas vývoja pri zmene modelov.
//  - off   -> NEROBÍ žiadnu zmenu schémy (žiadny sync). Vhodné pre PRODUKCIU
//             a bežné reštarty — tabuľky sa nemenia, len sa spustí appka.
//
// Ak DB_SYNC nie je nastavená, použije sa bezpečné "off" (bez zmeny schémy).
const syncDatabase = async () => {
  try {
    const dbSync = (process.env.DB_SYNC || 'off').toLowerCase();
    const isForce = dbSync === 'force';
    const isAlter = dbSync === 'alter';

    if (isForce) {
      // Pri force musíme dočasne vypnúť kontrolu cudzích kľúčov, inak MariaDB
      // nedovolí dropnúť tabuľky, na ktoré odkazujú FK z iných tabuliek
      // (napr. notifications/user_achievements/articles -> users). Bez tohto
      // drop potichu zlyhá, stará tabuľka users ostane a seed admina narazí
      // na duplicitu (ER_DUP_ENTRY 'administrator').
      await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      try {
        await db.sequelize.sync({ force: true });
      } finally {
        await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
      }
      console.log('Databáza synchronizovaná (režim: force).');
    } else if (isAlter) {
      await db.sequelize.sync({ alter: true });
      console.log('Databáza synchronizovaná (režim: alter).');
    } else {
      // off — žiadny sync schémy. Iba overíme spojenie.
      await db.sequelize.authenticate();
      console.log('Databáza pripravená (režim: off — bez zmeny schémy).');
    }

    // Definičné dáta (odznaky) sa upsertujú VŽDY — sú idempotentné a nezávisia
    // od toho, či je DB prázdna. Tým sa nové/zmenené odznaky doplnia aj v "alter"
    // režime bez nutnosti wipe-nút databázu.
    await seedAchievements();

    // Seed spustíme len pri "force" alebo keď je DB prázdna (žiadni používatelia).
    // Tým zabránime duplicitnému vkladaniu pri každom reštarte v "alter" režime.
    // V PRODUKCII sa testovací seed NIKDY nespúšťa — inak by prvý štart
    // s prázdnou DB vytvoril testovacích hráčov s heslom password123.
    const isProd = process.env.NODE_ENV === 'production';
    const userCount = await db.User.count();
    if (!isProd && (isForce || userCount === 0)) {
      console.log('Začínam testovací seed...');
      await seedAdminData();
      console.log('Administračné dáta boli vložené.');
    } else if (isProd && userCount === 0) {
      console.log('Produkcia s prázdnou DB — testovací seed preskočený. Prvého admina vytvor registráciou a povýš v DB (UPDATE users SET role=\'admin\' WHERE id=...).');
    } else {
      console.log('Dáta už existujú, seeding preskočený.');
    }
  } catch (error) {
    console.error('Chyba pri synchronizácii databázy:', error);
    throw error;
  }
};

module.exports = syncDatabase;