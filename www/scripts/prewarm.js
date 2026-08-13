/* Méthode Tee — préchauffage léger.
   Ne charge jamais une page privée, une image distante ou une requête Supabase
   en arrière-plan : seuls quelques fichiers statiques déjà publics sont préparés. */
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
  const warmedKey = 'mt_static_assets_prewarmed_v329';

  function idle(callback) {
    if ('requestIdleCallback' in window) requestIdleCallback(callback, { timeout: 1800 });
    else setTimeout(callback, 650);
  }

  function warmStaticAssets() {
    if (!navigator.onLine) return;
    try {
      if (sessionStorage.getItem(warmedKey) === '1') return;
      sessionStorage.setItem(warmedKey, '1');
    } catch (_) {}

    STATIC_ASSETS.forEach(function (url) {
      fetch(new URL(url, location.href).href, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'force-cache',
        priority: 'low'
      }).catch(function () {});
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    idle(warmStaticAssets);
  }, { once: true });

  // Compatibilité : l'ancien appel public reste disponible, sans charger de page.
  window.mtPrewarmMainPages = warmStaticAssets;
})();
