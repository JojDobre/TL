// backend/src/config/db.sync.js
const db = require('../models');
const seedTeams = require('../seeds/teams.seed');

// Synchronizácia databázy a naplnenie základných GLOBÁLNYCH tímov.
//
// REŽIMY (premenná DB_SYNC v .env):
//  - force: true  -> pri každom štarte ZMAŽE a znovu vytvorí všetky tabuľky
//                    (vhodné pri zmene modelov alebo prvom rozbiehaní).
//  - alter: true  -> upraví existujúce tabuľky podľa modelov a ZACHOVÁ dáta
//                    (vhodné počas bežného vývoja). Toto je predvolené.
//
// POZN.: Staré demo `initial-data.seed.js` sa už NEPOUŽÍVA — koliduje s novým
// modelom (joinCode ligy, scope/teamType tímov). Namiesto neho seedujeme len
// základné globálne tímy; sezóny/ligy/kolá si vytváraš cez aplikáciu.
const syncDatabase = async () => {
  try {
    const mode = process.env.DB_SYNC === 'force'
      ? { force: true }
      : { alter: true };

    await db.sequelize.sync(mode);
    console.log(`Databáza synchronizovaná (režim: ${process.env.DB_SYNC || 'alter'}).`);

    // Naseeduj základné globálne tímy (idempotentne — duplikáty preskočí).
    // Spustí sa pri force alebo keď v DB ešte nie sú žiadne tímy.
    const teamCount = await db.Team.count();
    if (process.env.DB_SYNC === 'force' || teamCount === 0) {
      const added = await seedTeams();
      console.log(`Naseedovaných ${added} základných tímov.`);
    } else {
      console.log('Tímy už existujú, seeding tímov preskočený.');
    }
  } catch (error) {
    console.error('Chyba pri synchronizácii databázy:', error);
    throw error;
  }
};

module.exports = syncDatabase;