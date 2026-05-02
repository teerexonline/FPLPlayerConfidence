const CACHE_NAME = 'fpl-confidence-v1';

self.addEventListener('install', () => {
  // Activate immediately — don't wait for existing tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Delete stale caches from previous versions.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only intercept same-origin GET requests.
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // API routes — never serve from cache; data must be fresh.
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Next.js immutable static chunks — cache-first, populate on first fetch.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            const clone = res.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return res;
          }),
      ),
    );
    return;
  }

  // Navigation and everything else — network-first.
  // This app is data-driven; serving a stale HTML shell would show outdated
  // confidence numbers. Fall through to the browser default (no response) on
  // network failure so the browser shows its own offline page rather than
  // a confusingly empty app.
  event.respondWith(fetch(request));
});
