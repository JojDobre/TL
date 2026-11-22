// ZDIEĽANIE VÝSLEDKU KOLA AKO OBRÁZKA (1080×1920 — Instagram/WhatsApp story).
// Obrázok sa kreslí priamo v prehliadači (canvas) — server nič negeneruje.
// Zdieľa sa cez systémové menu telefónu (Web Share API so súborom); kde to
// nejde (počítač), obrázok sa stiahne.
//
// Použitie: <button data-share-card='{"league":…,"round":…,…}'>  (JSON v atribúte)
// Polia: league, round, initials, grad (CSS gradient ligy), points, rank, players, exact, hits, tips,
//        joker (bool), code (kód ligy), url, labels { … } (texty v jazyku stránky)
(function () {
  var W = 1080; var H = 1920;
  var FONT_D = "'Space Grotesk', 'Manrope', system-ui, sans-serif";
  var FONT_B = "'Manrope', system-ui, sans-serif";

  function loadImg(src) {
    return new Promise(function (resolve) {
      var i = new Image();
      i.onload = function () { resolve(i); };
      i.onerror = function () { resolve(null); };
      i.src = src;
    });
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  // text zmenšený tak, aby sa zmestil do šírky
  function fitText(ctx, text, maxW, size, weight, family) {
    var s = size;
    do { ctx.font = weight + ' ' + s + 'px ' + family; s -= 2; } while (ctx.measureText(text).width > maxW && s > 20);
    return text;
  }
  function ellipsis(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text + '…';
  }

  function draw(d) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    var L = d.labels || {};

    // pozadie
    ctx.fillStyle = '#080b14'; ctx.fillRect(0, 0, W, H);
    var g1 = ctx.createRadialGradient(W * 0.85, H * 0.08, 0, W * 0.85, H * 0.08, 900);
    g1.addColorStop(0, 'rgba(124,92,255,.75)'); g1.addColorStop(1, 'rgba(124,92,255,0)');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
    var g2 = ctx.createRadialGradient(0, H, 0, 0, H, 900);
    g2.addColorStop(0, 'rgba(250,204,21,.22)'); g2.addColorStop(1, 'rgba(250,204,21,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    // jemná mriežka hore
    ctx.save();
    var mask = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    mask.addColorStop(0, 'rgba(255,255,255,.045)'); mask.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = mask; ctx.lineWidth = 1;
    for (var x = 0; x <= W; x += 60) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H * 0.55); ctx.stroke(); }
    for (var y = 0; y <= H * 0.55; y += 60) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    ctx.restore();

    var PAD = 90;
    // značka
    if (d._mascot) ctx.drawImage(d._mascot, PAD, 120, 84, 84);
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.font = '700 46px ' + FONT_D; ctx.textBaseline = 'middle';
    ctx.fillText('Tifo', PAD + (d._mascot ? 104 : 0), 164);

    // erb ligy (iniciály — cudzie obrázky by canvas „zablokovali“)
    var cy = 330;
    var cg = ctx.createLinearGradient(PAD, cy, PAD + 150, cy + 150);
    var cols = String(d.grad || '').match(/#[0-9a-f]{3,8}/gi) || [];
    cg.addColorStop(0, cols[0] || '#7c5cff'); cg.addColorStop(1, cols[1] || cols[0] || '#3b1f8f');
    rr(ctx, PAD, cy, 150, 150, 44); ctx.fillStyle = cg; ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 54px ' + FONT_D; ctx.textAlign = 'center';
    ctx.fillText((d.initials || 'T').slice(0, 3), PAD + 75, cy + 78);
    ctx.textAlign = 'left';

    // liga + kolo
    ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.font = '700 38px ' + FONT_B;
    ctx.fillText(ellipsis(ctx, d.league || '', W - PAD * 2 - 190), PAD + 190, cy + 50);
    ctx.fillStyle = '#fff';
    fitText(ctx, d.round || '', W - PAD * 2 - 190, 64, '700', FONT_D);
    ctx.fillText(ellipsis(ctx, d.round || '', W - PAD * 2 - 190), PAD + 190, cy + 112);

    // veľké body
    var py = 820;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '700 40px ' + FONT_B;
    ctx.fillText((L.got || 'Získal som').toUpperCase(), W / 2, py - 210);
    var pts = '+' + (d.points || 0);
    ctx.font = '700 300px ' + FONT_D;
    var pg = ctx.createLinearGradient(0, py - 150, 0, py + 150);
    pg.addColorStop(0, '#fff3b0'); pg.addColorStop(1, '#facc15');
    ctx.fillStyle = pg;
    ctx.shadowColor = 'rgba(250,204,21,.35)'; ctx.shadowBlur = 60;
    ctx.fillText(pts, W / 2, py);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = '700 52px ' + FONT_D;
    ctx.fillText(L.pts || 'bodov', W / 2, py + 175);

    // poradie
    if (d.rank) {
      var rt = (L.rank || '{r}. miesto z {n}').replace('{r}', d.rank).replace('{n}', d.players || '–');
      ctx.font = '700 46px ' + FONT_B;
      var rw = ctx.measureText(rt).width + 120;
      rr(ctx, (W - rw) / 2, py + 260, rw, 104, 52);
      ctx.fillStyle = 'rgba(250,204,21,.16)'; ctx.fill();
      ctx.strokeStyle = 'rgba(250,204,21,.55)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#facc15'; ctx.fillText('🏆 ' + rt, W / 2, py + 314);
    }

    // štatistiky
    var tiles = [[d.exact || 0, L.exact || 'presné výsledky'], [d.hits || 0, L.hits || 'bodované tipy'], [d.tips || 0, L.tips || 'tipov']];
    var ty = 1330; var gap = 28; var tw = (W - PAD * 2 - gap * 2) / 3;
    tiles.forEach(function (t, i) {
      var tx = PAD + i * (tw + gap);
      rr(ctx, tx, ty, tw, 230, 40);
      ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill();
      ctx.strokeStyle = 'rgba(150,165,215,.22)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = i === 0 ? '#facc15' : '#fff'; ctx.font = '700 92px ' + FONT_D;
      ctx.fillText(String(t[0]), tx + tw / 2, ty + 100);
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '700 30px ' + FONT_B;
      ctx.fillText(ellipsis(ctx, t[1], tw - 30), tx + tw / 2, ty + 180);
    });
    if (d.joker) {
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.font = '700 36px ' + FONT_B;
      ctx.fillText('🃏 ' + (L.joker || 'Žolík v hre'), W / 2, ty + 300);
    }

    // výzva + kód ligy
    ctx.fillStyle = '#fff'; ctx.font = '700 50px ' + FONT_D;
    ctx.fillText(L.cta || 'Tipuj so mnou', W / 2, 1745);
    ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.font = '700 36px ' + FONT_B;
    var sub = 'tifo.sk' + (d.code ? '  ·  ' + (L.code || 'kód ligy') + ' ' + d.code : '');
    ctx.fillText(sub, W / 2, 1810);
    ctx.textAlign = 'left';
    return c;
  }

  function make(d) {
    var fontsReady = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('700 64px "Space Grotesk"'), document.fonts.load('700 40px "Manrope"')]).catch(function () {})
      : Promise.resolve();
    return Promise.all([fontsReady, loadImg('/branding/identity/tifo-mascot-512.webp')]).then(function (r) {
      d._mascot = r[1];
      var c = draw(d);
      return new Promise(function (resolve, reject) {
        c.toBlob(function (b) { if (b) resolve(b); else reject(new Error('Obrázok sa nepodarilo vytvoriť.')); }, 'image/png');
      });
    });
  }

  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // zdieľanie: súbor cez systémové menu, inak stiahnutie
  window.tifoShareCard = function (d) {
    return make(d).then(function (blob) {
      var name = 'tifo-' + String(d.round || 'kolo').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') + '.png';
      var file = null;
      try { file = new File([blob], name, { type: 'image/png' }); } catch (e) { file = null; }
      var text = (d.labels && d.labels.text) || '';
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        return navigator.share({ files: [file], text: text + (d.url ? ' ' + d.url : '') })
          .then(function () { return 'shared'; })
          .catch(function (e) { if (e && e.name === 'AbortError') return 'cancel'; download(blob, name); return 'download'; });
      }
      download(blob, name);
      return 'download';
    });
  };
  window.tifoShareCardPreview = function (d) { return make(d); };

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-share-card]');
    if (!b || b.classList.contains('busy')) return;
    e.preventDefault();
    var d;
    try { d = JSON.parse(b.getAttribute('data-share-card')); } catch (err) { return; }
    b.classList.add('busy');
    window.tifoShareCard(d).catch(function (err) { alert(err.message); })
      .then(function () { b.classList.remove('busy'); });
  });
})();
