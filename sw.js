const CACHE_NAME='methode-tee-v63';
const ASSETS=['./','./index.html','./auth.html','./protocols.html','./protocol.html','./library.html','./profile.html','./admin.html','./style.css','./config.js','./data.js','./supabaseClient.js','./app.js','./manifest.json','./brand-logo.png','./app-icon-192.png','./app-icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim())});
self.addEventListener('fetch',event=>{event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))});
