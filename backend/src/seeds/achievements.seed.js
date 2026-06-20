// backend/src/seeds/achievements.seed.js
//
// Naplní/aktualizuje tabuľku `achievements` podľa centrálnej definície.
// Idempotentné — podľa `code`: chýbajúce vytvorí, existujúce aktualizuje
// (názov, popis, ikona, rarity, kritérium, hodnota, measurable, poradie).

const { Achievement } = require('../models');
const { ACHIEVEMENTS } = require('./achievements.def');

async function seedAchievements() {
  console.log('Seedujem odznaky...');
  for (const def of ACHIEVEMENTS) {
    const existing = await Achievement.findOne({ where: { code: def.code } });
    if (existing) {
      await existing.update({
        name: def.name, description: def.description, icon: def.icon,
        rarity: def.rarity, criteria: def.criteria, value: def.value,
        measurable: def.measurable, sortOrder: def.sortOrder,
      });
    } else {
      await Achievement.create(def);
    }
  }
  console.log(`Odznaky naseedované (${ACHIEVEMENTS.length}).`);
}

module.exports = { seedAchievements };
