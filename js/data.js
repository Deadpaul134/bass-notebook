/* Bass Notebook — storage, ids, settings. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});

  BN.KEYS = {
    theme: "bass-notebook-v1-theme",
    index: "bass-notebook-v1-index",
    settings: "bass-notebook-v1-settings",
    pages: "bass-notebook-v1-pages",
    backup: "bass-notebook-v1-last-backup",
    opened: "bass-notebook-v1-opened"
  };

  BN.readJSON = function (key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null || raw === "") return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  };

  BN.writeJSON = function (key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  };

  BN.uid = function (prefix) {
    var p = prefix || "p";
    var rnd = Math.random().toString(36).slice(2, 10);
    var time = Date.now().toString(36);
    return p + "_" + rnd + time.slice(-4);
  };

  BN.ymd = function (d) {
    var date = d || new Date();
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  };

  BN.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  BN.migrate = function (page) {
    if (!page || typeof page !== "object") return page;
    if (!page.v) page.v = 1;
    if (!Array.isArray(page.tags)) page.tags = [];
    if (!Array.isArray(page.strokes)) page.strokes = [];
    if (!Array.isArray(page.systems)) page.systems = [];
    if (typeof page.notes !== "string") page.notes = page.notes ? String(page.notes) : "";
    if (!page.time) page.time = "4/4";
    if (!page.key) page.key = "C";
    if (!page.clef) page.clef = "bass";
    page.systems.forEach(function (sys) {
      if (!sys.id) sys.id = BN.uid("y");
      if (!sys.layout) sys.layout = sys.staves && sys.staves.length > 1 ? "grand" : "single";
      if (!Array.isArray(sys.staves)) sys.staves = [];
      var count = 0;
      sys.staves.forEach(function (staff) {
        if (!staff.id) staff.id = BN.uid("s");
        if (!staff.clef) staff.clef = "bass";
        if (!Array.isArray(staff.measures)) staff.measures = [];
        staff.measures.forEach(function (measure) {
          if (!measure.barEnd) measure.barEnd = "single";
          if (!Array.isArray(measure.events)) measure.events = [];
          measure.events.forEach(function (ev) {
            if (!ev.id) ev.id = BN.uid("e");
            if (!ev.dur) ev.dur = "q";
            if (ev.dots == null) ev.dots = 0;
            if (!ev.kind) ev.kind = "note";
            if (ev.kind === "note" && ev.pitch && ev.pitch.acc === undefined) ev.pitch.acc = null;
          });
        });
        count = Math.max(count, staff.measures.length);
      });
      sys.staves.forEach(function (staff) {
        while (staff.measures.length < count) {
          staff.measures.push({ barEnd: "single", events: [] });
        }
      });
    });
    page.strokes.forEach(function (stroke) {
      if (!stroke.id) stroke.id = BN.uid("k");
      if (!stroke.tool) stroke.tool = "pen";
      if (!stroke.color) stroke.color = "ink";
      if (!stroke.size) stroke.size = 6;
      if (!Array.isArray(stroke.points)) stroke.points = [];
    });
    return page;
  };

  function emptyMeasure() {
    return { barEnd: "single", events: [] };
  }

  function emptyStaff(clef) {
    return {
      id: BN.uid("s"),
      clef: clef,
      measures: [emptyMeasure(), emptyMeasure(), emptyMeasure(), emptyMeasure()]
    };
  }

  BN.data = BN.data || {};

  BN.data.emptySystem = function (clef) {
    if (clef === "grand") {
      return { id: BN.uid("y"), layout: "grand", staves: [emptyStaff("treble"), emptyStaff("bass")] };
    }
    var c = clef === "treble" ? "treble" : "bass";
    return { id: BN.uid("y"), layout: "single", staves: [emptyStaff(c)] };
  };

  BN.data.blankPage = function (opts) {
    opts = opts || {};
    var settings = BN.data.settings();
    var clef = opts.clef || settings.clef || "bass";
    var n = opts.systems || settings.systems || 6;
    var now = new Date().toISOString();
    var systems = [];
    for (var i = 0; i < n; i++) systems.push(BN.data.emptySystem(clef));
    return BN.migrate({
      id: BN.uid("p"),
      v: 1,
      title: "רעיון חדש",
      createdAt: now,
      updatedAt: now,
      date: BN.ymd(),
      tempo: null,
      key: "C",
      time: "4/4",
      clef: clef,
      tags: [],
      notes: "",
      systems: systems,
      strokes: []
    });
  };

  var DEFAULT_SETTINGS = {
    clef: "bass",
    systems: 6,
    hand: "right",
    penOnly: false,
    penOnlyLocked: false,
    version: "1.0.0"
  };

  BN.data.settings = function () {
    var stored = BN.readJSON(BN.KEYS.settings, {});
    var out = {};
    Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
      out[k] = stored[k] == null ? DEFAULT_SETTINGS[k] : stored[k];
    });
    return out;
  };

  BN.data.saveSettings = function (next) {
    var merged = BN.data.settings();
    Object.keys(next || {}).forEach(function (k) {
      merged[k] = next[k];
    });
    BN.writeJSON(BN.KEYS.settings, merged);
    return merged;
  };

  var memory = new Map();
  var useMemory = false;
  var idbWarning = "";
  var dbPromise = null;
  var saveTimer = 0;
  var chain = Promise.resolve();

  function indexOf(page) {
    return {
      id: page.id,
      title: page.title || "",
      date: page.date || "",
      tempo: page.tempo == null ? null : page.tempo,
      key: page.key || "C",
      clef: page.clef || "bass",
      updatedAt: page.updatedAt || "",
      createdAt: page.createdAt || "",
      tags: page.tags || [],
      notes: page.notes || ""
    };
  }

  function writeIndex() {
    var list = Array.from(memory.values()).map(indexOf);
    list.sort(function (a, b) {
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
    BN.writeJSON(BN.KEYS.index, list);
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("no idb"));
        return;
      }
      var req = indexedDB.open("bass-notebook", 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains("pages")) db.createObjectStore("pages", { keyPath: "id" });
        if (!db.objectStoreNames.contains("thumbs")) db.createObjectStore("thumbs");
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error || new Error("idb"));
      };
    });
    return dbPromise;
  }

  function idbOp(storeName, mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeName, mode);
        var store = tx.objectStore(storeName);
        var result;
        try {
          result = fn(store);
        } catch (err) {
          reject(err);
          return;
        }
        tx.oncomplete = function () {
          resolve(result);
        };
        tx.onerror = function () {
          reject(tx.error);
        };
        tx.onabort = function () {
          reject(tx.error || new Error("abort"));
        };
      });
    });
  }

  function loadFromLocal() {
    var pages = BN.readJSON(BN.KEYS.pages, []);
    memory.clear();
    (pages || []).forEach(function (page) {
      memory.set(page.id, BN.migrate(page));
    });
    writeIndex();
  }

  function persistLocal() {
    BN.writeJSON(BN.KEYS.pages, Array.from(memory.values()));
  }

  BN.store = {
    warning: function () {
      return idbWarning;
    },
    close: function () {
      return Promise.resolve(dbPromise).then(function (db) {
        if (db && db.close) db.close();
        dbPromise = null;
      }).catch(function () {
        dbPromise = null;
      });
    },
    ready: function () {
      return openDb()
        .then(function () {
          return idbOp("pages", "readonly", function (store) {
            return new Promise(function (resolve, reject) {
              var req = store.getAll();
              req.onsuccess = function () {
                resolve(req.result || []);
              };
              req.onerror = function () {
                reject(req.error);
              };
            });
          });
        })
        .then(function (rows) {
          memory.clear();
          rows.forEach(function (page) {
            memory.set(page.id, BN.migrate(page));
          });
          if (!rows.length) {
            var fallback = BN.readJSON(BN.KEYS.pages, []);
            if (fallback && fallback.length) {
              fallback.forEach(function (page) {
                memory.set(page.id, BN.migrate(page));
              });
              return BN.store.flush();
            }
          }
          writeIndex();
        })
        .catch(function () {
          useMemory = true;
          idbWarning = "השמירה בדפדפן מוגבלת (בלי IndexedDB). כדאי לגבות קובץ.";
          loadFromLocal();
        });
    },
    list: function () {
      return BN.readJSON(BN.KEYS.index, []).slice();
    },
    get: function (id) {
      var page = memory.get(id);
      return page ? BN.migrate(page) : null;
    },
    all: function () {
      return Array.from(memory.values()).map(function (page) {
        return BN.migrate(page);
      });
    },
    schedule: function (page) {
      if (page) {
        memory.set(page.id, page);
        writeIndex();
      }
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        BN.store.flush();
      }, 500);
    },
    flush: function () {
      clearTimeout(saveTimer);
      var pages = Array.from(memory.values());
      writeIndex();
      if (useMemory) {
        persistLocal();
        return Promise.resolve();
      }
      chain = chain.then(function () {
        return idbOp("pages", "readwrite", function (store) {
          pages.forEach(function (page) {
            store.put(page);
          });
        }).catch(function () {
          useMemory = true;
          idbWarning = "השמירה בדפדפן מוגבלת (בלי IndexedDB). כדאי לגבות קובץ.";
          persistLocal();
        });
      });
      return chain;
    },
    remove: function (id) {
      memory.delete(id);
      writeIndex();
      if (useMemory) {
        persistLocal();
        return Promise.resolve();
      }
      return idbOp("pages", "readwrite", function (store) {
        store.delete(id);
      }).catch(function () {
        persistLocal();
      });
    },
    replaceAll: function (pages) {
      memory.clear();
      (pages || []).forEach(function (page) {
        memory.set(page.id, BN.migrate(page));
      });
      writeIndex();
      if (useMemory) {
        persistLocal();
        return Promise.resolve();
      }
      return idbOp("pages", "readwrite", function (store) {
        store.clear();
        memory.forEach(function (page) {
          store.put(page);
        });
      }).catch(function () {
        useMemory = true;
        persistLocal();
      });
    },
    saveThumb: function (id, dataUrl) {
      if (useMemory) {
        try {
          localStorage.setItem("bass-notebook-v1-thumb-" + id, dataUrl);
        } catch (err) {
          /* quota */
        }
        return Promise.resolve();
      }
      return idbOp("thumbs", "readwrite", function (store) {
        store.put(dataUrl, id);
      }).catch(function () {});
    },
    getThumb: function (id) {
      if (useMemory) {
        return Promise.resolve(localStorage.getItem("bass-notebook-v1-thumb-" + id));
      }
      return openDb()
        .then(function (db) {
          return new Promise(function (resolve) {
            var tx = db.transaction("thumbs", "readonly");
            var req = tx.objectStore("thumbs").get(id);
            req.onsuccess = function () {
              resolve(req.result || null);
            };
            req.onerror = function () {
              resolve(null);
            };
          });
        })
        .catch(function () {
          return null;
        });
    }
  };

  BN.list = {
    filter: function (pages, query) {
      var q = String(query || "").trim().toLowerCase();
      if (!q) return pages.slice();
      return pages.filter(function (page) {
        var tags = (page.tags || []).join(" ");
        var blob = [page.title, page.notes, page.key, tags].join("\n").toLowerCase();
        return blob.indexOf(q) !== -1;
      });
    },
    sort: function (pages, mode) {
      var list = pages.slice();
      if (mode === "name") {
        list.sort(function (a, b) {
          return String(a.title || "").localeCompare(String(b.title || ""), "he");
        });
      } else if (mode === "date") {
        list.sort(function (a, b) {
          return String(b.date || "").localeCompare(String(a.date || ""));
        });
      } else {
        list.sort(function (a, b) {
          return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
        });
      }
      return list;
    }
  };
})();
