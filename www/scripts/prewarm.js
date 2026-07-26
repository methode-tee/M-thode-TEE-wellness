/* Méthode Tee — background page prewarmer
   Prépare les rubriques principales après l'affichage de l'accueil.
   Aucun placeholder, aucune animation, aucune modification visuelle. */
(function () {
  'use strict';

  if (window.top !== window.self) return;
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (file !== 'index.html' && file !== '') return;

  const TARGETS = [
    'protocols.html?category=pharmacie_vegetale&mt_preheat=1',
    'protocols.html?category=objectifs_corps&mt_preheat=1',
    'page.html?slug=recettes&mt_preheat=1',
    'library.html?mt_preheat=1'
  ];
  const STATIC_ASSETS = [
    'styles/style.css',
    'scripts/app.js',
    'scripts/v18-premium.js',
    'scripts/v14-luxe.js',
    'config.js',
    'data.js',
    'supabaseClient.js'
  ];

  let running = false;
  let rerunTimer = 0;
  const warmedAtKey = 'mt_pages_prewarmed_at_v224';
  const MIN_REFRESH_MS = 4 * 60 * 1000;

  function idle(callback, timeout) {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(callback, { timeout: timeout || 1800 });
    } else {
      setTimeout(callback, 450);
    }
  }

  function absolute(url) {
    try { return new URL(url, location.href).href; } catch (_) { return url; }
  }

  function fetchWarm(url) {
    return fetch(absolute(url), {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'force-cache',
      priority: 'low'
    }).catch(function () {});
  }

  function warmStaticAssets() {
    STATIC_ASSETS.forEach(fetchWarm);
    TARGETS.forEach(fetchWarm);
  }

  function preloadRealImages(doc) {
    if (!doc) return;
    const urls = [];
    doc.querySelectorAll('img[src]').forEach(function (img) {
      const src = img.currentSrc || img.src;
      if (src && !urls.includes(src)) urls.push(src);
    });
    urls.slice(0, 5).forEach(function (src, index) {
      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      if (index < 2) image.fetchPriority = 'high';
      image.src = src;
      if (image.decode) image.decode().catch(function () {});
    });
  }

  function pageLooksReady(doc, targetUrl) {
    if (!doc || !doc.body) return false;
    if (targetUrl.indexOf('library.html') !== -1) {
      const page = doc.getElementById('libraryPage');
      return !!(page && (page.dataset.mtRendered === '1' || page.querySelector('.library-category,.biblio-smart-shelves,.empty-card')));
    }
    if (targetUrl.indexOf('protocols.html') !== -1) {
      const grid = doc.getElementById('protocolGrid');
      return !!(grid && grid.querySelector('.protocol-card,.empty-card'));
    }
    if (targetUrl.indexOf('slug=recettes') !== -1) {
      return !!doc.querySelector('#recipeMarketGrid .recipe-card, #recipeMarketGrid .empty-card, .recipe-market-grid .recipe-card');
    }
    return doc.readyState === 'complete';
  }

  function warmOnePage(targetUrl) {
    return new Promise(function (resolve) {
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('tabindex', '-1');
      frame.title = '';
      frame.style.cssText = 'position:fixed!important;width:1px!important;height:1px!important;left:-10000px!important;top:-10000px!important;opacity:0!important;pointer-events:none!important;border:0!important;';

      let finished = false;
      let poll = 0;
      const finish = function () {
        if (finished) return;
        finished = true;
        clearInterval(poll);
        try { preloadRealImages(frame.contentDocument); } catch (_) {}
        setTimeout(function () {
          try { frame.remove(); } catch (_) {}
          resolve();
        }, 250);
      };

      const hardTimeout = setTimeout(finish, 9000);
      frame.onload = function () {
        let checks = 0;
        poll = setInterval(function () {
          checks += 1;
          try {
            const doc = frame.contentDocument;
            preloadRealImages(doc);
            if (pageLooksReady(doc, targetUrl) || checks >= 24) {
              clearTimeout(hardTimeout);
              finish();
            }
          } catch (_) {
            if (checks >= 24) {
              clearTimeout(hardTimeout);
              finish();
            }
          }
        }, 250);
      };
      frame.src = targetUrl;
      document.body.appendChild(frame);
    });
  }

  async function runPrewarm(force) {
    if (running || !navigator.onLine) return;
    const last = Number(sessionStorage.getItem(warmedAtKey) || 0);
    if (!force && last && Date.now() - last < MIN_REFRESH_MS) return;

    running = true;
    warmStaticAssets();
    try {
      for (const target of TARGETS) {
        await warmOnePage(target);
        await new Promise(function (r) { setTimeout(r, 120); });
      }
      sessionStorage.setItem(warmedAtKey, String(Date.now()));
      window.dispatchEvent(new CustomEvent('mt:pages-prewarmed'));
    } catch (_) {
      // Le préchauffage ne doit jamais bloquer l'app principale.
    } finally {
      running = false;
    }
  }

  function schedule(force, delay) {
    clearTimeout(rerunTimer);
    rerunTimer = setTimeout(function () {
      idle(function () { runPrewarm(!!force); }, 1600);
    }, delay == null ? 700 : delay);
  }

  document.addEventListener('DOMContentLoaded', function () {
    // L'accueil est prioritaire. Les autres rubriques démarrent ensuite en arrière-plan.
    schedule(false, 850);
  });

  window.addEventListener('online', function () {
    // Après un passage Wi-Fi/4G, rafraîchit les caches sans vider l'affichage courant.
    schedule(true, 900);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') schedule(false, 1200);
  });

  window.mtPrewarmMainPages = function () { schedule(true, 0); };
})();
