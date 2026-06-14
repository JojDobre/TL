// frontend/src/template/adminUsersPage.js
//
// Admin — správa užívateľov: telo 1:1 zo šablóny + plná funkčnosť na reálnych
// dátach so SERVEROVÝM stránkovaním (škáluje na tisíce užívateľov).
// Filter (rola, stav), vyhľadávanie (debounced), stránkovanie a akcie
// (zmena roly, blokovanie/aktivácia, mazanie) — všetko cez userService.

import React from 'react';
import TemplatePage from './TemplatePage';
import { getAllUsers, updateUser, deleteUser } from '../services/userService';
import * as mAdminUsers from './html/admin-users.html.js';
import axios from 'axios';

const PER_PAGE = 20;

const GRADS = [
  'linear-gradient(135deg,#7c5cff,#5b3fd6)', 'linear-gradient(135deg,#3a7bd5,#1b3f72)',
  'linear-gradient(135deg,#16a085,#0c5f4d)', 'linear-gradient(135deg,#d35400,#8a3700)',
  'linear-gradient(135deg,#8e44ad,#522963)', 'linear-gradient(135deg,#ff6b9a,#f0476a)',
];
const gradFor = (s = '') => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % GRADS.length; return GRADS[h]; };
const fullName = (u) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || '?';
const initials = (u) => fullName(u).split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
const roleLabel = (r) => (r === 'admin' ? 'Admin' : r === 'vip' ? 'VIP' : 'Hráč');
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function rowHtml(u) {
  const active = u.active !== false;
  const color = active ? 'var(--success)' : 'var(--danger)';
  const label = active ? 'Aktívny' : 'Zablokovaný';
  return '<div class="u-row" data-uid="' + u.id + '"' + (active ? '' : ' style="opacity:.6"') + '>' +
    '<div class="u-user">' +
      '<span class="avatar avatar-md" style="background:' + gradFor(u.username || fullName(u)) + ';color:#fff">' + esc(initials(u)) + '</span>' +
      '<div style="min-width:0"><div class="u-name">' + esc(fullName(u)) + '</div><div class="u-email">' + esc(u.email || '') + '</div></div>' +
    '</div>' +
    '<span><span class="chip-role role-' + (u.role || 'player') + '">' + roleLabel(u.role) + '</span></span>' +
    '<span class="u-num u-col-hide">—</span>' +
    '<span class="u-num u-col-hide">—</span>' +
    '<span class="status-dot" style="color:' + color + '"><span class="d" style="background:' + color + '"></span>' + label + '</span>' +
    '<div class="row-menu"><button class="row-menu-btn" data-menu>⋯</button></div>' +
  '</div>';
}

const AdminUsersPage = () => {
  const onMount = (root) => {
    const table = root.querySelector('.u-table');
    if (!table) return;

    const searchInput = root.querySelector('.filters .input-icon input');
    const selects = root.querySelectorAll('.filters select');
    const roleSel = selects[0];
    const statusSel = selects[1];
    const countEl = root.querySelector('.filters .muted') || root.querySelectorAll('.filters span')[0];
    const footer = root.querySelector('.between');
    const prevBtn = footer ? footer.querySelectorAll('button')[0] : null;
    const nextBtn = footer ? footer.querySelectorAll('button')[1] : null;
    const pageInfoEl = footer ? footer.querySelector('.muted') : null;
    const addBtn = root.querySelector('.btn-primary');

    let page = 1;
    let pages = 1;
    let total = 0;
    let current = []; // užívatelia na aktuálnej strane
    let searchTimer = null;

    const queryParams = () => {
      const p = { page, limit: PER_PAGE };
      const q = (searchInput && searchInput.value || '').trim();
      if (q) p.search = q;
      const role = (roleSel && roleSel.value) || 'Všetky roly';
      if (role !== 'Všetky roly') p.role = role === 'Admin' ? 'admin' : role === 'VIP' ? 'vip' : 'player';
      const status = (statusSel && statusSel.value) || 'Všetky stavy';
      if (status === 'Aktívny') p.status = 'active';
      if (status === 'Zablokovaný') p.status = 'blocked';
      return p;
    };

    const load = async () => {
      try {
        const res = await getAllUsers(queryParams());
        current = res.data || [];
        if (res.pagination) { total = res.pagination.total; pages = res.pagination.pages || 1; page = res.pagination.page || page; }
        render();
      } catch (err) {
        const msg = (err.response && err.response.status === 403) ? 'Len pre administrátorov.'
          : (err.response && err.response.status === 401) ? 'Musíš byť prihlásený.'
          : 'Nepodarilo sa načítať používateľov.';
        table.innerHTML = '<div class="u-row"><div class="u-user"><div class="u-name">' + msg + '</div></div></div>';
      }
    };

    const render = () => {
      table.innerHTML = current.length
        ? current.map(rowHtml).join('')
        : '<div class="u-row"><div class="u-user"><div class="u-name">Žiadni používatelia nevyhovujú filtru.</div></div></div>';

      const start = (page - 1) * PER_PAGE;
      if (countEl) countEl.textContent = total ? (start + 1) + '–' + (start + current.length) + ' z ' + total : '0 z 0';
      if (pageInfoEl) pageInfoEl.textContent = 'Strana ' + page + ' / ' + pages;

      if (prevBtn) { const d = page <= 1; prevBtn.setAttribute('aria-disabled', d ? 'true' : 'false'); prevBtn.style.opacity = d ? '.4' : ''; prevBtn.style.pointerEvents = d ? 'none' : ''; }
      if (nextBtn) { const d = page >= pages; nextBtn.setAttribute('aria-disabled', d ? 'true' : 'false'); nextBtn.style.opacity = d ? '.4' : ''; nextBtn.style.pointerEvents = d ? 'none' : ''; }

      if (window.TLenhance) window.TLenhance();
    };

    function showActionMenu(wrap, user) {
      root.querySelectorAll('[data-rowmenu]').forEach((p) => p.remove());
      const panel = document.createElement('div');
      panel.setAttribute('data-rowmenu', '');
      panel.className = 'row-pop';
      panel.style.cssText = 'position:absolute;right:0;top:100%;z-index:60;display:block';
      const active = user.active !== false;
      panel.innerHTML =
        '<a data-act="role-player">Zmeniť rolu → Hráč</a>' +
        '<a data-act="role-vip">Zmeniť rolu → VIP</a>' +
        '<a data-act="role-admin">Zmeniť rolu → Admin</a>' +
        '<div class="sep"></div>' +
        '<a class="danger" data-act="ban">' + (active ? 'Zablokovať' : 'Aktivovať') + '</a>' +
        '<a class="danger" data-act="del">Vymazať účet</a>';
      wrap.style.position = 'relative';
      wrap.appendChild(panel);

      panel.addEventListener('click', async (ev) => {
        const a = ev.target.closest('[data-act]');
        if (!a) return;
        ev.preventDefault();
        ev.stopPropagation();
        const act = a.getAttribute('data-act');
        try {
          if (act.indexOf('role-') === 0) {
            await updateUser(user.id, { role: act.replace('role-', '') });
          } else if (act === 'ban') {
            await updateUser(user.id, { active: !(user.active !== false) });
          } else if (act === 'del') {
            if (!window.confirm('Naozaj vymazať účet ' + fullName(user) + '?')) return;
            await deleteUser(user.id);
          }
          panel.remove();
          await load(); // znovu načítaj aktuálnu stranu z backendu
        } catch (err) {
          alert((err.response && err.response.data && err.response.data.message) || 'Akcia zlyhala.');
        }
      });
    }

    table.addEventListener('click', (e) => {
      if (e.target.closest('[data-menu]')) {
        e.stopPropagation();
        const row = e.target.closest('.u-row');
        if (!row) return;
        const user = current.find((u) => String(u.id) === String(row.getAttribute('data-uid')));
        if (user) showActionMenu(e.target.closest('.row-menu'), user);
      }
    });
    document.addEventListener('click', () => root.querySelectorAll('[data-rowmenu]').forEach((p) => p.remove()));

    // search s debounce (300 ms), filtre okamžite
    if (searchInput) searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { page = 1; load(); }, 300);
    });
    [roleSel, statusSel].forEach((el) => { if (el) el.addEventListener('change', () => { page = 1; load(); }); });

    if (prevBtn) prevBtn.addEventListener('click', () => { if (page > 1) { page--; load(); } });
    if (nextBtn) nextBtn.addEventListener('click', () => { if (page < pages) { page++; load(); } });

    if (addBtn) addBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const username = window.prompt('Prezývka nového používateľa:'); if (!username) return;
      const email = window.prompt('E-mail:'); if (!email) return;
      const password = window.prompt('Heslo (min. 6 znakov):'); if (!password) return;
      try {
        await axios.post('/api/auth/register', { username, email, password });
        page = 1; await load();
      } catch (err) {
        alert((err.response && err.response.data && err.response.data.message) || 'Nepodarilo sa pridať používateľa.');
      }
    });

    load();
  };

  return (
    <TemplatePage html={mAdminUsers.html} dataPage={mAdminUsers.dataPage} inlineScript={mAdminUsers.inlineScript} onMount={onMount} />
  );
};

export default AdminUsersPage;
