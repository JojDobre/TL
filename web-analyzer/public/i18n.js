'use strict';
/* Preklady pre skripty stránky – dáta vkladá server do <script type="application/json" id="i18n">. */
(function () {
  let data = { lang: document.documentElement.lang || 'sk', routes: {}, t: {} };
  try { data = JSON.parse(document.getElementById('i18n').textContent); } catch { /* bez prekladov */ }
  const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars && k in vars ? vars[k] : m));
  const get = (key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), data.t);
  /** Množné číslo: SK [1, 2–4, 5+], EN [1, ostatné]. */
  function form(arr, n) {
    if (!Array.isArray(arr)) return arr;
    if (data.lang === 'sk') return n === 1 ? arr[0] : n >= 2 && n <= 4 ? arr[1] : arr[2];
    return n === 1 ? arr[0] : arr[1];
  }
  window.I18N = {
    lang: data.lang,
    locale: data.lang === 'en' ? 'en-GB' : 'sk-SK',
    routes: data.routes,
    t: (key, vars) => { const v = get(key); return v == null ? key : typeof v === 'string' ? fill(v, vars) : v; },
    tp: (key, n) => fill(form(get(key), n), { n }),
  };
})();
