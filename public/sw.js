// Service worker for the offline catalogue (spec §3.3).
//
// Strategy is deliberately conservative:
//   - navigations and RSC payloads: network-first, fall back to the last good
//     cached copy. Prices must never be shown from cache when the network can
//     supply something fresher.
//   - build assets under /_next/static: cache-first, they are content-hashed.
//   - anything non-GET (server actions, the CSV export): never touched.
//
// Queued edits live in IndexedDB, not here — see src/lib/offline-queue.ts.

const CACHE = "ppt-v1";
const OFFLINE_FALLBACK = "/dashboard";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_FALLBACK))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname === "/manifest.webmanifest";
}

// Dev-server endpoints must never be intercepted or hot reload breaks.
function isDevEndpoint(url) {
  return (
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/__nextjs") ||
    url.pathname.startsWith("/_next/turbopack")
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isDevEndpoint(url)) return;
  // The export is a live snapshot; serving a stale one would be misleading.
  if (url.pathname.startsWith("/admin/export")) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const fallback = await caches.match(OFFLINE_FALLBACK);
          if (fallback) return fallback;
        }
        return new Response("Offline and nothing cached for this page.", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      }),
  );
});
