// Service Worker for Push Notifications and Caching
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

// Helper to update badge count
async function updateBadgeCount() {
  if ('setAppBadge' in navigator) {
    try {
      // Get all visible notifications to count them
      const notifications = await self.registration.getNotifications();
      const count = notifications.length;
      
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
    } catch (error) {
      console.error('Error updating badge:', error);
    }
  }
}

// Push notification received
self.addEventListener('push', (event) => {
  console.log('Push notification received', event);
  
  let data = {
    title: 'Almost Adult',
    body: 'You have a notification',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: 'default',
    data: { url: '/' }
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/logo.png',
    badge: data.badge || '/logo.png',
    tag: data.tag || Date.now().toString(), // Unique tag to count multiple notifications
    data: data.data || { url: '/' },
    vibrate: [200, 100, 200],
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => updateBadgeCount())
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked', event);
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window if not
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
      .then(() => updateBadgeCount())
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed', event);
  event.waitUntil(updateBadgeCount());
});
