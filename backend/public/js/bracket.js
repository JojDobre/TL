/* =====================================================================
   TIPERLIGA — Pavúk (NHL play-off bracket) prediction
   Click the team you think advances; the winner fills the next series.
   ===================================================================== */
(function () {
  // ---- teams (abbr, full name, seed, two-stop gradient) ----
  const T = {
    // Západná konferencia
    DAL: { n: 'Dallas Stars',           ab: 'DAL', s: '1',  c: ['#1c8a4a', '#0a3d22'] },
    MIN: { n: 'Minnesota Wild',          ab: 'MIN', s: 'WC', c: ['#0e6b3a', '#08361e'] },
    COL: { n: 'Colorado Avalanche',      ab: 'COL', s: '2',  c: ['#6f263d', '#3a1421'] },
    WPG: { n: 'Winnipeg Jets',           ab: 'WPG', s: '3',  c: ['#1f4a8a', '#0d2147'] },
    VGK: { n: 'Vegas Golden Knights',    ab: 'VGK', s: '1',  c: ['#b9975b', '#5f4d2c'] },
    VAN: { n: 'Vancouver Canucks',       ab: 'VAN', s: 'WC', c: ['#00295d', '#06132f'] },
    EDM: { n: 'Edmonton Oilers',         ab: 'EDM', s: '2',  c: ['#ff5a1f', '#0b2a5e'] },
    LAK: { n: 'Los Angeles Kings',       ab: 'LAK', s: '3',  c: ['#7f8a8f', '#15191b'] },
    // Východná konferencia
    FLA: { n: 'Florida Panthers',        ab: 'FLA', s: '1',  c: ['#b9362c', '#0c1c39'] },
    WSH: { n: 'Washington Capitals',     ab: 'WSH', s: 'WC', c: ['#cc1230', '#5d0a18'] },
    TOR: { n: 'Toronto Maple Leafs',     ab: 'TOR', s: '2',  c: ['#1657b0', '#0a274f'] },
    BOS: { n: 'Boston Bruins',           ab: 'BOS', s: '3',  c: ['#f2b40f', '#5a4205'] },
    NYR: { n: 'New York Rangers',        ab: 'NYR', s: '1',  c: ['#1455c7', '#08245a'] },
    NJD: { n: 'New Jersey Devils',       ab: 'NJD', s: 'WC', c: ['#d11a2d', '#5a0b15'] },
    CAR: { n: 'Carolina Hurricanes',     ab: 'CAR', s: '2',  c: ['#cf2030', '#5c0d15'] },
    TBL: { n: 'Tampa Bay Lightning',     ab: 'TBL', s: '3',  c: ['#1f5fbf', '#0a2247'] },
  };

  // ---- series: src entries are a team id, or '@<seriesId>' = winner of that series ----
  const SERIES = {
    // West round 1
    w1: { src: ['DAL', 'MIN'], next: 'w5', conf: 'W' },
    w2: { src: ['COL', 'WPG'], next: 'w5', conf: 'W' },
    w3: { src: ['VGK', 'VAN'], next: 'w6', conf: 'W' },
    w4: { src: ['EDM', 'LAK'], next: 'w6', conf: 'W' },
    // West round 2
    w5: { src: ['@w1', '@w2'], next: 'w7', conf: 'W' },
    w6: { src: ['@w3', '@w4'], next: 'w7', conf: 'W' },
    // West conference final
    w7: { src: ['@w5', '@w6'], next: 'F', conf: 'W' },
    // East round 1
    e1: { src: ['FLA', 'WSH'], next: 'e5', conf: 'E' },
    e2: { src: ['TOR', 'BOS'], next: 'e5', conf: 'E' },
    e3: { src: ['NYR', 'NJD'], next: 'e6', conf: 'E' },
    e4: { src: ['CAR', 'TBL'], next: 'e6', conf: 'E' },
    // East round 2
    e5: { src: ['@e1', '@e2'], next: 'e7', conf: 'E' },
    e6: { src: ['@e3', '@e4'], next: 'e7', conf: 'E' },
    // East conference final
    e7: { src: ['@e5', '@e6'], next: 'F', conf: 'E' },
    // Stanley Cup Final
    F:  { src: ['@w7', '@e7'], next: null, conf: 'F' },
  };

  // visual column layout (left → right) + round labels
  const COLS = [
    ['w1', 'w2', 'w3', 'w4'],
    ['w5', 'w6'],
    ['w7'],
    ['F'],
    ['e7'],
    ['e5', 'e6'],
    ['e1', 'e2', 'e3', 'e4'],
  ];
  const LABELS = [
    ['1. kolo', 'Západ'], ['2. kolo', 'Západ'], ['Konf. finále', 'Západ'],
    ['Finále', 'Stanleyho pohár'],
    ['Konf. finále', 'Východ'], ['2. kolo', 'Východ'], ['1. kolo', 'Východ'],
  ];
  const CAP = { w7: 'Finále Západu', e7: 'Finále Východu', F: 'O Stanleyho pohár' };
  const TOTAL = Object.keys(SERIES).length; // 15
  const STORE = 'tl-bracket-nhl';

  let picks = load();

  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(picks)); } catch (e) {} }

  const resolve = ref => ref[0] === '@' ? picks[ref.slice(1)] : ref;
  const teamsOf = id => SERIES[id].src.map(resolve);          // [teamId | undefined, ...]
  function leaves(ref) {                                      // all possible real teams behind a slot
    if (ref[0] !== '@') return [ref];
    return SERIES[ref.slice(1)].src.flatMap(leaves);
  }

  // drop any pick whose winner is no longer one of its (now changed) two teams — cascades downstream
  function prune() {
    let changed = true, guard = 0;
    while (changed && guard++ < 20) {
      changed = false;
      ['w1','w2','w3','w4','e1','e2','e3','e4','w5','w6','e5','e6','w7','e7','F'].forEach(id => {
        const tt = teamsOf(id);
        if (picks[id] && !tt.includes(picks[id])) { delete picks[id]; changed = true; }
      });
    }
  }

  // ---- render ----
  const colsEl   = document.getElementById('cols');
  const labelsEl = document.getElementById('roundLabels');
  const svg      = document.getElementById('connectors');
  const bracket  = document.getElementById('bracket');

  function teamRow(id, teamId, candidates, mirror) {
    if (!teamId) {
      const hint = candidates.length <= 2 ? candidates.map(t => T[t].ab).join(' / ') : 'Víťaz série';
      return `<div class="series-team empty"><span class="lg">?</span><span class="ab">${hint}</span></div>`;
    }
    const t = T[teamId];
    const win = picks[id] === teamId ? ' win' : '';
    return `<button type="button" class="series-team${win}" data-series="${id}" data-team="${teamId}">
        <span class="lg" style="background:linear-gradient(135deg,${t.c[0]},${t.c[1]})">${t.ab}</span>
        <span class="ab">${t.n}</span>
        <span class="seed">${t.s}</span>
      </button>`;
  }

  function seriesEl(id, mirror) {
    const tt = teamsOf(id);
    const cap = CAP[id] ? `<div class="series-cap">${CAP[id]}</div>` : '';
    const rows = tt.map((team, i) => teamRow(id, team, leaves(SERIES[id].src[i]), mirror)).join('');
    const cls = 'series' + (mirror ? ' mirror' : '') + (id === 'F' ? ' final' : '');
    return `<div class="${cls}" id="S-${id}">${cap}${rows}</div>`;
  }

  function render() {
    prune();

    labelsEl.innerHTML = LABELS.map(([r, c], i) =>
      `<div class="rl-col${i === 3 ? ' is-final' : ''}"><div class="r">${r}</div><div class="conf">${c}</div></div>`
    ).join('');

    colsEl.innerHTML = COLS.map((ids, ci) => {
      const single = ids.length === 1;
      const mirror = ci > 3;                 // east columns mirror
      if (ci === 3) {                        // final column: cup emblem + final + champion card
        const champ = picks.F;
        const cup = `<svg class="cup-emblem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 0 12 0V4H6v5Z"/><path d="M6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3"/><path d="M12 15v4M8 21h8M9 21v-1.5h6V21"/></svg>`;
        const cc = champ
          ? `<div class="champ-card"><div class="k">Tvoj víťaz</div><div class="v"><span class="lg" style="background:linear-gradient(135deg,${T[champ].c[0]},${T[champ].c[1]})">${T[champ].ab}</span>${T[champ].n}</div></div>`
          : `<div class="champ-card empty"><div class="k">Stanleyho pohár</div><div class="v">vyber víťaza finále</div></div>`;
        return `<div class="bracket-col col-final">${cup}${seriesEl('F', false)}${cc}</div>`;
      }
      return `<div class="bracket-col${single ? ' single' : ''}">${ids.map(id => seriesEl(id, mirror)).join('')}</div>`;
    }).join('');

    // progress + champion summary
    const n = Object.keys(picks).length;
    document.getElementById('progN').textContent = n;
    document.getElementById('saveN').textContent = n;
    var pt = document.getElementById('progTotal'); if (pt) pt.textContent = TOTAL;
    var st = document.getElementById('saveTotal'); if (st) st.textContent = TOTAL;
    document.getElementById('progBar').style.width = (n / TOTAL * 100) + '%';
    const champEl = document.getElementById('champNow');
    if (picks.F) {
      const t = T[picks.F];
      champEl.className = 'champ-team';
      champEl.innerHTML = `<span class="lg" style="background:linear-gradient(135deg,${t.c[0]},${t.c[1]})">${t.ab}</span>${t.n}`;
    } else {
      champEl.className = 'champ-empty';
      champEl.textContent = 'Zatiaľ nevybraný';
    }

    requestAnimationFrame(drawConnectors);
  }

  // ---- SVG connectors between each series and the one it feeds ----
  function drawConnectors() {
    const bb = bracket.getBoundingClientRect();
    let d = '';
    Object.keys(SERIES).forEach(id => {
      const s = SERIES[id];
      if (!s.next) return;
      const fe = document.getElementById('S-' + id);
      const ne = document.getElementById('S-' + s.next);
      if (!fe || !ne) return;
      const fr = fe.getBoundingClientRect(), nr = ne.getBoundingClientRect();
      const sy = fr.top + fr.height / 2 - bb.top;
      const ey = nr.top + nr.height / 2 - bb.top;
      let sx, ex;
      if (s.conf === 'W') { sx = fr.right - bb.left; ex = nr.left - bb.left; }   // flow →
      else                { sx = fr.left  - bb.left; ex = nr.right - bb.left; }  // flow ←
      const mx = (sx + ex) / 2;
      const on = picks[id] ? ' class="on"' : '';
      d += `<path${on} d="M${sx.toFixed(1)} ${sy.toFixed(1)} H${mx.toFixed(1)} V${ey.toFixed(1)} H${ex.toFixed(1)}"/>`;
    });
    svg.setAttribute('viewBox', `0 0 ${bracket.offsetWidth} ${bracket.offsetHeight}`);
    svg.innerHTML = d;
  }

  // ---- interactions ----
  colsEl.addEventListener('click', e => {
    const btn = e.target.closest('.series-team[data-series]');
    if (!btn) return;
    const id = btn.dataset.series, team = btn.dataset.team;
    picks[id] = (picks[id] === team) ? undefined : team;   // toggle off if same
    if (picks[id] === undefined) delete picks[id];
    save();
    render();
  });

  function reset() { picks = {}; save(); render(); toast('Pavúk vyčistený', 'Všetky tipy série boli odstránené.', 'warning'); }
  document.getElementById('resetBtn').addEventListener('click', reset);
  document.getElementById('resetBtn2').addEventListener('click', reset);

  document.getElementById('saveBtn').addEventListener('click', () => {
    const n = Object.keys(picks).length;
    const champ = picks.F ? `Šampión: ${T[picks.F].n}.` : 'Šampióna ešte nemáš vybraného.';
    toast('Pavúk uložený', `${n} z ${TOTAL} sérií vytipovaných. ${champ}`);
  });

  // ---- toast (same pattern as round.html) ----
  function toast(title, msg, type) {
    type = type || 'success';
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="var(--${type === 'success' ? 'success' : type})" stroke-width="2.5"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg><div><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>`;
    document.getElementById('toastWrap').appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; setTimeout(() => el.remove(), 300); }, 3200);
  }

  // redraw connectors on resize
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawConnectors, 80); });
  window.addEventListener('load', () => setTimeout(drawConnectors, 120));

  render();
})();
