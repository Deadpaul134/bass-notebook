/* Bass Notebook service worker — cache-first, relative to the page directory. */
var CACHE_VERSION = "bass-notebook-v6-piano-samples";
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
  "./js/ui/icons.js",
  "./js/ui/toast.js",
  "./js/ui/ghost.js",
  "./js/ui/pop.js",
  "./js/ui/actions.js",
  "./js/ui/topbar.js",
  "./js/ui/ribbon.js",
  "./js/ui/keypad-layouts.js",
  "./js/ui/keypad.js",
  "./js/ui/contextbar.js",
  "./js/ui/piano.js",
  "./js/ui/list.js",
  "./js/ui/settings.js",
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
  "./assets/icons/icon-maskable-512.png",
  "./assets/piano/A0.mp3",
  "./assets/piano/A1.mp3",
  "./assets/piano/A2.mp3",
  "./assets/piano/A3.mp3",
  "./assets/piano/A4.mp3",
  "./assets/piano/A5.mp3",
  "./assets/piano/A6.mp3",
  "./assets/piano/C1.mp3",
  "./assets/piano/C2.mp3",
  "./assets/piano/C3.mp3",
  "./assets/piano/C4.mp3",
  "./assets/piano/C5.mp3",
  "./assets/piano/C6.mp3",
  "./assets/piano/C7.mp3",
  "./assets/piano/Ds1.mp3",
  "./assets/piano/Ds2.mp3",
  "./assets/piano/Ds3.mp3",
  "./assets/piano/Ds4.mp3",
  "./assets/piano/Ds5.mp3",
  "./assets/piano/Ds6.mp3",
  "./assets/piano/Fs1.mp3",
  "./assets/piano/Fs2.mp3",
  "./assets/piano/Fs3.mp3",
  "./assets/piano/Fs4.mp3",
  "./assets/piano/Fs5.mp3",
  "./assets/piano/Fs6.mp3"
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
