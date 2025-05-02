// backend/src/seeds/teams.seed.js
const { Team } = require('../models');

const seedTeams = async () => {
  try {
    // Kontrola, či už existujú tímy
    const teamsCount = await Team.count();
    
    if (teamsCount > 0) {
      console.log('Tímy už existujú v databáze. Preskakujem seeding.');
      return;
    }
    
    // Vytvorenie základných tímov
    const teams = [
      { 
        name: 'FC Barcelona', 
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/1200px-FC_Barcelona_%28crest%29.svg.png', 
        type: 'official' 
      },
      { 
        name: 'Real Madrid', 
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/56/Real_Madrid_CF.svg/1200px-Real_Madrid_CF.svg.png', 
        type: 'official' 
      },
      { 
        name: 'Manchester United', 
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/1200px-Manchester_United_FC_crest.svg.png', 
        type: 'official' 
      },
      { 
        name: 'Bayern Munich', 
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/1200px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png', 
        type: 'official' 
      },
      { 
        name: 'Liverpool', 
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/1200px-Liverpool_FC.svg.png', 
        type: 'official' 
      },
      { 
        name: 'Manchester City', 
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/1200px-Manchester_City_FC_badge.svg.png', 
        type: 'official' 
      },
      { 
        name: 'Paris Saint-Germain', 
        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/1200px-Paris_Saint-Germain_F.C..svg.png', 
        type: 'official' 
      },
      { 
        name: 'Juventus', 
        logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Juventus_FC_2017_icon_%28black%29.svg/1200px-Juventus_FC_2017_icon_%28black%29.svg.png', 
        type: 'official' 
      }
    ];
    
    // Vloženie tímov do databázy
    await Team.bulkCreate(teams);
    
    console.log('Základné tímy boli úspešne vložené do databázy.');
  } catch (error) {
    console.error('Chyba pri vkladaní základných tímov:', error);
  }
};

module.exports = seedTeams;