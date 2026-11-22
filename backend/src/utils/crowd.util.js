// backend/src/utils/crowd.util.js
//
// „AKO TIPOVALI OSTATNÍ“ — súhrn tipov na zápas (zobrazuje sa až po jeho
// začiatku, dovtedy by sa tipy dali odpisovať): rozdelenie 1 / X / 2 v %,
// najčastejší presný výsledok a koľko hráčov trafilo presný výsledok.

const winnerOf = (t) => {
  if (t.winner) return t.winner;
  if (t.homeScore == null || t.awayScore == null) return null;
  return t.homeScore > t.awayScore ? 'home' : (t.homeScore < t.awayScore ? 'away' : 'draw');
};

// match: { tipType, status, homeScore, awayScore }, tips: [{ userId, homeScore, awayScore, winner }]
function crowdStats(match, tips) {
  const list = (tips || []).filter((t) => winnerOf(t));
  const n = list.length;
  if (!n) return null;
  const cnt = { home: 0, draw: 0, away: 0 };
  list.forEach((t) => { cnt[winnerOf(t)] += 1; });
  const pct = (k) => Math.round((cnt[k] / n) * 100);
  const out = { n, home: pct('home'), draw: pct('draw'), away: pct('away'), topScore: null, topScorePct: 0, exactCount: null, exactIds: [] };
  // zaokrúhlenie, aby súčet bol 100
  const diff = 100 - (out.home + out.draw + out.away);
  if (diff) { const k = ['home', 'draw', 'away'].sort((a, b) => cnt[b] - cnt[a])[0]; out[k] += diff; }

  if (match.tipType === 'exact_score') {
    const scores = new Map();
    list.forEach((t) => {
      if (t.homeScore == null || t.awayScore == null) return;
      const k = `${t.homeScore}:${t.awayScore}`;
      scores.set(k, (scores.get(k) || 0) + 1);
    });
    const top = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) { out.topScore = top[0]; out.topScorePct = Math.round((top[1] / n) * 100); }
    if (match.status === 'finished' && match.homeScore != null) {
      const hit = list.filter((t) => t.homeScore === match.homeScore && t.awayScore === match.awayScore);
      out.exactCount = hit.length;
      out.exactIds = hit.map((t) => Number(t.userId));
    }
  } else if (match.status === 'finished' && match.homeScore != null) {
    const actual = match.homeScore > match.awayScore ? 'home' : (match.homeScore < match.awayScore ? 'away' : 'draw');
    out.exactCount = cnt[actual];
  }
  return out;
}

module.exports = { crowdStats };
