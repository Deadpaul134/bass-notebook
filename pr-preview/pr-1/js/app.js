/* Bass Notebook — screens, routing, theme, gestures. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var state = {
    mode: "pen",
    sort: "updated",
    query: "",
    zoom: 1,
    page: null,
    pointers: new Map(),
    pinch: null,
    tempEraser: false,
    deleted: null
  };

  var KEY_NAMES = {
    C: "דו", G: "סול", D: "רה", A: "לה", E: "מי", B: "סי", "F#": "פה♯", "C#": "דו♯",
    F: "פה", Bb: "סי♭", Eb: "מי♭", Ab: "לה♭", Db: "רה♭", Gb: "סול♭", Cb: "דו♭"
  };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function pref() {
    return localStorage.getItem(BN.KEYS.theme) || "system";
  }

  function applyTheme(next) {
    var mode = next || pref();
    var dark = mode === "dark" || (mode !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme-pref", mode);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#2a221d" : "#f6f0e8";
    localStorage.setItem(BN.KEYS.theme, mode);
  }

  function cycleTheme() {
    var order = ["light", "dark", "system"];
    var i = order.indexOf(pref());
    applyTheme(order[(i + 1) % order.length]);
    var btn = $("[data-action='theme']");
    if (btn) btn.innerHTML = themeIcon();
    if (state.page && $("#score")) redraw();
  }

  function themeIcon() {
    var p = pref();
    if (p === "dark") return "☾";
    if (p === "system") return "אוטו";
    return "☀︎";
  }

  function route() {
    var h = (location.hash || "#list").replace(/^#/, "");
    if (h === "settings") return { name: "settings" };
    if (h.indexOf("page/") === 0) return { name: "page", id: decodeURIComponent(h.slice(5)) };
    return { name: "list" };
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function toast(text, opts) {
    opts = opts || {};
    var host = $("#toasts");
    var node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = "<span>" + BN.esc(text) + "</span>";
    if (opts.action) {
      var b = document.createElement("button");
      b.type = "button";
      b.dataset.action = "toast-undo";
      b.textContent = opts.action;
      b.addEventListener("click", function () {
        if (opts.onAction) opts.onAction();
        node.remove();
      });
      node.appendChild(b);
    }
    host.appendChild(node);
    setTimeout(function () {
      node.remove();
    }, opts.timeout || 5000);
  }

  function closePop() {
    var pop = $("#pop");
    pop.hidden = true;
    pop.innerHTML = "";
  }

  var popStamp = 0;
  function openPop(html, x, y) {
    var pop = $("#pop");
    popStamp = Date.now();
    pop.innerHTML = html;
    pop.hidden = false;
    pop.style.left = Math.min(window.innerWidth - 280, Math.max(8, x)) + "px";
    pop.style.top = Math.min(window.innerHeight - 80, Math.max(8, y)) + "px";
  }

  function handClass() {
    var hand = BN.data.settings().hand === "left" ? "left" : "right";
    document.body.dataset.hand = hand;
  }

  function render() {
    closePop();
    var r = route();
    if (r.name === "list") renderList();
    else if (r.name === "settings") renderSettings();
    else renderEditor(r.id);
    var theme = $("[data-action='theme']");
    if (theme) theme.innerHTML = themeIcon();
  }

  function backupNote() {
    var opened = BN.readJSON(BN.KEYS.opened, null);
    if (!opened) {
      BN.writeJSON(BN.KEYS.opened, Date.now());
      return "";
    }
    var last = Number(localStorage.getItem(BN.KEYS.backup) || 0);
    if (last) return "";
    if (Date.now() - opened < 14 * 86400000) return "";
    if (!BN.store.all().length) return "";
    return '<p class="banner">עברו שבועיים בלי גיבוי. בהגדרות אפשר לשמור עותק לקובץ.</p>';
  }

  function renderList() {
    state.page = null;
    var pages = BN.list.sort(BN.list.filter(BN.store.list(), state.query), state.sort);
    var cards = pages.map(function (page) {
      var tempo = page.tempo ? "♩=" + BN.esc(page.tempo) : "";
      var clef = page.clef === "grand" ? "𝄞𝄢" : page.clef === "treble" ? "𝄞" : "𝄢";
      return (
        '<article class="idea" data-id="' + BN.esc(page.id) + '">' +
        '<button type="button" class="idea-open" data-action="open" data-id="' + BN.esc(page.id) + '">' +
        '<span class="thumb" data-thumb="' + BN.esc(page.id) + '"></span>' +
        '<span class="idea-title">' + BN.esc(page.title || "בלי שם") + "</span>" +
        '<span class="idea-meta">' + BN.esc(page.date || "") + " " + tempo + " " + BN.esc(page.key || "") + " " + clef + "</span>" +
        "</button>" +
        '<button type="button" class="more" data-action="more" data-id="' + BN.esc(page.id) + '" aria-label="פעולות">⋮</button>' +
        "</article>"
      );
    }).join("");
    var warn = BN.store.warning();
    $("#app").innerHTML =
      '<main class="screen" data-screen="list">' +
      '<header class="top">' +
      "<h1>המחברת שלי</h1>" +
      '<div class="top-actions">' +
      '<a class="icon-btn" href="#settings" aria-label="הגדרות">⚙</a>' +
      '<button type="button" class="icon-btn" data-action="theme" aria-label="ערכת צבע">' + themeIcon() + "</button>" +
      "</div></header>" +
      (warn ? '<p class="banner">' + BN.esc(warn) + "</p>" : "") +
      backupNote() +
      '<div class="filters">' +
      '<input id="search" class="field" type="search" placeholder="חיפוש לפי שם, תגית, הערה או סולם" value="' + BN.esc(state.query) + '">' +
      '<select id="sort" class="field" aria-label="מיון">' +
      '<option value="updated"' + (state.sort === "updated" ? " selected" : "") + ">עודכן לאחרונה</option>" +
      '<option value="date"' + (state.sort === "date" ? " selected" : "") + ">תאריך</option>" +
      '<option value="name"' + (state.sort === "name" ? " selected" : "") + ">שם</option>" +
      "</select></div>" +
      '<section class="ideas">' + (cards || '<p class="empty">עוד אין רעיונות. הראשון מחכה לכפתור למטה.</p>') + "</section>" +
      '<button type="button" class="fab" data-action="new-page">＋ רעיון חדש</button>' +
      "</main>";
    pages.forEach(function (page) {
      BN.store.getThumb(page.id).then(function (url) {
        var slot = document.querySelector('[data-thumb="' + page.id + '"]');
        if (slot && url) slot.style.backgroundImage = "url(" + url + ")";
      });
    });
    bindList();
  }

  function bindList() {
    var search = $("#search");
    if (search) {
      search.addEventListener("input", function () {
        state.query = search.value;
        var pages = BN.list.sort(BN.list.filter(BN.store.list(), state.query), state.sort);
        var box = $(".ideas");
        box.innerHTML = pages.map(function (page) {
          var tempo = page.tempo ? "♩=" + BN.esc(page.tempo) : "";
          var clef = page.clef === "grand" ? "𝄞𝄢" : page.clef === "treble" ? "𝄞" : "𝄢";
          return (
            '<article class="idea" data-id="' + BN.esc(page.id) + '">' +
            '<button type="button" class="idea-open" data-action="open" data-id="' + BN.esc(page.id) + '">' +
            '<span class="thumb" data-thumb="' + BN.esc(page.id) + '"></span>' +
            '<span class="idea-title">' + BN.esc(page.title || "בלי שם") + "</span>" +
            '<span class="idea-meta">' + BN.esc(page.date || "") + " " + tempo + " " + BN.esc(page.key || "") + " " + clef + "</span>" +
            "</button>" +
            '<button type="button" class="more" data-action="more" data-id="' + BN.esc(page.id) + '" aria-label="פעולות">⋮</button>' +
            "</article>"
          );
        }).join("") || '<p class="empty">אין תוצאות.</p>';
        pages.forEach(function (page) {
          BN.store.getThumb(page.id).then(function (url) {
            var slot = document.querySelector('[data-thumb="' + page.id + '"]');
            if (slot && url) slot.style.backgroundImage = "url(" + url + ")";
          });
        });
      });
    }
    var sort = $("#sort");
    if (sort) sort.addEventListener("change", function () {
      state.sort = sort.value;
      renderList();
    });
    var root = $("#app");
    root.onclick = onListClick;
    root.onpointerdown = onListPress;
  }

  function onListPress(e) {
    var card = e.target.closest(".idea");
    if (!card || e.target.closest("[data-action='more']")) return;
    var id = card.dataset.id;
    var timer = setTimeout(function () {
      openCardMenu(id, e.clientX, e.clientY);
    }, 550);
    function clear() {
      clearTimeout(timer);
      card.removeEventListener("pointerup", clear);
      card.removeEventListener("pointercancel", clear);
      card.removeEventListener("pointermove", clear);
    }
    card.addEventListener("pointerup", clear);
    card.addEventListener("pointercancel", clear);
    card.addEventListener("pointermove", clear);
  }

  function onListClick(e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var action = btn.dataset.action;
    if (action === "theme") cycleTheme();
    if (action === "new-page") createPage();
    if (action === "open") go("#page/" + encodeURIComponent(btn.dataset.id));
    if (action === "more") openCardMenu(btn.dataset.id, e.clientX, e.clientY);
  }

  function openCardMenu(id, x, y) {
    openPop(
      '<button type="button" data-action="duplicate" data-id="' + BN.esc(id) + '">שכפול</button>' +
      '<button type="button" data-action="delete" data-id="' + BN.esc(id) + '">מחיקה</button>',
      x, y
    );
  }

  function createPage() {
    var page = BN.data.blankPage();
    BN.history.reset(page.id);
    BN.store.schedule(page);
    BN.store.flush().then(function () {
      go("#page/" + encodeURIComponent(page.id));
    });
  }

  function duplicate(id) {
    var src = BN.store.get(id);
    if (!src) return;
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = BN.uid("p");
    copy.title = (src.title || "רעיון") + " (עותק)";
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    BN.migrate(copy);
    BN.store.schedule(copy);
    BN.store.flush().then(renderList);
  }

  function deletePage(id) {
    var page = BN.store.get(id);
    if (!page) return;
    state.deleted = page;
    BN.store.remove(id).then(function () {
      renderList();
      toast("«" + (page.title || "דף") + "» נמחק", {
        action: "בטל",
        timeout: 5000,
        onAction: function () {
          if (!state.deleted) return;
          BN.store.schedule(state.deleted);
          state.deleted = null;
          BN.store.flush().then(renderList);
        }
      });
    });
  }

  function renderEditor(id) {
    var page = BN.store.get(id);
    if (!page) {
      go("#list");
      return;
    }
    state.page = page;
    handClass();
    var settings = BN.data.settings();
    $("#app").innerHTML =
      '<main class="screen editor" data-screen="editor" data-hand="' + BN.esc(settings.hand) + '">' +
      '<header class="top editor-top">' +
      '<button type="button" class="icon-btn" data-action="back" aria-label="חזרה">→</button>' +
      '<input id="page-title" class="title-input" value="' + BN.esc(page.title || "") + '" aria-label="כותרת">' +
      '<button type="button" class="icon-btn" data-action="export-png" aria-label="ייצוא תמונה">PNG</button>' +
      '<button type="button" class="icon-btn" data-action="theme" aria-label="ערכת צבע">' + themeIcon() + "</button>" +
      "</header>" +
      '<div class="chips">' +
      chip("date", page.date || "תאריך") +
      chip("tempo", page.tempo ? "♩=" + page.tempo : "טמפו") +
      chip("key", labelKey(page.key)) +
      chip("time", page.time || "4/4") +
      chip("clef", labelClef(page.clef)) +
      "</div>" +
      '<div class="editor-body">' +
      '<div id="stage" class="stage"><div id="sizer"><div id="sheet">' +
      '<header id="sheet-head"></header><div id="score"></div>' +
      '<svg id="ink" xmlns="http://www.w3.org/2000/svg"></svg>' +
      '<canvas id="live"></canvas>' +
      "</div></div></div>" +
      '<aside class="rail" data-mode-panel="' + state.mode + '">' + rail() + "</aside>" +
      "</div>" +
      '<button type="button" class="add-system" data-action="add-system">＋ שורה</button>' +
      '<details class="notes-box"><summary>הערות ותגיות</summary>' +
      '<textarea id="page-notes" class="field" placeholder="הערה חופשית">' + BN.esc(page.notes || "") + "</textarea>" +
      '<input id="page-tags" class="field" placeholder="תגיות, מופרדות בפסיק" value="' + BN.esc((page.tags || []).join(", ")) + '">' +
      "</details></main>";
    $("#sheet-head").innerHTML =
      "<strong>" + BN.esc(page.title || "") + "</strong>" +
      "<span>" + BN.esc(page.date || "") + " · " + BN.esc(labelKey(page.key)) + " · " + BN.esc(page.time || "") +
      (page.tempo ? " · ♩=" + BN.esc(page.tempo) : "") + "</span>";
    bindEditor();
    requestAnimationFrame(redraw);
  }

  function chip(name, text) {
    return '<button type="button" class="chip" data-chip="' + name + '">' + BN.esc(text) + "</button>";
  }

  function labelKey(key) {
    if (!key) return "דו C";
    if (BN.music.RELATIVE[key]) return KEY_NAMES[BN.music.majorName(key)] + " " + key;
    return (KEY_NAMES[key] || key) + " " + key;
  }

  function labelClef(clef) {
    if (clef === "treble") return "𝄞 סול";
    if (clef === "grand") return "מערכת";
    return "𝄢 פה";
  }

  function rail() {
    var pal = BN.tap.palette();
    var pen = state.mode === "pen";
    var undoOn = state.page && BN.history.canUndo(state.page.id);
    var redoOn = state.page && BN.history.canRedo(state.page.id);
    var html =
      '<div class="mode">' +
      '<button type="button" data-mode="pen" aria-pressed="' + (pen ? "true" : "false") + '">✎ עט</button>' +
      '<button type="button" data-mode="tap" aria-pressed="' + (!pen ? "true" : "false") + '">♪ הקשה</button>' +
      "</div>" +
      '<div class="hist">' +
      '<button type="button" data-action="undo" aria-label="בטל"' + (undoOn ? "" : " disabled") + ">↶</button>" +
      '<button type="button" data-action="redo" aria-label="חזור"' + (redoOn ? "" : " disabled") + ">↷</button>" +
      "</div>";
    if (pen) {
      html += '<div class="tools">' +
        colorBtn("ink") + colorBtn("accent") + colorBtn("blue") + colorBtn("green") +
        sizeBtn(4) + sizeBtn(8) + sizeBtn(12) +
        '<button type="button" data-tool="pen" aria-pressed="' + (BN.pen.tool === "pen" ? "true" : "false") + '">עט</button>' +
        '<button type="button" data-tool="highlighter" aria-pressed="' + (BN.pen.tool === "highlighter" ? "true" : "false") + '">מרקר</button>' +
        '<button type="button" data-tool="eraser" aria-pressed="' + (BN.pen.tool === "eraser" ? "true" : "false") + '">מחק</button>' +
        "</div>";
    } else {
      html += '<div class="tools">' +
        durBtn("w", "שלם", pal) + durBtn("h", "חצי", pal) + durBtn("q", "רבע", pal) + durBtn("8", "⅛", pal) + durBtn("16", "¹⁄₁₆", pal) +
        '<button type="button" data-action="toggle-rest" aria-pressed="' + (pal.rest ? "true" : "false") + '">הפסקה</button>' +
        '<button type="button" data-dots="' + pal.dots + '">נקודה ' + (pal.dots === 2 ? "··" : pal.dots === 1 ? "·" : "·") + "</button>" +
        accBtn("#", "♯", pal) + accBtn("b", "♭", pal) + accBtn("n", "♮", pal) +
        '<button type="button" data-bar="single">|</button>' +
        '<button type="button" data-bar="double">||</button>' +
        '<button type="button" data-bar="end">|]</button>' +
        '<button type="button" data-bar="repeatEnd">:|</button>' +
        '<button type="button" data-bar="repeatStart">|:</button>' +
        '<button type="button" data-action="delete-note" aria-label="מחיקת תו">🗑</button>' +
        "</div>";
    }
    html += '<div class="zoom-btns">' +
      '<button type="button" data-action="zoom-out" aria-label="הקטנה">−</button>' +
      '<button type="button" data-action="zoom-in" aria-label="הגדלה">+</button>' +
      "</div>";
    return html;
  }

  function colorBtn(name) {
    return '<button type="button" class="swatch ' + name + '" data-color="' + name + '" aria-pressed="' + (BN.pen.color === name ? "true" : "false") + '" aria-label="' + name + '"></button>';
  }
  function sizeBtn(n) {
    return '<button type="button" data-size="' + n + '" aria-pressed="' + (BN.pen.size === n ? "true" : "false") + '">' + n + "</button>";
  }
  function durBtn(dur, label, pal) {
    return '<button type="button" data-dur="' + dur + '" aria-pressed="' + (pal.dur === dur ? "true" : "false") + '">' + label + "</button>";
  }
  function accBtn(acc, label, pal) {
    return '<button type="button" data-acc="' + acc + '" aria-pressed="' + (pal.acc === acc ? "true" : "false") + '">' + label + "</button>";
  }

  function bindEditor() {
    var root = $("#app");
    root.onclick = onEditorClick;
    $("#page-title").addEventListener("input", function (e) {
      state.page.title = e.target.value;
      state.page.updatedAt = new Date().toISOString();
      BN.store.schedule(state.page);
      var head = $("#sheet-head strong");
      if (head) head.textContent = state.page.title;
    });
    $("#page-notes").addEventListener("input", function (e) {
      state.page.notes = e.target.value;
      state.page.updatedAt = new Date().toISOString();
      BN.store.schedule(state.page);
    });
    $("#page-tags").addEventListener("input", function (e) {
      state.page.tags = e.target.value.split(",").map(function (t) { return t.trim(); }).filter(Boolean);
      state.page.updatedAt = new Date().toISOString();
      BN.store.schedule(state.page);
    });
    var sheet = $("#sheet");
    sheet.addEventListener("pointerdown", onSheetDown);
    sheet.addEventListener("pointermove", onSheetMove);
    sheet.addEventListener("pointerup", onSheetUp);
    sheet.addEventListener("pointercancel", onSheetUp);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
  }

  function onResize() {
    if (state.page && $("#score")) redraw();
  }

  function refreshRail() {
    var node = $(".rail");
    if (node) node.innerHTML = rail();
  }

  function redraw() {
    if (!state.page || !$("#score")) return;
    var stage = $("#stage");
    var avail = Math.max(280, stage.clientWidth - 12);
    var css = Math.max(BN.render.MIN_CSS, avail);
    var sheet = $("#sheet");
    sheet.style.width = css + "px";
    BN.render.draw(state.page, $("#score"), { selection: BN.tap.selection() });
    var layout = BN.render.layout;
    var headerPx = (layout.headerLogical / 1000) * css;
    var scorePx = (layout.userH / layout.userW) * css;
    var sheetH = (layout.logicalH / 1000) * css;
    $("#sheet-head").style.height = headerPx + "px";
    $("#score").style.height = scorePx + "px";
    sheet.style.height = sheetH + "px";
    applyZoom();
    var ink = $("#ink");
    ink.setAttribute("viewBox", "0 0 1000 " + layout.logicalH);
    ink.setAttribute("width", "100%");
    ink.setAttribute("height", "100%");
    BN.pen.redraw(ink, state.page.strokes);
    var head = $("#sheet-head");
    if (head) {
      head.innerHTML =
        "<strong>" + BN.esc(state.page.title || "") + "</strong><span>" +
        BN.esc(state.page.date || "") + " · " + BN.esc(labelKey(state.page.key)) + " · " +
        BN.esc(state.page.time || "") + (state.page.tempo ? " · ♩=" + BN.esc(state.page.tempo) : "") + "</span>";
    }
    document.querySelectorAll(".chip").forEach(function (btn) {
      var name = btn.dataset.chip;
      if (name === "date") btn.textContent = state.page.date || "תאריך";
      if (name === "tempo") btn.textContent = state.page.tempo ? "♩=" + state.page.tempo : "טמפו";
      if (name === "key") btn.textContent = labelKey(state.page.key);
      if (name === "time") btn.textContent = state.page.time || "4/4";
      if (name === "clef") btn.textContent = labelClef(state.page.clef);
    });
  }

  function applyZoom() {
    var sheet = $("#sheet");
    var sizer = $("#sizer");
    if (!sheet || !sizer) return;
    state.zoom = Math.max(0.5, Math.min(2, state.zoom));
    document.documentElement.setAttribute("data-zoom", String(state.zoom));
    sheet.style.transform = "scale(" + state.zoom + ")";
    sizer.style.width = sheet.offsetWidth * state.zoom + "px";
    sizer.style.height = sheet.offsetHeight * state.zoom + "px";
  }

  function commit(mutate) {
    BN.history.exec(state.page, mutate);
    BN.store.schedule(state.page);
    redraw();
    refreshRail();
  }

  function undo() {
    if (!state.page) return;
    var next = BN.history.undo(state.page);
    if (next === state.page) return;
    state.page = next;
    BN.tap.clearSelection();
    BN.store.schedule(state.page);
    redraw();
    refreshRail();
  }

  function redo() {
    if (!state.page) return;
    var next = BN.history.redo(state.page);
    if (next === state.page) return;
    state.page = next;
    BN.tap.clearSelection();
    BN.store.schedule(state.page);
    redraw();
    refreshRail();
  }

  function eraseAt(e) {
    var logical = BN.render.clientToLogical(e.clientX, e.clientY);
    var hit = BN.pen.hit(state.page.strokes, logical);
    if (!hit) return;
    commit(function (page) {
      page.strokes = page.strokes.filter(function (stroke) { return stroke.id !== hit.id; });
    });
  }

  function onSheetDown(e) {
    if (e.target.closest("button, a, input, textarea")) return;
    state.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, t: Date.now(), moved: 0, type: e.pointerType });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    if (e.pointerType === "pen") {
      var settings = BN.data.settings();
      if (!settings.penOnly && !settings.penOnlyLocked) BN.data.saveSettings({ penOnly: true });
    }
    if (state.pointers.size >= 2) {
      BN.pen.cancel();
      var pts = Array.from(state.pointers.values());
      state.pinch = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        sl: $("#stage").scrollLeft,
        st: $("#stage").scrollTop,
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2
      };
      return;
    }
    var settingsNow = BN.data.settings();
    var fat = e.width > 40 || e.height > 40;
    if (fat && (settingsNow.penOnly || seenPen())) return;
    if (state.mode === "pen" && settingsNow.penOnly && e.pointerType === "touch") {
      state.pinch = { pan: true, x: e.clientX, y: e.clientY, sl: $("#stage").scrollLeft, st: $("#stage").scrollTop };
      return;
    }
    if (state.mode === "pen" && ((e.buttons & 32) === 32 || BN.pen.tool === "eraser")) {
      state.tempEraser = (e.buttons & 32) === 32;
      eraseAt(e);
      return;
    }
    if (state.mode === "pen") BN.pen.down(state.page, e);
    else {
      var res = BN.tap.down(state.page, e);
      if (res && res.kind === "clef") openSystemMenu(res.system, e.clientX, e.clientY);
    }
  }

  function seenPen() {
    var found = false;
    state.pointers.forEach(function (p) { if (p.type === "pen") found = true; });
    return found || BN.data.settings().penOnly;
  }

  function onSheetMove(e) {
    var rec = state.pointers.get(e.pointerId);
    if (rec) rec.moved += Math.hypot(e.clientX - rec.x, e.clientY - rec.y);
    if (state.pointers.size >= 2 && state.pinch && !state.pinch.pan) {
      var pts = Array.from(state.pointers.values());
      if (pts.length >= 2) {
        var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        var midX = (pts[0].x + pts[1].x) / 2;
        var midY = (pts[0].y + pts[1].y) / 2;
        state.zoom = Math.max(0.5, Math.min(2, state.zoom * (dist / state.pinch.dist)));
        state.pinch.dist = dist;
        var stage = $("#stage");
        stage.scrollLeft = state.pinch.sl - (midX - state.pinch.x);
        stage.scrollTop = state.pinch.st - (midY - state.pinch.y);
        applyZoom();
      }
      return;
    }
    if (state.pinch && state.pinch.pan) {
      var stage = $("#stage");
      stage.scrollLeft = state.pinch.sl - (e.clientX - state.pinch.x);
      stage.scrollTop = state.pinch.st - (e.clientY - state.pinch.y);
      return;
    }
    if (state.mode === "pen" && BN.pen.tool !== "eraser" && !state.tempEraser) BN.pen.move(e);
    else if (state.mode === "tap") {
      var drag = BN.tap.move(state.page, e);
      if (drag && drag.kind === "drag") {
        /* ghost already shown */
      }
    }
  }

  function onSheetUp(e) {
    var rec = state.pointers.get(e.pointerId);
    var wasPinch = state.pointers.size >= 2 || (state.pinch && !state.pinch.pan);
    state.pointers.delete(e.pointerId);
    if (wasPinch && state.pointers.size < 2) {
      var calm = true;
      if (rec && rec.moved > 18) calm = false;
      state.pointers.forEach(function (p) { if (p.moved > 18) calm = false; });
      if (calm && rec && Date.now() - rec.t < 450) undo();
      if (state.pointers.size === 0) state.pinch = null;
      BN.pen.cancel();
      return;
    }
    if (state.pinch && state.pinch.pan && state.pointers.size === 0) {
      state.pinch = null;
      return;
    }
    if (!state.page) return;
    if (state.mode === "pen") {
      if (BN.pen.tool === "eraser" || state.tempEraser) {
        state.tempEraser = false;
        BN.pen.cancel();
        return;
      }
      var stroke = BN.pen.up(state.page, e);
      if (stroke) {
        commit(function (page) { page.strokes.push(stroke); });
      }
      return;
    }
    var action = BN.tap.up(state.page, e);
    if (!action) {
      redraw();
      return;
    }
    commit(function (page) {
      if (action.kind === "add") BN.tap.applyAdd(page, action);
      else BN.tap.applyPitch(page, action);
    });
  }

  function onEditorClick(e) {
    var btn = e.target.closest("[data-action], [data-mode], [data-color], [data-size], [data-tool], [data-dur], [data-dots], [data-acc], [data-bar], [data-chip]");
    if (!btn) return;
    if (btn.dataset.mode) {
      state.mode = btn.dataset.mode;
      refreshRail();
      return;
    }
    if (btn.dataset.color) {
      BN.pen.color = btn.dataset.color;
      BN.pen.tool = BN.pen.tool === "eraser" ? "pen" : BN.pen.tool;
      refreshRail();
      return;
    }
    if (btn.dataset.size) {
      BN.pen.size = Number(btn.dataset.size);
      refreshRail();
      return;
    }
    if (btn.dataset.tool) {
      BN.pen.tool = btn.dataset.tool;
      refreshRail();
      return;
    }
    if (btn.dataset.dur) {
      var dur = btn.dataset.dur;
      if (BN.tap.selectedEvent(state.page)) commit(function (page) { BN.tap.patchSelected(page, { dur: dur }); });
      BN.tap.setPalette({ dur: dur });
      refreshRail();
      if (!BN.tap.selectedEvent(state.page)) redraw();
      return;
    }
    if (btn.hasAttribute("data-dots")) {
      var evDots = BN.tap.selectedEvent(state.page);
      var baseDots = evDots ? evDots.dots || 0 : BN.tap.palette().dots;
      var nextDots = (baseDots + 1) % 3;
      if (evDots) commit(function (page) { BN.tap.patchSelected(page, { dots: nextDots }); });
      BN.tap.setPalette({ dots: nextDots });
      refreshRail();
      return;
    }
    if (btn.dataset.acc) {
      var acc = btn.dataset.acc;
      var pal = BN.tap.palette();
      var value = pal.acc === acc ? null : acc;
      var selected = BN.tap.selectedEvent(state.page);
      if (selected && selected.kind === "note") {
        commit(function (page) {
          var item = BN.tap.selectedEvent(page);
          if (item && item.pitch) item.pitch.acc = value;
        });
      }
      BN.tap.setPalette({ acc: value });
      refreshRail();
      return;
    }
    if (btn.dataset.bar) {
      var kind = btn.dataset.bar;
      commit(function (page) { BN.tap.setBar(page, kind); });
      return;
    }
    if (btn.dataset.chip) {
      openChip(btn.dataset.chip, e.clientX, e.clientY);
      return;
    }
    var action = btn.dataset.action;
    if (action === "theme") cycleTheme();
    if (action === "back") leaveEditor();
    if (action === "undo") undo();
    if (action === "redo") redo();
    if (action === "zoom-in") { state.zoom = Math.min(2, state.zoom + 0.1); applyZoom(); }
    if (action === "zoom-out") { state.zoom = Math.max(0.5, state.zoom - 0.1); applyZoom(); }
    if (action === "add-system") commit(function (page) { BN.tap.addSystem(page); });
    if (action === "delete-note") {
      if (BN.tap.selection()) commit(function (page) { BN.tap.deleteSelected(page); });
    }
    if (action === "toggle-rest") {
      var rest = !BN.tap.palette().rest;
      var sel = BN.tap.selectedEvent(state.page);
      if (sel) {
        commit(function (page) {
          var item = BN.tap.selectedEvent(page);
          if (!item) return;
          if (rest) {
            item.kind = "rest";
            delete item.pitch;
          } else if (item.kind === "rest") {
            item.kind = "note";
            var clef = page.systems[BN.tap.selection().system].staves[BN.tap.selection().staff].clef;
            item.pitch = BN.music.posToPitch(clef, 4);
          }
        });
      }
      BN.tap.setPalette({ rest: rest });
      refreshRail();
    }
    if (action === "export-png") exportPng();
  }

  function openChip(name, x, y) {
    if (name === "date") {
      openPop('<label>תאריך<input id="pop-date" class="field" type="date" value="' + BN.esc(state.page.date || "") + '"></label><button type="button" data-pop="date">עדכון</button>', x, y);
    } else if (name === "tempo") {
      openPop('<label>טמפו<input id="pop-tempo" class="field" type="number" min="1" max="400" placeholder="ריק = בלי" value="' + (state.page.tempo || "") + '"></label><button type="button" data-pop="tempo">עדכון</button>', x, y);
    } else if (name === "time") {
      openPop(timePop(), x, y);
    } else if (name === "key") {
      openPop(keyPop(), x, y);
    } else if (name === "clef") {
      openPop(clefPop(true), x, y);
    }
  }

  function timePop() {
    var presets = ["2/4", "3/4", "4/4", "5/4", "6/8", "7/8", "12/8"];
    return presets.map(function (t) {
      return '<button type="button" data-pop-time="' + t + '">' + t + "</button>";
    }).join("") + '<label>מותאם<input id="pop-time" class="field" placeholder="7/8"></label>' +
      '<button type="button" data-pop="time-page">לכל הדף</button>' +
      '<button type="button" data-pop="time-measure">לתיבה הזו</button>';
  }

  function keyPop() {
    var majors = BN.music.KEYS.map(function (k) {
      return '<button type="button" data-pop-key="' + k + '">' + BN.esc(labelKey(k)) + "</button>";
    }).join("");
    var minors = BN.music.MINORS.map(function (k) {
      return '<button type="button" data-pop-key="' + k + '">' + BN.esc(k) + "</button>";
    }).join("");
    return '<div class="key-grid">' + majors + minors + "</div>" +
      '<button type="button" data-pop="key-measure">הסולם לתיבה הזו בלבד</button>';
  }

  function clefPop(pageLevel) {
    return '<button type="button" data-clef="bass">פה 𝄢</button>' +
      '<button type="button" data-clef="treble">סול 𝄞</button>' +
      '<button type="button" data-clef="grand">מערכת כפולה</button>' +
      (pageLevel ? '<button type="button" data-action="apply-clef-all">החל על כל השורות</button>' : "");
  }

  function openSystemMenu(index, x, y) {
    state.systemMenu = index;
    openPop(
      '<button type="button" data-sys="add-measure">הוסף תיבה</button>' +
      '<button type="button" data-sys="delete">מחק שורה</button>' +
      clefPop(false),
      x, y
    );
  }

  document.addEventListener("click", function (e) {
    var popBtn = e.target.closest("#pop button, #pop");
    if (!popBtn) {
      if (Date.now() - popStamp < 350) return;
      if (!e.target.closest("[data-chip], [data-action='more'], .more")) closePop();
      return;
    }
    if (e.target.closest("[data-action='duplicate']")) {
      duplicate(e.target.dataset.id);
      closePop();
      return;
    }
    if (e.target.closest("[data-action='delete']")) {
      deletePage(e.target.dataset.id);
      closePop();
      return;
    }
    if (!state.page) return;
    var t = e.target.closest("[data-pop], [data-pop-time], [data-pop-key], [data-clef], [data-sys], [data-action='apply-clef-all']");
    if (!t) return;
    if (t.dataset.pop === "date") {
      state.page.date = $("#pop-date").value || state.page.date;
      state.page.updatedAt = new Date().toISOString();
      BN.store.schedule(state.page);
      redraw();
      closePop();
    }
    if (t.dataset.pop === "tempo") {
      var raw = $("#pop-tempo").value;
      state.page.tempo = raw === "" ? null : Number(raw);
      state.page.updatedAt = new Date().toISOString();
      BN.store.schedule(state.page);
      redraw();
      closePop();
    }
    if (t.dataset.popTime) {
      commit(function (page) { BN.tap.setMeasureTime(page, t.dataset.popTime, "page"); });
      closePop();
    }
    if (t.dataset.pop === "time-page" || t.dataset.pop === "time-measure") {
      var custom = ($("#pop-time") && $("#pop-time").value) || state.page.time;
      if (!/^\d+\/(1|2|4|8|16|32)$/.test(custom)) {
        toast("משקל לא תקין");
        return;
      }
      var scope = t.dataset.pop === "time-measure" ? "measure" : "page";
      commit(function (page) { BN.tap.setMeasureTime(page, custom, scope); });
      closePop();
    }
    if (t.dataset.popKey) {
      var key = t.dataset.popKey;
      var measureOnly = state.keyScope === "measure";
      state.keyScope = "page";
      commit(function (page) { BN.tap.setMeasureKey(page, key, measureOnly ? "measure" : "page"); });
      closePop();
    }
    if (t.dataset.pop === "key-measure") {
      state.keyScope = "measure";
      toast("הסולם הבא שייבחר יחול על התיבה");
    }
    if (t.dataset.clef) {
      var clef = t.dataset.clef;
      if (state.systemMenu != null && !t.closest("[data-action='apply-clef-all']")) {
        var idx = state.systemMenu;
        commit(function (page) { BN.tap.changeSystemClef(page, idx, clef); });
        state.systemMenu = null;
        closePop();
        return;
      }
      state.pendingClef = clef;
      state.page.clef = clef;
      state.page.updatedAt = new Date().toISOString();
      BN.store.schedule(state.page);
      redraw();
    }
    if (t.dataset.action === "apply-clef-all" || t.dataset.action === "apply-clef-all") {
      var clefAll = state.pendingClef || state.page.clef;
      commit(function (page) {
        page.clef = clefAll;
        page.systems.forEach(function (sys, i) { BN.tap.changeSystemClef(page, i, clefAll); });
      });
      closePop();
    }
    if (t.dataset.sys === "add-measure") {
      var index = state.systemMenu || 0;
      commit(function (page) {
        page.systems[index].staves.forEach(function (staff) {
          staff.measures.push({ barEnd: "single", events: [] });
        });
      });
      closePop();
    }
    if (t.dataset.sys === "delete") {
      var indexDel = state.systemMenu || 0;
      commit(function (page) { BN.tap.deleteSystem(page, indexDel); });
      closePop();
    }
  });

  function onKey(e) {
    if (!state.page || route().name !== "page") return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      BN.tap.moveSelection(state.page, 1);
      redraw();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      BN.tap.moveSelection(state.page, -1);
      redraw();
    } else if (/^[a-gA-G]$/.test(e.key)) {
      var step = e.key.toUpperCase();
      commit(function (page) { BN.tap.typeStep(page, step); });
    } else if (/^[1-5]$/.test(e.key)) {
      var map = { "1": "w", "2": "h", "3": "q", "4": "8", "5": "16" };
      var keyDur = map[e.key];
      if (BN.tap.selectedEvent(state.page)) commit(function (page) { BN.tap.patchSelected(page, { dur: keyDur }); });
      BN.tap.setPalette({ dur: keyDur });
      if (!BN.tap.selectedEvent(state.page)) redraw();
      refreshRail();
    } else if (e.key === ".") {
      var dots = (BN.tap.palette().dots + 1) % 3;
      var ev = BN.tap.selectedEvent(state.page);
      if (ev) commit(function (page) { BN.tap.patchSelected(page, { dots: dots }); });
      BN.tap.setPalette({ dots: dots });
      refreshRail();
    } else if (e.key === "+" || e.key === "=") {
      setAccKey("#");
    } else if (e.key === "-" || e.key === "_") {
      setAccKey("b");
    } else if (e.key === "Backspace" || e.key === "Delete") {
      if (BN.tap.selection()) {
        e.preventDefault();
        commit(function (page) { BN.tap.deleteSelected(page); });
      }
    }
  }

  function setAccKey(acc) {
    var ev = BN.tap.selectedEvent(state.page);
    var next = ev && ev.pitch && ev.pitch.acc === acc ? "n" : acc;
    if (ev && ev.pitch) commit(function (page) {
      var item = BN.tap.selectedEvent(page);
      if (item && item.pitch) item.pitch.acc = next;
    });
    BN.tap.setPalette({ acc: next === "n" ? "n" : acc });
    refreshRail();
  }

  function leaveEditor() {
    var page = state.page;
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    BN.store.flush().then(function () {
      if (page && BN.export.thumb) {
        return BN.export.thumb(page).then(function (url) {
          return BN.store.saveThumb(page.id, url);
        }).catch(function () {});
      }
    }).then(function () {
      go("#list");
    });
  }

  function exportPng() {
    var page = state.page;
    BN.export.pngBlob(page).then(function (blob) {
      redraw();
      var file = new File([blob], BN.export.filename(page), { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        openPop('<button type="button" id="do-share">שתף</button><button type="button" id="do-download">הורדה</button>', 80, 80);
        $("#do-share").onclick = function () {
          navigator.share({ files: [file], title: page.title }).catch(function () {});
          closePop();
        };
        $("#do-download").onclick = function () {
          downloadBlob(blob, file.name);
          closePop();
        };
        return;
      }
      downloadBlob(blob, file.name);
    }).catch(function () {
      toast("לא הצלחתי לייצא תמונה");
      redraw();
    });
  }

  function downloadBlob(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function renderSettings() {
    state.page = null;
    var s = BN.data.settings();
    $("#app").innerHTML =
      '<main class="screen" data-screen="settings">' +
      '<header class="top"><a class="icon-btn" href="#list" aria-label="חזרה">→</a><h1>הגדרות</h1>' +
      '<button type="button" class="icon-btn" data-action="theme" aria-label="ערכת צבע">' + themeIcon() + "</button></header>" +
      '<section class="card">' +
      "<h2>תצוגה</h2>" +
      '<button type="button" class="text-btn" data-action="theme">ערכת צבע: ' + BN.esc(pref()) + "</button>" +
      "<label>מפתח לדף חדש<select id=\"set-clef\" class=\"field\">" +
      option("bass", "פה", s.clef) + option("treble", "סול", s.clef) + option("grand", "מערכת כפולה", s.clef) +
      "</select></label>" +
      '<label>שורות בדף חדש<input id="set-systems" class="field" type="number" min="1" max="24" value="' + s.systems + '"></label>' +
      "<label>יד דומיננטית<select id=\"set-hand\" class=\"field\">" +
      option("right", "ימין (סרגל מימין)", s.hand) + option("left", "שמאל (סרגל משמאל)", s.hand) +
      "</select></label>" +
      '<label class="check"><input id="set-pen" type="checkbox"' + (s.penOnly ? " checked" : "") + "> עט בלבד מצייר</label>" +
      "</section>" +
      '<section class="card">' +
      "<h2>גיבוי</h2>" +
      "<p>הנתונים נשמרים רק במכשיר הזה.</p>" +
      '<button type="button" class="text-btn" data-action="backup">גיבוי לקובץ JSON</button>' +
      '<label class="text-btn file">שחזור מקובץ<input id="restore-file" type="file" accept="application/json,.json"></label>' +
      '<p id="restore-msg" class="form-error" hidden></p>' +
      '<div id="restore-actions" hidden>' +
      '<button type="button" data-restore="merge">מיזוג</button>' +
      '<button type="button" data-restore="replace">החלפה</button>' +
      "</div></section>" +
      '<section class="card">' +
      "<h2>אודות</h2>" +
      "<p>מחברת בס " + BN.esc(s.version) + " · MIT © Paul Samson</p>" +
      '<p><a href="./THIRD_PARTY_NOTICES.md">רישיונות: VexFlow, Bravura, perfect-freehand, Heebo</a></p>' +
      "</section></main>";
    $("#app").onclick = function (e) {
      if (e.target.closest("[data-action='theme']")) cycleTheme();
      if (e.target.closest("[data-action='backup']")) {
        var data = BN.export.toJSON();
        localStorage.setItem(BN.KEYS.backup, String(Date.now()));
        downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), BN.export.backupName());
      }
    };
    $("#set-clef").addEventListener("change", function (e) { BN.data.saveSettings({ clef: e.target.value }); });
    $("#set-systems").addEventListener("change", function (e) {
      BN.data.saveSettings({ systems: Math.max(1, Math.min(24, Number(e.target.value) || 6)) });
    });
    $("#set-hand").addEventListener("change", function (e) { BN.data.saveSettings({ hand: e.target.value }); handClass(); });
    $("#set-pen").addEventListener("change", function (e) {
      BN.data.saveSettings({ penOnly: e.target.checked, penOnlyLocked: !e.target.checked });
    });
    $("#restore-file").addEventListener("change", onRestoreFile);
  }

  function option(value, label, current) {
    return '<option value="' + value + '"' + (current === value ? " selected" : "") + ">" + label + "</option>";
  }

  var pendingImport = null;

  function onRestoreFile(e) {
    var file = e.target.files && e.target.files[0];
    var msg = $("#restore-msg");
    var actions = $("#restore-actions");
    pendingImport = null;
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(String(reader.result));
        BN.export.validate(obj);
        pendingImport = obj;
        msg.hidden = false;
        msg.classList.remove("form-error");
        msg.textContent = "נמצאו " + obj.pages.length + " דפים";
        actions.hidden = false;
      } catch (err) {
        pendingImport = null;
        actions.hidden = true;
        msg.hidden = false;
        msg.classList.add("form-error");
        msg.textContent = "הקובץ פגום ולא נטען. הנתונים במכשיר לא השתנו.";
      }
    };
    reader.readAsText(file);
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-restore]");
    if (!btn || !pendingImport) return;
    var mode = btn.dataset.restore;
    if (mode === "replace") {
      openPop('<p>להחליף את כל הדפים בדפים מהקובץ?</p><button type="button" data-action="confirm-replace">כן, להחליף</button>', 40, 120);
      return;
    }
    BN.export.importData(pendingImport, "merge").then(function () {
      toast("הגיבוי מוזג");
      pendingImport = null;
    });
  });

  document.addEventListener("click", function (e) {
    if (!e.target.closest("[data-action='confirm-replace']")) return;
    if (!pendingImport) return;
    BN.export.importData(pendingImport, "replace").then(function () {
      toast("הדפים הוחלפו");
      pendingImport = null;
      closePop();
    });
  });

  function registerSw() {
    if (!("serviceWorker" in navigator)) return;
    if (/[?&]nosw=1/.test(location.search)) return;
    navigator.serviceWorker.register("./sw.js").then(function (reg) {
      reg.addEventListener("updatefound", function () {
        var worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", function () {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            toast("גרסה חדשה זמינה — רענן");
          }
        });
      });
    }).catch(function () {});
  }

  BN.app = {
    getPage: function () { return state.page; },
    mode: function () { return state.mode; },
    boot: function () {
      applyTheme(pref());
      handClass();
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
      document.documentElement.dataset.motion = reduce.matches ? "reduce" : "ok";
      window.addEventListener("hashchange", function () {
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("resize", onResize);
        render();
      });
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") BN.store.flush();
      });
      window.addEventListener("pagehide", function () { BN.store.flush(); });
      BN.store.ready().then(function () {
        if (!location.hash) location.hash = "#list";
        render();
        registerSw();
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
      });
    }
  };

  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-action='theme']") && route().name !== "page" && route().name !== "list" && route().name !== "settings") cycleTheme();
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", BN.app.boot);
  else BN.app.boot();
})();
