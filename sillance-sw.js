/* ============================================================
   Sillance — service worker : notification du matin (Web Push)
   ------------------------------------------------------------
   Reçoit le push envoyé par l'edge function morning-digest
   (séances du jour + matériel + nutrition) et l'affiche même
   quand le site est fermé. Un clic ouvre l'app.
   ============================================================ */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); }
  catch { d = { title: 'Sillance', body: (e.data && e.data.text()) || '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Sillance', {
    body: d.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: 'sillance-digest',
    data: { url: d.url || './sillance-app.html' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ws) => {
    for (const w of ws) { if ('focus' in w) return w.focus(); }
    return self.clients.openWindow(e.notification.data?.url || './');
  }));
});
