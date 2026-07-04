// backend/src/bots/run-bots.js
//
// CLI na správu simulovaných hráčov (botov).
//
//   node src/bots/run-bots.js create 100     → vytvorí 100 botov (idempotentné)
//   node src/bots/run-bots.js tick           → jeden krok simulácie (do cronu)
//   node src/bots/run-bots.js status         → prehľad botov a ich aktivity
//   node src/bots/run-bots.js pause          → pozastaví všetkých botov (active=false)
//   node src/bots/run-bots.js resume         → opäť ich zapne
//
// Nasadenie: cron každých 20 minút, napr.:
//   */20 * * * * cd /cesta/k/backend && /usr/bin/node src/bots/run-bots.js tick >> logs/bots.log 2>&1

require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../models');
const { botIdentity } = require('./bot-names');
const { tick } = require('./bot-engine');

const DAY = 24 * 60 * 60 * 1000;

async function createBots(count) {
  // jedno silné náhodné heslo pre všetkých botov — nikto sa cez ne neprihlasuje
  const pw = await bcrypt.hash(require('crypto').randomBytes(24).toString('hex'), 10);
  let created = 0; let skipped = 0;
  for (let i = 0; i < count; i++) {
    const id = botIdentity(i);
    const exists = await db.User.findOne({ where: { email: id.email } });
    if (exists) { skipped++; continue; }
    // registrácia rozložená do minulých 60 dní, nech nevyzerá, že prišli naraz
    const createdAt = new Date(Date.now() - Math.floor(Math.random() * 60) * DAY - Math.floor(Math.random() * DAY));
    // ~40 % botov má generovaný avatar (iniciály), zvyšok používa fallback appky
    const avatar = Math.random() < 0.4
      ? `https://ui-avatars.com/api/?name=${encodeURIComponent(id.first + ' ' + id.last)}&background=random&size=128`
      : null;
    // username musí byť unikátny (DB constraint) — pri kolízii pridaj číslo
    let username = id.username.slice(0, 20);
    if (await db.User.findOne({ where: { username } })) username = `${username.slice(0, 16)}${i}`;
    await db.User.create({
      username,
      email: id.email,
      password: pw,
      firstName: Math.random() < 0.7 ? id.first : null,
      lastName: Math.random() < 0.5 ? id.last : null,
      profileImage: avatar,
      role: 'player',
      active: true,
      isBot: true,
      profilePublic: Math.random() < 0.85, // pár botov má súkromný profil — pôsobí prirodzene
      allowCompare: true,
      createdAt,
      updatedAt: createdAt,
    });
    created++;
  }
  console.log(`[bots] vytvorených: ${created}, preskočených (už existovali): ${skipped}`);
}

async function status() {
  const total = await db.User.count({ where: { isBot: true } });
  const active = await db.User.count({ where: { isBot: true, active: true } });
  const botIds = (await db.User.findAll({ where: { isBot: true }, attributes: ['id'] })).map((u) => u.id);
  const tips = botIds.length ? await db.Tip.count({ where: { userId: botIds } }) : 0;
  const seasons = botIds.length ? await db.Season.count({ where: { creatorId: botIds } }) : 0;
  const memberships = botIds.length ? await db.UserLeague.count({ where: { userId: botIds } }) : 0;
  console.log(`[bots] spolu: ${total} | aktívni: ${active} | tipov: ${tips} | členstiev v ligách: ${memberships} | založených súťaží: ${seasons}`);
}

async function setActive(value) {
  const [n] = await db.User.update({ active: value }, { where: { isBot: true } });
  console.log(`[bots] ${value ? 'zapnutých' : 'pozastavených'}: ${n}`);
}

(async () => {
  const cmd = process.argv[2];
  try {
    await db.sequelize.authenticate();
    if (cmd === 'create') {
      const n = Number(process.argv[3]) || 100;
      await createBots(n);
    } else if (cmd === 'tick') {
      await tick();
    } else if (cmd === 'status') {
      await status();
    } else if (cmd === 'pause') {
      await setActive(false);
    } else if (cmd === 'resume') {
      await setActive(true);
    } else {
      console.log('Použitie: node src/bots/run-bots.js create [N] | tick | status | pause | resume');
    }
    process.exit(0);
  } catch (e) {
    console.error('[bots] chyba:', e.message);
    process.exit(1);
  }
})();
