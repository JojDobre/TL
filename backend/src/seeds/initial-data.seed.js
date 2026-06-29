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

async function seedInitialData() {

    console.log('Začínam seedovanie základných dát...');
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

  const PW = await bcrypt.hash('password123', 10);

// ---------- POUŽÍVATELIA ----------
  console.log('  → používatelia');
  const admin = await db.User.create({ username: 'admin', email: 'admin@tiperliga.sk', password: PW, firstName: 'Admin', lastName: 'Tiperliga', role: 'admin' });
  const vip = await db.User.create({ username: 'vip', email: 'vip@tiperliga.sk', password: PW, firstName: 'Viktor', lastName: 'Important', role: 'vip' });
  const peter = await db.User.create({ username: 'peter', email: 'peter@tiperliga.sk', password: PW, firstName: 'Peter', lastName: 'Novák', role: 'player' });
  const jana = await db.User.create({ username: 'jana', email: 'jana@tiperliga.sk', password: PW, firstName: 'Jana', lastName: 'Kováčová', role: 'player' });
  const marek = await db.User.create({ username: 'marek', email: 'marek@tiperliga.sk', password: PW, firstName: 'Marek', lastName: 'Horák', role: 'player' });
  const lucia = await db.User.create({ username: 'lucia', email: 'lucia@tiperliga.sk', password: PW, firstName: 'Lucia', lastName: 'Tóthová', role: 'player' });
  const players = [peter, jana, marek, lucia];
 
  // ---------- TÍMY (globálne) ----------
  console.log('  → tímy');
  const mkTeam = (name, teamType, sport, country) => db.Team.create({ name, scope: 'global', teamType, sport, country, creatorId: null });
  // národné (futbal aj hokej ich zdieľa)
  const svk = await mkTeam('Slovensko', 'national', null, 'SK');
  const cze = await mkTeam('Česko', 'national', null, 'CZ');
  const can = await mkTeam('Kanada', 'national', null, 'CA');
  const fin = await mkTeam('Fínsko', 'national', null, 'FI');
  const swe = await mkTeam('Švédsko', 'national', null, 'SE');
  const ger = await mkTeam('Nemecko', 'national', null, 'DE');
  // futbalové kluby (EN/ES)
  const ars = await mkTeam('Arsenal', 'club', 'football', 'EN');
  const mci = await mkTeam('Manchester City', 'club', 'football', 'EN');
  const liv = await mkTeam('Liverpool', 'club', 'football', 'EN');
  const che = await mkTeam('Chelsea', 'club', 'football', 'EN');
  const rma = await mkTeam('Real Madrid', 'club', 'football', 'ES');
  const fcb = await mkTeam('FC Barcelona', 'club', 'football', 'ES');
  // hokejové kluby (SK)
  const kos = await mkTeam('HC Košice', 'club', 'hockey', 'SK');
  const slo = await mkTeam('HC Slovan Bratislava', 'club', 'hockey', 'SK');
  const nit = await mkTeam('HK Nitra', 'club', 'hockey', 'SK');
  const zvo = await mkTeam('HKM Zvolen', 'club', 'hockey', 'SK');
 
  // helper: vytvor kolo + zápasy + tipy
  // matchDefs: [{home, away, time, tipType, result?}]  result = {h,a} alebo 'canceled' alebo null
  async function makeRound(league, name, startOffset, endOffset, matchDefs, tipPlan) {
    const round = await db.Round.create({
      name, description: null, leagueId: league.id,
      startDate: daysFromNow(startOffset), endDate: daysFromNow(endOffset), active: true,
    });
    const createdMatches = [];
    for (const md of matchDefs) {
      const m = await db.Match.create({
        roundId: round.id, homeTeamId: md.home.id, awayTeamId: md.away.id,
        matchTime: daysFromNow(md.time), tipType: md.tipType || 'exact_score',
        homeScore: (md.result && md.result !== 'canceled') ? md.result.h : null,
        awayScore: (md.result && md.result !== 'canceled') ? md.result.a : null,
        status: md.result === 'canceled' ? 'canceled' : (md.result ? 'finished' : 'scheduled'),
      });
      createdMatches.push(m);
      // tímy zápasu zaraď do súpisky ligy (idempotentne)
      await db.LeagueTeam.findOrCreate({ where: { leagueId: league.id, teamId: md.home.id }, defaults: { leagueId: league.id, teamId: md.home.id } });
      await db.LeagueTeam.findOrCreate({ where: { leagueId: league.id, teamId: md.away.id }, defaults: { leagueId: league.id, teamId: md.away.id } });
    }
    // tipy: tipPlan(matchIndex, user) → {h,a} alebo {winner} alebo null
    if (tipPlan) {
      for (let i = 0; i < createdMatches.length; i++) {
        const m = createdMatches[i];
        for (const u of players) {
          const t = tipPlan(i, u, m);
          if (!t) continue;
          const tip = await db.Tip.create({
            userId: u.id, matchId: m.id,
            homeScore: t.h != null ? t.h : null,
            awayScore: t.a != null ? t.a : null,
            winner: t.winner || (t.h != null ? (t.h > t.a ? 'home' : t.h < t.a ? 'away' : 'draw') : null),
            points: 0, submitted: true,
          });
          // ak je zápas vyhodnotený, doráta body
          if (m.status === 'finished') {
            tip.points = scorePoints(tip, m, league.scoringSystem);
            await tip.save();
          }
        }
      }
    }
    return { round, matches: createdMatches };
  }
 
  // bodovanie (rovnaké ako calculatePoints v match.controller)
  function outcome(h, a) { return h > a ? 'home' : h < a ? 'away' : 'draw'; }
  function scorePoints(tip, match, scoring) {
    const s = scoring || { exactScore: 10, correctGoals: 1, correctWinner: 3, goalDifference: 2 };
    const { homeScore, awayScore, tipType } = match;
    if (homeScore == null || awayScore == null) return 0;
    const actual = outcome(homeScore, awayScore);
    if (tipType === 'winner') return tip.winner && tip.winner === actual ? s.correctWinner : 0;
    if (tip.homeScore == null || tip.awayScore == null) return tip.winner && tip.winner === actual ? s.correctWinner : 0;
    if (tip.homeScore === homeScore && tip.awayScore === awayScore) return s.exactScore;
    let p = 0;
    if (tip.homeScore === homeScore) p += s.correctGoals;
    if (tip.awayScore === awayScore) p += s.correctGoals;
    if (outcome(tip.homeScore, tip.awayScore) === actual) p += s.correctWinner;
    if ((tip.homeScore - tip.awayScore) === (homeScore - awayScore)) p += s.goalDifference;
    return p;
  }
 
  const DEF_SCORING = { exactScore: 10, correctGoals: 1, correctWinner: 3, goalDifference: 2 };
 
  // pomocné členstvá
  const joinSeason = (season, user, role = 'player') => db.UserSeason.create({ userId: user.id, seasonId: season.id, role, joinedAt: new Date() });
  const joinLeague = (league, user, role = 'player') => db.UserLeague.create({ userId: user.id, leagueId: league.id, role, joinedAt: new Date() });
 
  // ============================================================
  // SEZÓNA 1 — Oficiálna, PREBIEHAJÚCA: "MS vo futbale 2026"
  // ============================================================
  console.log('  → sezóna: MS vo futbale 2026 (oficiálna, prebieha)');
  const sMS = await db.Season.create({
    name: 'MS vo futbale 2026', description: 'Oficiálne tipovanie majstrovstiev sveta.',
    type: 'official', inviteCode: code6(), creatorId: admin.id, active: true,
    startDate: daysFromNow(-30), endDate: daysFromNow(40), ended: false,
    password: null, hasPassword: false, hidden: false, participantLimit: null,
  });
  await joinSeason(sMS, admin, 'admin');
  for (const u of players) await joinSeason(sMS, u);
  await joinSeason(sMS, vip);
 
  // Liga 1A — oficiálna ŠABLÓNA (prebieha), s ukončeným + otvoreným + naplánovaným kolom
  const lMSmain = await db.League.create({
    name: 'MS 2026 — hlavná', description: 'Hlavná oficiálna liga MS.',
    type: 'official', joinCode: code6(), password: null, hasPassword: false,
    seasonId: sMS.id, creatorId: admin.id, scoringSystem: DEF_SCORING, scoringLocked: true,
    active: true, isTemplate: false, templateId: null,
  });
  await joinLeague(lMSmain, admin, 'admin');
  for (const u of players) await joinLeague(lMSmain, u);
 
  // ukončené kolo (v minulosti) — vyhodnotené zápasy + zrušený
  const msR1 = await makeRound(lMSmain, 'Skupina A — 1. kolo', -20, -14, [
    { home: svk, away: ger, time: -18, result: { h: 1, a: 2 } },
    { home: fcb, away: rma, time: -17, result: { h: 3, a: 3 } },
    { home: ars, away: liv, time: -16, result: 'canceled' },
    { home: cze, away: swe, time: -15, tipType: 'winner', result: { h: 2, a: 0 } },
  ], (i, u) => {
    // rôzne tipy podľa hráča → rôzne body
    const plans = [
      [{ h: 1, a: 2 }, { h: 2, a: 1 }, { h: 0, a: 0 }, { winner: 'home' }],   // peter
      [{ h: 0, a: 2 }, { h: 3, a: 3 }, { h: 1, a: 1 }, { winner: 'away' }],   // jana
      [{ h: 1, a: 1 }, { h: 2, a: 2 }, { h: 2, a: 0 }, { winner: 'home' }],   // marek
      [{ h: 2, a: 2 }, { h: 1, a: 0 }, { h: 1, a: 1 }, { winner: 'draw' }],   // lucia
    ];
    const idx = players.indexOf(u);
    return plans[idx] ? plans[idx][i] : null;
  });
 
  // otvorené kolo (prebieha — tipuje sa): start v minulosti, koniec v budúcnosti
  await makeRound(lMSmain, 'Skupina A — 2. kolo', -2, 6, [
    { home: svk, away: cze, time: 3 },
    { home: ger, away: swe, time: 4 },
    { home: rma, away: ars, time: 5, tipType: 'winner' },
  ], (i, u) => {
    // niektorí už tipli, niektorí nie
    if (u === lucia) return null; // Lucia ešte netipovala
    const plans = [
      [{ h: 2, a: 1 }, { h: 1, a: 1 }, { winner: 'home' }],
      [{ h: 1, a: 0 }, { h: 2, a: 2 }, { winner: 'away' }],
      [{ h: 0, a: 0 }, { h: 3, a: 1 }, { winner: 'draw' }],
    ];
    const idx = players.indexOf(u);
    return plans[idx] ? plans[idx][i] : null;
  });
 
  // naplánované kolo (ešte sa neotvorilo): start aj koniec v budúcnosti
  await makeRound(lMSmain, 'Štvrťfinále', 10, 16, [
    { home: svk, away: fcb, time: 12 },
    { home: liv, away: rma, time: 13 },
  ], null);
 
  // Liga 1B — custom liga v tej istej oficiálnej sezóne (vytvoril vip)
  const lMSfun = await db.League.create({
    name: 'MS — partia z práce', description: 'Súkromná tipovačka kolegov.',
    type: 'custom', joinCode: code6(), password: null, hasPassword: false,
    seasonId: sMS.id, creatorId: vip.id, scoringSystem: { exactScore: 15, correctGoals: 2, correctWinner: 5, goalDifference: 3 },
    scoringLocked: false, active: true, isTemplate: false, templateId: null,
  });
  await joinLeague(lMSfun, vip, 'admin');
  await joinLeague(lMSfun, peter);
  await joinLeague(lMSfun, jana);
  await makeRound(lMSfun, '1. kolo', -10, -4, [
    { home: ars, away: che, time: -8, result: { h: 2, a: 0 } },
    { home: rma, away: fcb, time: -7, result: { h: 1, a: 4 } },
  ], (i, u) => {
    if (u !== peter && u !== jana) return null;
    const plans = { peter: [{ h: 2, a: 0 }, { h: 2, a: 2 }], jana: [{ h: 1, a: 0 }, { h: 1, a: 4 }] };
    return plans[u.username] ? plans[u.username][i] : null;
  });
 
  // ============================================================
  // SEZÓNA 2 — Oficiálna, PREBIEHAJÚCA: "NHL 2025/26" (hokej)
  // ============================================================
  console.log('  → sezóna: NHL 2025/26 (oficiálna, prebieha)');
  const sNHL = await db.Season.create({
    name: 'NHL 2025/26', description: 'Tipovanie zápasov NHL.',
    type: 'official', inviteCode: code6(), creatorId: admin.id, active: true,
    startDate: daysFromNow(-15), endDate: daysFromNow(60), ended: false,
    password: null, hasPassword: false, hidden: false, participantLimit: null,
  });
  await joinSeason(sNHL, admin, 'admin');
  await joinSeason(sNHL, marek);
  await joinSeason(sNHL, lucia);
 
  const lNHL = await db.League.create({
    name: 'NHL — základná časť', description: 'Oficiálna NHL liga.',
    type: 'official', joinCode: code6(), password: null, hasPassword: false,
    seasonId: sNHL.id, creatorId: admin.id, scoringSystem: DEF_SCORING, scoringLocked: false,
    active: true, isTemplate: false, templateId: null,
  });
  await joinLeague(lNHL, admin, 'admin');
  await joinLeague(lNHL, marek);
  await joinLeague(lNHL, lucia);
  await makeRound(lNHL, '1. hrací deň', -5, -1, [
    { home: kos, away: slo, time: -4, result: { h: 4, a: 2 } },
    { home: nit, away: zvo, time: -3, result: { h: 1, a: 1 } },
  ], (i, u) => {
    if (u !== marek && u !== lucia) return null;
    const plans = { marek: [{ h: 4, a: 2 }, { h: 2, a: 1 }], lucia: [{ h: 3, a: 2 }, { h: 1, a: 1 }] };
    return plans[u.username] ? plans[u.username][i] : null;
  });
  await makeRound(lNHL, '2. hrací deň', -1, 5, [
    { home: slo, away: nit, time: 2 },
    { home: zvo, away: kos, time: 3 },
  ], (i, u) => {
    if (u !== marek) return null;
    return [{ h: 2, a: 3 }, { h: 0, a: 2 }][i];
  });
 
  // ============================================================
  // SEZÓNA 3 — Komunitná, SÚKROMNÁ, PREBIEHAJÚCA: "Kamaráti"
  // ============================================================
  console.log('  → sezóna: Kamaráti (komunitná, súkromná, prebieha)');
  const sKam = await db.Season.create({
    name: 'Kamaráti — futbal', description: 'Súkromná tipovačka partie. Heslo: kamarati',
    type: 'community', inviteCode: code6(), creatorId: vip.id, active: true,
    startDate: daysFromNow(-7), endDate: daysFromNow(30), ended: false,
    password: await bcrypt.hash('kamarati', 10), hasPassword: true, hidden: false, participantLimit: 100,
  });
  await joinSeason(sKam, vip, 'admin');
  await joinSeason(sKam, peter);
  await joinSeason(sKam, jana);
 
  // ============================================================
  // ŠABLÓNA (samostatná, mimo sezóny) — zdroj pre klonovanie
  // isTemplate:true, seasonId:null, žiadni hráči. Oddelená od živej ligy lMSmain.
  // ============================================================
  console.log('  → šablóna: MS 2026 (oficiálna predloha)');
  const tplMS = await db.League.create({
    name: 'MS 2026 — oficiálna šablóna', description: 'Predpripravená predloha MS, z ktorej si môžu hráči vytvoriť vlastnú ligu.',
    type: 'official', joinCode: code6(), password: null, hasPassword: false,
    seasonId: null, creatorId: admin.id, scoringSystem: DEF_SCORING, scoringLocked: false,
    active: true, isTemplate: true, templateId: null,
  });
  // skopíruj kolá a zápasy zo živej ligy lMSmain do šablóny (bez tipov a hráčov)
  {
    const liveRounds = await db.Round.findAll({ where: { leagueId: lMSmain.id }, include: [{ model: db.Match }], order: [['startDate', 'ASC']] });
    for (const r of liveRounds) {
      const tr = await db.Round.create({ name: r.name, description: r.description, leagueId: tplMS.id, startDate: r.startDate, endDate: r.endDate, active: r.active });
      for (const m of (r.Matches || [])) {
        await db.Match.create({
          roundId: tr.id, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, matchTime: m.matchTime,
          tipType: m.tipType, homeScore: m.homeScore, awayScore: m.awayScore, status: m.status, sourceMatchId: null,
        });
        await db.LeagueTeam.findOrCreate({ where: { leagueId: tplMS.id, teamId: m.homeTeamId }, defaults: { leagueId: tplMS.id, teamId: m.homeTeamId } });
        await db.LeagueTeam.findOrCreate({ where: { leagueId: tplMS.id, teamId: m.awayTeamId }, defaults: { leagueId: tplMS.id, teamId: m.awayTeamId } });
      }
    }
  }

  // KLON ligy zo šablóny lMSmain (živé prepojenie výsledkov)
  const lKamClone = await db.League.create({
    name: 'Naše MS 2026', description: 'Klon oficiálneho MS, súťažíme len my.',
    type: 'custom', joinCode: code6(), password: null, hasPassword: false,
    seasonId: sKam.id, creatorId: vip.id, scoringSystem: { exactScore: 12, correctGoals: 1, correctWinner: 4, goalDifference: 2 },
    scoringLocked: false, active: true, isTemplate: false, templateId: tplMS.id,
  });
  await joinLeague(lKamClone, vip, 'admin');
  await joinLeague(lKamClone, peter);
  await joinLeague(lKamClone, jana);
  // naklonuj kolá+zápasy zo šablóny (rovnaká logika ako league-clone.util)
  const tplRounds = await db.Round.findAll({ where: { leagueId: tplMS.id }, include: [{ model: db.Match }], order: [['startDate', 'ASC']] });
  for (const r of tplRounds) {
    const nr = await db.Round.create({ name: r.name, description: r.description, leagueId: lKamClone.id, startDate: r.startDate, endDate: r.endDate, active: r.active });
    for (const m of (r.Matches || [])) {
      // klon dedí výsledok z originálu (kvôli zobrazeniu zapíšeme aktuálny stav)
      await db.Match.create({
        roundId: nr.id, homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, matchTime: m.matchTime,
        tipType: m.tipType, homeScore: m.homeScore, awayScore: m.awayScore, status: m.status, sourceMatchId: m.id,
      });
      await db.LeagueTeam.findOrCreate({ where: { leagueId: lKamClone.id, teamId: m.homeTeamId }, defaults: { leagueId: lKamClone.id, teamId: m.homeTeamId } });
      await db.LeagueTeam.findOrCreate({ where: { leagueId: lKamClone.id, teamId: m.awayTeamId }, defaults: { leagueId: lKamClone.id, teamId: m.awayTeamId } });
    }
  }
  // pár tipov v klone na vyhodnotené zápasy (prvé kolo klonu)
  const cloneFirstRound = await db.Round.findOne({ where: { leagueId: lKamClone.id }, order: [['startDate', 'ASC']], include: [{ model: db.Match }] });
  if (cloneFirstRound) {
    const cms = cloneFirstRound.Matches || [];
    const tipPlans = { peter: [{ h: 1, a: 2 }, { h: 2, a: 3 }, null, { winner: 'home' }], jana: [{ h: 0, a: 1 }, { h: 3, a: 3 }, null, { winner: 'home' }] };
    for (let i = 0; i < cms.length; i++) {
      for (const u of [peter, jana]) {
        const plan = tipPlans[u.username][i]; if (!plan) continue;
        const m = cms[i];
        const tip = await db.Tip.create({ userId: u.id, matchId: m.id, homeScore: plan.h != null ? plan.h : null, awayScore: plan.a != null ? plan.a : null, winner: plan.winner || (plan.h != null ? outcome(plan.h, plan.a) : null), points: 0, submitted: true });
        if (m.status === 'finished') { tip.points = scorePoints(tip, m, lKamClone.scoringSystem); await tip.save(); }
      }
    }
  }
 
  // ============================================================
  // SEZÓNA 4 — Komunitná, UKONČENÁ: "Stará liga 2024"
  // ============================================================
  console.log('  → sezóna: Stará liga 2024 (ukončená)');
  const sOld = await db.Season.create({
    name: 'Stará liga 2024', description: 'Minuloročná súťaž, už ukončená.',
    type: 'community', inviteCode: code6(), creatorId: vip.id, active: false,
    startDate: daysFromNow(-200), endDate: daysFromNow(-60), ended: true,
    password: null, hasPassword: false, hidden: false, participantLimit: 100,
  });
  await joinSeason(sOld, vip, 'admin');
  for (const u of players) await joinSeason(sOld, u);
  const lOld = await db.League.create({
    name: 'Liga 2024 — final', description: 'Ukončená liga.',
    type: 'custom', joinCode: code6(), password: null, hasPassword: false,
    seasonId: sOld.id, creatorId: vip.id, scoringSystem: DEF_SCORING, scoringLocked: true,
    active: false, ended: true, isTemplate: false, templateId: null,
  });
  await joinLeague(lOld, vip, 'admin');
  for (const u of players) await joinLeague(lOld, u);
  await makeRound(lOld, 'Posledné kolo', -90, -70, [
    { home: ars, away: che, time: -85, result: { h: 2, a: 1 } },
    { home: liv, away: mci, time: -84, result: { h: 0, a: 3 } },
    { home: rma, away: fcb, time: -83, result: { h: 2, a: 2 } },
  ], (i, u) => {
    const plans = [
      [{ h: 2, a: 1 }, { h: 1, a: 2 }, { h: 2, a: 2 }],
      [{ h: 1, a: 1 }, { h: 0, a: 3 }, { h: 1, a: 1 }],
      [{ h: 3, a: 0 }, { h: 0, a: 2 }, { h: 2, a: 2 }],
      [{ h: 2, a: 1 }, { h: 1, a: 1 }, { h: 3, a: 3 }],
    ];
    const idx = players.indexOf(u);
    return plans[idx] ? plans[idx][i] : null;
  });
 
  // ============================================================
  // SEZÓNA 5 — Komunitná, PRIPRAVOVANÁ (upcoming): "Budúca sezóna"
  // ============================================================
  console.log('  → sezóna: Budúca sezóna (pripravovaná)');
  const sFuture = await db.Season.create({
    name: 'Letná liga 2026', description: 'Štartuje čoskoro.',
    type: 'community', inviteCode: code6(), creatorId: peter.id, active: true,
    startDate: daysFromNow(20), endDate: daysFromNow(120), ended: false,
    password: null, hasPassword: false, hidden: false, participantLimit: 100,
  });
  await joinSeason(sFuture, peter, 'admin');
  const lFuture = await db.League.create({
    name: 'Letná liga — hlavná', description: 'Pripravovaná liga.',
    type: 'custom', joinCode: code6(), password: null, hasPassword: false,
    seasonId: sFuture.id, creatorId: peter.id, scoringSystem: DEF_SCORING, scoringLocked: false,
    active: true, isTemplate: false, templateId: null,
  });
  await joinLeague(lFuture, peter, 'admin');
  await makeRound(lFuture, '1. kolo', 22, 28, [
    { home: svk, away: cze, time: 24 },
    { home: fin, away: swe, time: 25 },
  ], null);
 
  console.log('  ✓ testovací seed dokončený');
}
 
module.exports = seedInitialData;