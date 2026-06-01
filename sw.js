const CACHE_NAME = 'methode-tee-v5-core';
const ASSETS = [
  './',
  './landing.html',
  './auth.html',
  './index.html',
  './onboarding.html',
  './catalogue.html',
  './guide.html',
  './admin.html',
  './profile.html',
  './style.css',
  './config.js',
  './data.js',
  './supabaseClient.js',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
