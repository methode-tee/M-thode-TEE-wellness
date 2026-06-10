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
  const options = {
    body: data.body || 'Le corps aime la régularité ✨ Ton rituel t’attend.',
    icon: data.icon || '/assets/app-icon-192.png',
    badge: data.badge || '/assets/app-icon-192.png',
    data: {
      url: data.url || '/protocols.html'
    },
    vibrate: [80, 40, 80],
    tag: data.tag || 'methode-tee-rituel',
    renotify: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification?.data?.url || '/protocols.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
