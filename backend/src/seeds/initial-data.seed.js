// backend/src/seeds/initial-data.seed.js

const db = require('../models');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const seedInitialData = async () => {
  try {
    console.log('Začínam seedovanie základných dát...');
    
    // Vytvorenie testovacích používateľov
    console.log('Vytváram používateľov...');
    
    // Hashovanie hesla
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
    
    const vipUser = await db.User.create({
      username: 'vipuser',
      email: 'vip@example.com',
      password: '$2b$10$ksEjSjxcDlrSIWkvLTDI5Oj7pij2jU4oKqdk4nc3MP3wwEzyx8UUm',
      firstName: 'VIP',
      lastName: 'User',
      role: 'vip',
      active: true
    });
    
    const regularUser = await db.User.create({
      username: 'user',
      email: 'user@example.com',
      password: '$2b$10$ksEjSjxcDlrSIWkvLTDI5Oj7pij2jU4oKqdk4nc3MP3wwEzyx8UUm',
      firstName: 'Regular',
      lastName: 'User',
      role: 'player',
      active: true
    });
    
    // Vytvorenie oficiálnej sezóny
    console.log('Vytváram oficiálnu sezónu...');
    const officialSeason = await db.Season.create({
      name: 'Sezóna 2024/2025',
      description: 'Oficiálna tipovacia súťaž pre sezónu 2024/2025 vrátane Premier League, La Liga a Bundesliga.',
      image: 'https://images.unsplash.com/photo-1508098682722-e99c643e7f0b?q=80&w=1000',
      type: 'official',
      inviteCode: uuidv4().substring(0, 6).toUpperCase(),
      active: true,
      rules: 'Všetci hráči musia zadať svoje tipy pred začiatkom zápasu. Za presný výsledok získavate 10 bodov, za správny počet gólov jedného tímu +1 bod, za správneho víťaza +3 body a za správny gólový rozdiel +2 body.',
      creatorId: adminUser.id
    });
    
    // Vytvorenie komunitnej sezóny
    console.log('Vytváram komunitnú sezónu...');
    const communitySeason = await db.Season.create({
      name: 'Futbal medzi kamarátmi',
      description: 'Tipovacia súťaž medzi priateľmi, sledujeme veľké futbalové zápasy a bavíme sa tipovaním.',
      image: 'https://images.unsplash.com/photo-1610201417828-29dd1173d62f?q=80&w=1000',
      type: 'community',
      inviteCode: uuidv4().substring(0, 6).toUpperCase(),
      active: true,
      rules: 'Neformálna súťaž medzi kamarátmi. Váš tip musí byť zadaný najneskôr 5 minút pred začiatkom zápasu.',
      creatorId: vipUser.id
    });
    
    // Priradenie používateľov do sezón
    console.log('Priraďujem používateľov do sezón...');
    
    // Admin do oficiálnej sezóny
    await db.UserSeason.create({
      userId: adminUser.id,
      seasonId: officialSeason.id,
      role: 'admin'
    });
    
    // VIP user do oficiálnej sezóny
    await db.UserSeason.create({
      userId: vipUser.id,
      seasonId: officialSeason.id,
      role: 'player'
    });
    
    // Regular user do oficiálnej sezóny
    await db.UserSeason.create({
      userId: regularUser.id,
      seasonId: officialSeason.id,
      role: 'player'
    });
    
    // VIP user do komunitnej sezóny
    await db.UserSeason.create({
      userId: vipUser.id,
      seasonId: communitySeason.id,
      role: 'admin'
    });
    
    // Regular user do komunitnej sezóny
    await db.UserSeason.create({
      userId: regularUser.id,
      seasonId: communitySeason.id,
      role: 'player'
    });
    
    // Vytvorenie oficiálnych tímov (ak ešte neexistujú)
    console.log('Kontrolujem existujúce tímy a vytvaram nové...');
    const teamsCount = await db.Team.count();
    
    let teams = [];
    if (teamsCount === 0) {
      teams = await db.Team.bulkCreate([
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
          name: 'Manchester City',
          logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/1200px-Manchester_City_FC_badge.svg.png',
          type: 'official'
        },
        {
          name: 'Liverpool FC',
          logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/0/0c/Liverpool_FC.svg/1200px-Liverpool_FC.svg.png',
          type: 'official'
        },
        {
          name: 'Bayern Mníchov',
          logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/1200px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png',
          type: 'official'
        },
        {
          name: 'Borussia Dortmund',
          logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Borussia_Dortmund_logo.svg/1200px-Borussia_Dortmund_logo.svg.png',
          type: 'official'
        },
        {
          name: 'PSG',
          logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/1200px-Paris_Saint-Germain_F.C..svg.png',
          type: 'official'
        }
      ]);
    } else {
      teams = await db.Team.findAll();
    }
    
    // Vytvorenie líg
    console.log('Vytváram ligy...');
    
    // Liga v oficiálnej sezóne
    const premierLeague = await db.League.create({
      name: 'Premier League 2024/2025',
      description: 'Anglická Premier League, najvyššia anglická futbalová súťaž.',
      image: 'https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Premier_League_Logo.svg/1200px-Premier_League_Logo.svg.png',
      type: 'official',
      seasonId: officialSeason.id,
      active: true,
      scoringSystem: {
        exactScore: 10,
        correctGoals: 1,
        correctWinner: 3,
        goalDifference: 2
      },
      scoringLocked: false
    });
    
    const laLiga = await db.League.create({
      name: 'La Liga 2024/2025',
      description: 'Španielska LaLiga, najvyššia španielska futbalová súťaž.',
      image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/LaLiga.svg/1200px-LaLiga.svg.png',
      type: 'official',
      seasonId: officialSeason.id,
      active: true,
      scoringSystem: {
        exactScore: 10,
        correctGoals: 1,
        correctWinner: 3,
        goalDifference: 2
      },
      scoringLocked: false
    });
    
    // Liga v komunitnej sezóne
    const friendsLeague = await db.League.create({
      name: 'Liga kamarátov',
      description: 'Naša vlastná liga na tipovanie zápasov podľa výberu.',
      image: 'https://images.unsplash.com/photo-1577466879723-a2a32823eaee?q=80&w=1000',
      type: 'custom',
      seasonId: communitySeason.id,
      active: true,
      scoringSystem: {
        exactScore: 15,  // Vlastný bodovací systém s vyššími bodmi za presný výsledok
        correctGoals: 2,
        correctWinner: 5,
        goalDifference: 3
      },
      scoringLocked: false
    });
    
    // Vytvorenie kôl
    console.log('Vytváram kolá...');
    
    // Aktuálny dátum
    const now = new Date();
    
    // Kolá pre Premier League
    const premierLeagueRound1 = await db.Round.create({
      name: '1. kolo',
      description: 'Úvodné kolo Premier League 2024/2025',
      leagueId: premierLeague.id,
      startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),  // 7 dní dozadu
      endDate: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),    // 6 dní dozadu
      active: true
    });
    
    const premierLeagueRound2 = await db.Round.create({
      name: '2. kolo',
      description: 'Druhé kolo Premier League 2024/2025',
      leagueId: premierLeague.id,
      startDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),  // 1 deň dozadu
      endDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),    // 1 deň dopredu
      active: true
    });
    
    const premierLeagueRound3 = await db.Round.create({
      name: '3. kolo',
      description: 'Tretie kolo Premier League 2024/2025',
      leagueId: premierLeague.id,
      startDate: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),  // 6 dní dopredu
      endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),    // 7 dní dopredu
      active: true
    });
    
    // Kolá pre La Liga
    const laLigaRound1 = await db.Round.create({
      name: '1. kolo',
      description: 'Úvodné kolo La Liga 2024/2025',
      leagueId: laLiga.id,
      startDate: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),  // 8 dní dozadu
      endDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),    // 7 dní dozadu
      active: true
    });
    
    const laLigaRound2 = await db.Round.create({
      name: '2. kolo',
      description: 'Druhé kolo La Liga 2024/2025',
      leagueId: laLiga.id,
      startDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),  // 2 dni dozadu
      endDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),    // 1 deň dozadu
      active: true
    });
    
    // Kolo pre Ligu kamarátov
    const friendsLeagueRound = await db.Round.create({
      name: 'Víkendové zápasy',
      description: 'Zápasy tohto víkendu, ktoré nás zaujali',
      leagueId: friendsLeague.id,
      startDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),  // 3 dni dozadu
      endDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000),    // 1 deň dopredu
      active: true
    });
    
    // Vytvorenie zápasov
    console.log('Vytváram zápasy...');
    
    // Zápasy pre Premier League - 1. kolo (už odohraté)
    const plRound1Match1 = await db.Match.create({
      roundId: premierLeagueRound1.id,
      homeTeamId: teams[2].id,  // Manchester United
      awayTeamId: teams[4].id,  // Liverpool
      matchTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      homeScore: 2,
      awayScore: 1,
      status: 'finished',
      tipType: 'exact_score'
    });
    
    const plRound1Match2 = await db.Match.create({
      roundId: premierLeagueRound1.id,
      homeTeamId: teams[3].id,  // Manchester City
      awayTeamId: teams[5].id,  // Bayern Mníchov
      matchTime: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      homeScore: 3,
      awayScore: 3,
      status: 'finished',
      tipType: 'exact_score'
    });
    
    // Zápasy pre Premier League - 2. kolo (prebiehajúce)
    const plRound2Match1 = await db.Match.create({
      roundId: premierLeagueRound2.id,
      homeTeamId: teams[4].id,  // Liverpool
      awayTeamId: teams[3].id,  // Manchester City
      matchTime: new Date(now.getTime() + 12 * 60 * 60 * 1000),
      status: 'scheduled',
      tipType: 'exact_score'
    });
    
    const plRound2Match2 = await db.Match.create({
      roundId: premierLeagueRound2.id,
      homeTeamId: teams[5].id,  // Bayern Mníchov
      awayTeamId: teams[2].id,  // Manchester United
      matchTime: new Date(now.getTime() + 18 * 60 * 60 * 1000),
      status: 'scheduled',
      tipType: 'exact_score'
    });
    
    // Zápasy pre Premier League - 3. kolo (budúce)
    const plRound3Match1 = await db.Match.create({
      roundId: premierLeagueRound3.id,
      homeTeamId: teams[2].id,  // Manchester United
      awayTeamId: teams[3].id,  // Manchester City
      matchTime: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000),
      status: 'scheduled',
      tipType: 'exact_score'
    });
    
    // Zápasy pre La Liga - 1. kolo (už odohraté)
    const laLigaRound1Match1 = await db.Match.create({
      roundId: laLigaRound1.id,
      homeTeamId: teams[0].id,  // FC Barcelona
      awayTeamId: teams[1].id,  // Real Madrid
      matchTime: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      homeScore: 2,
      awayScore: 2,
      status: 'finished',
      tipType: 'exact_score'
    });
    
    // Zápasy pre La Liga - 2. kolo (už odohraté)
    const laLigaRound2Match1 = await db.Match.create({
      roundId: laLigaRound2.id,
      homeTeamId: teams[1].id,  // Real Madrid
      awayTeamId: teams[7].id,  // PSG
      matchTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      homeScore: 3,
      awayScore: 1,
      status: 'finished',
      tipType: 'exact_score'
    });
    
    // Zápasy pre Ligu kamarátov
    const friendsLeagueMatch1 = await db.Match.create({
      roundId: friendsLeagueRound.id,
      homeTeamId: teams[0].id,  // FC Barcelona
      awayTeamId: teams[5].id,  // Bayern Mníchov
      matchTime: new Date(now.getTime() + 8 * 60 * 60 * 1000),
      status: 'scheduled',
      tipType: 'exact_score'
    });
    
    const friendsLeagueMatch2 = await db.Match.create({
      roundId: friendsLeagueRound.id,
      homeTeamId: teams[6].id,  // Borussia Dortmund
      awayTeamId: teams[7].id,  // PSG
      matchTime: new Date(now.getTime() + 10 * 60 * 60 * 1000),
      status: 'scheduled',
      tipType: 'exact_score'
    });
    
    // Vytvorenie tipov pre používateľov
    console.log('Vytváram tipy...');
    
    // Tipy pre prvý zápas Premier League - 1. kolo (už vyhodnotené)
    await db.Tip.create({
      userId: vipUser.id,
      matchId: plRound1Match1.id,
      homeScore: 2,
      awayScore: 1,
      winner: 'home',
      points: 10,  // Presný výsledok
      submitted: true
    });
    
    await db.Tip.create({
      userId: regularUser.id,
      matchId: plRound1Match1.id,
      homeScore: 1,
      awayScore: 0,
      winner: 'home',
      points: 4,  // Správny víťaz (3) + Správny gólový rozdiel (1)
      submitted: true
    });
    
    // Tipy pre druhý zápas Premier League - 1. kolo (už vyhodnotené)
    await db.Tip.create({
      userId: vipUser.id,
      matchId: plRound1Match2.id,
      homeScore: 2,
      awayScore: 2,
      winner: 'draw',
      points: 3,  // Správny víťaz - remíza
      submitted: true
    });
    
    await db.Tip.create({
      userId: regularUser.id,
      matchId: plRound1Match2.id,
      homeScore: 3,
      awayScore: 3,
      winner: 'draw',
      points: 10,  // Presný výsledok
      submitted: true
    });
    
    // Tipy pre zápasy Premier League - 2. kolo (ešte neodohraté)
    await db.Tip.create({
      userId: vipUser.id,
      matchId: plRound2Match1.id,
      homeScore: 2,
      awayScore: 1,
      winner: 'home',
      points: 0,
      submitted: true
    });
    
    await db.Tip.create({
      userId: regularUser.id,
      matchId: plRound2Match1.id,
      homeScore: 1,
      awayScore: 2,
      winner: 'away',
      points: 0,
      submitted: true
    });
    
    // Tipy pre zápasy Liga kamarátov
    await db.Tip.create({
      userId: vipUser.id,
      matchId: friendsLeagueMatch1.id,
      homeScore: 3,
      awayScore: 2,
      winner: 'home',
      points: 0,
      submitted: true
    });
    
    await db.Tip.create({
      userId: regularUser.id,
      matchId: friendsLeagueMatch1.id,
      homeScore: 2,
      awayScore: 2,
      winner: 'draw',
      points: 0,
      submitted: true
    });
    
    console.log('Základné dáta boli úspešne vytvorené!');
    
  } catch (error) {
    console.error('Chyba pri seedovaní základných dát:', error);
  }
};

module.exports = seedInitialData;