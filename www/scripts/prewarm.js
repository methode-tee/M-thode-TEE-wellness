/* Méthode Tee — préchargement prioritaire depuis l'accueil
   - Affiche d'abord l'accueil sans concurrence lourde.
   - Prépare ensuite au maximum deux rubriques simultanément.
   - Recettes et Pharmacopée sont prioritaires.
   - Les iframes sont retirées dès que leur contenu réel est prêt.
   - Aucun droit commercial n'est créé : les pages exécutent leur logique normale. */
(function () {
  'use strict';

  if (window.top !== window.self) return;
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (file !== 'index.html' && file !== '') return;

  const LANES = [
    [
      'page.html?slug=recettes&mt_preheat=1',
      'dashboard.html?mt_preheat=1'
    ],
    [
      'protocols.html?category=pharmacie_vegetale&mt_preheat=1',
      'protocols.html?category=objectifs_corps&mt_preheat=1',
      'library.html?mt_preheat=1'
    ]
  ];

  const STATIC_ASSETS = [
    'page.html',
    'protocols.html',
    'dashboard.html',
    'library.html',
    'styles/style.css',
    'scripts/app.js',
    'scripts/v18-premium.js',
    'config.js',
    'data.js',
    'supabaseClient.js'
  ];

  const warmedAtKey = 'mt_pages_prewarmed_at_v276';
  const MIN_REFRESH_MS = 4 * 60 * 1000;
  let running = false;
  let startTimer = 0;

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
  }

  function preloadFirstImages(doc) {
    if (!doc) return;
    const urls = [];
    doc.querySelectorAll('img[src]').forEach(function (img) {
      const src = img.currentSrc || img.src;
      if (src && !urls.includes(src)) urls.push(src);
    });
    urls.slice(0, 3).forEach(function (src, index) {
      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.fetchPriority = index === 0 ? 'high' : 'low';
      image.src = src;
    });
  }

  function pageLooksReady(doc, targetUrl) {
    if (!doc || !doc.body) return false;

    if (targetUrl.indexOf('slug=recettes') !== -1) {
      const grid = doc.getElementById('recipeMarketGrid');
      return !!(grid && grid.querySelector('.recipe-market-card,.empty-card'));
    }

    if (targetUrl.indexOf('protocols.html') !== -1) {
      const grid = doc.getElementById('protocolGrid');
      return !!(grid && grid.querySelector('.protocol-card,.empty-card'));
    }

    if (targetUrl.indexOf('dashboard.html') !== -1) {
      const summary = doc.getElementById('dashboardSummary');
      return !!(summary && (summary.children.length || summary.textContent.trim()));
    }

    if (targetUrl.indexOf('library.html') !== -1) {
      const page = doc.getElementById('libraryPage');
      return !!(page && (
        page.dataset.mtRendered === '1' ||
        page.querySelector('.library-category,.biblio-smart-shelves,.empty-card')
      ));
    }

    return doc.readyState === 'complete';
  }

  function warmOnePage(targetUrl) {
    return new Promise(function (resolve) {
      if (!navigator.onLine) return resolve();

      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('tabindex', '-1');
      frame.title = '';
      frame.style.cssText = [
        'position:fixed!important',
        'width:1px!important',
        'height:1px!important',
        'left:-10000px!important',
        'top:-10000px!important',
        'opacity:0!important',
        'pointer-events:none!important',
        'border:0!important'
      ].join(';');

      let finished = false;
      let poll = 0;
      let hardTimeout = 0;

      function finish() {
        if (finished) return;
        finished = true;
        clearInterval(poll);
        clearTimeout(hardTimeout);
        try { preloadFirstImages(frame.contentDocument); } catch (_) {}
        setTimeout(function () {
          try { frame.remove(); } catch (_) {}
          resolve();
        }, 120);
      }

      hardTimeout = setTimeout(finish, 7000);
      frame.onload = function () {
        let checks = 0;
        poll = setInterval(function () {
          checks += 1;
          try {
            const doc = frame.contentDocument;
            if (pageLooksReady(doc, targetUrl) || checks >= 28) finish();
          } catch (_) {
            if (checks >= 28) finish();
          }
        }, 200);
      };

      frame.src = targetUrl;
      document.body.appendChild(frame);
    });
  }

  async function runLane(targets) {
    for (const target of targets) {
      await warmOnePage(target);
      await new Promise(function (resolve) { setTimeout(resolve, 80); });
    }
  }

  async function runPrewarm(force) {
    if (running || !navigator.onLine) return;
    const last = Number(sessionStorage.getItem(warmedAtKey) || 0);
    if (!force && last && Date.now() - last < MIN_REFRESH_MS) return;

    running = true;
    warmStaticAssets();

    try {
      await Promise.all(LANES.map(runLane));
      sessionStorage.setItem(warmedAtKey, String(Date.now()));
      window.dispatchEvent(new CustomEvent('mt:pages-prewarmed'));
    } catch (_) {
      // Le préchargement ne doit jamais interrompre l'accueil.
    } finally {
      running = false;
    }
  }

  function schedule(force, delay) {
    clearTimeout(startTimer);
    startTimer = setTimeout(function () {
      runPrewarm(!!force);
    }, delay == null ? 180 : delay);
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Deux peintures garantissent que l'accueil a été présenté avant les iframes.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        schedule(false, 120);
      });
    });
  });

  window.addEventListener('online', function () {
    schedule(true, 500);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') schedule(false, 800);
  });

  window.mtPrewarmMainPages = function () {
    schedule(true, 0);
  };
})();
