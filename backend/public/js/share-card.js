// ZDIEĽANIE AKO OBRÁZOK — viac štýlov kariet (story 1080×1920, príspevok 1080×1080).
// Obrázky sa kreslia priamo v prehliadači (canvas), server nič negeneruje.
// Po kliknutí na [data-share-card] sa otvorí výber štýlu s náhľadom; zdieľa sa
// cez systémové menu telefónu (Web Share API so súborom), inak sa stiahne.
//
// Údaje (JSON v atribúte data-share-card):
//   kolo:   league, round, initials, grad, points, rank, players, exact, hits,
//           tips, joker, code, url, matches[], board[], labels{}
//   súboj:  variant:'duel', league, round, me{name,initials,pts}, opp{…}, result
//   sezóna: variant:'season', season, points, rank, players, exact, accuracy,
//           rounds, best{name,pts}, team, labels{}
(function () {
  var FD = "'Space Grotesk', 'Manrope', system-ui, sans-serif";
  var FB = "'Manrope', system-ui, sans-serif";
  var GOLD = '#facc15';

  // ------------------------------------------------------------ pomocníci
  function loadImg(src) {
    return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; });
  }
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function font(c, w, s, f) { c.font = w + ' ' + s + 'px ' + (f || FB); }
  function ell(c, t, max) {
    t = String(t == null ? '' : t);
    if (c.measureText(t).width <= max) return t;
    while (t.length > 1 && c.measureText(t + '…').width > max) t = t.slice(0, -1);
    return t + '…';
  }
  function fit(c, t, max, size, w, f) { var s = size; do { font(c, w, s, f); s -= 2; } while (c.measureText(t).width > max && s > 18); }
  function txt(c, t, x, y, align, color) { c.textAlign = align || 'left'; if (color) c.fillStyle = color; c.fillText(t, x, y); }
  function cols(d) { var m = String(d.grad || '').match(/#[0-9a-f]{3,8}/gi) || []; return [m[0] || '#7c5cff', m[1] || m[0] || '#3b1f8f']; }
  function L(d, k, def) { return (d.labels && d.labels[k]) || def; }
  function grid(c, W, H, alpha) {
    c.save();
    var g = c.createLinearGradient(0, 0, 0, H * 0.55);
    g.addColorStop(0, 'rgba(255,255,255,' + alpha + ')'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.strokeStyle = g; c.lineWidth = 1;
    for (var x = 0; x <= W; x += 60) { c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, H * 0.55); c.stroke(); }
    for (var y = 0; y <= H * 0.55; y += 60) { c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); c.stroke(); }
    c.restore();
  }
  function glow(c, x, y, r, color) {
    var g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  }
  function darkBg(c, W, H, d) {
    c.fillStyle = '#080b14'; c.fillRect(0, 0, W, H);
    glow(c, W * 0.85, H * 0.06, 900, 'rgba(124,92,255,.7)');
    glow(c, 0, H, 900, 'rgba(250,204,21,.2)');
    grid(c, W, H, 0.045);
  }
  function brand(c, d, x, y, dark) {
    if (d._mascot) c.drawImage(d._mascot, x, y - 42, 84, 84);
    font(c, '700', 46, FD); c.textBaseline = 'middle';
    txt(c, 'Tifo', x + (d._mascot ? 104 : 0), y, 'left', dark ? '#111' : 'rgba(255,255,255,.92)');
  }
  function crest(c, d, x, y, s) {
    var k = cols(d); var g = c.createLinearGradient(x, y, x + s, y + s);
    g.addColorStop(0, k[0]); g.addColorStop(1, k[1]);
    rr(c, x, y, s, s, s * 0.29); c.fillStyle = g; c.fill();
    font(c, '700', Math.round(s * 0.36), FD);
    txt(c, String(d.initials || 'T').slice(0, 3), x + s / 2, y + s / 2 + 2, 'center', '#fff');
  }
  function footer(c, d, W, y, dark) {
    font(c, '700', 50, FD); txt(c, L(d, 'cta', 'Tipuj so mnou na Tifo'), W / 2, y, 'center', dark ? '#111' : '#fff');
    font(c, '700', 36); txt(c, 'tifo.sk' + (d.code ? '  ·  ' + L(d, 'code', 'kód ligy') + ' ' + d.code : ''), W / 2, y + 64, 'center', dark ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.62)');
  }
  function pill(c, t, cx, y, h, bg, border, color, size) {
    font(c, '700', size || 44); var w = c.measureText(t).width + 110;
    rr(c, cx - w / 2, y, w, h, h / 2); c.fillStyle = bg; c.fill();
    if (border) { c.strokeStyle = border; c.lineWidth = 3; c.stroke(); }
    txt(c, t, cx, y + h / 2 + 2, 'center', color);
  }
  function rankText(d) { return L(d, 'rank', '{r}. miesto z {n}').replace('{r}', d.rank).replace('{n}', d.players || '–'); }
  function header(c, d, W, y) {
    crest(c, d, 90, y, 150);
    font(c, '700', 38); txt(c, ell(c, d.league || '', W - 370), 280, y + 52, 'left', 'rgba(255,255,255,.62)');
    fit(c, d.round || '', W - 370, 64, '700', FD); txt(c, ell(c, d.round || '', W - 370), 280, y + 112, 'left', '#fff');
  }

  // ------------------------------------------------------------- štýly
  var V = {};

  // 1) KLASIK — veľké body, poradie, tri čísla
  V.classic = { w: 1080, h: 1920, draw: function (c, d, W, H) {
    darkBg(c, W, H, d); c.textBaseline = 'middle';
    brand(c, d, 90, 162);
    header(c, d, W, 330);
    var py = 820;
    font(c, '700', 40); txt(c, L(d, 'got', 'V tomto kole mám').toUpperCase(), W / 2, py - 210, 'center', 'rgba(255,255,255,.6)');
    font(c, '700', 300, FD);
    var g = c.createLinearGradient(0, py - 150, 0, py + 150); g.addColorStop(0, '#fff3b0'); g.addColorStop(1, GOLD);
    c.fillStyle = g; c.shadowColor = 'rgba(250,204,21,.35)'; c.shadowBlur = 60; txt(c, '+' + (d.points || 0), W / 2, py, 'center'); c.shadowBlur = 0;
    font(c, '700', 52, FD); txt(c, L(d, 'pts', 'bodov'), W / 2, py + 175, 'center', 'rgba(255,255,255,.85)');
    if (d.rank) pill(c, '🏆 ' + rankText(d), W / 2, py + 260, 104, 'rgba(250,204,21,.16)', 'rgba(250,204,21,.55)', GOLD, 46);
    var tiles = [[d.exact || 0, L(d, 'exact', 'presné výsledky')], [d.hits || 0, L(d, 'hits', 'bodované tipy')], [d.tips || 0, L(d, 'tips', 'tipov')]];
    var ty = 1330; var gap = 28; var tw = (W - 180 - gap * 2) / 3;
    tiles.forEach(function (t, i) {
      var tx = 90 + i * (tw + gap);
      rr(c, tx, ty, tw, 230, 40); c.fillStyle = 'rgba(255,255,255,.06)'; c.fill(); c.strokeStyle = 'rgba(150,165,215,.22)'; c.lineWidth = 2; c.stroke();
      font(c, '700', 92, FD); txt(c, String(t[0]), tx + tw / 2, ty + 100, 'center', i === 0 ? GOLD : '#fff');
      font(c, '700', 30); txt(c, ell(c, t[1], tw - 30), tx + tw / 2, ty + 180, 'center', 'rgba(255,255,255,.6)');
    });
    if (d.joker) { font(c, '700', 36); txt(c, '🃏 ' + L(d, 'joker', 'Žolík v hre'), W / 2, ty + 300, 'center', 'rgba(255,255,255,.75)'); }
    footer(c, d, W, 1745);
  } };

  // 2) MINIMAL — svetlý, čistý, jedno veľké číslo
  V.minimal = { w: 1080, h: 1920, light: true, draw: function (c, d, W, H) {
    c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, W, H);
    var k = cols(d); c.textBaseline = 'middle';
    c.fillStyle = k[0]; c.beginPath(); c.arc(W - 150, 170, 44, 0, Math.PI * 2); c.fill();
    font(c, '800', 50, FD); txt(c, 'tifo.', 90, 170, 'left', '#111');
    font(c, '700', 34); txt(c, ell(c, String(d.league || '').toUpperCase(), W - 180), 90, 420, 'left', 'rgba(0,0,0,.45)');
    fit(c, d.round || '', W - 180, 92, '700', FD); txt(c, ell(c, d.round || '', W - 180), 90, 510, 'left', '#111');
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(90, 600, W - 180, 3);
    font(c, '700', 400, FD); txt(c, String(d.points || 0), 70, 900, 'left', '#111');
    var nw = c.measureText(String(d.points || 0)).width;
    font(c, '700', 60, FD); txt(c, L(d, 'pts', 'bodov'), 90 + nw + 10, 1010, 'left', k[0]);
    if (d.rank) {
      font(c, '700', 44); var t = rankText(d); var w = c.measureText(t).width + 80;
      rr(c, 90, 1160, w, 96, 48); c.fillStyle = '#111'; c.fill(); txt(c, t, 90 + w / 2, 1210, 'center', '#fff');
    }
    var rows = [[L(d, 'exact', 'presné výsledky'), d.exact || 0], [L(d, 'hits', 'bodované tipy'), d.hits || 0], [L(d, 'tips', 'tipov'), d.tips || 0]];
    rows.forEach(function (r, i) {
      var y = 1380 + i * 92;
      c.fillStyle = 'rgba(0,0,0,.1)'; c.fillRect(90, y + 46, W - 180, 2);
      font(c, '600', 40); txt(c, r[0], 90, y, 'left', 'rgba(0,0,0,.6)');
      font(c, '700', 48, FD); txt(c, String(r[1]), W - 90, y, 'right', '#111');
    });
    font(c, '700', 36); txt(c, L(d, 'cta', 'Tipuj so mnou na Tifo') + '  →  tifo.sk', 90, 1800, 'left', 'rgba(0,0,0,.55)');
  } };

  // 3) ZÁPASY — moje tipy s výsledkami, uhádnuté zvýraznené
  V.matches = { w: 1080, h: 1920, need: function (d) { return d.matches && d.matches.length; }, draw: function (c, d, W, H) {
    darkBg(c, W, H, d); c.textBaseline = 'middle';
    brand(c, d, 90, 150);
    pill(c, '+' + (d.points || 0) + ' ' + L(d, 'ptsShort', 'b'), W - 200, 112, 80, GOLD, null, '#1c1605', 42);
    font(c, '700', 36); txt(c, ell(c, (d.league || '') + ' · ' + (d.round || ''), W - 180), 90, 290, 'left', 'rgba(255,255,255,.6)');
    font(c, '700', 72, FD); txt(c, L(d, 'myTips', 'Moje tipy v kole'), 90, 370, 'left', '#fff');
    var list = d.matches.slice(0, 8); var rh = list.length <= 4 ? 230 : (list.length <= 6 ? 190 : 158); var y0 = 470;
    list.forEach(function (m, i) {
      var y = y0 + i * (rh + 18);
      var hitC = m.hit === 'exact' ? GOLD : (m.hit === 'part' ? '#1fd497' : 'rgba(255,255,255,.18)');
      rr(c, 90, y, W - 180, rh, 30);
      c.fillStyle = m.hit === 'exact' ? 'rgba(250,204,21,.12)' : 'rgba(255,255,255,.05)'; c.fill();
      c.strokeStyle = m.hit === 'exact' ? 'rgba(250,204,21,.55)' : 'rgba(150,165,215,.18)'; c.lineWidth = 2; c.stroke();
      // tímy a výsledok
      font(c, '700', rh > 200 ? 42 : 36); var half = (W - 180 - 360) / 2 + 60;
      txt(c, ell(c, m.home, half - 20), 90 + 30, y + rh * 0.32, 'left', '#fff');
      txt(c, ell(c, m.away, half - 20), 90 + 30, y + rh * 0.68, 'left', '#fff');
      font(c, '700', 44, FD); txt(c, m.result || '–', W - 90 - 300, y + rh / 2, 'center', 'rgba(255,255,255,.9)');
      // môj tip + body
      rr(c, W - 90 - 230, y + 34, 200, rh - 68, 22); c.fillStyle = hitC === 'rgba(255,255,255,.18)' ? 'rgba(255,255,255,.08)' : hitC; c.fill();
      var ink = m.hit === 'miss' || !m.hit ? 'rgba(255,255,255,.8)' : '#10130a';
      font(c, '700', 36, FD); txt(c, (m.tip || '–') + (m.joker ? ' 🃏' : ''), W - 90 - 130, y + rh / 2 - 14, 'center', ink);
      font(c, '700', 26); txt(c, '+' + (m.pts || 0), W - 90 - 130, y + rh / 2 + 24, 'center', ink);
    });
    if (d.matches.length > 8) { font(c, '700', 32); txt(c, '+ ' + (d.matches.length - 8) + ' …', W / 2, y0 + 8 * (rh + 18) + 10, 'center', 'rgba(255,255,255,.5)'); }
    footer(c, d, W, 1790);
  } };

  // 4) POREDIE — rebríček kola, ja zvýraznený
  V.rank = { w: 1080, h: 1920, need: function (d) { return d.board && d.board.length > 1; }, draw: function (c, d, W, H) {
    var k = cols(d);
    c.fillStyle = '#0a0d18'; c.fillRect(0, 0, W, H);
    glow(c, W / 2, 0, 1100, k[0] + 'cc'); glow(c, W, H, 800, 'rgba(250,204,21,.18)');
    c.textBaseline = 'middle'; brand(c, d, 90, 150);
    font(c, '700', 36); txt(c, ell(c, (d.league || '') + ' · ' + (d.round || ''), W - 180), W / 2, 330, 'center', 'rgba(255,255,255,.7)');
    font(c, '700', 210, FD); txt(c, (d.rank || '–') + '.', W / 2, 520, 'center', '#fff');
    font(c, '700', 48, FD); txt(c, L(d, 'place', 'miesto v kole') + ' · ' + (d.players || '') + ' ' + L(d, 'playersW', 'hráčov'), W / 2, 680, 'center', GOLD);
    var y = 800; var rh = 128;
    var rows = d.board.slice(0, 6);
    rows.forEach(function (r, i) {
      if (r.gap) { font(c, '700', 40); txt(c, '⋯', W / 2, y + 40, 'center', 'rgba(255,255,255,.4)'); y += 80; return; }
      rr(c, 90, y, W - 180, rh, 34);
      c.fillStyle = r.me ? GOLD : 'rgba(255,255,255,.07)'; c.fill();
      var ink = r.me ? '#1c1605' : '#fff';
      font(c, '700', 48, FD); txt(c, String(r.rank), 160, y + rh / 2, 'center', r.me ? ink : (r.rank <= 3 ? GOLD : 'rgba(255,255,255,.6)'));
      font(c, '700', 42); txt(c, ell(c, r.name, W - 520), 230, y + rh / 2, 'left', ink);
      font(c, '700', 46, FD); txt(c, String(r.pts), W - 130, y + rh / 2, 'right', ink);
      y += rh + 16;
      void i;
    });
    footer(c, d, W, 1790);
  } };

  // 5) PRÍSPEVOK (štvorec) — výrazný farebný blok
  V.square = { w: 1080, h: 1080, draw: function (c, d, W, H) {
    var k = cols(d);
    var g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, k[0]); g.addColorStop(1, '#0a0d18');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    glow(c, W, 0, 700, 'rgba(250,204,21,.25)');
    c.textBaseline = 'middle';
    brand(c, d, 80, 110);
    font(c, '700', 34); txt(c, ell(c, d.league || '', W - 160), 80, 250, 'left', 'rgba(255,255,255,.75)');
    fit(c, d.round || '', W - 160, 70, '700', FD); txt(c, ell(c, d.round || '', W - 160), 80, 320, 'left', '#fff');
    font(c, '700', 330, FD); txt(c, '+' + (d.points || 0), 70, 590, 'left', '#fff');
    font(c, '700', 50, FD); txt(c, L(d, 'pts', 'bodov'), 86, 790, 'left', GOLD);
    var y = 930;
    font(c, '700', 40);
    var parts = [];
    if (d.rank) parts.push('🏆 ' + rankText(d));
    parts.push('🎯 ' + (d.exact || 0) + ' ' + L(d, 'exactShort', 'presné'));
    txt(c, parts.join('   '), 80, y, 'left', '#fff');
    font(c, '700', 30); txt(c, 'tifo.sk', W - 80, y, 'right', 'rgba(255,255,255,.65)');
  } };

  // 6) SÚBOJ — ja vs. súper
  function duelDraw(light) {
    return function (c, d, W, H) {
      var me = d.me || {}; var op = d.opp || {};
      if (light) { c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, W, H); } else {
        c.fillStyle = '#0b0a16'; c.fillRect(0, 0, W, H);
        glow(c, 0, H * 0.45, 900, d.result === 'loss' ? 'rgba(139,147,173,.35)' : 'rgba(240,71,106,.45)');
        glow(c, W, H * 0.45, 900, 'rgba(124,92,255,.5)');
        grid(c, W, H, 0.04);
      }
      var ink = light ? '#111' : '#fff'; var sub = light ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.62)';
      c.textBaseline = 'middle';
      brand(c, d, 90, 150, light);
      font(c, '700', 36); txt(c, ell(c, (d.league || '') + ' · ' + (d.round || ''), W - 180), W / 2, 330, 'center', sub);
      font(c, '800', 120, FD); txt(c, '⚔️', W / 2, 470, 'center');
      var head = d.result === 'win' ? L(d, 'win', 'Víťazstvo!') : (d.result === 'loss' ? L(d, 'loss', 'Tentoraz prehra') : (d.result === 'draw' ? L(d, 'draw', 'Remíza') : L(d, 'live', 'Súboj prebieha')));
      font(c, '700', 86, FD); txt(c, head, W / 2, 630, 'center', d.result === 'win' ? (light ? '#111' : GOLD) : ink);
      function person(p, x, color, lead) {
        c.fillStyle = color; c.beginPath(); c.arc(x, 900, 130, 0, Math.PI * 2); c.fill();
        if (lead) { c.strokeStyle = GOLD; c.lineWidth = 10; c.stroke(); }
        font(c, '700', 90, FD); txt(c, String(p.initials || '?'), x, 905, 'center', '#fff');
        font(c, '700', 40); txt(c, ell(c, p.name || '', 380), x, 1080, 'center', ink);
        font(c, '700', 170, FD); txt(c, String(p.pts || 0), x, 1260, 'center', lead ? (light ? '#111' : GOLD) : ink);
      }
      person(me, 300, '#7c5cff', (me.pts || 0) > (op.pts || 0));
      person(op, W - 300, '#d43545', (op.pts || 0) > (me.pts || 0));
      font(c, '800', 64, FD); txt(c, 'VS', W / 2, 1000, 'center', sub);
      font(c, '700', 38); txt(c, L(d, 'pts', 'bodov'), W / 2, 1260, 'center', sub);
      footer(c, d, W, 1745, light);
    };
  }
  V.duel = { w: 1080, h: 1920, only: 'duel', draw: duelDraw(false) };
  V.duelLight = { w: 1080, h: 1920, only: 'duel', light: true, draw: duelDraw(true) };

  // 7) SEZÓNA — súhrnná karta
  function seasonDraw(light) {
    return function (c, d, W, H) {
      if (light) { c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, W, H); } else { darkBg(c, W, H, d); }
      var ink = light ? '#111' : '#fff'; var sub = light ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.62)';
      c.textBaseline = 'middle';
      brand(c, d, 90, 150, light);
      font(c, '700', 40); txt(c, L(d, 'yearIn', 'Moja sezóna').toUpperCase(), 90, 330, 'left', light ? cols(d)[0] : GOLD);
      fit(c, d.season || '', W - 180, 88, '700', FD); txt(c, ell(c, d.season || '', W - 180), 90, 420, 'left', ink);
      font(c, '700', 260, FD); txt(c, String(d.points || 0), 80, 640, 'left', ink);
      var nw = c.measureText(String(d.points || 0)).width;
      font(c, '700', 54, FD); txt(c, L(d, 'pts', 'bodov'), 100 + nw, 700, 'left', sub);
      if (d.rank) {
        var t = rankText(d); font(c, '700', 44); var w = c.measureText(t).width + 100;
        rr(c, 90, 800, w, 96, 48); c.fillStyle = light ? '#111' : 'rgba(250,204,21,.16)'; c.fill();
        if (!light) { c.strokeStyle = 'rgba(250,204,21,.55)'; c.lineWidth = 3; c.stroke(); }
        txt(c, '🏆 ' + t, 90 + w / 2, 850, 'center', light ? '#fff' : GOLD);
      }
      var cards = [
        [d.exact || 0, L(d, 'exact', 'presné výsledky')],
        [d.accuracy != null ? d.accuracy + ' %' : '–', L(d, 'accuracy', 'presnosť')],
        [d.rounds || 0, L(d, 'roundsW', 'odohraných kôl')],
        [d.tips || 0, L(d, 'tips', 'tipov')],
      ];
      var gx = 90; var gy = 980; var cw = (W - 180 - 28) / 2; var ch = 200;
      cards.forEach(function (k, i) {
        var x = gx + (i % 2) * (cw + 28); var y = gy + Math.floor(i / 2) * (ch + 28);
        rr(c, x, y, cw, ch, 36); c.fillStyle = light ? '#fff' : 'rgba(255,255,255,.06)'; c.fill();
        if (!light) { c.strokeStyle = 'rgba(150,165,215,.22)'; c.lineWidth = 2; c.stroke(); }
        font(c, '700', 80, FD); txt(c, String(k[0]), x + 40, y + 80, 'left', i === 0 ? (light ? cols(d)[0] : GOLD) : ink);
        font(c, '700', 30); txt(c, ell(c, k[1], cw - 60), x + 40, y + 150, 'left', sub);
      });
      var y2 = gy + 2 * (ch + 28) + 40;
      if (d.best) { font(c, '700', 36); txt(c, '⭐ ' + L(d, 'bestRound', 'Najlepšie kolo') + ': ' + ell(c, d.best.name, 560) + ' (+' + d.best.pts + ')', 90, y2, 'left', ink); y2 += 70; }
      if (d.team) { font(c, '700', 36); txt(c, '❤️ ' + L(d, 'favTeam', 'Najlepšie mi išiel') + ': ' + ell(c, d.team, 520), 90, y2, 'left', ink); }
      footer(c, d, W, 1790, light);
    };
  }
  V.season = { w: 1080, h: 1920, only: 'season', draw: seasonDraw(false) };
  V.seasonLight = { w: 1080, h: 1920, only: 'season', light: true, draw: seasonDraw(true) };

  var NAMES = { classic: 'Klasik', minimal: 'Minimal', matches: 'Moje tipy', rank: 'Poradie', square: 'Príspevok', duel: 'Súboj', duelLight: 'Svetlý', season: 'Sezóna', seasonLight: 'Svetlý' };

  function variantsFor(d) {
    var only = d.variant === 'duel' || d.variant === 'season' ? d.variant : null;
    return Object.keys(V).filter(function (k) {
      var v = V[k];
      if (only) return v.only === only;
      if (v.only) return false;
      return !v.need || v.need(d);
    });
  }

  // ---------------------------------------------------------------- kreslenie
  var assets = null;
  function prepare() {
    if (assets) return assets;
    var fonts = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('700 64px "Space Grotesk"'), document.fonts.load('700 40px "Manrope"'), document.fonts.load('800 40px "Space Grotesk"')]).catch(function () {})
      : Promise.resolve();
    assets = Promise.all([fonts, loadImg('/branding/identity/tifo-mascot-512.webp')]).then(function (r) { return { mascot: r[1] }; });
    return assets;
  }
  function render(d, key) {
    return prepare().then(function (a) {
      var v = V[key] || V.classic;
      var cv = document.createElement('canvas'); cv.width = v.w; cv.height = v.h;
      var c = cv.getContext('2d');
      d._mascot = a.mascot;
      v.draw(c, d, v.w, v.h);
      return cv;
    });
  }
  function toBlob(cv) {
    return new Promise(function (res, rej) { cv.toBlob(function (b) { if (b) res(b); else rej(new Error('Obrázok sa nepodarilo vytvoriť.')); }, 'image/png'); });
  }
  function download(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function fileName(d, key) {
    return 'tifo-' + String(d.round || d.season || 'kolo').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + key + '.png';
  }
  function share(d, key) {
    return render(d, key).then(toBlob).then(function (blob) {
      var name = fileName(d, key); var file = null;
      try { file = new File([blob], name, { type: 'image/png' }); } catch (e) { file = null; }
      var text = L(d, 'text', '');
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: text + (d.url ? ' ' + d.url : '') }).then(function () { return 'shared'; })
          .catch(function (e) { if (e && e.name === 'AbortError') return 'cancel'; download(blob, name); return 'download'; });
      }
      download(blob, name); return 'download';
    });
  }

  // ------------------------------------------------------- výber štýlu (sheet)
  function css() {
    if (document.getElementById('tsc-css')) return;
    var s = document.createElement('style'); s.id = 'tsc-css';
    s.textContent = '.tsc{position:fixed;inset:0;z-index:400;display:flex;align-items:flex-end;justify-content:center;background:rgba(5,7,13,.72);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:tscf .2s ease}'
      + '@keyframes tscf{from{opacity:0}to{opacity:1}}'
      + '.tsc-p{width:100%;max-width:520px;max-height:96vh;display:flex;flex-direction:column;background:#10141f;border:1px solid rgba(150,165,215,.18);border-radius:28px 28px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom));color:#eef1f9;font-family:Manrope,system-ui,sans-serif}'
      + '@media(min-width:700px){.tsc{align-items:center}.tsc-p{border-radius:28px}}'
      + '.tsc-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.tsc-h b{font:700 18px "Space Grotesk",Manrope,sans-serif}'
      + '.tsc button.tsc-x{width:38px;height:38px;border-radius:12px;border:1px solid rgba(150,165,215,.2)!important;background:rgba(255,255,255,.06)!important;color:#eef1f9!important;font-size:20px!important;cursor:pointer}'
      + '.tsc-chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}.tsc-chips::-webkit-scrollbar{display:none}'
      + '.tsc button.tsc-chip{flex:none;padding:9px 14px;border-radius:12px;border:1px solid rgba(150,165,215,.2)!important;background:rgba(255,255,255,.06)!important;color:#c8cee0!important;font:700 13px Manrope,sans-serif!important;cursor:pointer}'
      + '.tsc button.tsc-chip.on{background:#facc15!important;border-color:#facc15!important;color:#1c1605!important}'
      + '.tsc-view{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;margin:14px 0;position:relative}'
      + '.tsc-view img{max-width:100%;max-height:58vh;border-radius:18px;box-shadow:0 18px 40px rgba(0,0,0,.5);background:#080b14}'
      + '.tsc-view .ld{position:absolute;color:#8b93ad;font-size:13px}'
      + '.tsc-a{display:flex;gap:10px}.tsc .tsc-a button{flex:1;height:50px;border-radius:15px;border:0;font:700 15px Manrope,sans-serif!important;cursor:pointer}'
      + '.tsc .tsc-a .go{background:#facc15!important;color:#1c1605!important}.tsc .tsc-a .dl{flex:0 0 auto;padding:0 18px;background:rgba(255,255,255,.07)!important;color:#eef1f9!important;border:1px solid rgba(150,165,215,.2)!important}'
      + '.tsc-a button:disabled{opacity:.6}';
    document.head.appendChild(s);
  }
  function openPicker(d) {
    css();
    var keys = variantsFor(d);
    var names = (d.labels && d.labels.variants) || {};
    var el = document.createElement('div'); el.className = 'tsc';
    el.innerHTML = '<div class="tsc-p" role="dialog" aria-modal="true"><div class="tsc-h"><b></b><button class="tsc-x" type="button" aria-label="Zavrieť">×</button></div>'
      + '<div class="tsc-chips"></div><div class="tsc-view"><span class="ld">…</span><img alt=""></div>'
      + '<div class="tsc-a"><button class="go" type="button"></button><button class="dl" type="button" aria-label="Stiahnuť">⬇</button></div></div>';
    el.querySelector('.tsc-h b').textContent = L(d, 'pick', 'Vyber štýl karty');
    el.querySelector('.go').textContent = L(d, 'shareNow', 'Zdieľať');
    var chips = el.querySelector('.tsc-chips'); var img = el.querySelector('img'); var ld = el.querySelector('.ld');
    var cur = keys[0]; var cache = {};
    function show(k) {
      cur = k;
      chips.querySelectorAll('.tsc-chip').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-k') === k); });
      ld.hidden = false; img.style.opacity = '.35';
      var p = cache[k] || (cache[k] = render(d, k).then(function (cv) { return cv.toDataURL('image/jpeg', 0.82); }));
      p.then(function (url) { if (cur !== k) return; img.src = url; img.style.opacity = '1'; ld.hidden = true; });
    }
    keys.forEach(function (k) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'tsc-chip'; b.setAttribute('data-k', k);
      b.textContent = names[k] || NAMES[k] || k; b.addEventListener('click', function () { show(k); });
      chips.appendChild(b);
    });
    function close() { el.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    el.addEventListener('click', function (e) { if (e.target === el) close(); });
    el.querySelector('.tsc-x').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    var go = el.querySelector('.go'); var dl = el.querySelector('.dl');
    go.addEventListener('click', function () {
      go.disabled = true;
      share(d, cur).then(function (r) { if (r === 'shared' || r === 'download') close(); })
        .catch(function (e) { alert(e.message); }).then(function () { go.disabled = false; });
    });
    dl.addEventListener('click', function () {
      render(d, cur).then(toBlob).then(function (b) { download(b, fileName(d, cur)); }).catch(function (e) { alert(e.message); });
    });
    document.body.appendChild(el);
    show(cur);
  }

  // verejné API
  window.tifoShareCard = function (d, key) { return share(d, key || variantsFor(d)[0]); };
  window.tifoShareCardPreview = function (d, key) { return render(d, key || variantsFor(d)[0]).then(toBlob); };
  window.tifoShareVariants = variantsFor;

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-share-card]');
    if (!b) return;
    e.preventDefault();
    var d; try { d = JSON.parse(b.getAttribute('data-share-card')); } catch (err) { return; }
    openPicker(d);
  });
})();
