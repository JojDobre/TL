// backend/src/seeds/initial-data.seed.js
//
// PORIADNY testovací seed balíček. Pokrýva rôzne stavy:
//  - sezóny: prebiehajúca / pripravovaná / ukončená, oficiálna / komunitná, súkromná
//  - ligy: prebiehajúca / ukončená (cez ended sezónu), oficiálna / custom, šablóna + klon
//  - kolá: otvorené / naplánované / ukončené (podľa dátumov)
//  - zápasy: vyhodnotené / čakajúce / neodohrané, aj zrušený, aj typ 1x2
//  - tipy s rôznymi bodmi (presný / čiastočný / mimo)
//
// Píše sa pre AKTUÁLNY model (joinCode ligy, scope/teamType tímov, dátumy/heslo
// sezóny, isTemplate/templateId, sourceMatchId). Idempotenciu nerieši — určené
// na spustenie s DB_SYNC=force (čistá DB).

const db = require('../models');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// pomocné: dátum posunutý o N dní od teraz
const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const code6 = () => uuidv4().substring(0, 6).toUpperCase();

async function seedAdminData() {

    console.log('Začínam seedovanie admin dát...');
    console.log('Vytváram používateľov...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const adminUser = await db.User.create({
      username: 'administrator',
      email: 'admin@example.com',
      password: '$2b$10$ksEjSjxcDlrSIWkvLTDI5Oj7pij2jU4oKqdk4nc3MP3wwEzyx8UUm',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      active: true
    });
 
  console.log('  ✓ testovací seed dokončený');
}
 
module.exports = seedAdminData;