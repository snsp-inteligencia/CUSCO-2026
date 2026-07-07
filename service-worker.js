const CACHE_NAME = "cusco-2026-v1-0-6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./catalogo_localidades.js",
  "./capturistas.js",
  "./logo_piscis.png",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;

  // Para navegación HTML: red primero, si no hay internet, regresar index cacheado.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
        return response;
      }).catch(() =>
        caches.match("./index.html").then(cached => cached || caches.match("./"))
      )
    );
    return;
  }

  // Para recursos: caché primero, si no está, red y guardar.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(response => {
        if (response && response.status === 200 && req.method === "GET") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return response;
      });
    })
  );
});
