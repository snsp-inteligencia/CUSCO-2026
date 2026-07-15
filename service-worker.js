/* CUSCO 2026 Service Worker v1.3.3 */
const CACHE_NAME = "cusco-2026-v1-3-3";

const APP_SHELL = [
  "/CUSCO-2026/",
  "/CUSCO-2026/?v=133",
  "/CUSCO-2026/index.html",
  "/CUSCO-2026/catalogo_localidades.js",
  "/CUSCO-2026/logos_institucionales.png?v=133",
  "/CUSCO-2026/manifest.json",
  "/CUSCO-2026/icons/icon-192.png",
  "/CUSCO-2026/icons/icon-512.png"
];

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      for (const url of APP_SHELL) {
        try {
          const response = await fetch(url, { cache: "reload" });
          if (response.ok) {
            await cache.put(url, response.clone());
          } else {
            console.warn("CUSCO: recurso no disponible", url, response.status);
          }
        } catch (error) {
          console.warn("CUSCO: no se pudo precargar", url, error);
        }
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.map(key => key !== CACHE_NAME ? caches.delete(key) : Promise.resolve())
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  if (
    url.hostname.includes("script.google.com") ||
    url.hostname.includes("googleusercontent.com") ||
    url.hostname.includes("google.com")
  ) {
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("/CUSCO-2026/index.html", copy));
          }
          return response;
        })
        .catch(async () => {
          return (
            await caches.match("/CUSCO-2026/index.html") ||
            await caches.match("/CUSCO-2026/") ||
            Response.error()
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req).then(response => {
        if (response && response.status === 200 && response.type !== "opaque") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return response;
      });
    })
  );
});
