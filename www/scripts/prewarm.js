/* Méthode Tee — préchauffage léger
   Prépare uniquement les petits fichiers statiques après l'affichage de l'accueil.
   Aucun iframe, aucune page catalogue et aucune image distante ne sont téléchargés en arrière-plan. */
(function () {
  'use strict';

  if (window.top !== window.self) return;
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (file !== 'index.html' && file !== '') return;

  const STATIC_ASSETS = [
    'styles/style.css',
    'scripts/app.js',
    'scripts/v18-premium.js',
    'scripts/v14-luxe.js',
    'config.js',
    'data.js',
    'supabaseClient.js'
  ];

  let timer = 0;
  const warmedAtKey = 'mt_static_prewarmed_at_v258_perf1';
  const MIN_REFRESH_MS = 10 * 60 * 1000;

  function warmStaticAssets() {
    const last = Number(sessionStorage.getItem(warmedAtKey) || 0);
    if (last && Date.now() - last < MIN_REFRESH_MS) return;
    STATIC_ASSETS.forEach(function (url) {
      fetch(new URL(url, location.href).href, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'force-cache',
        priority: 'low'
      }).catch(function () {});
    });
    sessionStorage.setItem(warmedAtKey, String(Date.now()));
  }

  function schedule(delay) {
    clearTimeout(timer);
    timer = setTimeout(function () {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(warmStaticAssets, { timeout: 2500 });
      } else {
        setTimeout(warmStaticAssets, 800);
      }
    }, delay == null ? 1400 : delay);
  }

  document.addEventListener('DOMContentLoaded', function () { schedule(1400); });
  window.addEventListener('online', function () { schedule(1800); }, { passive: true });
  window.mtPrewarmMainPages = function () { schedule(0); };
})();
