// Service Worker for BioCoach PWA (Network-First for fresh telemetry & instant updates)
const CACHE_NAME = 'biocoach-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Never intercept or cache external APIs (Supabase, Gemini, CDNs) or local /api/
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) {
    return;
  }

  // Network-First with Cache Fallback so iPhone/Safari ALWAYS gets the latest deployed app
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return networkRes;
      })
      .catch(() => caches.match(req))
  );
});
