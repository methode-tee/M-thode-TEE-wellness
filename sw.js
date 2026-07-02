/* Méthode Tee — Service Worker PWA Push SAFE */
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  event.respondWith(fetch(event.request));
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}

  const title = data.title || 'Méthode Tee';
  const targetUrl = data.url || '/index.html';
  const options = {
    body: data.body || 'Le corps aime la régularité ✨ Ton rituel t’attend.',
    icon: data.icon || '/assets/app-icon-192.png',
    badge: data.badge || '/assets/app-icon-192.png',
    data: { url: targetUrl },
    vibrate: [80, 40, 80],
    tag: data.tag || 'methode-tee-rituel',
    renotify: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const rawUrl = event.notification?.data?.url || '/index.html';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clientList => {
      // Priorité : réutiliser une fenêtre Méthode Tee déjà ouverte.
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin && 'focus' in client) {
            if ('navigate' in client) await client.navigate(targetUrl);
            return client.focus();
          }
        } catch (_) {}
      }

      // Sinon ouvrir directement la bonne page/section.
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
