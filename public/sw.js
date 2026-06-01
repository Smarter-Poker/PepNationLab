// Pep Nation Lab service worker - web push receiver + install handler.
// CACHE_VERSION is informational (we cache no responses). Bump it to force a
// fresh activate when this file changes so devices pick up new push behavior.
const CACHE_VERSION = 'pnl-sw-v2';

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
    // Re-alert (sound + vibrate) even if a notification with the same tag is
    // already showing — important for back-to-back messages.
    renotify: data.renotify === undefined ? true : !!data.renotify,
    // Never silent: iOS plays the system notification sound, Android plays the
    // channel sound, for any non-silent notification.
    silent: false,
    // Vibration pattern = haptics on Android (ignored on iOS, which uses the
    // system haptic). Always provide a default so every push buzzes.
    vibrate: Array.isArray(data.vibrate) && data.vibrate.length ? data.vibrate : [120, 60, 120],
    // Keep call notifications on-screen until the user acts.
    requireInteraction: !!data.requireInteraction,
    // Action buttons (e.g. Accept / Decline for a call) when provided.
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 2) : undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // A "decline" action button just dismisses — do not open the app.
  if (event.action === 'decline') return;

  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        // Focus an existing window/tab and route it to the target url.
        if ('focus' in c) {
          c.focus();
          if ('navigate' in c && url && !c.url.includes(url)) {
            try { c.navigate(url); } catch (_) { /* navigate not always allowed */ }
          }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
