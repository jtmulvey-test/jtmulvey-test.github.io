/* ------------------------------------------------------------------
   main.js — small shared bits: footer year, links from data/links.json,
   contact page rendering.
   ------------------------------------------------------------------ */

(function () {

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* small line-icon set for the contact list + footer links — keyed by
     link label (lowercased), monochrome via currentColor so they follow
     the surrounding link's color/hover state automatically. */
  var ICONS = {
    'email': '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4.5" width="15" height="11" rx="1.6"/><path d="M3 5.5l7 6 7-6"/></svg>',
    'google scholar': '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 8L10 4l8.5 4-8.5 4-8.5-4z"/><path d="M5.5 9.9v3.3c0 1.1 2 2 4.5 2s4.5-.9 4.5-2V9.9"/><path d="M17.3 8.4v4.6"/></svg>',
    'linkedin': '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.2" y="2.2" width="15.6" height="15.6" rx="3.2"/><line x1="6.4" y1="8.8" x2="6.4" y2="14"/><circle cx="6.4" cy="6" r="0.15" fill="currentColor" stroke="currentColor" stroke-width="1.9"/><path d="M9.6 14v-3.7c0-.95.85-1.5 1.75-1.5s1.75.6 1.75 1.7V14"/></svg>',
    'github': '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.2 5.3L2.5 10l4.7 4.7"/><path d="M12.8 5.3L17.5 10l-4.7 4.7"/></svg>',
    'orcid': '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="7.8"/><circle cx="7.1" cy="6.6" r="0.15" fill="currentColor" stroke="currentColor" stroke-width="1.8"/><line x1="7.1" y1="8.5" x2="7.1" y2="13.4"/><path d="M9.5 8.5h1.6c1.5 0 2.7.95 2.7 2.45s-1.2 2.45-2.7 2.45H9.5V8.5z"/></svg>'
  };

  function iconFor(label) {
    return ICONS[String(label || '').toLowerCase()] || '';
  }

  /* ----------------------------------------------------------------
     Click-to-copy on the email row.

     Clicking a mailto: link is a coin flip — on a machine with no mail
     client configured it opens nothing, or worse, a client the person
     never uses. Copying the address instead is what most people were
     going to do anyway. The mailto: href is left intact so nothing is
     lost: it is still there for right-click, for middle-click, and for
     anyone with no JS.
     ---------------------------------------------------------------- */

  var COPY_ICON =
    '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="7" y="7" width="9.5" height="9.5" rx="1.8"/>' +
    '<path d="M13 4.5H5.3c-.9 0-1.6.7-1.6 1.6V13"/></svg>';

  var DONE_ICON =
    '<svg class="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4.5 10.4l3.6 3.6 7.4-7.8"/></svg>';

  /* Sits to the right of the address. Without it a click that only copies
     reads as a broken link — there has to be something on the row saying
     this button does something other than navigate. */
  var COPY_AFFORDANCE =
    '<span class="copy-affordance" aria-hidden="true">' +
      '<span class="copy-affordance__icon">' + COPY_ICON + DONE_ICON + '</span>' +
      '<span class="copy-affordance__text">' +
        '<span class="copy-affordance__idle">Copy</span>' +
        '<span class="copy-affordance__done">Copied</span>' +
      '</span>' +
    '</span>';

  /* Async clipboard first; execCommand for older browsers and for any
     context where the async API is unavailable (it needs a secure origin,
     which GitHub Pages provides, but a local file:// preview does not). */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:absolute;left:-9999px;top:0;';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('copy unsupported'));
    });
  }

  function wireCopy(scope) {
    var link = scope.querySelector('.contact-links__copy');
    if (!link) return;

    /* A purely visual state change is invisible to a screen reader, so the
       confirmation is also announced through a polite live region. */
    var status = document.createElement('span');
    status.className = 'visually-hidden';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    scope.parentNode.insertBefore(status, scope.nextSibling);

    var timer;

    link.addEventListener('click', function (ev) {
      var address = link.getAttribute('data-copy');
      if (!address) return;
      ev.preventDefault();

      copyText(address).then(function () {
        link.classList.add('is-copied');
        status.textContent = address + ' copied to clipboard';
        clearTimeout(timer);
        timer = setTimeout(function () {
          link.classList.remove('is-copied');
          status.textContent = '';
        }, 2000);
      }).catch(function () {
        /* Clipboard blocked or unsupported — fall back to the behaviour
           the href describes rather than leaving the click doing nothing. */
        window.location.href = link.href;
      });
    });
  }

  fetch('data/links.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (data) {
      if (!data) return;
      var links = data.links || [];

      /* footer */
      var footer = document.getElementById('footer-links');
      if (footer) {
        footer.innerHTML = links
          .filter(function (l) { return l.in_footer !== false; })
          .map(function (l) {
            return '<a href="' + esc(l.url) + '" target="_blank" rel="noopener">' +
                   iconFor(l.label) + '<span>' + esc(l.label) + '</span></a>';
          }).join('');
      }

      /* publications page: point "Google Scholar" at the real profile */
      var scholar = document.getElementById('scholar-link');
      if (scholar) {
        var match = links.filter(function (l) {
          return /scholar/i.test(l.label);
        })[0];
        if (match) scholar.href = match.url;
      }

      /* contact page */
      var list = document.getElementById('contact-links');
      if (list) {
        list.innerHTML = links.map(function (l) {
          var isMail = l.url.indexOf('mailto:') === 0;
          var value = l.display || l.url.replace(/^https?:\/\/(www\.)?|^mailto:/, '');
          var address = l.url.slice(7);

          /* The href stays a real mailto: even though the click copies —
             right-click "Copy link address", middle-click and the keyboard
             context menu all keep working, and the row still degrades to a
             plain mail link if the script never runs. */
          return '<li><a href="' + esc(l.url) + '"' +
                 (isMail
                   ? ' class="contact-links__copy" data-copy="' + esc(address) +
                     '" aria-label="Copy email address ' + esc(address) + ' to clipboard"'
                   : ' target="_blank" rel="noopener"') +
                 '><span class="label">' + iconFor(l.label) + esc(l.label) + '</span>' +
                 '<span class="value">' + esc(value) + '</span>' +
                 (isMail ? COPY_AFFORDANCE : '') +
                 '</a></li>';
        }).join('');
        wireCopy(list);
      }

      /* contact page: source-code line beneath the links. Starts hidden in
         the markup so it never flashes an empty sentence, and stays hidden
         if data/links.json has no "repo" key. */
      var repoNote = document.getElementById('repo-note');
      if (repoNote && data.repo) {
        var repoLabel = data.repo.replace(/^https?:\/\/(www\.)?/, '').replace(/\.git$/, '');
        repoNote.innerHTML = 'All code for this site available at ' +
          '<a href="' + esc(data.repo) + '" target="_blank" rel="noopener">' +
          esc(repoLabel) + '</a>';
        repoNote.hidden = false;
      }
    })
    .catch(function (err) { console.error(err); });
})();
