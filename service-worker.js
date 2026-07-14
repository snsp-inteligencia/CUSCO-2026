/* CUSCO 2026 Service Worker v1.3.0 Seguridad */
const CACHE_NAME = "cusco-2026-v1-3-1-logos-offline";

const APP_SHELL = [
  "./",
 "./?v=131",
  "./index.html",
  "./catalogo_localidades.js",
  "./logos_institucionales.png",
  "./logo_piscis.png",
  "./logo_snsp.png",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, {cache:"reload"}))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => key !== CACHE_NAME ? caches.delete(key) : Promise.resolve())))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.hostname.includes("script.google.com") || url.hostname.includes("googleusercontent.com") || url.hostname.includes("google.com")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(response => {
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./index.html",copy));
          return response;
        })
        .catch(() => caches.match("./index.html").then(cached => cached || caches.match("./")))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(response => {
      if(response && response.status===200){
        const copy=response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req,copy));
      }
      return response;
    }))
  );
});
