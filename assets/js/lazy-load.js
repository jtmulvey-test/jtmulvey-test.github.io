/* ------------------------------------------------------------------
   lazy-load.js
   Media carries data-src instead of src. Nothing is fetched until the
   card scrolls near the viewport, and even then only the slide actually
   on show is fetched — the rest wait until the visitor navigates to
   them. With three multi-megabyte videos per card, loading a whole card
   up front costs roughly three times what the visitor is looking at.
   Video additionally only plays while it is the active slide AND on
   screen.
   ------------------------------------------------------------------ */

window.LazyMedia = (function () {

  var ROOT_MARGIN = '400px 0px';

  /* ----------------------------------------------------------------
     Per-slide loading wheel.

     A slide's media pane is solid black until the first frame decodes, so
     a multi-megabyte video swiped into view on a slow connection shows a
     black rectangle with nothing to say whether it is loading or broken.
     One second after hydration starts, if the media still has no frame to
     show, the slide gets .is-loading and cards.css spins a wheel over it.

     One second, rather than immediately, for the same reason as the
     research page's wheel: most slides arrive fast enough that a spinner
     would flash and vanish, which reads as a glitch rather than as
     feedback.
     ---------------------------------------------------------------- */

  var SPINNER_DELAY = 1000;

  /* "Has something to paint" — a decoded image, or enough video for a
     first frame. readyState 2 is HAVE_CURRENT_DATA, which is exactly the
     point the black rectangle becomes a picture. */
  function hasFrame(el) {
    return el.tagName === 'VIDEO'
      ? el.readyState >= 2
      : (el.complete && el.naturalWidth > 0);
  }

  function watchLoading(el) {
    var host = el.closest && el.closest('.card__slide');
    if (!host) return;

    var timer = null;

    function start() {
      if (timer || hasFrame(el)) return;
      timer = window.setTimeout(function () {
        timer = null;
        if (!hasFrame(el)) host.classList.add('is-loading');
      }, SPINNER_DELAY);
    }

    /* Also the failure path: a wheel spinning forever over a file that
       404'd is worse than the bare black pane it replaced. */
    function stop() {
      if (timer) { window.clearTimeout(timer); timer = null; }
      host.classList.remove('is-loading');
    }

    if (el.tagName === 'VIDEO') {
      /* preload="none" is the whole point of this file — the browser
         fetches nothing until playback is requested. So hydration is NOT
         when loading starts, play() is, and timing from hydration would
         put a wheel on every slide sitting quietly in the strip.

         'pause' stops the clock because card-gallery.js pauses whatever
         is no longer the active slide: if it is not on screen it does not
         need a wheel. Swiping back fires 'play' and starts it again. */
      el.addEventListener('play', start);
      ['loadeddata', 'error', 'abort', 'pause'].forEach(function (name) {
        el.addEventListener(name, stop);
      });
      if (!el.paused) start();
    } else {
      /* An image begins fetching the moment src is set. */
      ['load', 'error'].forEach(function (name) { el.addEventListener(name, stop); });
      start();
    }
  }

  function hydrate(el) {
    if (el.dataset.src) {
      if (el.tagName === 'VIDEO') {
        var source = document.createElement('source');
        source.src = el.dataset.src;
        source.type = el.dataset.mime || '';
        el.appendChild(source);
        el.load();
      } else {
        el.src = el.dataset.src;
      }
      delete el.dataset.src;
      watchLoading(el);
    }
  }

  function hydrateAll(el) {
    el.querySelectorAll('[data-src]').forEach(hydrate);
  }

  /* Only the slide currently on show. Anything in the media pane that
     isn't part of the slide strip (a placeholder, say) still loads. */
  function hydrateShown(card) {
    var active = card.querySelector('.card__slide.is-active');
    if (!active) { hydrateAll(card); return; }
    hydrateAll(active);
    card.querySelectorAll('.card__media > [data-src]').forEach(hydrate);
  }

  /* Load the shown slide once its card approaches the viewport. */
  var loader = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          hydrateShown(entry.target);
          loader.unobserve(entry.target);
        });
      }, { rootMargin: ROOT_MARGIN })
    : null;

  /* Pause video that scrolls off screen; resume if it is still active. */
  var player = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var video = entry.target;
          if (entry.isIntersecting && video.dataset.active === 'true') {
            video.play().catch(function () { /* autoplay refused, fine */ });
          } else {
            video.pause();
          }
        });
      }, { threshold: 0.25 })
    : null;

  return {
    /* Call once per card element after it is in the DOM. */
    observe: function (card) {
      if (loader) {
        loader.observe(card);
      } else {
        hydrateShown(card);
      }
      if (player) {
        card.querySelectorAll('video').forEach(function (v) {
          player.observe(v);
        });
      }
    },

    /* Force-load a specific slide's media (used when a user jumps ahead). */
    hydrateWithin: function (el) {
      el.querySelectorAll('[data-src]').forEach(hydrate);
    }
  };
})();
