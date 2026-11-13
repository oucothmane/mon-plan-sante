// Mon Plan Santé — service worker : l'app marche sans réseau.
// Pour publier une mise à jour : change index.html ET le numéro de CACHE ci-dessous.
// L'app ouverte détecte alors la nouvelle version et se recharge toute seule.
const CACHE = 'plan-repas-v65';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const timeout = (ms) => new Promise((_, reject) => setTimeout(reject, ms));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // La page : réseau d'abord, sans le cache du navigateur (GitHub Pages le garde 10 min),
  // sinon la copie gardée pour le hors ligne.
  if (req.mode === 'navigate') {
    const fresh = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then((res) => (res.redirected ? fetch(req) : res));
    event.respondWith(
      Promise.race([fresh, timeout(3500)])
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Icônes, manifeste et polices Google : copie gardée d'abord, rafraîchie en arrière-plan.
  const sameSite = url.origin === self.location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameSite && !fonts) return;
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
