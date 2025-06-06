const db = require('../models');
const seedTeams = require('../seeds/teams.seed');
const seedInitialData = require('../seeds/initial-data.seed');


const syncDatabase = async () => {
  try {
    // Synchronizácia všetkých modelov s databázou
    // { force: true } vymaže existujúce tabuľky a vytvorí ich znova - POUŽIŤ LEN PRE VÝVOJ!
    // Pre produkciu použite { alter: true } alebo žiadne parametre
    await db.sequelize.sync({ force: true });
    console.log('Databáza bola úspešne synchronizovaná.');
    
    // Môžeme tu pridať inicializačné dáta (seeders)
    await initializeData();
    await seedInitialData();
    
    console.log('Inicializačné dáta boli úspešne vložené do databázy.');
  } catch (error) {
    console.error('Chyba pri synchronizácii databázy:', error);
  }
};

// Funkcia pre vloženie základných dát do databázy
const initializeData = async () => {
  // Príklad vloženia základných dát - môžete upraviť podľa potreby
  try {
    // Vytvorenie admin používateľa
    const adminUser = await db.User.create({
      username: 'admin',
      email: 'admin@admin.com',
      password: '$2b$10$ksEjSjxcDlrSIWkvLTDI5Oj7pij2jU4oKqdk4nc3MP3wwEzyx8UUm', // heslo: user
      role: 'admin',
      firstName: 'Admin',
      lastName: 'User',
    });

    const vipUser = await db.User.create({
      username: 'vip',
      email: 'vip@vip.com',
      password: '$2b$10$ksEjSjxcDlrSIWkvLTDI5Oj7pij2jU4oKqdk4nc3MP3wwEzyx8UUm', // heslo: user
      role: 'vip',
      firstName: 'vip',
      lastName: 'User',
    });
    
    console.log('Admin používateľ bol vytvorený:', adminUser.id);

    // Vloženie základných tímov
    await seedTeams();
    
    // Vytvorenie základných achievementov
    const achievements = [
      {
        name: 'Prvé kroky',
        description: 'Zadaj svoj prvý tip',
        criteria: 'tips_count',
        value: 1,
        icon: 'award-icon-1.png',
      },
      {
        name: 'Presný strelec',
        description: 'Uhádni 5 presných výsledkov',
        criteria: 'exact_score',
        value: 5,
        icon: 'award-icon-2.png',
      },
      {
        name: 'Tipovací majster',
        description: 'Získaj 100 bodov v jednej sezóne',
        criteria: 'season_points',
        value: 100,
        icon: 'award-icon-3.png',
      },
    ];
    
    for (const achievement of achievements) {
      await db.Achievement.create(achievement);
    }
    
    console.log('Základné achievementy boli vytvorené');
    
    // Vytvorenie oficiálnych tímov
    const teams = [
      { name: 'FC Barcelona', logo: 'barcelona.png', type: 'official' },
      { name: 'Real Madrid', logo: 'real_madrid.png', type: 'official' },
      { name: 'Manchester United', logo: 'man_utd.png', type: 'official' },
      { name: 'Bayern Munich', logo: 'bayern.png', type: 'official' },
      { name: 'Liverpool', logo: 'liverpool.png', type: 'official' },
    ];
    
    for (const team of teams) {
      await db.Team.create(team);
    }
    
    console.log('Oficiálne tímy boli vytvorené');
    
  } catch (error) {
    console.error('Chyba pri inicializácii dát:', error);
    throw error;
  }
};

// Exportovanie funkcie pre použitie v iných častiach aplikácie
module.exports = syncDatabase;