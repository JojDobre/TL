/* =====================================================================
   TIFO — správanie MOBILNEJ APLIKÁCIE
   Spúšťa sa len v appke (html.is-app). Na webe sa hneď ukončí.
   ===================================================================== */
(function () {
  'use strict';
  var html = document.documentElement;
  if (!html.classList.contains('is-app')) return;

  var body = document.body;
  var isAppScreen = body.classList.contains('a-screen');
  var screen = body.getAttribute('data-screen') || '';

  // ---------------------------------------------------------------- utility
  function csrf() {
    var m = document.querySelector('meta[name="csrf-token"]');
    return m ? m.getAttribute('content') : '';
  }
  // texty v jazyku appky (window.TIFO_I18N z app/_head.ejs); na webových
  // stránkach chýbajú → slovenčina
  var I18N = window.TIFO_I18N || {};
  function tr(k, sk) { return I18N[k] || sk; }
  function api(url, opts) {
    opts = opts || {};
    var headers = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.method && opts.method !== 'GET') headers['X-CSRF-Token'] = csrf();
    return fetch(url, {
      method: opts.method || 'GET',
      headers: headers,
      credentials: 'same-origin',
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.success === false) {
          var e = new Error(j.message || tr('error', 'Nepodarilo sa. Skús to znova.'));
          e.status = r.status;
          throw e;
        }
        return j;
      });
    });
  }
  var toastTimer;
  function toast(msg, err) {
    var t = document.querySelector('.a-toast');
    if (!t) { t = document.createElement('div'); t.className = 'a-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'a-toast' + (err ? ' err' : '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, err ? 3500 : 2000);
  }
  function haptic(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) { /* nič */ } }
  window.tifoApp = { api: api, toast: toast, haptic: haptic };

  // ------------------------------------------- jedna obrazovka na jednu vec
  // Odkazy na webové stránky, ktoré majú v appke vlastnú obrazovku, vedú
  // rovno na ňu (bez preblikutia starej stránky). Záloha je presmerovanie
  // v partials/app-detect.ejs.
  var APP_URL = { '/': '/app', '/my': '/app', '/profile': '/app/profil', '/notifications': '/app/notifikacie',
    '/moje-tipy': '/app/tipovat', '/leaderboards': '/app/rebricky' };
  function appUrl(href) {
    if (!href || href.charAt(0) !== '/') return null;
    var m = /^\/leagues\/(\d+)\/?(?:[?#].*)?$/.exec(href);
    if (m) return '/app/liga/' + m[1];
    m = /^\/rounds\/(\d+)(?:\/results)?\/?(?:[?#].*)?$/.exec(href);
    if (m) return '/app/kolo/' + m[1];
    m = /^\/seasons\/(\d+)\/leaderboard\/?(?:[?#].*)?$/.exec(href);
    if (m) return '/app/sezona/' + m[1] + '#rebricek';
    m = /^\/seasons\/(\d+)\/?(?:[?#].*)?$/.exec(href);
    if (m) return '/app/sezona/' + m[1];
    m = /^\/seasons\/(\d+)\/zapasy\/?(?:[?#].*)?$/.exec(href);
    if (m) return '/app/tipovat?sezona=' + m[1];
    return APP_URL[href.split(/[?#]/)[0]] || null;
  }
  function fixLink(a) {
    var to = appUrl(a.getAttribute('href'));
    if (to) a.setAttribute('href', to);
  }
  document.querySelectorAll('a[href^="/"]').forEach(fixLink);
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="/"]');
    if (a) fixLink(a);
  }, true);

  // ------------------------------------- zadávanie skóre šípkami (webové stránky)
  // Na stránkach kola, Moje tipy a zápasoch sezóny sa v appke skóre zadáva
  // ako na obrazovke Tipovať: šípka hore / dole s haptickou odozvou, bez
  // klávesnice. Existujúca logika stránky (počítadlo, Uložiť) ostáva — na
  // každú zmenu sa vyvolá udalosť input ako pri písaní.
  var ARROW = { up: '<path d="M18 15l-6-6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>' };
  function stepBtn(dir, label) {
    return '<button type="button" class="tip-step-btn" data-step="' + (dir === 'up' ? 1 : -1) + '" aria-label="' + label + '">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + ARROW[dir] + '</svg></button>';
  }
  document.querySelectorAll('.tip-inputs').forEach(function (box) {
    var h = box.querySelector('.tip-num[data-home]');
    var a = box.querySelector('.tip-num[data-away]');
    if (!h || !a || box.classList.contains('tip-stepper')) return;
    box.classList.add('tip-stepper');
    [h, a].forEach(function (inp) {
      var wrap = document.createElement('span');
      wrap.className = 'tip-step' + (inp.disabled ? ' off' : '');
      inp.parentNode.insertBefore(wrap, inp);
      wrap.insertAdjacentHTML('beforeend', stepBtn('up', '+1'));
      wrap.appendChild(inp);
      wrap.insertAdjacentHTML('beforeend', stepBtn('down', '−1'));
      inp.readOnly = true;            // bez vyskakovacej klávesnice
      inp.setAttribute('tabindex', '-1');
      if (inp.disabled) wrap.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.tip-step-btn');
      if (!b || b.disabled) return;
      var inp = b.parentNode.querySelector('.tip-num');
      if (!inp || inp.disabled) return;
      // prvé ťuknutie na prázdny tip nastaví 0 : 0 (ako na obrazovke Tipovať)
      if (h.value === '' && a.value === '') { h.value = '0'; a.value = '0'; }
      else if (h.value === '') h.value = '0';
      else if (a.value === '') a.value = '0';
      var v = Math.max(0, Math.min(20, (parseInt(inp.value, 10) || 0) + Number(b.getAttribute('data-step'))));
      inp.value = String(v);
      [h, a].forEach(function (x) { x.dispatchEvent(new Event('input', { bubbles: true })); });
      haptic(6);
    });
  });
  // hmatová odozva aj pri výbere 1 / X / 2 a uložení tipov
  document.addEventListener('click', function (e) {
    var p = e.target.closest('.pick-w');
    if (p && !p.disabled) { haptic(8); return; }
    var sv = e.target.closest('#saveTips');
    if (sv && !sv.disabled) haptic(14);
  });

  // ------------------------------------------- horná lišta na webových stránkach
  if (!isAppScreen) {
    var h1 = document.querySelector('main h1, .wrap h1, h1');
    var title = (h1 && h1.textContent.trim()) || document.title.replace(/^tifo\.sk\s*[—-]\s*/i, '');
    var bar = document.createElement('div');
    bar.className = 'app-topbar';
    bar.innerHTML = '<button type="button" class="a-ib" aria-label="Späť">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>'
      + '</button><b></b>';
    bar.querySelector('b').textContent = title;
    bar.querySelector('button').addEventListener('click', function () {
      if (history.length > 1 && document.referrer && document.referrer.indexOf(location.origin) === 0) history.back();
      else location.href = '/app/home';
    });
    body.insertBefore(bar, body.firstChild);
    // ako na obrazovkách appky: veľký nadpis je na stránke, do lišty sa
    // presunie až keď ho používateľ odscrolluje; lišta dostane pozadie
    var big = h1 && h1.getBoundingClientRect().top < window.innerHeight ? h1 : null;
    function topState() {
      var y = window.scrollY || 0;
      bar.classList.toggle('solid', y > 4);
      if (big) bar.classList.toggle('big', big.getBoundingClientRect().bottom > bar.offsetHeight);
    }
    topState();
    window.addEventListener('scroll', topState, { passive: true });
  }

  // ----------------------------------------------------- neprečítané notifikácie
  var dot = document.querySelector('[data-unread-dot]');
  if (dot && screen !== 'notifikacie') {
    api('/api/notifications/unread-count').then(function (j) {
      if (j && j.count > 0) dot.hidden = false;
    }).catch(function () { /* nič */ });
  }

  // ------------------------------------ rýchlejšie otváranie odkazov (prefetch)
  var prefetched = {};
  function prefetch(e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) !== '/' || href.indexOf('/logout') === 0 || prefetched[href]) return;
    prefetched[href] = true;
    var l = document.createElement('link');
    l.rel = 'prefetch'; l.href = href;
    document.head.appendChild(l);
  }
  document.addEventListener('touchstart', prefetch, { passive: true });
  document.addEventListener('mouseover', prefetch, { passive: true });

  // -------------------------- príprava ďalších kariet na pozadí (keď je telefón v pokoji)
  // Rebríčky a Profil sa tipovaním nemenia, preto si ich appka po otvorení
  // potichu stiahne vopred → prepnutie karty je okamžité. Najviac raz za 3 min,
  // aby to nezaťažovalo server; na pomalom/šetriacom pripojení sa nerobí.
  if (isAppScreen && screen && screen !== 'welcome') {
    var conn = navigator.connection || {};
    var lastWarm = 0;
    try { lastWarm = Number(sessionStorage.getItem('tifo-warm') || 0); } catch (e) { /* nič */ }
    if (!conn.saveData && !/2g/.test(conn.effectiveType || '') && Date.now() - lastWarm > 3 * 60 * 1000) {
      var warm = function () {
        try { sessionStorage.setItem('tifo-warm', String(Date.now())); } catch (e) { /* nič */ }
        ['/app/rebricky', '/app/profil'].forEach(function (href) {
          if (location.pathname === href || prefetched[href]) return;
          prefetched[href] = true;
          var l = document.createElement('link');
          l.rel = 'prefetch'; l.href = href;
          document.head.appendChild(l);
        });
      };
      if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 });
      else setTimeout(warm, 1500);
    }
  }

  // ------------------------------------------------- potiahnutie na obnovenie
  if (isAppScreen && 'ontouchstart' in window) {
    var ptr = document.createElement('div');
    ptr.className = 'a-ptr';
    ptr.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/></svg>';
    body.appendChild(ptr);
    var startY = null; var dist = 0;
    window.addEventListener('touchstart', function (e) {
      startY = (window.scrollY <= 0 && e.touches.length === 1) ? e.touches[0].clientY : null;
      dist = 0;
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (startY === null) return;
      dist = Math.max(0, e.touches[0].clientY - startY);
      var d = Math.min(dist, 120);
      ptr.style.opacity = String(Math.min(1, d / 80));
      ptr.style.transform = 'translateY(' + (d * 0.7 - 40) + 'px) rotate(' + (d * 3) + 'deg)';
    }, { passive: true });
    window.addEventListener('touchend', function () {
      if (startY === null) return;
      if (dist > 90) {
        ptr.classList.add('spin');
        ptr.style.transform = 'translateY(24px)';
        haptic(10);
        location.reload();
      } else {
        ptr.style.opacity = '0';
        ptr.style.transform = 'translateY(-50px)';
      }
      startY = null;
    });
  }

  // ------------------------------------------------------------ záložky (tabs)
  document.querySelectorAll('[data-tabs]').forEach(function (group) {
    var scope = group.closest('[data-tabs-scope]') || document;
    group.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]');
      if (!b) return;
      e.preventDefault();
      var name = b.getAttribute('data-tab');
      group.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('on', x === b); });
      scope.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== name; });
      try { history.replaceState(null, '', '#' + name); } catch (err) { /* nič */ }
      haptic(5);
    });
    var initial = location.hash.replace('#', '');
    var target = initial && group.querySelector('[data-tab="' + initial + '"]');
    if (target) target.click();
  });

  // výber ligy (select) → prejdi na URL
  document.querySelectorAll('select[data-nav]').forEach(function (s) {
    s.addEventListener('change', function () { if (s.value) location.href = s.value; });
  });

  // spodný panel (bottom sheet)
  function sheet(html) {
    var bg = document.createElement('div'); bg.className = 'a-sheet-bg';
    var sh = document.createElement('div'); sh.className = 'a-sheet';
    sh.innerHTML = '<div class="grab"></div>' + html;
    document.body.appendChild(bg); document.body.appendChild(sh);
    requestAnimationFrame(function () { bg.classList.add('open'); sh.classList.add('open'); });
    function close() {
      bg.classList.remove('open'); sh.classList.remove('open');
      setTimeout(function () { bg.remove(); sh.remove(); }, 300);
    }
    bg.addEventListener('click', close);
    sh.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
    return { el: sh, close: close };
  }

  // ======================================================== ÚVODNÉ OBRAZOVKY
  if (screen === 'welcome') {
    var slides = document.querySelectorAll('.a-onb .slide');
    var dots = document.querySelectorAll('.a-onb .dots i');
    var next = document.querySelector('[data-onb-next]');
    var idx = 0;
    var done = function () {
      try { localStorage.setItem('tifo-onboarded', '1'); } catch (e) { /* nič */ }
    };
    var show = function (i) {
      idx = Math.max(0, Math.min(slides.length - 1, i));
      slides.forEach(function (s) { s.style.transform = 'translateX(' + (-100 * idx) + '%)'; });
      dots.forEach(function (d, k) { d.classList.toggle('on', k === idx); });
      next.textContent = idx === slides.length - 1 ? tr('start', 'Začať') : tr('continue', 'Pokračovať');
    };
    next.addEventListener('click', function () {
      haptic(6);
      if (idx < slides.length - 1) show(idx + 1);
      else { done(); location.href = next.getAttribute('data-done') || '/register'; }
    });
    document.querySelectorAll('[data-onb-skip]').forEach(function (a) { a.addEventListener('click', done); });
    var sx = null;
    var box = document.querySelector('.a-onb .slides');
    box.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
      sx = null;
    });
    show(0);
  }

  // ================================================================ TIPOVANIE
  // obrazovky Tipovať a Kolo majú tie isté karty zápasov (views/app/_match.ejs)
  if (screen === 'tipovat' || screen === 'kolo') {
    var total = Number(body.getAttribute('data-total') || 0);
    var ring = document.querySelector('[data-ring]');
    var ringTxt = document.querySelector('[data-ring-text]');
    var C = 2 * Math.PI * 19;
    function updateRing() {
      var done = document.querySelectorAll('.a-match.tipped').length;
      if (ringTxt) ringTxt.textContent = done + '/' + total;
      if (ring) ring.setAttribute('stroke-dasharray', (total ? (C * done / total) : 0).toFixed(1) + ' ' + C.toFixed(1));
      var kc = document.querySelector('[data-kolo-count]');
      if (kc && total) kc.textContent = done + '/' + total;
    }
    var askedPush = false;
    function maybeAskPush() {
      if (askedPush) return;
      askedPush = true;
      try {
        if (localStorage.getItem('tifo-push-asked')) return;
        if (!('Notification' in window) || Notification.permission !== 'default' || !window.tifoPush) return;
        localStorage.setItem('tifo-push-asked', '1');
      } catch (e) { return; }
      setTimeout(function () {
        var s = sheet('<h3>' + tr('pushTitle', 'Pripomenúť uzávierku?') + '</h3><p>' + tr('pushTx', 'Pošleme ti upozornenie, keď sa blíži uzávierka a keď dostaneš body za tip.') + '</p>'
          + '<button class="a-btn gold" data-push-yes>' + tr('pushYes', 'Zapnúť upozornenia') + '</button>'
          + '<button class="a-btn ghost" style="margin-top:10px" data-close>' + tr('pushNo', 'Teraz nie') + '</button>');
        s.el.querySelector('[data-push-yes]').addEventListener('click', function () {
          window.tifoPush.subscribe().then(function () { toast(tr('pushOn', 'Upozornenia zapnuté')); })
            .catch(function (e) { toast(e.message || tr('pushErr', 'Nepodarilo sa zapnúť upozornenia.'), true); });
          s.close();
        });
      }, 700);
    }

    document.querySelectorAll('.a-match').forEach(function (card) {
      var id = card.getAttribute('data-match');
      var type = card.getAttribute('data-type');
      var status = card.querySelector('.a-saved');
      var timer = null; var seq = 0;
      function setStatus(kind, text) {
        status.className = 'a-saved' + (kind ? ' ' + kind : '');
        status.innerHTML = kind === '' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' + text : text;
      }
      function save(payload) {
        var my = ++seq;
        setStatus('busy', tr('saving', 'Ukladám…'));
        api('/api/tips', { method: 'POST', body: Object.assign({ matchId: Number(id) }, payload) })
          .then(function () {
            if (my !== seq) return;
            card.classList.add('tipped'); card.classList.remove('untipped');
            setStatus('', tr('saved', 'Uložené'));
            updateRing();
            haptic(12);
            maybeAskPush();
          })
          .catch(function (e) {
            if (my !== seq) return;
            setStatus('err', e.message);
            haptic(40);
          });
      }
      if (type === 'exact_score') {
        var vals = card.querySelectorAll('.a-step .v');
        card.querySelectorAll('.a-step button').forEach(function (b) {
          b.addEventListener('click', function () {
            var side = Number(b.getAttribute('data-side'));
            var delta = Number(b.getAttribute('data-delta'));
            // prvé ťuknutie na netipnutý zápas nastaví 0:0
            if (card.classList.contains('untipped') && vals[0].textContent === '–') { vals[0].textContent = '0'; vals[1].textContent = '0'; }
            var v = Math.max(0, Math.min(20, (parseInt(vals[side].textContent, 10) || 0) + delta));
            vals[side].textContent = String(v);
            card.classList.remove('untipped');
            haptic(5);
            clearTimeout(timer);
            setStatus('busy', tr('saving', 'Ukladám…'));
            timer = setTimeout(function () {
              save({ homeScore: parseInt(vals[0].textContent, 10) || 0, awayScore: parseInt(vals[1].textContent, 10) || 0 });
            }, 650);
          });
        });
      } else {
        card.querySelectorAll('.a-pick button').forEach(function (b) {
          b.addEventListener('click', function () {
            card.querySelectorAll('.a-pick button').forEach(function (x) { x.classList.toggle('on', x === b); });
            save({ winner: b.getAttribute('data-w') });
          });
        });
      }
    });

    // pás dní → posun na deň
    document.querySelectorAll('[data-day]').forEach(function (d) {
      d.addEventListener('click', function () {
        var t = document.getElementById('day-' + d.getAttribute('data-day'));
        document.querySelectorAll('[data-day]').forEach(function (x) { x.classList.toggle('on', x === d); });
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    updateRing();
  }

  // ================================================================== KOLO
  if (screen === 'kolo') {
    var go = document.querySelector('[data-kolo-go]');
    if (go) go.addEventListener('click', function () {
      var first = document.querySelector('.a-match.untipped') || document.getElementById('naTip');
      var tab = document.querySelector('[data-tab="zapasy"]'); if (tab) tab.click();
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      haptic(6);
    });
    var kTpl = document.getElementById('koloMenu');
    var kBtn = document.querySelector('[data-kolo-menu]');
    if (kTpl && kBtn) kBtn.addEventListener('click', function () {
      haptic(6);
      var sh = sheet(kTpl.innerHTML);
      var del = sh.el.querySelector('[data-del-round]');
      if (del) del.addEventListener('click', function () {
        if (!window.confirm(del.getAttribute('data-q'))) return;
        del.disabled = true;
        api('/api/rounds/' + del.getAttribute('data-del-round'), { method: 'DELETE' })
          .then(function () { location.replace('/app/liga/' + del.getAttribute('data-league')); })
          .catch(function (e) { del.disabled = false; toast(e.message, true); haptic(40); });
      });
    });
  }

  // =============================================================== REBRÍČEK
  if (screen === 'rebricek') {
    var me = document.querySelector('[data-me-row]');
    var mebar = document.querySelector('.a-mebar');
    if (me && mebar && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        mebar.classList.toggle('hide', entries[0].isIntersecting);
      }).observe(me);
    }
  }

  // ============================================================ NOTIFIKÁCIE
  // ================================================= LIGY: PRIDAŤ SA / VYTVORIŤ
  // liga a sezóna majú rovnaké menu možností a pripojenie
  if (screen === 'liga' || screen === 'sezona') {
    var TL = window.TIFO_LIGA || {};
    var copyCode = function (code) {
      var ok = function () { toast(TL.copied); haptic(8); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(ok, ok); else ok();
    };
    // kopírovanie kódu a zdieľanie (banner aj menu možností)
    document.addEventListener('click', function (e) {
      var c = e.target.closest('[data-copy-code]');
      if (c) { copyCode(c.getAttribute('data-copy-code')); return; }
      var s = e.target.closest('[data-share-league]');
      if (!s) return;
      e.preventDefault();
      haptic(6);
      var code = s.getAttribute('data-code');
      var text = (TL.shareText || '').replace('{name}', s.getAttribute('data-name')).replace('{code}', code);
      var link = location.origin + '/join?code=' + encodeURIComponent(code);
      if (navigator.share) navigator.share({ title: 'Tifo', text: text, url: link }).catch(function () {});
      else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text + ' ' + link).then(function () { toast(TL.copied); });
    });
    var menuBtn = document.querySelector('[data-liga-menu],[data-sez-menu]');
    var tpl = document.getElementById('ligaMenu') || document.getElementById('sezMenu');
    if (menuBtn && tpl) {
      menuBtn.addEventListener('click', function () {
        haptic(6);
        var sh = sheet(tpl.innerHTML);
        sh.el.querySelectorAll('form[data-confirm]').forEach(function (f) {
          f.addEventListener('submit', function (e) { if (!window.confirm(f.getAttribute('data-confirm'))) e.preventDefault(); });
        });
      });
    }
    var doJoin = function (body, btn, errEl) {
      btn.disabled = true;
      api('/api/app/join', { method: 'POST', body: body })
        .then(function () { haptic(14); toast(TL.joined); setTimeout(function () { location.reload(); }, 500); })
        .catch(function (err) {
          btn.disabled = false; haptic(40);
          if (errEl) { errEl.textContent = err.message; errEl.hidden = false; } else toast(err.message, true);
        });
    };
    var now = document.querySelector('[data-liga-join-now],[data-sez-join]');
    if (now) now.addEventListener('click', function () { doJoin({ code: now.getAttribute('data-code') || now.getAttribute('data-sez-join') }, now); });
    var jf = document.querySelector('[data-liga-join],[data-sez-join-pw]');
    if (jf) jf.addEventListener('submit', function (e) {
      e.preventDefault();
      doJoin(jf.sid ? { sid: Number(jf.sid.value), password: jf.password.value } : { lid: Number(jf.leagueId.value), password: jf.password.value }, jf.querySelector('button'), jf.querySelector('[data-join-err]'));
    });
  }

  if (screen === 'pridat') {
    var T = window.TIFO_ADD || {};
    var showErr = function (el, msg) { el.textContent = msg || T.err || ''; el.hidden = !msg && !T.err; haptic(40); };
    // pridanie cez kód
    var jf = document.getElementById('joinForm');
    var jCode = document.getElementById('joinCode');
    var jPwBox = document.getElementById('joinPwBox');
    var jErr = document.getElementById('joinErr');
    var jBtn = document.getElementById('joinBtn');
    jCode.addEventListener('input', function () {
      var v = jCode.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (v !== jCode.value) jCode.value = v;
      jErr.hidden = true;
    });
    jf.addEventListener('submit', function (e) {
      e.preventDefault();
      jErr.hidden = true;
      var label = jBtn.textContent;
      jBtn.disabled = true;
      api('/api/app/join', { method: 'POST', body: { code: jCode.value, password: document.getElementById('joinPw').value } })
        .then(function (r) { haptic(14); toast(r.leagueId ? T.joined : T.joinedSeason); setTimeout(function () { location.href = r.redirect; }, 500); })
        .catch(function (err) {
          jBtn.disabled = false; jBtn.textContent = label;
          if (err.status === 401) { jPwBox.hidden = false; document.getElementById('joinPw').focus(); }
          showErr(jErr, err.message);
        });
    });
    // oficiálne súťaže jedným ťuknutím
    document.querySelectorAll('[data-join-league]').forEach(function (b) {
      b.addEventListener('click', function () {
        b.disabled = true;
        api('/api/app/join', { method: 'POST', body: { leagueId: Number(b.getAttribute('data-join-league')) } })
          .then(function (r) { haptic(14); toast(T.joined); setTimeout(function () { location.href = r.redirect; }, 500); })
          .catch(function (err) { b.disabled = false; toast(err.message, true); haptic(40); });
      });
    });
    if (jCode.value) jCode.focus();

    // vytvorenie ligy
    var cf = document.getElementById('createForm');
    if (cf) {
      var src = document.querySelector('#srcChoice .on') ? document.querySelector('#srcChoice .on').getAttribute('data-src') : 'own';
      var tip = 'exact_score';
      var tplBox = document.getElementById('tplBox');
      var cErr = document.getElementById('createErr');
      var cBtn = document.getElementById('createBtn');
      document.getElementById('srcChoice').addEventListener('click', function (e) {
        var b = e.target.closest('[data-src]'); if (!b || b.disabled) return;
        src = b.getAttribute('data-src');
        this.querySelectorAll('[data-src]').forEach(function (x) { x.classList.toggle('on', x === b); });
        tplBox.hidden = src !== 'tpl';
        haptic(5);
      });
      var tc = document.getElementById('tipChoice');
      if (tc) tc.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tip]'); if (!b) return;
        tip = b.getAttribute('data-tip');
        tc.querySelectorAll('[data-tip]').forEach(function (x) { x.classList.toggle('on', x === b); });
        haptic(5);
      });
      cf.addEventListener('submit', function (e) {
        e.preventDefault();
        cErr.hidden = true;
        var name = document.getElementById('lgName').value.trim();
        var picked = cf.querySelector('input[name=templateId]:checked');
        var body = { name: name, password: document.getElementById('lgPw').value };
        if (src === 'tpl' && picked) { body.templateId = Number(picked.value); body.tipType = tip; }
        var label = cBtn.textContent;
        cBtn.disabled = true;
        api('/api/app/leagues', { method: 'POST', body: body })
          .then(function (r) {
            haptic(20);
            document.getElementById('createBox').hidden = true;
            var done = document.getElementById('createDone');
            done.hidden = false;
            var codeBtn = document.getElementById('doneCode');
            codeBtn.textContent = r.joinCode;
            document.getElementById('doneOpen').href = r.redirect;
            if (!r.fromTemplate) { var fr = document.getElementById('doneRound'); fr.hidden = false; fr.href = '/rounds/create?league=' + r.leagueId; }
            var link = location.origin + '/join?code=' + encodeURIComponent(r.joinCode);
            var text = (T.shareText || '').replace('{name}', name).replace('{code}', r.joinCode);
            var copy = function () {
              var ok = function () { toast(T.copied); haptic(8); };
              if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(r.joinCode).then(ok, ok); else ok();
            };
            codeBtn.addEventListener('click', copy);
            document.getElementById('doneShare').addEventListener('click', function () {
              haptic(8);
              if (navigator.share) navigator.share({ title: 'Tifo', text: text, url: link }).catch(function () {});
              else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text + ' ' + link).then(function () { toast(T.copied); });
            });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          })
          .catch(function (err) { cBtn.disabled = false; cBtn.textContent = label; showErr(cErr, err.message); });
      });
    }
  }

  if (screen === 'notifikacie') {
    document.addEventListener('click', function (e) {
      var n = e.target.closest('[data-noti]');
      if (!n) return;
      var id = n.getAttribute('data-noti');
      if (!n.classList.contains('read')) {
        n.classList.add('read');
        // sendBeacon prežije aj okamžitý prechod na odkaz notifikácie
        var data = new URLSearchParams({ _csrf: csrf() });
        if (!(navigator.sendBeacon && navigator.sendBeacon('/notifications/' + id + '/read', data))) {
          api('/notifications/' + id + '/read', { method: 'POST', body: {} }).catch(function () {});
        }
      }
    });
    var all = document.querySelector('[data-read-all]');
    if (all) all.addEventListener('click', function () {
      api('/notifications/read-all', { method: 'POST', body: {} }).then(function () {
        document.querySelectorAll('[data-noti]').forEach(function (n) { n.classList.add('read'); });
        document.querySelectorAll('.a-noti .unread').forEach(function (u) { u.remove(); });
        toast(tr('allRead', 'Všetko prečítané'));
      }).catch(function (err) { toast(err.message, true); });
    });
  }
  // ------------------------------------------------- prepínač jazyka (Profil)
  document.querySelectorAll('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function (e) {
      e.preventDefault();
      var l = b.getAttribute('data-set-lang');
      if (window.tifoLang) window.tifoLang(l);
      try { sessionStorage.removeItem('tifo-lang-rl'); } catch (e) { /* nič */ }
      // replace (nie reload) — reload ruší animáciu prechodu a hlási chybu
      location.replace(location.pathname + location.search);
    });
  });
})();
