// frontend/src/template/pageEnhance.js
//
// Oživuje data-atribúty v obalenom HTML tele stránky (prevzatom 1:1 zo šablóny).
// Volá sa z TemplatePage po vykreslení. Pokrýva interaktivitu z shell.js/enhance.js,
// ktorá sa týka OBSAHU stránky (nie navbaru — ten je samostatný React komponent).
//
// Vracia cleanup funkciu na odpojenie listenerov.

export function enhancePage(root) {
  if (!root) return () => {};
  const cleanups = [];
  const on = (el, ev, fn) => { el.addEventListener(ev, fn); cleanups.push(() => el.removeEventListener(ev, fn)); };

  // 1) Taby: [data-ct="x"] prepína [data-cpanel="x"] (admin-competition, atď.)
  const tabBtns = root.querySelectorAll('[data-ct]');
  tabBtns.forEach((btn) => {
    on(btn, 'click', () => {
      const key = btn.getAttribute('data-ct');
      // aktívny stav tlačidiel v tej istej skupine
      const group = btn.parentElement;
      group.querySelectorAll('[data-ct]').forEach((b) => b.classList.toggle('active', b === btn));
      // panely
      root.querySelectorAll('[data-cpanel]').forEach((p) => {
        p.style.display = p.getAttribute('data-cpanel') === key ? '' : 'none';
      });
    });
  });
  // inicializácia: zobraz prvý panel, skry ostatné
  const panels = root.querySelectorAll('[data-cpanel]');
  if (panels.length) {
    const active = root.querySelector('[data-ct].active') || root.querySelector('[data-ct]');
    const activeKey = active ? active.getAttribute('data-ct') : panels[0].getAttribute('data-cpanel');
    panels.forEach((p) => { p.style.display = p.getAttribute('data-cpanel') === activeKey ? '' : 'none'; });
  }

  // 2) Generické taby cez [data-tab]/[data-tabpanel] (ak sa vyskytnú)
  root.querySelectorAll('[data-tab]').forEach((btn) => {
    on(btn, 'click', () => {
      const key = btn.getAttribute('data-tab');
      const group = btn.parentElement;
      group.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === btn));
      root.querySelectorAll('[data-tabpanel]').forEach((p) => {
        p.style.display = p.getAttribute('data-tabpanel') === key ? '' : 'none';
      });
    });
  });

  // 3) Riadkové menu (3 bodky): [data-menu] toggluje najbližší [data-rowmenu] alebo súrodenca
  root.querySelectorAll('[data-menu]').forEach((btn) => {
    on(btn, 'click', (e) => {
      e.stopPropagation();
      const wrap = btn.closest('.row-menu') || btn.parentElement;
      let panel = wrap.querySelector('[data-rowmenu]') || wrap.querySelector('.row-menu-panel');
      if (!panel) {
        // ak šablóna nemá panel, vytvoríme jednoduchý
        panel = document.createElement('div');
        panel.className = 'row-menu-panel dropdown';
        panel.setAttribute('data-rowmenu', '');
        panel.style.cssText = 'position:absolute;right:0;top:100%;z-index:50;min-width:180px';
        panel.innerHTML = '<a class="dd-link">Zobraziť profil</a><a class="dd-link">Zmeniť rolu</a><a class="dd-link danger">Zablokovať</a>';
        wrap.style.position = 'relative';
        wrap.appendChild(panel);
      }
      const open = panel.style.display === 'block';
      root.querySelectorAll('[data-rowmenu]').forEach((p) => { p.style.display = 'none'; });
      panel.style.display = open ? 'none' : 'block';
    });
  });
  // klik mimo zatvorí riadkové menu
  const closeMenus = () => root.querySelectorAll('[data-rowmenu]').forEach((p) => { p.style.display = 'none'; });
  on(document, 'click', closeMenus);

  // 4) Expand/collapse: [data-expand="id"] toggluje [data-expandable="id"]
  root.querySelectorAll('[data-expand]').forEach((btn) => {
    on(btn, 'click', () => {
      const key = btn.getAttribute('data-expand');
      const target = root.querySelector(`[data-expandable="${key}"]`);
      if (target) {
        const open = target.style.display !== 'none' && target.style.display !== '';
        target.style.display = open ? 'none' : '';
        btn.classList.toggle('open');
      }
    });
  });

  // 5) Chevron rozbalenie (admin-leagues): [data-chev] toggluje ďalší .lg-nest
  root.querySelectorAll('[data-chev]').forEach((chev) => {
    on(chev, 'click', (e) => {
      e.stopPropagation();
      const card = chev.closest('.card') || chev.closest('[data-expand-host]');
      if (!card) return;
      const nest = card.querySelector('.lg-nest, [data-nest]');
      if (nest) {
        const open = nest.style.display !== 'none' && nest.style.display !== '';
        nest.style.display = open ? 'none' : '';
        chev.style.transform = open ? '' : 'rotate(90deg)';
      }
    });
  });

  // 6) Confirm akcie: [data-confirm="správa"] vyžiada potvrdenie
  root.querySelectorAll('[data-confirm]').forEach((btn) => {
    on(btn, 'click', (e) => {
      const msg = btn.getAttribute('data-confirm');
      if (!window.confirm(msg)) { e.preventDefault(); e.stopPropagation(); }
    });
  });

  // 7) Segmentové prepínače stavu (napr. data-state na ukážkové prepínanie)
  root.querySelectorAll('[data-stateseg] [data-state]').forEach((btn) => {
    on(btn, 'click', () => {
      const key = btn.getAttribute('data-state');
      btn.parentElement.querySelectorAll('[data-state]').forEach((b) => b.classList.toggle('active', b === btn));
      root.querySelectorAll('[data-stateview]').forEach((v) => {
        v.style.display = v.getAttribute('data-stateview') === key ? '' : 'none';
      });
    });
  });

  // 8) Count-up a reveal: jednoducho zobraz všetko (bez animácie pre stabilitu),
  //    aby obsah nezostal skrytý. (Plnú animáciu rieši voliteľne enhance.js.)
  root.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));

  return () => cleanups.forEach((fn) => fn());
}
