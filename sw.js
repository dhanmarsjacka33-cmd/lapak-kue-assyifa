/**
 * Kue As-Syifa POS — Service Worker v1.0
 *
 * Strategi caching:
 *  - HTML/JS/CSS: network-first (selalu ambil terbaru, fallback ke cache saat offline)
 *  - Icons/images: cache-first (jarang berubah, ambil cepat)
 *  - API Apps Script: TIDAK di-cache (harus selalu fresh)
 */

const CACHE_VERSION = 'kueassyifa-v1';
const CACHE_STATIC = CACHE_VERSION + '-static';
const CACHE_DYNAMIC = CACHE_VERSION + '-dynamic';

// Aset yang di-precache saat install
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles.css?v=6.0',
  './app.js?v=6.0',
  './config.js'
];

// ============================================
//  INSTALL — precache aset statis
// ============================================
self.addEventListener('install', event => {
  console.log('[SW] Install:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => Promise.all(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Skip cache:', url, err.message))
        )
      ))
      .then(() => self.skipWaiting())
  );
});

// ============================================
//  ACTIVATE — bersihkan cache lama
// ============================================
self.addEventListener('activate', event => {
  console.log('[SW] Activate:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => {
            console.log('[SW] Hapus cache lama:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================
//  FETCH — strategi per jenis resource
// ============================================
self.addEventListener('fetch', event => {
  const req = event.request;

  // Hanya handle GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. JANGAN cache request ke Apps Script / Google APIs
  if (url.hostname.includes('script.google.com') ||
      url.hostname.includes('googleusercontent.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    return; // biarkan browser handle normal
  }

  // 2. JANGAN cache CDN eksternal (Chart.js, dll)
  if (url.hostname.includes('jsdelivr.net') ||
      url.hostname.includes('cdnjs.com') ||
      url.hostname.includes('unpkg.com')) {
    // Cache-first untuk CDN (jarang berubah)
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_DYNAMIC).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached))
    );
    return;
  }

  // 3. Hanya handle request dari origin sendiri
  if (url.origin !== self.location.origin) return;

  // 4. HTML/JS/CSS: network-first
  const isHTMLOrJS = /\.(?:html|js|css)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (isHTMLOrJS) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_STATIC).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          // Offline: coba ambil dari cache, fallback ke index.html
          return caches.match(req).then(cached => {
            if (cached) return cached;
            return caches.match('./index.html');
          });
        })
    );
    return;
  }

  // 5. Icons, images, fonts: cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_DYNAMIC).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// ============================================
//  MESSAGE — komunikasi dengan halaman
// ============================================
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'GET_VERSION') event.ports[0].postMessage(CACHE_VERSION);
});