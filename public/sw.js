/**
 * Service worker de JOHN HENRY.
 *
 * Escrito a mano y a propósito: el CMS es una app autenticada, y las librerías
 * genéricas de PWA cachean navegaciones por defecto. Aquí NO se cachea nunca
 * HTML de páginas del sistema — un iPad compartido en sede no puede servir la
 * ficha de un cliente desde disco a quien ya cerró sesión.
 *
 * Reparto de responsabilidades:
 *   · Assets inmutables (/_next/static, iconos, marca) → cache-first.
 *     Llevan hash en el nombre; nunca cambian bajo la misma URL.
 *   · Imágenes optimizadas (/_next/image)              → stale-while-revalidate.
 *   · Navegaciones (documentos HTML)                    → red primero, y si no
 *     hay red, la pantalla /offline. Sin caché de respuesta.
 *   · API, Server Actions, RSC, POST y todo lo demás    → directo a la red.
 */

const VERSION = "v1";
const SHELL_CACHE = `jh-shell-${VERSION}`;
const ASSET_CACHE = `jh-assets-${VERSION}`;
const IMAGE_CACHE = `jh-images-${VERSION}`;

const OFFLINE_URL = "/offline";

/** Lo mínimo para que la ventana instalada nunca aparezca rota. */
const SHELL_ASSETS = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

/** Techo de entradas por caché de imágenes: el disco del dispositivo no es infinito. */
const IMAGE_CACHE_LIMIT = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // `reload` evita que el propio HTTP cache del navegador nos devuelva una
      // versión vieja de /offline al instalar una versión nueva del worker.
      await cache.addAll(SHELL_ASSETS.map((url) => new Request(url, { cache: "reload" })));
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL_CACHE, ASSET_CACHE, IMAGE_CACHE]);
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)));

      // Con navigation preload el fetch del documento arranca en paralelo al
      // arranque del worker: no se paga latencia por tener SW.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }

      await self.clients.claim();
    })(),
  );
});

/** La página decide cuándo aplicar la actualización (ver ServiceWorkerRegistrar). */
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Rutas que jamás se interceptan: datos autenticados, mutaciones y payloads
  // RSC (que Next invalida por su cuenta y no deben servirse desde disco).
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.searchParams.has("_rsc") ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1"
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.pathname.startsWith("/_next/image")) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, IMAGE_CACHE_LIMIT));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/")
  ) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});

/**
 * Red primero, sin guardar la respuesta. Si no hay red, la pantalla /offline
 * explica qué pasó y ofrece reintentar — nunca el dinosaurio del navegador.
 */
async function handleNavigation(event) {
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
    return await fetch(event.request);
  } catch {
    const cache = await caches.open(SHELL_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ??
      new Response("Sin conexión.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

/** Para URLs con hash: si está en disco, es la buena. */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    cache.put(request, response.clone());
  }
  return response;
}

/** Sirve al instante lo que haya y refresca en segundo plano. */
async function staleWhileRevalidate(request, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);

  const network = fetch(request)
    .then(async (response) => {
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
        await trimCache(cache, limit);
      }
      return response;
    })
    .catch(() => undefined);

  return hit ?? (await network) ?? Response.error();
}

/** FIFO simple: la entrada más antigua sale primero. */
async function trimCache(cache, limit) {
  if (!limit) return;
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  await Promise.all(keys.slice(0, keys.length - limit).map((key) => cache.delete(key)));
}
