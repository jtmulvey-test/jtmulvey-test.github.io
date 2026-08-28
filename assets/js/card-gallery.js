/* ------------------------------------------------------------------
   card-gallery.js
   Wires up one research card: click / arrow / dot / keyboard on desktop,
   native scroll-snap swipe on mobile. Media and the left-hand text always
   change together.
   ------------------------------------------------------------------ */

(function () {

/* The hints persist until the visitor navigates for the first time, then every
   hint on the page clears at once — having learned it on one card, they don't
   need telling again on the next four. Shared across galleries, so it lives
   out here rather than inside CardGallery. */
var hintsDismissed = false;

function dismissHints() {
  if (hintsDismissed) return;
  hintsDismissed = true;
  document.querySelectorAll('.card__hint').forEach(function (hint) {
    hint.classList.add('is-hidden');
  });
}

window.CardGallery = function (card) {

  var slidesWrap = card.querySelector('.card__slides');
  var slides     = Array.prototype.slice.call(card.querySelectorAll('.card__slide'));
  var textPane   = card.querySelector('.card__slide-text');
  var dots       = Array.prototype.slice.call(card.querySelectorAll('.card__dot'));
  var prev       = card.querySelector('[data-dir="prev"]');
  var next       = card.querySelector('[data-dir="next"]');
  var counter    = card.querySelector('.card__counter');
  var hint       = card.querySelector('.card__hint');
  var media      = card.querySelector('.card__media');

  if (slides.length === 0) return;

  var index = 0;
  var swapTimer;

  function isMobile() {
    return window.matchMedia('(max-width: 860px)').matches;
  }

  function renderText(slide) {
    var data = JSON.parse(slide.dataset.text || '{}');
    var html = '';

    if (data.title)   html += '<h3 class="card__slide-title">' + data.title + '</h3>';
    if (data.journal) {
      html += data.journal_link
        ? '<a class="card__slide-journal" href="' + data.journal_link +
          '" target="_blank" rel="noopener">' + data.journal + '</a>'
        : '<span class="card__slide-journal">' + data.journal + '</span>';
    }
    if (data.description) html += '<p class="card__slide-desc">' + data.description + '</p>';
    if (data.body_html)   html += '<div class="card__slide-desc">' + data.body_html + '</div>';

    if (data.extra && data.extra.length) {
      html += '<dl class="card__slide-credits">' +
        data.extra.map(function (f) {
          return '<div class="card__slide-credit">' +
                 '<dt>' + f.label + ':</dt><dd>' + f.value + '</dd>' +
                 '</div>';
        }).join('') +
      '</dl>';
    }

    /* One pending swap at a time. A swipe can ask for several in quick
       succession, and without this each queues its own timer — the pane then
       rewrites itself two or three times and the card's height jumps with
       every rewrite. */
    window.clearTimeout(swapTimer);
    textPane.classList.add('is-swapping');
    swapTimer = window.setTimeout(function () {
      textPane.innerHTML = html;
      textPane.classList.remove('is-swapping');
    }, 140);
  }

  function setVideoState() {
    slides.forEach(function (slide, i) {
      var video = slide.querySelector('video');
      if (!video) return;
      var active = i === index;
      video.dataset.active = active ? 'true' : 'false';
      if (active) {
        video.play().catch(function () { /* autoplay refused */ });
      } else {
        video.pause();
      }
    });
  }

  /* Step forward or back with wrap-around, so the gallery is a loop rather
     than a strip with two dead ends: right on the last slide lands on the
     first, left on the first lands on the last. Negative input is handled
     by the double modulo — JS's % keeps the sign of the left operand. */
  function step(delta) {
    var len = slides.length;
    return ((index + delta) % len + len) % len;
  }

  function go(n, scroll) {
    index = Math.max(0, Math.min(slides.length - 1, n));

    slides.forEach(function (s, i) {
      s.classList.toggle('is-active', i === index);
      s.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    });

    dots.forEach(function (d, i) {
      d.classList.toggle('is-active', i === index);
      d.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });

    if (counter) counter.textContent = (index + 1) + ' / ' + slides.length;

    window.LazyMedia.hydrateWithin(slides[index]);
    renderText(slides[index]);
    setVideoState();

    if (scroll && isMobile()) {
      slidesWrap.scrollTo({ left: slides[index].offsetLeft, behavior: 'smooth' });
    }
  }

  /* --- desktop: click anywhere on the media advances ---------------- */

  media.addEventListener('click', function (event) {
    if (isMobile()) return;
    if (event.target.closest('button')) return;
    dismissHints();
    go(step(1));
  });

  /* The arrows used to disable themselves at each end. Now that they wrap
     they are never dead, so the disabled state is gone with them. */
  if (prev) prev.addEventListener('click', function () { dismissHints(); go(step(-1)); });
  if (next) next.addEventListener('click', function () { dismissHints(); go(step(1)); });

  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () { dismissHints(); go(i, true); });
  });

  /* --- keyboard ----------------------------------------------------- */

  media.setAttribute('tabindex', '0');
  media.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowRight') { event.preventDefault(); dismissHints(); go(step(1), true); }
    if (event.key === 'ArrowLeft')  { event.preventDefault(); dismissHints(); go(step(-1), true); }
  });

  /* --- mobile: follow native scroll-snap ---------------------------- */

  /* Slides load one at a time, so a swipe would otherwise drag an empty
     frame into view and only fill it once the scroll settled. Hydrating
     whatever overlaps the strip's viewport during the drag keeps the
     saving (nothing off-screen loads) without the blank frame. */
  function hydrateVisibleSlides() {
    var left = slidesWrap.scrollLeft;
    var right = left + slidesWrap.clientWidth;
    slides.forEach(function (s) {
      if (s.offsetLeft < right && s.offsetLeft + s.offsetWidth > left) {
        window.LazyMedia.hydrateWithin(s);
      }
    });
  }

  /* The caption and dots follow the finger, not the snap: once the drag
     passes 15% of a slide width the text and dot switch, so the new image
     never sits against the old caption.

     Measured against `anchor` — the slide the drag started from — rather
     than against the live index. Measuring against the index is unstable:
     switching the index moves the goalposts, the same scroll position then
     reads as a drag back the other way, and the pane flips between the two
     captions on every scroll event, resizing the card each time. The anchor
     only moves once the scroll has actually come to rest on a slide. */
  var LEAD = 0.15;
  var AT_REST = 0.02;
  var anchor = 0;

  /* Dismissal hangs off this handler and nothing earlier. It fires the moment
     the strip itself starts moving sideways, which is the start of a swipe —
     but scrolling the page vertically never moves the strip, so reading down
     the page with a finger resting on a card leaves the hints alone. Watching
     pointerdown instead was the bug: any touch on the media counted, and a
     downward flick cleared every hint on the page. */
  slidesWrap.addEventListener('scroll', function () {
    if (!isMobile()) return;
    hydrateVisibleSlides();
    dismissHints();

    var width = slidesWrap.clientWidth;
    if (!width) return;

    var pos = slidesWrap.scrollLeft / width;

    if (Math.abs(pos - Math.round(pos)) < AT_REST) {
      anchor = Math.max(0, Math.min(slides.length - 1, Math.round(pos)));
    }

    var target = anchor;
    if (pos > anchor + LEAD)      target = Math.min(slides.length - 1, anchor + 1);
    else if (pos < anchor - LEAD) target = Math.max(0, anchor - 1);

    if (target !== index) go(target);
  }, { passive: true });

  go(0);
};

})();
