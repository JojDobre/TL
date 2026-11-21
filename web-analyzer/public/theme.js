'use strict';
/* Prepínač témy pre jednoduché stránky (právne info, admin). */
(function () {
  const root = document.documentElement;
  let t = null;
  try { t = localStorage.getItem('wa-theme'); } catch { /* storage nedostupný */ }
  root.dataset.theme = t || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const bind = () => {
    const b = document.getElementById('themeToggle');
    if (b) b.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('wa-theme', root.dataset.theme); } catch { /* ignore */ }
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind); else bind();
})();
