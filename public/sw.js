// Pep Nation Lab service worker - web push receiver + install handler.
// Bumping CACHE_VERSION here would force a fresh activate; we do not cache
// any responses today, so version is purely informational.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch (_) {
    data = { title: 'Pep Nation Lab', body: event.data.text() };
  }
  const title = data.title || 'Pep Nation Lab';
  const options = {
    body: data.body || '',
    icon: data.icon || '/logo-mark.svg',
    badge: data.badge || '/logo-mark.svg',
    data: { url: data.url || '/' },
    tag: data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      for (const c of clients) {
        if (c.url.includes(url) && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
