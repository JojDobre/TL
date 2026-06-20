// backend/src/controllers/achievementsPage.controller.js
//
// Stránka /achievements — galéria odznakov prihláseného používateľa.
// Vyhodnotenie je LAZY: pri každom otvorení sa prepočítajú a udelia odznaky.

const { evaluateUser } = require('../utils/achievement.engine');
const { asyncHandler } = require('../middleware/error.middleware');

const RARITY_RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };

// GET /achievements
const achievementsPage = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const { items, earnedCount, total } = await evaluateUser(meId);

  const lockedCount = total - earnedCount;
  const overallPct = total > 0 ? Math.round((earnedCount / total) * 100) : 0;

  // najvzácnejší získaný odznak
  const earned = items.filter((i) => i.earned);
  let rarest = null;
  earned.forEach((i) => {
    if (!rarest || RARITY_RANK[i.rarity] > RARITY_RANK[rarest.rarity]) rarest = i;
  });

  // najbližší cieľ: nezískaný merateľný odznak s najvyšším % progresu (a < 100 alebo ešte neudelený)
  const lockedMeasurable = items.filter((i) => !i.earned && i.measurable && i.target > 0);
  lockedMeasurable.sort((a, b) => b.pct - a.pct);
  const nextGoal = lockedMeasurable.length ? lockedMeasurable[0] : null;

  res.render('achievements', {
    items, earnedCount, lockedCount, total, overallPct, rarest, nextGoal,
  });
});

module.exports = { achievementsPage };
