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
          var e = new Error(j.message || 'Nepodarilo sa. Skús to znova.');
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
      next.textContent = idx === slides.length - 1 ? 'Začať' : 'Pokračovať';
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
  if (screen === 'tipovat') {
    var total = Number(body.getAttribute('data-total') || 0);
    var ring = document.querySelector('[data-ring]');
    var ringTxt = document.querySelector('[data-ring-text]');
    var C = 2 * Math.PI * 19;
    function updateRing() {
      var done = document.querySelectorAll('.a-match.tipped').length;
      if (ringTxt) ringTxt.textContent = done + '/' + total;
      if (ring) ring.setAttribute('stroke-dasharray', (total ? (C * done / total) : 0).toFixed(1) + ' ' + C.toFixed(1));
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
        var s = sheet('<h3>Pripomenúť uzávierku?</h3><p>Pošleme ti upozornenie, keď sa blíži uzávierka a keď dostaneš body za tip.</p>'
          + '<button class="a-btn gold" data-push-yes>Zapnúť upozornenia</button>'
          + '<button class="a-btn ghost" style="margin-top:10px" data-close>Teraz nie</button>');
        s.el.querySelector('[data-push-yes]').addEventListener('click', function () {
          window.tifoPush.subscribe().then(function () { toast('Upozornenia zapnuté'); })
            .catch(function (e) { toast(e.message || 'Nepodarilo sa zapnúť upozornenia.', true); });
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
        setStatus('busy', 'Ukladám…');
        api('/api/tips', { method: 'POST', body: Object.assign({ matchId: Number(id) }, payload) })
          .then(function () {
            if (my !== seq) return;
            card.classList.add('tipped'); card.classList.remove('untipped');
            setStatus('', 'Uložené');
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
            setStatus('busy', 'Ukladám…');
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
        toast('Všetko prečítané');
      }).catch(function (err) { toast(err.message, true); });
    });
  }
})();
