/**
 * FPL Confidence — Service Worker
 *
 * Route table (evaluated top-to-bottom):
 *   /_next/static/*               cache-first   (immutable content-hashed chunks)
 *   /icon*, /apple-icon*,
 *   /manifest.webmanifest         cache-first   (stable app-shell assets)
 *   /api/cron/*                   bypass        (do NOT call event.respondWith)
 *   /api/*                        network-only  (data must be fresh)
 *   navigate (mode === 'navigate') network-first → /offline fallback
 *   everything else               network-only
 *
 * skipWaiting is intentionally omitted from install.
 * Rationale: calling skipWaiting mid-flight can leave an in-progress page
 * half-served by the old SW and half by the new one, corrupting state in a
 * data-driven app. Tabs pick up the new SW on their next navigation instead.
 */

const CACHE_VERSION = 'fpl-conf-v1';

// Assets to precache on install so the offline fallback is ready immediately.
const PRECACHE_URLS = [
  '/offline',
  '/icon/192',
  '/icon/512',
  '/icon-maskable',
  '/apple-icon',
  '/manifest.webmanifest',
];

// ── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll fails atomically — if any URL 404s the install fails cleanly.
      cache.addAll(PRECACHE_URLS),
    ),
  );
  // No skipWaiting — see rationale above.
});

// ── Activate ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        // Delete every cache whose name doesn't match the current version.
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests.
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // /api/cron/* — bypass entirely. Do not call event.respondWith so the
  // browser sends the request directly to the network unmodified.
  if (url.pathname.startsWith('/api/cron/')) {
    return;
  }

  // /api/* — network-only (confidence data must always be fresh).
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // /_next/static/* — cache-first. Next.js content-hashes every chunk so
  // a cache hit is always the correct version.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            const clone = res.clone();
            void caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
            return res;
          }),
      ),
    );
    return;
  }

  // App-shell assets — cache-first (precached on install, stable across sessions).
  const pathname = url.pathname;
  const isAppShell =
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon') ||
    pathname === '/manifest.webmanifest';

  if (isAppShell) {
    event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
    return;
  }

  // HTML navigations — network-first with /offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/offline')));
    return;
  }

  // Everything else — network-only.
  event.respondWith(fetch(request));
});
