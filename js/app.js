/* Routing, theme, and wiring of the editor screen. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var mounted = false;
  var CHROME = { light: "#24262b", dark: "#1b1d21" };

  function $(s) { return document.querySelector(s); }
  function pref() { return localStorage.getItem(BN.KEYS.theme) || "system"; }

  function applyTheme(mode) {
    var choice = mode || pref();
    var dark = choice === "dark" || (choice !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme-pref", choice);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? CHROME.dark : CHROME.light;
    localStorage.setItem(BN.KEYS.theme, choice);
  }

  function route() {
    var h = (location.hash || "#list").replace(/^#/, "");
    if (h === "settings") return { name: "settings" };
    if (h.indexOf("score/") === 0) return { name: "score", id: decodeURIComponent(h.slice(6)) };
    return { name: "list" };
  }

  function show(name) {
    document.body.dataset.screen = name;
    ["list", "settings", "editor"].forEach(function (n) { $("#screen-" + n).hidden = n !== name; });
  }

  function mountEditor() {
    if (mounted) return;
    mounted = true;
    BN.ui.topbar.mount($("#topbar"));
    BN.ui.ribbon.mount($("#ribbon"));
    BN.ui.keypad.mount($("#keypad"), $("#kp-show"));
    BN.ui.piano.mount($("#piano-dock"), $("#piano-handle"), $("#piano-keys"));
    BN.ui.contextbar.mount($("#ctx"));
    BN.editor.mount($("#stage"));
  }

  BN.ui = BN.ui || {};
  BN.ui.syncAll = function () {
    if (document.body.dataset.screen !== "editor" || !BN.state.current) return;
    BN.ui.topbar.sync();
    BN.ui.ribbon.sync();
    BN.ui.keypad.sync();
    BN.ui.piano.sync();
    BN.ui.contextbar.sync();
  };

  function renderScore(id) {
    var score = BN.store.get(id);
    if (!score) { BN.app.go("#list"); return; }
    mountEditor();
    BN.state.current = score;
    BN.state.selection = [];
    BN.state.selMeasures = [];
    BN.state.cursor = null;
    BN.state.zoom = 1;
    BN.state.tab = "input";
    BN.state.playingId = null;
    BN.state.palette.accidental = null;
    BN.state.palette.tie = false;
    show("editor");
    $("#stage").scrollTop = 0;
    BN.ui.keypad.place();
    BN.editor.redraw();
  }

  BN.app = {
    go: function (hash) { if (location.hash !== hash) location.hash = hash; else BN.app.render(); },
    applyTheme: applyTheme,
    themePref: pref,
    render: function () {
      if (BN.playback && BN.playback.isPlaying()) BN.playback.stop();
      BN.pop.close();
      BN.ghost.hide();
      var r = route();
      if (r.name === "score") renderScore(r.id);
      else if (r.name === "settings") { BN.state.current = null; show("settings"); BN.ui.settings.render($("#screen-settings")); }
      else { show("list"); BN.ui.list.render($("#screen-list")); }
    }
  };

  function boot() {
    if (!location.hash) location.hash = "#list";
    applyTheme();
    document.addEventListener("pointerdown", function (e) {
      if (!BN.pop.isOpen()) return;
      if (e.target.closest("#pop")) return;
      var own = BN.pop.owner();
      if (own && own.dataset && own.dataset.chip && e.target.closest("[data-chip='" + own.dataset.chip + "']")) return;
      if (own && own.dataset && own.dataset.action && e.target.closest("[data-action='" + own.dataset.action + "']")) return;
      BN.pop.close();
    }, true);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") BN.store.flush();
    });
    window.addEventListener("pagehide", function () { BN.store.flush(); });
    window.addEventListener("hashchange", BN.app.render);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    if ("serviceWorker" in navigator && location.search.indexOf("nosw=1") < 0) {
      navigator.serviceWorker.register("./sw.js").then(function (reg) {
        reg.addEventListener("updatefound", function () {
          var worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", function () {
            if (worker.state === "installed" && navigator.serviceWorker.controller) BN.toast.show("גרסה חדשה — רענן");
          });
        });
      }).catch(function () {});
    }
    BN.store.ready().then(BN.app.render);
  }
  boot();
})();
