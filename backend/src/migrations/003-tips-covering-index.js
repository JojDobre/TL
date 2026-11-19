// Pokrývajúci index pre výpočet rebríčkov: databáza spočíta body a presnosť
// priamo z indexu bez čítania celých riadkov tipov (~40 % rýchlejšie).
module.exports = {
  async up({ addIndexIfMissing }) {
    await addIndexIfMissing('tips', 'tips_match_cover', ['match_id', 'user_id', 'points', 'home_score', 'away_score', 'winner']);
  },
};
