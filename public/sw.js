// ════════════════════════════════════════════════════════════════
// Service Worker — Camion Dubois Achats PWA
// Gère le cache offline + les notifications push
// ════════════════════════════════════════════════════════════════

const CACHE_NAME = 'achats-cd-v1';

// Assets à mettre en cache pour le mode offline
const ASSETS_STATIQUES = [
  '/achats',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_STATIQUES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stratégie : Network first, cache en fallback
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Ne pas intercepter les requêtes Supabase / API
  if (url.hostname !== self.location.hostname) return;
  // Ne pas intercepter les routes hors /achats
  if (!url.pathname.startsWith('/achats')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && event.request.method === 'GET') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ── Notifications Push ───────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Camion Dubois', body: event.data.text() };
  }

  const options = {
    body: payload.body ?? '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.achatId ?? 'achats-cd',
    data: { achatId: payload.achatId, url: '/achats' },
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      { action: 'ouvrir', title: '👁 Voir le camion' },
      { action: 'fermer', title: 'Fermer' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Camion Dubois — Achats', options)
  );
});

// Clic sur notification → ouvrir l'app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'fermer') return;

  const achatId = event.notification.data?.achatId;
  const targetUrl = achatId ? `/achats?achat=${achatId}` : '/achats';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const client = clients.find(c => c.url.includes('/achats'));
      if (client) {
        client.focus();
        client.postMessage({ type: 'OPEN_ACHAT', achatId });
      } else {
        self.clients.openWindow(targetUrl);
      }
    })
  );
});
