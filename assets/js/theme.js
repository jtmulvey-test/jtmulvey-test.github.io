/* ------------------------------------------------------------------
   theme.js
   Wires up the header dark-mode switch. The initial theme itself is
   applied earlier by the inline snippet in <head> (before first paint,
   to avoid a light-mode flash); this just syncs the switch UI and
   handles clicks.
   ------------------------------------------------------------------ */

(function () {
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;

  function current() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function reflect(theme) {
    btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  reflect(current());

  btn.addEventListener('click', function () {
    var next = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    reflect(next);
  });
})();
