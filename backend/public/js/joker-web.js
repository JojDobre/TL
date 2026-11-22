// ŽOLÍK na webových stránkach tipovania (kolo, zápasy sezóny, moje tipy):
// jeden zápas v kole s dvojnásobnými bodmi. Tip musí byť najprv uložený.
(function () {
  function label(b, on) { b.querySelector('.jt').textContent = on ? 'Žolík nasadený' : 'Nasadiť žolíka'; }
  function msg(text, ok) {
    if (window.toast) return window.toast(text, ok ? 'success' : 'error');
    var el = document.createElement('div');
    el.className = 'joker-toast' + (ok ? '' : ' err'); el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 300); }, 2600);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-joker-web]');
    if (!b || b.disabled || b.classList.contains('busy')) return;
    e.preventDefault();
    var on = !b.classList.contains('on');
    b.classList.add('busy');
    fetch('/api/tips/joker', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ matchId: Number(b.getAttribute('data-match-id')), on: on }),
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok && j.success !== false, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.message || 'Nepodarilo sa.');
        if (on) {
          document.querySelectorAll('[data-joker-web][data-round="' + b.getAttribute('data-round') + '"]').forEach(function (o) {
            if (o === b) return;
            o.classList.remove('on'); o.setAttribute('aria-pressed', 'false'); label(o, false);
          });
        }
        b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); label(b, on);
        msg(res.j.message, true);
      })
      .catch(function (err) { msg(err.message, false); })
      .then(function () { b.classList.remove('busy'); });
  });
})();
