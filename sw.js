/* Bass Notebook service worker — cache-first, relative to the page directory. */
var CACHE_VERSION = "bass-notebook-v2";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./sw.js",
  "./css/app.css",
  "./js/data.js",
  "./js/music.js",
  "./js/model.js",
  "./js/layout.js",
  "./js/render.js",
  "./js/history.js",
  "./js/playback.js",
  "./js/musicxml.js",
  "./js/export.js",
  "./js/editor.js",
  "./js/app.js",
  "./vendor/vexflow/vexflow-bravura.js",
  "./vendor/jspdf/jspdf.umd.min.js",
  "./vendor/svg2pdf/svg2pdf.umd.min.js",
  "./assets/fonts/heebo-hebrew.woff2",
  "./assets/fonts/heebo-latin.woff2",
  "./assets/fonts/OFL.txt",
  "./assets/icons/icon.svg",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-192.png",
  "./assets/icons/icon-maskable-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== CACHE_VERSION;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.ok && url.pathname.indexOf("/pr-preview/") === -1) {
          var copy = response.clone();
          caches.open(CACHE_VERSION).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () {
        if (request.mode === "navigate") return caches.match("./index.html");
        return caches.match(request);
      });
    })
  );
});
