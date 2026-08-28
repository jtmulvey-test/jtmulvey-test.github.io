/* ------------------------------------------------------------------
   render-publications.js
   Reads data/publications.json, renders a card grid (image + title +
   journal/year + tags), newest first. Falls back to a placeholder
   graphic for any publication without a "image" field yet.
   ------------------------------------------------------------------ */

(function () {

  /* ----------------------------------------------------------------
     Full Publication List: the citations are static markup, so this just
     hides everything past the sixth and offers one button to reveal the
     lot. Hidden rather than removed — the whole list stays in the page
     source for search engines and for Ctrl+F.
     ---------------------------------------------------------------- */
  (function collapseFullList() {
    var section = document.querySelector('.cv-pubs');
    if (!section) return;

    /* Two on phones. Six citations run to most of a phone screen on their
       own, which buries the "Show all" button and makes the card grid above
       feel like it ended long ago. Desktop has the width to carry six. */
    var VISIBLE = window.matchMedia('(max-width: 860px)').matches ? 2 : 6;
    var items = section.querySelectorAll('.cv-pubs__list li');
    if (items.length <= VISIBLE) return;

    /* the later "In preparation" / "Conference proceedings" blocks belong
       with the citations they follow, so they collapse too */
    var hidden = Array.prototype.slice.call(items, VISIBLE);
    var lists = section.querySelectorAll('.cv-pubs__list');
    for (var i = 1; i < lists.length; i++) {
      hidden.push(lists[i]);
      if (lists[i].previousElementSibling &&
          lists[i].previousElementSibling.classList.contains('cv-pubs__subhead')) {
        hidden.push(lists[i].previousElementSibling);
      }
    }

    hidden.forEach(function (el) { el.hidden = true; });

    var all = document.createElement('button');
    all.type = 'button';
    all.className = 'pub-more';
    all.textContent = 'Show all';
    all.setAttribute('aria-label',
      'Show all ' + items.length + ' publications in the full list');
    section.appendChild(all);

    all.addEventListener('click', function () {
      hidden.forEach(function (el) { el.hidden = false; });
      hidden[0].setAttribute('tabindex', '-1');
      hidden[0].focus({ preventScroll: true });
      all.remove();
    });
  })();

  var mount = document.getElementById('publications');
  if (!mount) return;

  var PLACEHOLDER = 'assets/img/publications/placeholder.svg';

  /* The grid is a preview, not the record — the full list further down the
     page always renders in its entirety.

     Eight on phones: the mobile grid is two columns, so an even number fills
     the last row. Nine on desktop, which fills three full rows on the common
     three-column layout. */
  var FIRST_BATCH = window.matchMedia('(max-width: 860px)').matches ? 8 : 9;
  /* Desktop reveals nine at a time so every batch fills three whole rows of
     the three-column grid, matching the first batch. Mobile's two-column
     grid wants an even number, so it keeps ten. */
  var NEXT_BATCH  = window.matchMedia('(max-width: 860px)').matches ? 10 : 9;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Bold the site owner's name wherever it appears in the author list. */
  function authorsLine(list, me) {
    return (list || []).map(function (name) {
      return name === me ? '<strong>' + esc(name) + '</strong>' : esc(name);
    }).join(', ');
  }

  /* Figures wider than this lock to the frame's left and right edges;
     anything squarer locks to its top and bottom. See layout.css. */
  var WIDE_ABOVE = 2.2;

  function markWide(img) {
    if (!img.naturalWidth || !img.naturalHeight) return;
    img.classList.toggle('is-wide', img.naturalWidth / img.naturalHeight > WIDE_ABOVE);
  }

  function markWideIn(scope) {
    scope.querySelectorAll('.pub-card__thumb img').forEach(function (img) {
      if (img.complete) {
        markWide(img);
      } else {
        img.addEventListener('load', function () { markWide(img); }, { once: true });
      }
    });
  }

  function cardHTML(pub, me) {
    var img = pub.image || PLACEHOLDER;
    var hasImage = !!pub.image;

    var tags = (pub.tags || []).map(function (t) {
      return '<span class="pub-card__tag">' + esc(t) + '</span>';
    }).join('');

    var meta = [];
    if (pub.journal) meta.push(esc(pub.journal));
    if (pub.year) meta.push(esc(pub.year));

    var linkOpen = pub.link
      ? '<a class="pub-card__link" href="' + esc(pub.link) + '" target="_blank" rel="noopener" aria-label="Read: ' + esc(pub.title) + '">'
      : '<div class="pub-card__link">';
    var linkClose = pub.link ? '</a>' : '</div>';

    return (
      '<article class="pub-card' + (hasImage ? '' : ' pub-card--placeholder') + '">' +
        linkOpen +
          '<div class="pub-card__thumb">' +
            '<img src="' + esc(img) + '" alt="' + esc(hasImage ? pub.title + ' — TOC figure' : 'Figure not yet added') + '" loading="lazy">' +
          '</div>' +
          '<div class="pub-card__body">' +
            '<h3 class="pub-card__title">' + esc(pub.title) + '</h3>' +
            '<p class="pub-card__authors">' + authorsLine(pub.authors, me) + '</p>' +
            (tags ? '<div class="pub-card__tags">' + tags + '</div>' : '') +
            '<p class="pub-card__meta">' + meta.join(' · ') + '</p>' +
          '</div>' +
        linkClose +
      '</article>'
    );
  }

  fetch('data/publications.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('publications.json not found');
      return r.json();
    })
    .then(function (data) {
      var me = data.author_name || '';
      var pubs = (data.publications || []).slice()
        .sort(function (a, b) { return (b.year || 0) - (a.year || 0); });

      if (!pubs.length) {
        mount.innerHTML = '<p class="cards__loading">No publications listed yet.</p>';
        return;
      }

      mount.innerHTML = '';

      /* the button is a sibling of the grid, not a cell inside it */
      var more = document.createElement('button');
      more.type = 'button';
      more.className = 'pub-more';
      mount.insertAdjacentElement('afterend', more);

      var shown = 0;

      function reveal(count) {
        var batch = pubs.slice(shown, shown + count);
        mount.insertAdjacentHTML('beforeend',
          batch.map(function (pub) { return cardHTML(pub, me); }).join(''));
        markWideIn(mount);
        shown += batch.length;

        var left = pubs.length - shown;
        if (left <= 0) {
          more.remove();
          return;
        }
        /* The visible label stays a plain "Show more" — the exact batch size
           is an implementation detail and it changed between breakpoints,
           which made the button look like it meant something by it. The
           aria-label keeps the numbers, where they cost nothing. */
        more.textContent = 'Show more';
        more.setAttribute('aria-label',
          'Show ' + Math.min(NEXT_BATCH, left) + ' more publications, ' +
          left + ' remaining');
      }

      more.addEventListener('click', function () {
        var first = shown; // index of the first card this click adds
        reveal(NEXT_BATCH);
        /* move focus to the first newly revealed card so keyboard and screen
           reader users land on the new content rather than the page top */
        var cards = mount.querySelectorAll('.pub-card__link');
        if (cards[first]) {
          cards[first].setAttribute('tabindex', '-1');
          cards[first].focus({ preventScroll: true });
        }
      });

      reveal(FIRST_BATCH);
    })
    .catch(function (err) {
      mount.innerHTML = '<p class="cards__loading">Could not load publications. ' +
                        esc(err.message) + '</p>';
      console.error(err);
    });
})();
