// backend/src/utils/achievement.engine.js
//
// Vyhodnocovací engine pre odznaky. Pracuje LAZY: zavolá sa pri otvorení stránky
// /achievements alebo profilu. Pre daného používateľa:
//   1) spočíta agregáty z reálnych dát (tipy, presné výsledky, ligy, pódiá),
//   2) vyhodnotí každý merateľný odznak (splnené? aký progres?),
//   3) udelí novo splnené odznaky (zápis do user_achievements),
//   4) vráti pole odznakov so stavom pre zobrazenie.
//
// Presný výsledok = tip.points >= exactScore danej ligy (default 10) a tip nie je
// typu 'winner' — rovnaká logika ako v round/stats controlleroch.

const { Achievement, UserAchievement, Tip, Match, Round, League, Sequelize } = require('../models');
const { Op } = Sequelize;

const DEFAULT_EXACT = 10;

// Spočíta agregáty potrebné pre kritériá. Vracia objekt so štatistikami.
async function computeStats(userId) {
  // všetky tipy používateľa + zápas/kolo/liga (na exactScore a kolo).
  // Pozn.: nefiltrujeme na 'submitted' — zvyšok projektu (myPage/profilePage)
  // počíta tipy rovnako bez tohto flagu, takže ostávame konzistentní.
  const tips = await Tip.findAll({
    where: { userId },
    include: [{
      model: Match,
      attributes: ['id', 'roundId', 'tipType', 'status'],
      include: [{
        model: Round,
        attributes: ['id', 'leagueId', 'startDate', 'endDate'],
        include: [{ model: League, attributes: ['id', 'scoringSystem'] }],
      }],
    }],
  });

  let tipsTotal = 0;
  let exactTotal = 0;
  let totalPoints = 0;            // súčet všetkých získaných bodov
  const exactByRound = {};        // roundId -> počet presných výsledkov
  // per-round agregát pre série: roundId -> { leagueId, start, points, exact }
  const roundAgg = {};

  for (const t of tips) {
    tipsTotal += 1;
    totalPoints += (t.points || 0);
    const match = t.Match;
    if (!match) continue;
    const round = match.Round;
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
    if (match.status !== 'finished') continue;
    if (match.tipType === 'winner') continue; // presný výsledok sa týka exact_score tipov
    const league = round && round.League;
    const exactScore = (league && league.scoringSystem && league.scoringSystem.exactScore) || DEFAULT_EXACT;
    if ((t.points || 0) >= exactScore) {
      exactTotal += 1;
      exactByRound[match.roundId] = (exactByRound[match.roundId] || 0) + 1;
      if (roundAgg[match.roundId]) roundAgg[match.roundId].exact += 1;
    }
  }
  const maxExactInRound = Object.values(exactByRound).reduce((m, v) => Math.max(m, v), 0);

  // ---- série (streaky) ----
  // Počítame najlepšiu súvislú sériu kôl V RÁMCI jednej ligy (kolá zoradené
  // podľa dátumu začiatku). Dve série:
  //   bestPointStreak — kolá po sebe so ziskom aspoň 1 bodu
  //   bestExactStreak — kolá po sebe s aspoň 1 presným výsledkom
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

  // počet líg, ktoré používateľ vytvoril
  const createdLeagues = await League.count({ where: { creatorId: userId } });

  // pódiá: TOP 3 aspoň v jednej lige — spočítame body všetkých hráčov po ligách,
  // do ktorých používateľ tipoval, a zistíme jeho najlepšie umiestnenie.
  let bestRank = null;
  const myLeagueIds = [...new Set(tips.map((t) => t.Match && t.Match.Round && t.Match.Round.leagueId).filter(Boolean))];
  for (const lid of myLeagueIds) {
    // body všetkých tipov v lige -> rebríček
    const rounds = await Round.findAll({ where: { leagueId: lid }, attributes: ['id'] });
    const roundIds = rounds.map((r) => r.id);
    if (!roundIds.length) continue;
    const lTips = await Tip.findAll({
      include: [{ model: Match, attributes: ['id'], where: { roundId: { [Op.in]: roundIds } }, required: true }],
      attributes: ['userId', 'points'],
    });
    const byUser = {};
    lTips.forEach((t) => { byUser[t.userId] = (byUser[t.userId] || 0) + (t.points || 0); });
    const board = Object.entries(byUser).map(([uid, pts]) => ({ uid: Number(uid), pts })).sort((a, b) => b.pts - a.pts);
    const idx = board.findIndex((b) => b.uid === userId);
    if (idx >= 0) {
      const rank = idx + 1;
      if (bestRank === null || rank < bestRank) bestRank = rank;
    }
  }

  return { tipsTotal, exactTotal, totalPoints, maxExactInRound, createdLeagues, bestRank, bestPointStreak, bestExactStreak };
}

// Vyhodnotí jeden odznak: vráti { earned: bool, current, target }.
function evaluate(def, stats, earnedCount) {
  switch (def.criteria) {
    case 'first_tip':
      return { earned: stats.tipsTotal >= 1, current: Math.min(stats.tipsTotal, 1), target: 1 };
    case 'tips_total':
      return { earned: stats.tipsTotal >= def.value, current: stats.tipsTotal, target: def.value };
    case 'exact_total':
      return { earned: stats.exactTotal >= def.value, current: stats.exactTotal, target: def.value };
    case 'exact_in_round':
      return { earned: stats.maxExactInRound >= def.value, current: stats.maxExactInRound, target: def.value };
    case 'total_points':
      return { earned: stats.totalPoints >= def.value, current: stats.totalPoints, target: def.value };
    case 'point_streak':
      return { earned: stats.bestPointStreak >= def.value, current: stats.bestPointStreak, target: def.value };
    case 'exact_streak':
      return { earned: stats.bestExactStreak >= def.value, current: stats.bestExactStreak, target: def.value };
    case 'create_league':
      return { earned: stats.createdLeagues >= 1, current: Math.min(stats.createdLeagues, 1), target: 1 };
    case 'podium':
      return { earned: stats.bestRank !== null && stats.bestRank <= 3, current: stats.bestRank ? Math.max(0, 4 - stats.bestRank) : 0, target: 3 };
    case 'collector':
      return { earned: earnedCount >= def.value, current: earnedCount, target: def.value };
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

  // collector kritérium potrebuje počet už získaných — počítame iteratívne,
  // preto najprv vyhodnotíme nezberateľské, potom collector/legend.
  let earnedCount = Object.keys(ownedMap).length;

  const toAward = []; // nové odznaky na udelenie
  const items = [];

  // prvý prechod: všetko okrem collector a nemerateľných závislých na počte
  for (const def of defs) {
    const alreadyOwned = ownedMap[def.id] != null;
    let res;
    if (def.criteria === 'collector') {
      res = { earned: false, current: 0, target: def.value }; // doplníme v 2. prechode
    } else {
      res = evaluate(def, stats, earnedCount);
    }
    items.push({ def, res, alreadyOwned });
  }

  // koľko by ich bolo získaných (vrátane novo splnených merateľných okrem collector)
  let projectedEarned = 0;
  items.forEach((it) => {
    if (it.def.criteria === 'collector') return;
    if (it.alreadyOwned || it.res.earned) projectedEarned += 1;
  });

  // druhý prechod: dopočítaj collector podľa projectedEarned
  items.forEach((it) => {
    if (it.def.criteria === 'collector') {
      it.res = { earned: projectedEarned >= it.def.value, current: projectedEarned, target: it.def.value };
    }
  });

  // urči, čo treba novo udeliť
  const now = new Date();
  const awardedDefs = []; // pre notifikáciu (name, rarity)
  for (const it of items) {
    if (!it.alreadyOwned && it.res.earned) {
      toAward.push({ userId: uid, achievementId: it.def.id, dateAwarded: now });
      ownedMap[it.def.id] = now;
      awardedDefs.push({ name: it.def.name, rarity: it.def.rarity });
    }
  }
  if (toAward.length) {
    // bulkCreate s ignoreDuplicates pre istotu (lazy beh môže prebehnúť paralelne)
    await UserAchievement.bulkCreate(toAward, { ignoreDuplicates: true });
    // notifikácia o nových odznakoch (fire-and-forget; import tu kvôli prípadnej cyklickosti)
    try {
      const notify = require('./notification.service');
      await notify.achievementsAwarded(uid, awardedDefs);
    } catch (e) { /* notifikácia je vedľajší efekt, chybu ignorujeme */ }
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
