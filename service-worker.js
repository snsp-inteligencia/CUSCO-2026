/* CUSCO 2026 Service Worker v1.3.6 */
const CACHE_NAME = "cusco-2026-v1-3-6";
const BASE_PATH = "/CUSCO-2026/";
const INDEX_URL = BASE_PATH + "index.html";

const APP_SHELL = [
  BASE_PATH,
  INDEX_URL,
  BASE_PATH + "catalogo_localidades.js?v=20260629",
  BASE_PATH + "logos_institucionales.png?v=135",
  BASE_PATH + "manifest.json",
  BASE_PATH + "icons/icon-192.png",
  BASE_PATH + "icons/icon-512.png"
];

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    for (const url of APP_SHELL) {
      try {
        const request = new Request(url, { cache: "reload" });
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(request, response.clone());
        }
      } catch (error) {
        console.warn("CUSCO: no se pudo precargar", url, error);
      }
    }
  })());

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key.startsWith("cusco-2026-") && key !== CACHE_NAME)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

function fetchWithTimeout(request, timeoutMs) {
  return Promise.race([
    fetch(request, { cache: "no-store" }),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Tiempo de espera agotado")), timeoutMs)
    )
  ]);
}

async function navigationResponse(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetchWithTimeout(request, 5000);

    if (response && response.ok) {
      await cache.put(INDEX_URL, response.clone());
      return response;
    }
  } catch (error) {
    console.warn("CUSCO: navegación sin respuesta de red; usando caché", error);
  }

  return (
    await cache.match(INDEX_URL) ||
    await cache.match(BASE_PATH) ||
    new Response(
      "<!doctype html><html lang='es'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>CUSCO 2026</title><body style='font-family:system-ui;padding:24px'><h2>CUSCO 2026</h2><p>No fue posible cargar la aplicación. Conéctate a internet una vez y vuelve a abrirla.</p></body></html>",
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    )
  );
}

async function assetResponse(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async response => {
      if (response && response.ok && response.type !== "opaque") {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  // Recursos ya disponibles: respuesta inmediata y actualización en segundo plano.
  if (cached) {
    networkPromise;
    return cached;
  }

  // Recurso no almacenado: esperar la red.
  const network = await networkPromise;
  return network || Response.error();
}

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (
    url.hostname.includes("script.google.com") ||
    url.hostname.includes("googleusercontent.com") ||
    url.hostname.includes("google.com")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith(BASE_PATH)) {
    event.respondWith(assetResponse(request));
  }
});
