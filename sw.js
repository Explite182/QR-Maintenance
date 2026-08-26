const SITEWORKS_SW_VERSION = "20260826-siteworks-pump-automation-30";
const STATIC_CACHE = `siteworks-static-${SITEWORKS_SW_VERSION}`;

const STATIC_ASSETS = [
  "/styles.css?v=20260826-siteworks-pump-automation-30",
  "/keybox.css?v=20260809-key-search-25",
  "/keybox.js?v=20260809-key-wizard-22",
  "/monitoring-engine.js?v=20260805-monitoring-engine",
  "/js/panel-hmi-standard-model.js?v=20260826-siteworks-pump-automation-30",
  "/js/panel-hmi-siteworks-adapter.js?v=20260826-siteworks-pump-automation-30",
  "/js/panel-hmi-standard-renderer.js?v=20260826-siteworks-pump-automation-30",
  "/app.js?v=20260826-siteworks-pump-automation-30",
  "/manifest.webmanifest?v=20260826-siteworks-pump-automation-30",
  "/icons/siteworks-icon-192.png?v=20260826-siteworks-pump-automation-30",
  "/icons/siteworks-icon-512.png?v=20260826-siteworks-pump-automation-30"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("siteworks-static-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") return cache.match(request) || cache.match("/") || cache.match("/index.html");
    throw new Error("SiteWorks is offline and this file is not cached.");
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  const shouldHandleStaticAsset = [
    ".html",
    ".css",
    ".js",
    ".json",
    ".webmanifest",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".pdf"
  ].some((extension) => url.pathname.endsWith(extension));

  if (shouldHandleStaticAsset) {
    event.respondWith(networkFirst(request));
  }
});
