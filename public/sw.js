// Service Worker for Caching (PWA offline support)
const CACHE_VERSION = 'v' + Date.now(); // Auto-versioned cache
const CACHE_NAME = 'almost-adult-' + CACHE_VERSION;
const CRITICAL_ASSETS = [
  '/',
  '/manifest.json'
];

// Install event - cache critical assets and activate immediately
self.addEventListener('install', (event) => {
  console.log('Service Worker installing:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CRITICAL_ASSETS))
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Activate event - clean up old caches and take control immediately
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating:', CACHE_NAME);
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.startsWith('almost-adult-') && name !== CACHE_NAME)
            .map(name => {
              console.log('Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => clients.claim()) // Take control immediately
  );
});

// Fetch event - Network-first for HTML, cache-first for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and API calls
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first strategy for HTML/documents
  if (request.headers.get('accept')?.includes('text/html') || url.pathname === '/') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the fresh response
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(request)) // Fallback to cache if offline
    );
    return;
  }

  // Cache-first strategy for static assets
  event.respondWith(
    caches.match(request)
      .then(cached => {
        if (cached) {
          // Return cached and update in background
          fetch(request).then(response => {
            if (response.ok) {
              caches.open(CACHE_NAME).then(cache => cache.put(request, response));
            }
          }).catch(() => {});
          return cached;
        }
        // Fetch and cache if not in cache
        return fetch(request).then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
          }
          return response;
        });
      })
  );
});
