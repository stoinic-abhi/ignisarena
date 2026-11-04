// sw.js — Ignis Arena Background Service Worker (Native Mobile Status Bar Alert & Vibration Dispatcher)

const CACHE_NAME = 'ignis-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Listener for In-App and Background System Notifications
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_SYSTEM_NOTIFICATION') {
    const payload = event.data.payload || {};
    const title = payload.title || 'Ignis Arena Esports';
    const options = {
      body: payload.body || 'New match update available.',
      icon: 'logo.png',
      badge: 'logo.png',
      tag: payload.tag || 'ignis-tag-' + Date.now(),
      vibrate: [250, 100, 250],
      requireInteraction: true,
      data: {
        url: payload.url || './'
      }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// Notification Click Handler: Opens/Focuses the App
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
