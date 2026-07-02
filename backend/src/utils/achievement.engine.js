// backend/src/utils/achievement.engine.js
//
// Vyhodnocovací engine pre odznaky. Pracuje LAZY: zavolá sa pri otvorení stránky
// /achievements alebo profilu. Pre daného používateľa:
//   1) spočíta agregáty z reálnych dát (tipy, presné výsledky, ligy, pódiá, …),
//   2) vyhodnotí každý merateľný odznak (splnené? aký progres?),
//   3) udelí novo splnené odznaky (zápis do user_achievements),
//   4) vráti pole odznakov so stavom pre zobrazenie.
//
// Presný výsledok = tip.points >= exactScore danej ligy (default 10) a tip nie je
// typu 'winner'/'winner_no_draw' — rovnaká logika ako v round/stats controlleroch.
// "Správny tip" (pre šport) = vyhodnotený tip so ziskom aspoň 1 bodu.
// "Nesprávny tip" = vyhodnotený tip s 0 bodmi.

const { Achievement, UserAchievement, Tip, Match, Round, League, Season, Team, User, Sequelize } = require('../models');
const { Op } = Sequelize;

const DEFAULT_EXACT = 10;

// Spočíta agregáty potrebné pre kritériá. Vracia objekt so štatistikami.
async function computeStats(userId) {
  const uid = Number(userId);

  // všetky tipy používateľa + zápas/kolo/liga + tímy (na šport).
  const tips = await Tip.findAll({
    where: { userId: uid },
    include: [{
      model: Match,
      attributes: ['id', 'roundId', 'tipType', 'status'],
      include: [
        {
          model: Round,
          attributes: ['id', 'leagueId', 'startDate', 'endDate'],
          include: [{ model: League, attributes: ['id', 'scoringSystem', 'type', 'ended'] }],
        },
        { model: Team, as: 'homeTeam', attributes: ['id', 'sport'] },
        { model: Team, as: 'awayTeam', attributes: ['id', 'sport'] },
      ],
    }],
  });

  let tipsTotal = 0;
  let exactTotal = 0;
  let totalPoints = 0;            // súčet všetkých získaných bodov
  let officialPoints = 0;         // súčet bodov v oficiálnych ligách
  let wrongTotal = 0;             // vyhodnotené tipy s 0 bodmi
  const exactByRound = {};        // roundId -> počet presných výsledkov
  const sportCorrect = {};        // sport -> počet správnych (bodovaných) tipov
  const roundAgg = {};            // roundId -> { leagueId, start, points, exact }
  const tipDays = new Set();      // 'YYYY-MM-DD' dni, kedy používateľ tipoval

  for (const t of tips) {
    tipsTotal += 1;
    totalPoints += (t.points || 0);

    // deň tipu (pre dennú sériu) — podľa createdAt
    if (t.createdAt) {
      const d = new Date(t.createdAt);
      tipDays.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    }

    const match = t.Match;
    if (!match) continue;
    const round = match.Round;
    const league = round && round.League;

    if (round) {
      if (!roundAgg[round.id]) {
        roundAgg[round.id] = {
          leagueId: round.leagueId,
          start: round.startDate || round.endDate || null,
          points: 0,
          exact: 0,
        };
      }
      roundAgg[round.id].points += (t.points || 0);
    }

    // body v oficiálnych ligách
    if (league && league.type === 'official') officialPoints += (t.points || 0);

    if (match.status !== 'finished') continue;

    // vyhodnotený tip: správny (body>0) alebo nesprávny (0)
    if ((t.points || 0) > 0) {
      // šport z ktoréhokoľvek tímu zápasu (oba majú spravidla rovnaký šport)
      const sport = (match.homeTeam && match.homeTeam.sport) || (match.awayTeam && match.awayTeam.sport) || null;
      if (sport) sportCorrect[sport] = (sportCorrect[sport] || 0) + 1;
    } else {
      wrongTotal += 1;
    }

    // presný výsledok sa týka len exact_score tipov
    if (match.tipType === 'winner' || match.tipType === 'winner_no_draw') continue;
    const exactScore = (league && league.scoringSystem && league.scoringSystem.exactScore) || DEFAULT_EXACT;
    if ((t.points || 0) >= exactScore) {
      exactTotal += 1;
      exactByRound[match.roundId] = (exactByRound[match.roundId] || 0) + 1;
      if (roundAgg[match.roundId]) roundAgg[match.roundId].exact += 1;
    }
  }
  const maxExactInRound = Object.values(exactByRound).reduce((m, v) => Math.max(m, v), 0);

  // ---- dokonalé kolo: trafil VSETKY exact_score zápasy v kole, min. 5 zápasov ----
  // Spočítame pre každé kolo počet exact_score zápasov (celkovo) a koľko z nich
  // používateľ trafil presne. perfectRound = existuje kolo s >=5 exact zápasmi,
  // kde trafil všetky.
  let hasPerfectRound = false;
  {
    const roundIds = Object.keys(roundAgg).map(Number);
    if (roundIds.length) {
      // počet exact_score zápasov na kolo (celkovo v kole)
      const exactMatchesPerRound = {};
      const matchesInRounds = await Match.findAll({
        where: { roundId: { [Op.in]: roundIds }, status: 'finished', tipType: 'exact_score' },
        attributes: ['id', 'roundId'],
      });
      matchesInRounds.forEach((m) => { exactMatchesPerRound[m.roundId] = (exactMatchesPerRound[m.roundId] || 0) + 1; });
      for (const rid of roundIds) {
        const totalExactMatches = exactMatchesPerRound[rid] || 0;
        const hit = exactByRound[rid] || 0;
        if (totalExactMatches >= 5 && hit >= totalExactMatches) { hasPerfectRound = true; break; }
      }
    }
  }

  // ---- série (streaky) v rámci jednej ligy ----
  const byLeague = {}; // leagueId -> [ {start, points, exact} ]
  Object.values(roundAgg).forEach((r) => {
    if (!byLeague[r.leagueId]) byLeague[r.leagueId] = [];
    byLeague[r.leagueId].push(r);
  });
  let bestPointStreak = 0;
  let bestExactStreak = 0;
  Object.values(byLeague).forEach((arr) => {
    arr.sort((a, b) => {
      const ta = a.start ? new Date(a.start).getTime() : 0;
      const tb = b.start ? new Date(b.start).getTime() : 0;
      return ta - tb;
    });
    let curP = 0; let curE = 0;
    arr.forEach((r) => {
      curP = r.points > 0 ? curP + 1 : 0;
      curE = r.exact > 0 ? curE + 1 : 0;
      if (curP > bestPointStreak) bestPointStreak = curP;
      if (curE > bestExactStreak) bestExactStreak = curE;
    });
  });

  // ---- denná séria: najdlhší súvislý reťazec kalendárnych dní s tipom ----
  let bestDailyStreak = 0;
  {
    const days = [...tipDays].map((s) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
    }).sort((a, b) => a - b);
    const DAY = 24 * 60 * 60 * 1000;
    let cur = 0; let prev = null;
    days.forEach((t) => {
      if (prev !== null && t - prev === DAY) cur += 1;
      else cur = 1;
      if (cur > bestDailyStreak) bestDailyStreak = cur;
      prev = t;
    });
  }

  // ---- komunitné ----
  const createdLeagues = await League.count({ where: { creatorId: uid } });
  const usedTemplate = (await League.count({ where: { creatorId: uid, templateId: { [Op.ne]: null } } })) > 0;
  const endedLeagues = await League.count({ where: { creatorId: uid, ended: true } });
  const endedSeasons = await Season.count({ where: { creatorId: uid, ended: true } });
  const endedCompetition = (endedLeagues + endedSeasons) > 0;

  // profil (edit/avatar)
  const me = await User.findByPk(uid, { attributes: ['firstName', 'lastName', 'bio', 'profileImage'] });
  const editedProfile = !!(me && ((me.firstName && me.firstName.trim()) || (me.lastName && me.lastName.trim()) || (me.bio && me.bio.trim())));
  const hasAvatar = !!(me && me.profileImage && me.profileImage.trim());

  // ---- pódiá: len z UKONCENYCH líg (ended:true) ----
  // Pre každú ukončenú ligu, do ktorej používateľ tipoval, zostavíme rebríček
  // (súčet bodov po hráčoch) a zistíme jeho umiestnenie.
  let bestRankEnded = null;          // najlepšie umiestnenie v ukončenej lige (akejkoľvek)
  let bestRankEndedOfficial = null;  // najlepšie umiestnenie v ukončenej OFICIALNEJ lige
  let wonOfficial = false;           // 1. miesto v ukončenej oficiálnej lige
  {
    // ligy, do ktorých používateľ tipoval, s typom a ended
    const myLeagueIds = [...new Set(tips.map((t) => t.Match && t.Match.Round && t.Match.Round.leagueId).filter(Boolean))];
    if (myLeagueIds.length) {
      const leagues = await League.findAll({ where: { id: { [Op.in]: myLeagueIds } }, attributes: ['id', 'type', 'ended'] });
      for (const lg of leagues) {
        if (!lg.ended) continue; // rebríčkové odznaky až po ukončení ligy
        const rounds = await Round.findAll({ where: { leagueId: lg.id }, attributes: ['id'] });
        const roundIds = rounds.map((r) => r.id);
        if (!roundIds.length) continue;
        const lTips = await Tip.findAll({
          include: [{ model: Match, attributes: ['id'], where: { roundId: { [Op.in]: roundIds } }, required: true }],
          attributes: ['userId', 'points'],
        });
        const byUser = {};
        lTips.forEach((t) => { byUser[t.userId] = (byUser[t.userId] || 0) + (t.points || 0); });
        const board = Object.entries(byUser)
          .map(([u, pts]) => ({ uid: Number(u), pts }))
          .sort((a, b) => b.pts - a.pts);
        const idx = board.findIndex((b) => b.uid === uid);
        if (idx < 0) continue;
        const rank = idx + 1;
        if (bestRankEnded === null || rank < bestRankEnded) bestRankEnded = rank;
        if (lg.type === 'official') {
          if (bestRankEndedOfficial === null || rank < bestRankEndedOfficial) bestRankEndedOfficial = rank;
          if (rank === 1) wonOfficial = true;
        }
      }
    }
  }

  return {
    tipsTotal, exactTotal, totalPoints, officialPoints, wrongTotal,
    maxExactInRound, hasPerfectRound,
    bestPointStreak, bestExactStreak, bestDailyStreak,
    sportCorrect,
    createdLeagues, usedTemplate, endedCompetition, editedProfile, hasAvatar,
    bestRankEnded, bestRankEndedOfficial, wonOfficial,
  };
}

// Vyhodnotí jeden odznak: vráti { earned, current, target }.
// `ownedRarityCount` = mapa rarity -> počet už vlastnených odznakov danej rarity.
function evaluate(def, stats, earnedCount, ownedRarityCount) {
  switch (def.criteria) {
    case 'first_tip':
      return { earned: stats.tipsTotal >= 1, current: Math.min(stats.tipsTotal, 1), target: 1 };
    case 'tips_total':
      return { earned: stats.tipsTotal >= def.value, current: stats.tipsTotal, target: def.value };
    case 'exact_total':
      return { earned: stats.exactTotal >= def.value, current: stats.exactTotal, target: def.value };
    case 'exact_in_round':
      return { earned: stats.maxExactInRound >= def.value, current: stats.maxExactInRound, target: def.value };
    case 'perfect_round':
      return { earned: stats.hasPerfectRound, current: stats.hasPerfectRound ? 1 : 0, target: 1 };
    case 'total_points':
      return { earned: stats.totalPoints >= def.value, current: stats.totalPoints, target: def.value };
    case 'official_points':
      return { earned: stats.officialPoints >= def.value, current: stats.officialPoints, target: def.value };
    case 'wrong_tips':
      return { earned: stats.wrongTotal >= def.value, current: stats.wrongTotal, target: def.value };
    case 'point_streak':
      return { earned: stats.bestPointStreak >= def.value, current: stats.bestPointStreak, target: def.value };
    case 'exact_streak':
      return { earned: stats.bestExactStreak >= def.value, current: stats.bestExactStreak, target: def.value };
    case 'daily_streak':
      return { earned: stats.bestDailyStreak >= def.value, current: stats.bestDailyStreak, target: def.value };
    case 'sport_correct': {
      const c = (stats.sportCorrect && stats.sportCorrect[def.sport]) || 0;
      return { earned: c >= def.value, current: c, target: def.value };
    }
    case 'create_league':
      return { earned: stats.createdLeagues >= 1, current: Math.min(stats.createdLeagues, 1), target: 1 };
    case 'use_template':
      return { earned: stats.usedTemplate, current: stats.usedTemplate ? 1 : 0, target: 1 };
    case 'end_competition':
      return { earned: stats.endedCompetition, current: stats.endedCompetition ? 1 : 0, target: 1 };
    case 'edit_profile':
      return { earned: stats.editedProfile, current: stats.editedProfile ? 1 : 0, target: 1 };
    case 'set_avatar':
      return { earned: stats.hasAvatar, current: stats.hasAvatar ? 1 : 0, target: 1 };
    case 'podium': {
      const limit = def.rank || 3;
      const r = stats.bestRankEnded;
      return { earned: r !== null && r <= limit, current: (r !== null && r <= limit) ? 1 : 0, target: 1 };
    }
    case 'podium_official': {
      const limit = def.rank || 3;
      const r = stats.bestRankEndedOfficial;
      return { earned: r !== null && r <= limit, current: (r !== null && r <= limit) ? 1 : 0, target: 1 };
    }
    case 'league_winner':
      return { earned: stats.wonOfficial, current: stats.wonOfficial ? 1 : 0, target: 1 };
    case 'collector':
      return { earned: earnedCount >= def.value, current: earnedCount, target: def.value };
    case 'rarity_count': {
      const c = (ownedRarityCount && ownedRarityCount[def.rarityKind]) || 0;
      return { earned: c >= def.value, current: c, target: def.value };
    }
    default:
      // nemerateľné — nikdy sa automaticky neudelí
      return { earned: false, current: 0, target: def.value || 0 };
  }
}

// Hlavná funkcia: vyhodnotí a udelí odznaky pre používateľa, vráti zoznam so stavom.
async function evaluateUser(userId) {
  const uid = Number(userId);
  const defs = await Achievement.findAll({ order: [['sortOrder', 'ASC']] });
  if (!defs.length) return { items: [], earnedCount: 0, total: 0 };

  // už udelené odznaky používateľa
  const owned = await UserAchievement.findAll({ where: { userId: uid } });
  const ownedMap = {}; // achievementId -> dateAwarded
  owned.forEach((o) => { ownedMap[o.achievementId] = o.dateAwarded; });

  const stats = await computeStats(uid);

  // rarity mapa už vlastnených odznakov (pre rarity_count) — podľa definícií
  const defById = {};
  defs.forEach((d) => { defById[d.id] = d; });
  function rarityCountFromOwned() {
    const rc = {};
    Object.keys(ownedMap).forEach((aid) => {
      const d = defById[aid];
      if (d) rc[d.rarity] = (rc[d.rarity] || 0) + 1;
    });
    return rc;
  }

  let earnedCount = Object.keys(ownedMap).length;

  const items = [];
  // prvý prechod: všetko okrem collector/rarity_count (tie závisia od počtu získaných)
  for (const def of defs) {
    const alreadyOwned = ownedMap[def.id] != null;
    let res;
    if (def.criteria === 'collector' || def.criteria === 'rarity_count') {
      res = { earned: false, current: 0, target: def.value }; // doplní 2. prechod
    } else {
      res = evaluate(def, stats, earnedCount, null);
    }
    items.push({ def, res, alreadyOwned });
  }

  // koľko by ich bolo (vrátane novo splnených merateľných okrem collector/rarity_count)
  // + rarita projektovaných odznakov (pre rarity_count)
  let projectedEarned = 0;
  const projectedRarity = {};
  items.forEach((it) => {
    if (it.def.criteria === 'collector' || it.def.criteria === 'rarity_count') return;
    if (it.alreadyOwned || it.res.earned) {
      projectedEarned += 1;
      projectedRarity[it.def.rarity] = (projectedRarity[it.def.rarity] || 0) + 1;
    }
  });

  // druhý prechod: collector + rarity_count podľa projekcie
  items.forEach((it) => {
    if (it.def.criteria === 'collector') {
      it.res = { earned: projectedEarned >= it.def.value, current: projectedEarned, target: it.def.value };
    } else if (it.def.criteria === 'rarity_count') {
      const c = projectedRarity[it.def.rarityKind] || 0;
      it.res = { earned: c >= it.def.value, current: c, target: it.def.value };
    }
  });

  // urči, čo treba novo udeliť
  const now = new Date();
  const toAward = [];
  const awardedDefs = [];
  for (const it of items) {
    if (!it.alreadyOwned && it.res.earned) {
      toAward.push({ userId: uid, achievementId: it.def.id, dateAwarded: now });
      ownedMap[it.def.id] = now;
      awardedDefs.push({ name: it.def.name, rarity: it.def.rarity });
    }
  }
  if (toAward.length) {
    await UserAchievement.bulkCreate(toAward, { ignoreDuplicates: true });
    try {
      const notify = require('./notification.service');
      await notify.achievementsAwarded(uid, awardedDefs);
    } catch (e) { /* notifikácia je vedľajší efekt */ }
  }

  // zostav výstup pre view
  const out = items.map((it) => {
    const earned = ownedMap[it.def.id] != null;
    const target = it.res.target || it.def.value || 0;
    const current = Math.max(0, it.res.current || 0);
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : (earned ? 100 : 0);
    return {
      id: it.def.id,
      code: it.def.code,
      name: it.def.name,
      description: it.def.description,
      icon: it.def.icon || '🏅',
      rarity: it.def.rarity,
      measurable: it.def.measurable,
      earned,
      dateAwarded: earned ? ownedMap[it.def.id] : null,
      current,
      target,
      pct,
    };
  });

  const earnedTotal = out.filter((o) => o.earned).length;
  return { items: out, earnedCount: earnedTotal, total: out.length };
}

module.exports = { evaluateUser, computeStats };