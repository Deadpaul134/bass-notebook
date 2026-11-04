/* Storage for scores. IndexedDB, with a localStorage index and v1 migration. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  BN.KEYS = {
    theme: "bass-notebook-v1-theme",
    index: "bass-notebook-v2-index",
    settings: "bass-notebook-v1-settings",
    backup: "bass-notebook-v1-last-backup",
    opened: "bass-notebook-v1-opened"
  };
  BN.readJSON = function (key, fallback) {
    try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  };
  BN.writeJSON = function (key, value) { localStorage.setItem(key, JSON.stringify(value)); };
  BN.uid = function (prefix) { return (prefix || "s") + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3); };
  BN.ymd = function (d) {
    var date = d || new Date();
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  };
  BN.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  var memory = new Map();
  var dbp = null;
  var timer = 0;
  var chain = Promise.resolve();

  function indexRow(score) {
    var key = score.parts && score.parts[0] && BN.model ? BN.model.keyOf(score.parts[0], 0) : null;
    return {
      id: score.id,
      title: score.title || "",
      date: score.date || "",
      bpm: score.tempo && score.tempo.bpm,
      key: key ? BN.music.vfKey(key) : "C",
      layout: score.staffLayout || "bass",
      updatedAt: score.updatedAt || "",
      tags: score.tags || [],
      comment: score.comment || ""
    };
  }
  function writeIndex() {
    BN.writeJSON(BN.KEYS.index, Array.from(memory.values()).map(indexRow).sort(function (a, b) {
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    }));
  }
  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise(function (resolve, reject) {
      var req = indexedDB.open("bass-notebook", 2);
      req.onupgradeneeded = function (event) {
        var db = req.result;
        var tx = req.transaction;
        if (!db.objectStoreNames.contains("scores")) db.createObjectStore("scores", { keyPath: "id" });
        if (!db.objectStoreNames.contains("thumbs")) db.createObjectStore("thumbs");
        if (event.oldVersion >= 1 && event.oldVersion < 2 && db.objectStoreNames.contains("pages")) {
          var getAll = tx.objectStore("pages").getAll();
          getAll.onsuccess = function () {
            (getAll.result || []).forEach(function (page) {
              if (page && page.v !== 2 && BN.model && BN.model.migrateV1) {
                try { tx.objectStore("scores").put(BN.model.migrateV1(page)); } catch (err) { /* keep the v2 store usable */ }
              }
            });
          };
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbp;
  }
  BN.store = {
    close: function () {
      return Promise.resolve(dbp).then(function (db) { if (db && db.close) db.close(); dbp = null; }).catch(function () { dbp = null; });
    },
    ready: function () {
      return openDb().then(function (db) {
        return new Promise(function (resolve) {
          var tx = db.transaction("scores", "readonly");
          var req = tx.objectStore("scores").getAll();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function () { resolve([]); };
        });
      }).then(function (rows) {
        memory.clear();
        rows.forEach(function (score) { memory.set(score.id, score); });
        writeIndex();
      }).catch(function () { writeIndex(); });
    },
    list: function () { return BN.readJSON(BN.KEYS.index, []); },
    get: function (id) { return memory.get(id) || null; },
    all: function () { return Array.from(memory.values()); },
    schedule: function (score) {
      if (score) memory.set(score.id, score);
      writeIndex();
      clearTimeout(timer);
      timer = setTimeout(function () { BN.store.flush(); }, 400);
    },
    flush: function () {
      clearTimeout(timer);
      var scores = Array.from(memory.values());
      writeIndex();
      chain = chain.then(function () {
        return openDb().then(function (db) {
          return new Promise(function (resolve) {
            var tx = db.transaction("scores", "readwrite");
            scores.forEach(function (score) { tx.objectStore("scores").put(score); });
            tx.oncomplete = function () { resolve(); };
            tx.onerror = function () { resolve(); };
          });
        });
      });
      return chain;
    },
    remove: function (id) {
      memory.delete(id);
      writeIndex();
      return openDb().then(function (db) {
        return new Promise(function (resolve) {
          var tx = db.transaction("scores", "readwrite");
          tx.objectStore("scores").delete(id);
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        });
      });
    },
    replaceAll: function (scores) {
      memory.clear();
      (scores || []).forEach(function (s) { memory.set(s.id, s); });
      writeIndex();
      return openDb().then(function (db) {
        return new Promise(function (resolve) {
          var tx = db.transaction("scores", "readwrite");
          tx.objectStore("scores").clear();
          memory.forEach(function (s) { tx.objectStore("scores").put(s); });
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        });
      });
    }
  };
  BN.list = {
    filter: function (rows, query) {
      var q = String(query || "").trim().toLowerCase();
      if (!q) return rows.slice();
      return rows.filter(function (row) {
        return [row.title, row.comment, row.key, (row.tags || []).join(" ")].join("\n").toLowerCase().indexOf(q) >= 0;
      });
    },
    sort: function (rows, mode) {
      var list = rows.slice();
      if (mode === "name") list.sort(function (a, b) { return String(a.title).localeCompare(String(b.title), "he"); });
      else if (mode === "date") list.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      else list.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
      return list;
    }
  };
  BN.data = {
    settings: function () {
      return Object.assign({ clef: "bass", hand: "right", metronome: false, countIn: false, volume: 0.8, sound: "synth" }, BN.readJSON(BN.KEYS.settings, {}));
    },
    saveSettings: function (patch) {
      var next = Object.assign(BN.data.settings(), patch || {});
      BN.writeJSON(BN.KEYS.settings, next);
      return next;
    }
  };
  BN.state = { current: null, selection: [], palette: { type: "quarter", dots: 0, rest: false, tie: false, accidental: null, select: false }, playingId: null, playing: false };
})();
