/* ============================================================
   Sillance — service worker : notifications (Web Push) + offline
   ------------------------------------------------------------
   Reçoit le push envoyé par l'edge function morning-digest
   (séances du jour + matériel + nutrition) et l'affiche même
   quand le site est fermé. Un clic ouvre l'app.

   Cache offline (audit 03/08/2026) : le manifest annonce
   "display: standalone" (app installable) mais rien n'était mis en
   cache — une install sans réseau échouait entièrement. Stratégie
   network-first, cache en secours UNIQUEMENT si le réseau échoue
   (jamais l'inverse) : le contenu servi est toujours le plus frais
   possible tant qu'il y a du réseau, la fraîcheur du cache ne compte
   donc que dans le cas rare "vraiment hors-ligne", où une version
   un peu ancienne vaut mieux qu'un échec total. Seules les requêtes
   même-origine sont concernées (jamais Supabase/API/polices — CDN
   tiers et données ne doivent jamais être mis en cache ici).

   Bump CACHE_VERSION pour purger le cache d'un coup si nécessaire
   (l'activate ci-dessous supprime automatiquement les anciennes
   versions) — pas obligatoire à chaque déploiement grâce au
   network-first, seulement utile si un jour un bug de cache est
   suspecté. */
const CACHE_VERSION = 'v1';
const CACHE_NAME = `sillance-${CACHE_VERSION}`;
const PRECACHE_URLS = [
  './', './index.html', './sillance-app.html', './sillance-calendrier.html', './sillance-review.html',
  './sillance-client.js', './sillance-integration.js', './sillance-flow.js', './sillance-fit.js', './sillance-tour.js',
  './favicon.svg', './icon-192.png', './icon-512.png', './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.warn('[sw] precache échoué :', err))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ),
  ]));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;               // jamais les écritures
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;       // jamais cross-origine (Supabase, polices, esm.sh…)

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((cached) => cached || Response.error()))
  );
});

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
