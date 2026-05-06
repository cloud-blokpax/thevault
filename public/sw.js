// Minimal service worker for installability + offline shell.
// Avoid caching authenticated API/HTML responses.

const CACHE = "vault-shell-v1";
const SHELL = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for static icons + manifest
  if (SHELL.some((p) => url.pathname === p) || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req)),
    );
    return;
  }

  // Network-first for everything else; do not cache HTML/API.
  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((c) => c || Response.error())),
  );
});
