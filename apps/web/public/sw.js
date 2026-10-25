// DirectLet service worker.
//
// It exists so the app can be installed and shows a friendly page when the phone
// has no connection. On purpose it does very little:
//   - It never touches /api. Messages, payments, receipts and logins are private
//     and must always come live from the server, never from a saved copy.
//   - It never saves pages, so people always get the newest version of the app.
//   - It only saves the built files in /assets, whose names contain a hash and so
//     can never be out of date.
const VERSION = "v1";
const CACHE = `directlet-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("directlet-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Other sites (map tiles, fonts) are left to the browser.
  if (url.origin !== self.location.origin) return;
  // Private data is never saved or served from a copy.
  if (url.pathname.startsWith("/api/")) return;

  // Opening a page: always ask the network first, and show the offline page if
  // there is no connection.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Built files: saved the first time, then served instantly.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const saved = await cache.match(request);
        if (saved) return saved;
        const response = await fetch(request);
        // A missing file can come back as the app's HTML page; never save that.
        const type = response.headers.get("content-type") || "";
        if (response.ok && !type.includes("text/html")) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
