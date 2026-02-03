// Service Worker for Push Notifications
const CACHE_NAME = 'almost-adult-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
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
