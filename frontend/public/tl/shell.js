/* =====================================================================
   TIPERLIGA — Shared shell: navbar, footer, theme, dropdowns
   Usage: <body data-page="home"> + <div data-shell-nav></div> ... <div data-shell-footer></div>
   ===================================================================== */
(function () {
  const ICON = `<svg class="logo-mark" viewBox="0 0 48 48" fill="none" aria-hidden="true" style="width:34px;height:34px">
    <defs><linearGradient id="tlg-shell" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9d83ff"/><stop offset="1" stop-color="#5b3fd6"/></linearGradient></defs>
    <path d="M24 4 L40 9 V23 C40 33 33 40 24 44 C15 40 8 33 8 23 V9 Z" fill="url(#tlg-shell)" stroke="#9d83ff" stroke-width="1.2"/>
    <path d="M15 28 L24 17 L33 28" fill="none" stroke="#0d1124" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M19 33 L24 27 L29 33" fill="none" stroke="#facc15" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const svg = (p, w) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w||2}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const I = {
    bell: svg('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/>'),
    moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    burger: svg('<path d="M3 6h18M3 12h18M3 18h18"/>'),
    x: svg('<path d="M18 6L6 18M6 6l12 12"/>'),
    check: svg('<path d="M20 6L9 17l-5-5"/>'),
    tHome: svg('<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M9.5 20v-5h5v5"/>'),
    tSeasons: svg('<path d="M7 4h10v3a5 5 0 0 1-10 0z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/><path d="M12 12v4M9 20h6M10 16h4"/>'),
    tBoard: svg('<path d="M5 21V10M12 21V4M19 21v-7"/>'),
    tProfile: svg('<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>'),
    tMoje: svg('<rect x="3" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8"/>'),
    tBlog: svg('<path d="M5 3.5h11l3 3V20.5H5z"/><path d="M15 3.5V7h3.5"/><path d="M8.5 12h7M8.5 15.5h7M8.5 8.5h3"/>'),
    cog: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  };

  // ---- mobile bottom tab bar (native-app feel) ----
  const SEASON_FILES = ['seasons.html','season.html','league.html','round.html','round-results.html','create-season.html','create-league.html','create-round.html','create-matches.html','create-team.html','discover.html','join.html'];
  const TABS_USER = [
    ['home', 'Domov', 'tHome', 'index.html', ['index.html', '']],
    ['seasons', 'Sezóny', 'tSeasons', 'seasons.html', SEASON_FILES],
    ['board', 'Rebríček', 'tBoard', 'leaderboards.html', ['leaderboards.html','player.html']],
    ['moje', 'Moje', 'tMoje', 'my.html', ['my.html','leave-competition.html']],
    ['profile', 'Profil', 'tProfile', 'profile.html', ['profile.html','stats.html','achievements.html','tip-history.html','notifications.html','settings.html']],
  ];
  const TABS_GUEST = [
    ['home', 'Domov', 'tHome', 'index.html', ['index.html', '']],
    ['seasons', 'Sezóny', 'tSeasons', 'seasons.html', SEASON_FILES],
    ['board', 'Rebríček', 'tBoard', 'leaderboards.html', ['leaderboards.html','player.html']],
    ['blog', 'Blog', 'tBlog', 'blog.html', ['blog.html','blog-post.html']],
    ['login', 'Prihlásiť', 'tProfile', 'login.html', ['login.html','register.html','forgot-password.html']],
  ];
  function currentFile() { return (location.pathname.split('/').pop() || 'index.html'); }
  function buildTabbar(state) {
    const cur = currentFile();
    const tabs = state === 'guest' ? TABS_GUEST : TABS_USER;
    return tabs.map(([id, label, icon, href, files, badge]) => {
      const active = files.includes(cur) ? 'active' : '';
      const b = badge ? `<span class="tab-badge">${badge}</span>` : '';
      return `<a class="tab-item ${active}" href="${href}">${b}${I[icon]}<span>${label}</span></a>`;
    }).join('');
  }


  const NAV = [
    ['home', 'Domov', 'index.html'],
    ['moje', 'Moje', 'my.html', 'user'],
    ['seasons', 'Sezóny', 'seasons.html'],
    ['leaderboards', 'Rebríčky', 'leaderboards.html'],
    ['blog', 'Blog', 'blog.html'],
    ['about', 'O nás', 'about.html'],
    ['admin', 'Admin', 'admin.html', 'user'],
  ];

  function buildNav(active) {
    const state = authState();
    const links = NAV.filter(n => !n[3] || n[3] === state).map(([id, label, href]) =>
      `<a class="nav-link ${id==='admin'?'admin':''} ${id===active?'active':''}" href="${href}">${label}</a>`
    ).join('');

    const actions = state === 'guest' ? `
        <button class="btn btn-ghost btn-icon" data-theme-toggle aria-label="Téma">${I.sun}</button>
        <a class="btn btn-ghost btn-sm nav-guest-text" href="login.html">Prihlásiť sa</a>
        <a class="btn btn-primary btn-sm nav-guest-text" href="register.html">Registrovať</a>
        <a class="btn btn-ghost btn-icon nav-guest-icon" href="login.html" aria-label="Prihlásiť sa / Registrovať">${I.tProfile}</a>
      ` : `
        <button class="btn btn-ghost btn-icon" data-theme-toggle aria-label="Téma">${I.sun}</button>
        <div style="position:relative">
          <button class="btn btn-ghost btn-icon bell" data-bell aria-label="Notifikácie">${I.bell}<span class="bell-count">3</span></button>
          <div class="dropdown" data-bell-panel hidden></div>
        </div>
        <div style="position:relative">
          <button class="row g-2" data-avatar style="background:none;border:none;padding:2px;border-radius:99px">
            <span class="avatar avatar-md avatar-ring" style="background:linear-gradient(135deg,#7c5cff,#5b3fd6);color:#fff">MN</span>
          </button>
          <div class="dropdown" data-avatar-panel hidden style="right:0"></div>
        </div>
      `;

    return `<div class="nav"><div class="wrap nav-inner">
      <a class="row g-2" href="index.html" style="gap:10px">
        ${ICON}<span class="wordmark" style="font-family:var(--font-display);font-weight:700;font-size:20px;letter-spacing:-.02em;color:var(--text-1)">Tiper<b style="color:var(--gold)">liga</b></span>
      </a>
      <nav class="nav-links">${links}</nav>
      <div class="nav-actions">${actions}</div>
    </div>
    </div>`;
  }

  const BELL_ITEMS = [
    ['live', 'Nové kolo otvorené', 'Kolo 14 — La Liga · tipuj do nedele 18:00', '12 min', true],
    ['warn', 'Blížiaca sa uzávierka', 'Kolo 13 sa uzatvára o 2 hodiny', '1 h', true],
    ['ok', 'Výsledky pridelené', 'Získal si +18 bodov v kole 12', '3 h', true],
    ['flat', 'Posun v rebríčku', 'Posunul si sa na 2. miesto v lige', 'včera', false],
  ];

  function buildBellPanel() {
    const rows = BELL_ITEMS.map(([type, title, msg, time, unread]) => {
      const color = {live:'var(--live)',warn:'var(--warning)',ok:'var(--success)',flat:'var(--brand)'}[type];
      return `<a class="dd-notif ${unread?'unread':''}" href="notifications.html">
        <span class="dd-dot" style="background:${color}"></span>
        <span class="dd-body"><span class="dd-title">${title}</span><span class="dd-msg">${msg}</span></span>
        <span class="dd-time">${time}</span>
      </a>`;
    }).join('');
    return `<div class="dd-head"><b>Notifikácie</b><span class="tag tag-danger" style="padding:2px 7px">3 nové</span></div>
      ${rows}
      <a class="dd-foot" href="notifications.html">Zobraziť všetky</a>`;
  }

  function buildAvatarPanel() {
    const item = (icon, label, href) => `<a class="dd-link" href="${href}">${label}</a>`;
    return `<div class="dd-profile">
        <span class="avatar avatar-lg" style="background:linear-gradient(135deg,#7c5cff,#5b3fd6);color:#fff">MN</span>
        <div><div class="dd-name">Martin Novák <span class="chip-role role-vip" style="vertical-align:middle">VIP</span></div><div class="dd-email">martin.novak@email.sk</div></div>
      </div>
      <div class="dd-sep"></div>
      ${item('','Moje súťaže a ligy','my.html')}
      ${item('','Môj profil','profile.html')}
      ${item('','História tipov','tip-history.html')}
      ${item('','Štatistiky','stats.html')}
      ${item('','Odznaky','achievements.html')}
      ${item('','Nastavenia','settings.html')}
      <div class="dd-sep"></div>
      ${item('','Admin panel','admin.html')}
      <a class="dd-link danger" href="login.html">Odhlásiť sa</a>`;
  }

  const SUBNAV = [
    ['overview', 'Prehľad', 'season.html'],
    ['rules', 'Pravidlá', 'season.html#rules'],
    ['leagues', 'Ligy', 'season.html#leagues'],
    ['leaderboard', 'Rebríček', 'season.html#leaderboard'],
    ['news', 'Aktuality', 'season.html#news'],
    ['admin', 'Admin', 'admin-competition.html'],
  ];

  function buildSubnav(active, name) {
    const links = SUBNAV.map(([id, label, href]) =>
      `<a class="subnav-link ${id==='admin'?'admin':''} ${id===active?'active':''}" href="${href}">${label}</a>`
    ).join('');
    return `<div class="subnav"><div class="wrap subnav-inner">
      <a href="season.html" class="row g-2" style="font-weight:700;color:var(--text-1);white-space:nowrap;padding-right:8px">
        <span class="team-logo" style="width:26px;height:26px;font-size:11px;background:linear-gradient(135deg,#0b4ea2,#06306a)">MS</span>
        ${name||'MS v hokeji 2026'}
      </a>
      <span style="width:1px;height:22px;background:var(--line)"></span>
      ${links}
    </div></div>`;
  }

  const ADMINNAV = [
    ['dashboard', 'Prehľad', 'admin.html'],
    ['users', 'Užívatelia', 'admin-users.html'],
    ['leagues', 'Ligy & sezóny', 'admin-leagues.html'],
    ['competition', 'Správa súťaže', 'admin-competition.html'],
    ['evaluate', 'Vyhodnotenie', 'admin-evaluate.html'],
  ];
  function buildAdminNav(active) {
    const links = ADMINNAV.map(([id, label, href]) =>
      `<a class="subnav-link ${id===active?'active':''}" href="${href}">${label}</a>`
    ).join('');
    return `<div class="subnav admin-bar"><div class="wrap subnav-inner">
      <span class="row g-2" style="font-weight:700;color:var(--text-1);white-space:nowrap;padding-right:6px">
        <span class="admin-badge">ADMIN</span> Administrácia
      </span>
      <span style="width:1px;height:22px;background:var(--line)"></span>
      ${links}
    </div></div>`;
  }

  function buildFooter() {
    const col = (title, links) => `<div><h5>${title}</h5>${links.map(l=>`<a href="${l[1]}">${l[0]}</a>`).join('')}</div>`;
    return `<div class="wrap">
      <div class="footer-grid">
        <div>
          <a class="row g-2" href="index.html" style="gap:10px;margin-bottom:14px">${ICON}<span style="font-family:var(--font-display);font-weight:700;font-size:19px;color:var(--text-1)">Tiper<b style="color:var(--gold)">liga</b></span></a>
          <p class="muted" style="font-size:var(--fs-sm);max-width:280px">Tipuj výsledky zápasov, súťaž v ligách a stúpaj v rebríčku. Oficiálne aj komunitné sezóny na jednom mieste.</p>
        </div>
        ${col('Platforma', [['Sezóny','seasons.html'],['Objaviť súťaže','discover.html'],['Rebríčky','leaderboards.html'],['Vytvoriť ligu','create-league.html']])}
        ${col('Môj účet', [['Moje súťaže','my.html'],['Pripojiť sa cez ID','join.html'],['Profil','profile.html'],['Nastavenia','settings.html']])}
        ${col('Komunita', [['Blog','blog.html'],['O nás','about.html'],['Kontakt','kontakt.html'],['Achievementy','achievements.html']])}
      </div>
      <div class="footer-bottom">
        <span>© 2026 Tiperliga. Všetky práva vyhradené.</span>
        <span class="row g-4"><a href="#" style="padding:0">Podmienky</a><a href="#" style="padding:0">Súkromie</a><a href="Design System.html" style="padding:0">Dizajn systém</a></span>
      </div>
    </div>`;
  }

  // ---- theme ----
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    document.querySelectorAll('[data-theme-toggle]').forEach(b => b.innerHTML = t === 'light' ? I.moon : I.sun);
  }

  // ---- auth state (demo: switch logged-in / guest view) ----
  function authState() {
    var a = document.body.getAttribute('data-auth');
    if (a === 'guest' || a === 'user') return a;
    return localStorage.getItem('tl-auth') === 'guest' ? 'guest' : 'user';
  }
  function applyAuthOnly(state) {
    document.documentElement.setAttribute('data-auth-state', state);
    document.querySelectorAll('[data-auth-only]').forEach(function (el) {
      el.hidden = el.getAttribute('data-auth-only') !== state;
    });
  }

  function init() {
    const page = document.body.getAttribute('data-page') || '';
    document.querySelectorAll('[data-shell-nav]').forEach(el => el.innerHTML = buildNav(page));
    document.querySelectorAll('[data-shell-subnav]').forEach(el => el.innerHTML = buildSubnav(el.getAttribute('data-shell-subnav'), el.getAttribute('data-season-name')));
    document.querySelectorAll('[data-shell-adminnav]').forEach(el => el.innerHTML = buildAdminNav(el.getAttribute('data-shell-adminnav')));
    document.querySelectorAll('[data-shell-footer]').forEach(el => { el.className = 'footer'; el.innerHTML = buildFooter(); });

    // mobile-only "manage" block: the season/league subnav is hidden on phones
    // (everything lives on one scrollable page), so the admin entry point moves
    // to a dedicated block at the very end of the content. Only on the hub pages.
    var _cf = currentFile();
    if (_cf === 'season.html' || _cf === 'league.html') {
      document.querySelectorAll('[data-shell-subnav]').forEach(el => {
        const isLeague = _cf === 'league.html';
        const kind = isLeague ? 'ligy' : 'sezóny';
        const href = el.getAttribute('data-manage-href') || 'admin-competition.html';
        const name = el.getAttribute('data-season-name') || '';
        const block = document.createElement('div');
        block.className = 'manage-block';
        block.innerHTML = `<div class="wrap"><a class="manage-card" href="${href}">
          <span class="manage-ic">${I.cog}</span>
          <span class="manage-tx"><b>Správa ${kind}</b><span>Administrácia${name?' · '+name:''} — zápasy, kolá, vyhodnotenie</span></span>
          <span class="manage-go">→</span>
        </a></div>`;
        const footer = document.querySelector('.footer, [data-shell-footer]');
        if (footer && footer.parentNode) footer.parentNode.insertBefore(block, footer);
        else document.body.appendChild(block);
      });
    }

    // mobile bottom tab bar — injected on pages that use the main shell nav
    if (document.querySelector('[data-shell-nav]') && !document.querySelector('.tabbar')) {
      const tb = document.createElement('nav');
      tb.className = 'tabbar';
      tb.setAttribute('aria-label', 'Mobilná navigácia');
      tb.innerHTML = buildTabbar(authState());
      document.body.appendChild(tb);
    }

    applyAuthOnly(authState());
    applyTheme(localStorage.getItem('tl-theme') || 'dark');

    initDevicePreview();
    initAuthDemo();

    document.addEventListener('click', (e) => {
      const t = e.target.closest('[data-theme-toggle]');
      if (t) {
        const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        localStorage.setItem('tl-theme', next); applyTheme(next); return;
      }
      // dropdowns
      const bell = e.target.closest('[data-bell]');
      const avatar = e.target.closest('[data-avatar]');
      const bp = document.querySelector('[data-bell-panel]');
      const ap = document.querySelector('[data-avatar-panel]');
      if (bell) { if (bp.hasAttribute('hidden')) bp.innerHTML = buildBellPanel(); bp.toggleAttribute('hidden'); ap && ap.setAttribute('hidden',''); return; }
      if (avatar) { if (ap.hasAttribute('hidden')) ap.innerHTML = buildAvatarPanel(); ap.toggleAttribute('hidden'); bp && bp.setAttribute('hidden',''); return; }
      if (!e.target.closest('.dropdown')) { bp && bp.setAttribute('hidden',''); ap && ap.setAttribute('hidden',''); }
      // mobile
      const burger = e.target.closest('[data-burger]');
      const mob = document.querySelector('[data-mobile]');
      if (burger && mob) { mob.toggleAttribute('hidden'); return; }
    });
  }

  // ---- desktop/mobile preview toggle (top-level only) ----
  function initDevicePreview(){
    if (window.name === 'tl-device') return; // inside the device frame: no nested toggle

    const monitor = svg('<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M9 21h6M12 17v4"/>');
    const phone = svg('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.4h2"/>');

    const wrap = document.createElement('div');
    wrap.className = 'vp-toggle';
    wrap.setAttribute('aria-label', 'Prepnúť náhľad desktop / mobil');
    wrap.innerHTML =
      '<button data-vp="desktop" title="Desktop náhľad">' + monitor + '<span>Desktop</span></button>' +
      '<button data-vp="mobile" title="Mobilný náhľad">' + phone + '<span>Mobil</span></button>';
    document.body.appendChild(wrap);

    const overlay = document.createElement('div');
    overlay.className = 'device-overlay';
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="device-bar">' +
        '<span class="device-cap">Mobilný náhľad</span>' +
        '<div class="device-sizes">' +
          '<button data-w="375">375</button>' +
          '<button data-w="390" class="active">390</button>' +
          '<button data-w="414">414</button>' +
        '</div>' +
        '<button class="device-close" data-vp="desktop">✕ Späť na desktop</button>' +
      '</div>' +
      '<div class="device-frame"><iframe name="tl-device" title="Mobilný náhľad" loading="lazy"></iframe></div>';
    document.body.appendChild(overlay);
    const iframe = overlay.querySelector('iframe');
    let frameLoaded = false;
    function loadFrame(){
      if (frameLoaded) return;
      frameLoaded = true;
      const dir = location.href.replace(/[?#].*$/, '').replace(/[^/]*$/, '');
      fetch(currentFile()).then(r => r.text()).then(html => {
        // inject a <base> so the framed page's relative css/js/links still resolve,
        // and route in-frame navigations to the top window (srcdoc avoids X-Frame blocking)
        html = html.replace(/<head([^>]*)>/i, '<head$1><base href="' + dir + '" target="_parent">');
        iframe.srcdoc = html;
      }).catch(() => {
        iframe.srcdoc = '<body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#9aa;background:#0c0f1a;text-align:center;padding:20px">Náhľad sa nepodarilo načítať.<br>Otvor stránku priamo na mobile.</body>';
      });
    }

    function setMode(mode){
      const mobile = mode === 'mobile';
      localStorage.setItem('tl-preview', mode);
      wrap.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.vp === mode));
      if (mobile){
        loadFrame();
        overlay.hidden = false;
        document.documentElement.style.overflow = 'hidden';
      } else {
        overlay.hidden = true;
        document.documentElement.style.overflow = '';
      }
    }

    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-vp]');
      if (b) setMode(b.dataset.vp);
    });
    overlay.addEventListener('click', e => {
      if (e.target.closest('[data-vp="desktop"]')) { setMode('desktop'); return; }
      const w = e.target.closest('[data-w]');
      if (w){
        overlay.querySelectorAll('[data-w]').forEach(x => x.classList.toggle('active', x === w));
        iframe.style.width = w.dataset.w + 'px';
        return;
      }
      if (e.target === overlay) setMode('desktop'); // click backdrop to exit
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) setMode('desktop'); });

    setMode((localStorage.getItem('tl-preview') === 'mobile') ? 'mobile' : 'desktop');
  }

  // ---- auth demo toggle (logged-in vs guest) ----
  function initAuthDemo() {
    if (window.name === 'tl-device') return;
    if (!document.querySelector('[data-shell-nav]')) return;
    var state = authState();
    var box = document.createElement('div');
    box.className = 'auth-toggle';
    box.setAttribute('aria-label', 'N\u00e1h\u013ead: prihl\u00e1sen\u00fd / hos\u0165');
    box.innerHTML =
      '<span class="at-cap">N\u00e1h\u013ead</span>' +
      '<button data-auth-set="user" class="' + (state === 'user' ? 'active' : '') + '">Prihl\u00e1sen\u00fd</button>' +
      '<button data-auth-set="guest" class="' + (state === 'guest' ? 'active' : '') + '">Hos\u0165</button>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-auth-set]');
      if (!b) return;
      localStorage.setItem('tl-auth', b.getAttribute('data-auth-set'));
      location.reload();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.TL = { svg, I, init, setPage: function(p){ document.body.setAttribute('data-page', p||''); init(); } };
})();
