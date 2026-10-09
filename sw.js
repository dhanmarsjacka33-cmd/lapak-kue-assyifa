/* Kue As-Syifa POS — Service Worker v2 */
const CACHE_VERSION = 'kueassyifa-v2';
const CACHE_STATIC = CACHE_VERSION + '-static';
const CACHE_DYNAMIC = CACHE_VERSION + '-dynamic';

const STATIC_ASSETS = [
  './', './index.html', './manifest.json',
  './styles.css?v=6.1', './app.js?v=6.1', './config.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_STATIC)
      .then(c => Promise.all(STATIC_ASSETS.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Skip: Apps Script & Google APIs
  if (/script\.google\.com|googleusercontent\.com|googleapis\.com|gstatic\.com/.test(url.hostname)) return;

  // CDN: cache-first
  if (/jsdelivr\.net|cdnjs\.com|unpkg\.com/.test(url.hostname)) {
    e.respondWith(caches.match(req).then(c => c || fetch(req).then(r => {
      if (r && r.status === 200) caches.open(CACHE_DYNAMIC).then(cc => cc.put(req, r.clone()));
      return r;
    })));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // HTML/JS/CSS: network-first
  if (/\.(?:html|js|css)$/.test(url.pathname) || url.pathname.endsWith('/')) {
    e.respondWith(
      fetch(req).then(r => {
        if (r && r.status === 200) caches.open(CACHE_STATIC).then(c => c.put(req, r.clone()));
        return r;
      }).catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // Icons/images: cache-first
  e.respondWith(caches.match(req).then(c => c || fetch(req).then(r => {
    if (r && r.status === 200 && r.type === 'basic') caches.open(CACHE_DYNAMIC).then(cc => cc.put(req, r.clone()));
    return r;
  }).catch(() => c)));
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});