// backend/src/utils/league.utils.js
//
// Pomocné funkcie pre stav ligy. Liga je "uzamknutá" (nedá sa do nej zasahovať
// — nové kolá/zápasy/tipy/vyhodnotenia), ak je ukončená samotná liga ALEBO
// je ukončená jej sezóna.

const { seasonStatus } = require('./season.utils');

// Je liga uzamknutá? (potrebuje načítanú league.Season, inak berie len league.ended)
function isLeagueLocked(league) {
  if (!league) return false;
  if (league.ended) return true;
  if (league.Season && seasonStatus(league.Season) === 'ended') return true;
  return false;
}

module.exports = { isLeagueLocked };
