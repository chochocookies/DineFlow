// Deliberately minimal. DineFlow's menu prices, table availability, and
// order status must never be served from a stale cache, so this service
// worker only ever caches the handful of truly static assets listed below
// — every other request (pages, /api/* calls, fonts) is passed straight
// through to the network untouched. Its main job is just existing and
// registering, which is one of the browser's requirements for the "Add to
// Home Screen" install prompt to show up at all.

const CACHE_NAME = "dineflow-static-v1";
const STATIC_ASSETS = [
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isStaticAsset =
    url.origin === self.location.origin && STATIC_ASSETS.includes(url.pathname);

  if (!isStaticAsset) return; // let the browser handle it normally

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
