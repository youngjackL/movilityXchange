// Bump VERSION whenever you change any file, so phones pick up the new build.
const VERSION = "mx-v2";
const SHELL = [
  "/", "/index.html", "/car.html", "/sell.html",
  "/styles.css", "/config.js", "/data.js", "/app.js",
  "/manifest.webmanifest",
  "/fonts/montserrat-latin-wght-normal.woff2",
  "/img/logo.png", "/img/logo-car.png",
  "/icons/icon-192.png", "/icons/icon-512.png",
  "/icons/favicon-32.png", "/icons/favicon-48.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Only handle our own GET requests. Supabase and TikTok go straight to the network.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    const fallback = url.pathname.startsWith("/c/") ? "/car.html"
      : url.pathname.startsWith("/sell") ? "/sell.html" : "/index.html";
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(fallback)))
    );
    return;
  }

  // Static assets: serve cached copy fast, refresh in the background.
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
