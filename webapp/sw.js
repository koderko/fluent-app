// Service Worker — cache shell, network-first for API.
const CACHE = 'devenglish-v6';
const ASSETS = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './storage.js',
  './srs.js',
  './speech.js',
  './openai.js',
  './tenses-explain.js',
  './wordlist.json',
  './manifest.webmanifest',
  './icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Never cache API calls.
  if (url.hostname === 'api.openai.com') return;
  if (e.request.method !== 'GET') return;
  // Network-first for same-origin so deploys reach the browser quickly;
  // fall back to cache when offline.
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        if (resp.ok && url.origin === self.location.origin) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return resp;
      })
      .catch(() => caches.match(e.request))
  );
});
