const CACHE_NAME = 'ignis-arena-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: '🔥 IGNIS ARENA', body: 'New tournament update available!', url: './' };
  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }
  const options = {
    body: data.body,
    icon: 'logo.png',
    badge: 'logo.png',
    vibrate: [250, 100, 250, 100, 300],
    tag: data.tag || 'ignis-broadcast-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_SYSTEM_NOTIFICATION') {
    const { title, body, tag, url } = event.data.payload;
    const options = {
      body: body || '',
      icon: 'logo.png',
      badge: 'logo.png',
      vibrate: [250, 100, 250, 100, 300],
      tag: tag || 'ignis-alert-' + Date.now(),
      renotify: true,
      requireInteraction: true,
      data: { url: url || './' }
    };
    event.waitUntil(self.registration.showNotification(title || '🔥 IGNIS ARENA', options));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
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
