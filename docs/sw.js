const VERSION = '43ccb9e940';
const CACHE = 'can-tracker-' + VERSION;
const FILES = ["./","./apple-touch-icon.png","./assets/index-BowlvsMx.js","./assets/index-CE1VG0Oo.css","./assets/reader-Bc_vmJBa.js","./icon-192.png","./icon-512.png","./index.html","./manifest.webmanifest","./zxing_reader.wasm"];

self.addEventListener('install', (e) => {
  // Do NOT skipWaiting: the page asks the user before swapping versions.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('can-tracker-') && k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  if (e.data === 'version') e.source && e.source.postMessage({ version: VERSION });
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // never cache OFF / GitHub API
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    })
  );
});
