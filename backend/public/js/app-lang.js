// public/js/app-lang.js
//
// Preklad webových stránok, ktoré appka zobrazuje (prihlásenie, registrácia,
// spodná lišta…). Beží LEN v appke (html.is-app) s jazykom en — web v
// prehliadači ostáva vždy po slovensky. Jazyk určuje partials/app-lang.ejs.
(function () {
  var d = document.documentElement;
  if (!d.classList.contains('is-app') || d.getAttribute('data-lang') !== 'en') return;
  d.lang = 'en';
  // chybové hlášky zo servera (auth stránky)
  var MSG = {
    'Nesprávny e-mail alebo heslo.': 'Incorrect e-mail or password.',
    'Tvoj účet je zablokovaný.': 'Your account is blocked.',
    'Chyba pri prihlásení. Skús znova.': 'Login failed. Please try again.',
    'Vyplň prezývku, e-mail aj heslo.': 'Fill in your username, e-mail and password.',
    'Heslo musí mať aspoň 8 znakov.': 'The password must be at least 8 characters long.',
    'Používateľ s týmto e-mailom alebo prezývkou už existuje.': 'A user with this e-mail or username already exists.',
    'Chyba pri registrácii. Skús znova.': 'Registration failed. Please try again.',
  };
  function run() {
    var i, el, list;
    list = document.querySelectorAll('[data-en]');
    for (i = 0; i < list.length; i++) { el = list[i]; el.textContent = el.getAttribute('data-en'); }
    list = document.querySelectorAll('[data-en-html]');
    for (i = 0; i < list.length; i++) { el = list[i]; el.innerHTML = el.getAttribute('data-en-html'); }
    list = document.querySelectorAll('[data-en-ph]');
    for (i = 0; i < list.length; i++) { el = list[i]; el.setAttribute('placeholder', el.getAttribute('data-en-ph')); }
    list = document.querySelectorAll('[data-en-label]');
    for (i = 0; i < list.length; i++) { el = list[i]; el.setAttribute('aria-label', el.getAttribute('data-en-label')); }
    list = document.querySelectorAll('[data-en-msg]');
    for (i = 0; i < list.length; i++) { el = list[i]; var k = el.textContent.trim(); if (MSG[k]) el.textContent = MSG[k]; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
})();
