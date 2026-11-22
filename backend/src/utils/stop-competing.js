// backend/src/utils/stop-competing.js
//
// Admin, ktorý založil OFICIÁLNU súťaž, ju môže spravovať bez toho, aby v nej
// súťažil. Pri založení si to zvolí (možnosť „Súťažím aj ja“), pri už
// existujúcej súťaži ju „opustí“ — vtedy sa odstráni jeho členstvo a aj jeho
// tipy v tejto súťaži, aby nebol v rebríčkoch. Spravovať ju môže ďalej (rola
// admin), pripojiť sa môže kedykoľvek znova.

const { League, Round, Match, Tip, UserLeague, UserSeason, Sequelize } = require('../models');
const { invalidate } = require('./standings.util');

const { Op } = Sequelize;

// môže tvorca opustiť súťaž bez jej zmazania? len globálny admin a len oficiálnu
function adminMayLeave(user, competition) {
  return !!(user && user.role === 'admin' && competition && competition.type === 'official'
    && Number(competition.creatorId) === Number(user.id));
}

// leagueIds = ligy, z ktorých odchádza; seasonId = ak odchádza aj zo sezóny
async function stopCompeting(userId, { leagueIds = [], seasonId = null } = {}) {
  let ids = [...new Set(leagueIds.map(Number).filter(Boolean))];
  if (seasonId) {
    const all = await League.findAll({ where: { seasonId }, attributes: ['id'] });
    ids = [...new Set([...ids, ...all.map((l) => l.id)])];
    await UserSeason.destroy({ where: { userId, seasonId } });
  }
  if (!ids.length) return { tips: 0 };
  await UserLeague.destroy({ where: { userId, leagueId: { [Op.in]: ids } } });
  const rounds = await Round.findAll({ where: { leagueId: { [Op.in]: ids } }, attributes: ['id'] });
  let tips = 0;
  if (rounds.length) {
    const matches = await Match.findAll({ where: { roundId: { [Op.in]: rounds.map((r) => r.id) } }, attributes: ['id'] });
    if (matches.length) tips = await Tip.destroy({ where: { userId, matchId: { [Op.in]: matches.map((m) => m.id) } } });
  }
  if (tips) invalidate();   // rebríčky sa prepočítajú bez neho
  return { tips };
}

module.exports = { adminMayLeave, stopCompeting };
