/**
 * The service worker, served at /sw.js. Its only job is notifications:
 * show the push it receives, and open the Live screen when it is tapped.
 * (It has no fetch handler, so it never caches or changes how the app loads.)
 */
const SW = `
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(d.title || 'Anjung Live', {
      body: d.body || '',
      icon: '/apple-icon.png',
      badge: '/icon.png',
      tag: 'anjung-live',
      renotify: true,
      data: { url: d.url || '/live' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/live';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          if ('navigate' in c) c.navigate(url).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
`;

export const dynamic = 'force-static';

export function GET() {
  return new Response(SW, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    },
  });
}
