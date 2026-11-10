/* Screens, routing, theme. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var sortMode = "updated";
  var query = "";
  var rate = 1;
  var tapTimes = [];

  function $(s) { return document.querySelector(s); }
  function pref() { return localStorage.getItem(BN.KEYS.theme) || "system"; }
  function applyTheme(mode) {
    var choice = mode || pref();
    var dark = choice === "dark" || (choice !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme-pref", choice);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#2a221d" : "#f6f0e8";
    localStorage.setItem(BN.KEYS.theme, choice);
  }
  function themeLabel() { return pref() === "dark" ? "☾" : pref() === "system" ? "אוטו" : "☀︎"; }
  var SHARE = {
    url: "https://deadpaul134.github.io/bass-notebook/",
    title: "מחברת בס",
    text: "מחברת בס – מחברת תווים לטאבלט, בעברית, שעובדת גם בלי אינטרנט."
  };
  function shareIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/></svg>';
  }
  function copyShareUrl(url) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(url);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { if (document.execCommand("copy")) resolve(); else reject(new Error("copy failed")); }
      catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }
  function shareApp() {
    var payload = { title: SHARE.title, text: SHARE.text, url: SHARE.url };
    var p = navigator.share ? navigator.share(payload) : Promise.reject(new Error("no-share"));
    return p.catch(function (err) {
      if (err && err.name === "AbortError") return;
      return copyShareUrl(SHARE.url).then(function () { toast("הקישור הועתק"); });
    });
  }
  function cycleTheme() {
    var order = ["light", "dark", "system"];
    applyTheme(order[(Math.max(0, order.indexOf(pref())) + 1) % 3]);
    if (BN.state.current && $("#score")) BN.editor.redraw();
    var btn = $("[data-action='theme']");
    if (btn) btn.textContent = themeLabel();
  }
  function route() {
    var h = (location.hash || "#list").replace(/^#/, "");
    if (h === "settings") return { name: "settings" };
    if (h.indexOf("score/") === 0) return { name: "score", id: decodeURIComponent(h.slice(6)) };
    return { name: "list" };
  }
  function go(hash) { if (location.hash !== hash) location.hash = hash; else render(); }
  function toast(text, undo) {
    var node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = "<span>" + BN.esc(text) + "</span>";
    if (undo) {
      var b = document.createElement("button");
      b.type = "button";
      b.dataset.action = "toast-undo";
      b.textContent = "בטל";
      b.onclick = function () { undo(); node.remove(); };
      node.appendChild(b);
    }
    var host = $("#toasts");
    if (host) host.appendChild(node);
    setTimeout(function () { node.remove(); }, 5000);
  }
  function closePop() { var pop = $("#pop"); if (pop) { pop.hidden = true; pop.innerHTML = ""; } }
  function openPop(html, x, y) {
    var pop = $("#pop");
    pop.hidden = false;
    pop.innerHTML = html;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - 280, x || 16)) + "px";
    pop.style.top = Math.max(8, Math.min(window.innerHeight - 320, y || 64)) + "px";
  }
  function render() {
    if (BN.playback && BN.playback.isPlaying()) BN.playback.stop();
    var r = route();
    if (r.name === "settings") renderSettings();
    else if (r.name === "score") renderScore(r.id);
    else renderList();
  }
  function card(row) {
    var icon = row.layout === "grand" ? "𝄞𝄢" : row.layout === "treble" ? "𝄞" : "𝄢";
    return '<article class="idea" data-id="' + BN.esc(row.id) + '"><button type="button" class="idea-open" data-action="open" data-id="' + BN.esc(row.id) + '"><span class="idea-title">' + BN.esc(row.title || "") + '</span><span class="idea-meta">' + BN.esc(row.date || "") + " ♩=" + BN.esc(row.bpm || "") + " " + BN.esc(row.key || "") + " " + icon + '</span></button><button type="button" class="more" data-action="more" data-id="' + BN.esc(row.id) + '" aria-label="פעולות">⋮</button></article>';
  }
  function renderList() {
    BN.state.current = null;
    var rows = BN.list.sort(BN.list.filter(BN.store.list(), query), sortMode);
    $("#app").innerHTML =
      '<main class="screen" data-screen="list"><header class="top"><h1>המחברת שלי</h1><button type="button" class="share-btn" data-action="share" aria-label="שתף קישור למחברת בס">' + shareIcon() + '<span>שתף</span></button><a class="icon-btn" href="#settings" aria-label="הגדרות">⚙</a><button type="button" class="icon-btn" data-action="theme" aria-label="ערכת צבע">' + themeLabel() + '</button></header>' +
      '<div class="filters"><input id="search" class="field" placeholder="חיפוש לפי שם, תגית, הערה או סולם" value="' + BN.esc(query) + '"><select id="sort" class="field" aria-label="מיון"><option value="updated">עודכן לאחרונה</option><option value="date">תאריך</option><option value="name">שם</option></select></div>' +
      '<section class="ideas">' + (rows.map(card).join("") || '<p class="empty">עוד אין רעיונות. הראשון מחכה לכפתור למטה.</p>') + "</section>" +
      '<button type="button" class="fab" data-action="new-score">＋ רעיון חדש</button>' +
      '<div id="new-menu" class="new-menu" hidden><button type="button" data-layout="bass">פה 𝄢</button><button type="button" data-layout="treble">סול 𝄞</button><button type="button" data-layout="grand">כפול</button></div></main>';
    var sort = $("#sort");
    if (sort) sort.value = sortMode;
    var search = $("#search");
    if (search) search.oninput = function (e) {
      query = e.target.value;
      var found = BN.list.sort(BN.list.filter(BN.store.list(), query), sortMode);
      $(".ideas").innerHTML = found.map(card).join("") || '<p class="empty">אין תוצאות.</p>';
    };
    if (sort) sort.onchange = function (e) { sortMode = e.target.value; renderList(); };
    maybeBackup();
  }
  function maybeBackup() {
    var opened = Number(localStorage.getItem(BN.KEYS.opened) || Date.now());
    localStorage.setItem(BN.KEYS.opened, String(opened));
    var last = Number(localStorage.getItem(BN.KEYS.backup) || 0);
    if (BN.store.list().length && Date.now() - opened > 14 * 86400000 && Date.now() - last > 14 * 86400000) {
      var banner = document.createElement("p");
      banner.className = "banner";
      banner.textContent = "עברו שבועיים בלי גיבוי. שווה לייצא JSON מההגדרות — הנתונים נשארים רק במכשיר.";
      var screen = $("[data-screen='list']");
      if (screen) screen.insertBefore(banner, screen.children[1]);
    }
  }
  function createScore(layout) {
    var score = BN.model.blank({ staffLayout: layout || BN.data.settings().clef || "bass" });
    BN.history.reset(score.id);
    BN.store.schedule(score);
    BN.store.flush().then(function () { go("#score/" + encodeURIComponent(score.id)); });
  }
  function typeBtn(type, label) {
    return '<button type="button" data-type="' + type + '">' + label + "</button>";
  }
  function undoButton(enabled) {
    return '<button type="button" class="icon-btn undo-btn" data-action="undo" aria-label="בטל" title="בטל"' +
      (enabled ? "" : " disabled") +
      '><svg class="undo-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg><span class="undo-label">בטל</span></button>';
  }
  function renderScore(id) {
    var score = BN.store.get(id);
    if (!score) return go("#list");
    BN.state.current = score;
    BN.state.selection = [];
    BN.state.rate = rate;
    var key = BN.music.vfKey(BN.model.keyOf(score.parts[0], 0));
    var time = BN.model.timeOf(score.parts[0], 0);
    var clef = score.staffLayout === "grand" ? "כפול" : score.staffLayout === "treble" ? "סול" : "פה";
    var canUndo = BN.history.canUndo(score.id);
    $("#app").innerHTML =
      '<main class="screen editor" data-screen="editor" data-hand="' + BN.esc(BN.data.settings().hand || "right") + '">' +
      '<header class="top"><button type="button" class="icon-btn" data-action="back" aria-label="חזרה">→</button>' +
      '<input id="score-title" class="title-input" value="' + BN.esc(score.title || "") + '" aria-label="כותרת">' +
      undoButton(canUndo) +
      '<button type="button" class="icon-btn" data-action="play" aria-label="השמעה">▶</button>' +
      '<button type="button" class="icon-btn" data-action="stop" aria-label="עצירה">■</button>' +
      '<button type="button" class="icon-btn" data-action="theme">' + themeLabel() + "</button></header>" +
      '<div class="chips"><button type="button" class="chip" data-chip="key">' + BN.esc(key) + "</button>" +
      '<button type="button" class="chip" data-chip="time">' + time.beats + "/" + time.beatType + "</button>" +
      '<button type="button" class="chip" data-chip="tempo">♩=' + score.tempo.bpm + "</button>" +
      '<button type="button" class="chip" data-chip="clef">' + clef + "</button>" +
      '<button type="button" class="chip" data-chip="barline">קו</button>' +
      '<button type="button" class="chip" data-action="export-musicxml">MusicXML</button>' +
      '<button type="button" class="chip" data-action="export-pdf">PDF</button>' +
      '<button type="button" class="chip" data-action="export-png">PNG</button></div>' +
      '<div class="editor-body"><div id="stage" class="stage"><div id="score" dir="ltr"></div></div>' +
      '<aside class="rail"><div class="tempo-live"><button type="button" data-action="bpm-down">−</button><span id="bpm">' + score.tempo.bpm + '</span><button type="button" data-action="bpm-up">+</button></div>' +
      '<button type="button" data-rate="0.5">×0.5</button><button type="button" data-rate="0.75">×0.75</button><button type="button" data-rate="1">×1</button>' +
      '<button type="button" data-zoom="out" aria-label="הקטנה">−</button><button type="button" data-zoom="in" aria-label="הגדלה">+</button></aside></div>' +
      '<div class="palette" id="palette"><div class="palette-main">' +
      typeBtn("whole", "𝅝") + typeBtn("half", "𝅗𝅥") + typeBtn("quarter", "♩") + typeBtn("eighth", "♪") + typeBtn("16th", "16") +
      '<button type="button" data-hist="undo" aria-label="בטל" title="בטל"' + (canUndo ? "" : " disabled") + '>↶</button>' +
      '<button type="button" data-action="step-up" aria-label="גובה למעלה" disabled>↑</button>' +
      '<button type="button" data-action="step-down" aria-label="גובה למטה" disabled>↓</button>' +
      '<button type="button" data-zoom="out" aria-label="הקטנה">−</button>' +
      '<button type="button" data-zoom="in" aria-label="הגדלה">+</button>' +
      '</div><div class="palette-more">' +
      '<button type="button" data-action="rest">𝄽</button>' +
      '<button type="button" data-action="dots">·</button>' +
      '<button type="button" data-action="tie">⁀</button>' +
      '<button type="button" data-acc="sharp">♯</button>' +
      '<button type="button" data-acc="flat">♭</button>' +
      '<button type="button" data-acc="natural">♮</button>' +
      '<button type="button" data-action="delete" aria-label="מחיקה">🗑</button>' +
      '<button type="button" data-action="redo" aria-label="חזור">↷</button>' +
      '<button type="button" data-action="select" aria-label="בחירה">↖</button></div></div></main>';
    var title = $("#score-title");
    title.addEventListener("input", function () {
      if (!BN.state.current) return;
      if (title.dataset.undoOpen !== "1") {
        BN.history.exec(BN.state.current, function (current) { current.title = title.value; });
        title.dataset.undoOpen = "1";
        if (BN.editor && BN.editor.syncPalette) BN.editor.syncPalette();
      } else BN.state.current.title = title.value;
      BN.store.schedule(BN.state.current);
    });
    title.addEventListener("blur", function () { title.dataset.undoOpen = ""; });
    BN.editor.mount($("#stage"));
    BN.editor.redraw();
    refreshRate();
  }
  function refreshChips() {
    var score = BN.state.current;
    if (!score) return;
    var keyBtn = document.querySelector("[data-chip='key']");
    var timeBtn = document.querySelector("[data-chip='time']");
    var tempoBtn = document.querySelector("[data-chip='tempo']");
    var clefBtn = document.querySelector("[data-chip='clef']");
    var bpm = $("#bpm");
    if (keyBtn) keyBtn.textContent = BN.music.vfKey(BN.model.keyOf(score.parts[0], 0));
    var time = BN.model.timeOf(score.parts[0], 0);
    if (timeBtn) timeBtn.textContent = time.beats + "/" + time.beatType;
    if (tempoBtn) tempoBtn.textContent = "♩=" + score.tempo.bpm;
    if (clefBtn) clefBtn.textContent = score.staffLayout === "grand" ? "כפול" : score.staffLayout === "treble" ? "סול" : "פה";
    if (bpm) bpm.textContent = String(Math.round(score.tempo.bpm * (BN.state.rate || 1)));
  }
  BN.syncChrome = function () {
    refreshChips();
    var title = $("#score-title");
    if (!title || !BN.state.current || document.activeElement === title) return;
    title.value = BN.state.current.title || "";
    title.dataset.undoOpen = "";
  };
  function refreshRate() {
    document.querySelectorAll("[data-rate]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", Number(btn.dataset.rate) === rate ? "true" : "false");
    });
  }
  function edit(mutate) {
    BN.history.exec(BN.state.current, mutate);
    BN.store.schedule(BN.state.current);
    BN.editor.redraw();
    refreshChips();
  }
  function setBpm(next) {
    next = Math.max(40, Math.min(240, Math.round(next)));
    edit(function (score) { score.tempo.bpm = next; });
    if (BN.playback.isPlaying()) BN.playback.setTempo(BN.state.current, next * rate);
  }
  function contentMeasure(score) {
    var measures = score.parts[0].measures;
    for (var i = measures.length - 1; i >= 0; i--) {
      if (measures[i].notes.some(function (n) { return !n.generated; }) || measures[i].attributes) {
        if (i > 0 && !measures[i].notes.some(function (n) { return !n.generated; }) && !measures[i].barline) continue;
        return i;
      }
    }
    return 0;
  }
  function keyMenu() {
    var html = '<div class="key-grid">';
    BN.music.MAJOR.forEach(function (row) {
      var minor = BN.music.MINOR_OF[row[1]];
      html += '<button type="button" data-keyname="' + row[1] + '">' + row[1] + "</button>";
      html += '<button type="button" data-keyname="' + minor + '">' + minor + "</button>";
    });
    return html + "</div>";
  }
  function timeMenu() {
    var presets = ["2/4", "3/4", "4/4", "5/4", "6/8", "7/8", "9/8", "12/8"];
    var html = '<div class="key-grid">';
    presets.forEach(function (p) { html += '<button type="button" data-time="' + p + '">' + p + "</button>"; });
    html += '</div><label class="check">מונה <input id="custom-beats" type="number" min="1" max="16" value="4"></label>';
    html += '<label class="check">מכנה <select id="custom-type"><option>2</option><option selected>4</option><option>8</option><option>16</option></select></label>';
    html += '<button type="button" data-action="time-custom">שמירה</button>';
    return html;
  }
  function clefMenu() {
    return '<button type="button" data-set-layout="bass">פה 𝄢</button><button type="button" data-set-layout="treble">סול 𝄞</button><button type="button" data-set-layout="grand">כפול</button>';
  }
  function barMenu() {
    return '<button type="button" data-bar="regular">רגיל</button><button type="button" data-bar="light-light">קו כפול</button><button type="button" data-bar="light-heavy">קו סיום</button><button type="button" data-bar="repeat-forward">חזרה מתחילה</button><button type="button" data-bar="repeat-backward">חזרה נגמרת</button>';
  }
  function tempoMenu() {
    var bpm = BN.state.current ? BN.state.current.tempo.bpm : 100;
    return '<label class="check">♩ <input id="bpm-input" type="number" min="40" max="240" value="' + bpm + '"></label><button type="button" data-action="bpm-set">שמירה</button><button type="button" data-action="tap-tempo">הקש טמפו</button>';
  }
  function applyLayout(layout) {
    var score = BN.state.current;
    var prev = score.staffLayout;
    if (prev === "grand" && layout !== "grand") {
      var staff = layout === "bass" ? 1 : 2;
      var doomed = score.parts[0].measures.some(function (m) {
        return m.notes.some(function (n) { return n.staff === staff && !n.rest && !n.generated; });
      });
      var message = layout === "bass" ? "התווים בחמשה העליונה יימחקו" : "התווים בחמשה התחתונה יימחקו";
      if (doomed && !window.confirm(message)) return;
    }
    edit(function (s) { BN.model.setLayout(s, layout); });
    closePop();
  }
  function applyBar(kind) {
    var score = BN.state.current;
    var index = contentMeasure(score);
    var barline = { right: "regular" };
    if (kind === "light-light") barline = { right: "light-light" };
    if (kind === "light-heavy") barline = { right: "light-heavy" };
    if (kind === "repeat-forward") barline = { right: "regular", repeat: "forward" };
    if (kind === "repeat-backward") barline = { right: "light-heavy", repeat: "backward" };
    edit(function (s) { BN.model.setBarline(s, index, barline); });
    closePop();
  }
  function downloadBlob(blob, name) {
    if (navigator.share && navigator.canShare) {
      var file = new File([blob], name, { type: blob.type || "application/octet-stream" });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: name }).catch(function () { BN.export.download(blob, name); });
        return;
      }
    }
    BN.export.download(blob, name);
  }
  function exportMusicXml() {
    var score = BN.state.current;
    var xml = BN.musicxml.export(score);
    downloadBlob(new Blob([xml], { type: "application/vnd.recordare.musicxml+xml" }), BN.export.filename(score, "musicxml"));
  }
  function exportPdf() {
    var score = BN.state.current;
    BN.export.pdfBlob(score).then(function (blob) {
      downloadBlob(blob, BN.export.filename(score, "pdf"));
    }).catch(function () { toast("ייצוא PDF נכשל"); });
  }
  function exportPng() {
    var score = BN.state.current;
    BN.export.pngBlob(score).then(function (blob) {
      downloadBlob(blob, BN.export.filename(score, "png"));
    }).catch(function () { toast("ייצוא PNG נכשל"); });
  }
  function duplicate(id) {
    var score = BN.store.get(id);
    if (!score) return;
    var copy = JSON.parse(JSON.stringify(score));
    copy.id = BN.uid("s");
    copy.title = (score.title || "רעיון") + " (עותק)";
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    BN.store.schedule(copy);
    BN.store.flush().then(renderList);
  }
  function removeScore(id) {
    var score = BN.store.get(id);
    if (!score) return;
    var snapshot = JSON.parse(JSON.stringify(score));
    BN.store.remove(id).then(function () {
      renderList();
      toast("נמחק", function () {
        BN.store.schedule(snapshot);
        BN.store.flush().then(renderList);
      });
    });
  }
  function renderSettings() {
    var s = BN.data.settings();
    $("#app").innerHTML =
      '<main class="screen" data-screen="settings"><header class="top"><a class="icon-btn" href="#list" aria-label="חזרה">→</a><h1>הגדרות</h1><button type="button" class="share-btn" data-action="share" aria-label="שתף קישור למחברת בס">' + shareIcon() + '<span>שתף</span></button><button type="button" class="icon-btn" data-action="theme">' + themeLabel() + "</button></header>" +
      '<section class="card"><h2>מראה</h2><p>ערכת הצבע הנוכחית: ' + BN.esc(pref()) + '</p>' +
      '<label class="check">מפתח לרעיון חדש <select id="set-clef"><option value="bass">פה</option><option value="treble">סול</option><option value="grand">כפול</option></select></label>' +
      '<label class="check">יד דומיננטית <select id="set-hand"><option value="right">ימין</option><option value="left">שמאל</option></select></label></section>' +
      '<section class="card"><h2>צליל</h2><p>סינתזה מקומית, בלי קבצי דגימה. בס: שן מסור, סול: משולש.</p>' +
      '<label class="check">עוצמה <input id="set-volume" type="range" min="0" max="1" step="0.05" value="' + s.volume + '"></label>' +
      '<label class="check"><input id="set-metro" type="checkbox"' + (s.metronome ? " checked" : "") + "> מטרונום בהשמעה</label>" +
      '<label class="check"><input id="set-count" type="checkbox"' + (s.countIn ? " checked" : "") + "> count-in של תיבה</label></section>" +
      '<section class="card"><h2>גיבוי</h2><p>הנתונים נשמרים רק במכשיר הזה. קובץ פגום לא ישנה כלום.</p>' +
      '<button type="button" class="text-btn" data-action="backup">הורדת JSON</button>' +
      '<label class="check">שחזור <select id="restore-mode"><option value="merge">מיזוג</option><option value="replace">החלפה</option></select></label>' +
      '<label class="file">קובץ גיבוי <input id="restore-file" type="file" accept="application/json,.json"></label>' +
      '<p id="form-error" class="form-error"></p></section>' +
      '<section class="card"><h2>אודות</h2><p>מחברת בס — כתיבת תווים חינמית, בלי חשבון ובלי פרסומות. רישיון MIT © Paul Samson.</p>' +
      '<p>VexFlow ו-Bravura, jsPDF, svg2pdf.js, Heebo. אין Tone.js ואין דגימות. הפירוט ב-THIRD_PARTY_NOTICES.</p></section></main>';
    $("#set-clef").value = s.clef;
    $("#set-hand").value = s.hand;
    $("#set-clef").onchange = function (e) { BN.data.saveSettings({ clef: e.target.value }); };
    $("#set-hand").onchange = function (e) { BN.data.saveSettings({ hand: e.target.value }); };
    $("#set-volume").oninput = function (e) { BN.data.saveSettings({ volume: Number(e.target.value) }); };
    $("#set-metro").onchange = function (e) { BN.data.saveSettings({ metronome: e.target.checked }); };
    $("#set-count").onchange = function (e) { BN.data.saveSettings({ countIn: e.target.checked }); };
    $("#restore-file").onchange = function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) restoreFile(file, $("#restore-mode").value);
      e.target.value = "";
    };
  }
  function restoreFile(file, mode) {
    var reader = new FileReader();
    reader.onload = function () {
      var error = $("#form-error");
      try {
        var parsed = JSON.parse(String(reader.result || ""));
        var data = BN.export.validate(parsed);
        if (mode === "replace") {
          if (!window.confirm("להחליף את כל המחברת? הפעולה מוחקת את היצירות הנוכחיות.")) return;
          if (!window.confirm("אישור שני: להחליף הכל עכשיו?")) return;
        }
        BN.export.importData(data, mode).then(function () {
          localStorage.setItem(BN.KEYS.backup, String(Date.now()));
          if (error) error.textContent = "";
          toast(mode === "replace" ? "המחברת הוחלפה" : "הגיבוי מוזג");
        });
      } catch (err) {
        var message = err && err.message && /גיבוי|פגום/.test(err.message) ? err.message : "הקובץ פגום";
        if (error) error.textContent = message;
      }
    };
    reader.readAsText(file);
  }
  function onClick(e) {
    var layout = e.target.closest("[data-layout]");
    if (layout && route().name === "list") { createScore(layout.dataset.layout); return; }
    var more = e.target.closest("[data-more]");
    if (more) {
      var id = more.dataset.id;
      closePop();
      if (more.dataset.more === "dup") duplicate(id);
      if (more.dataset.more === "rename") {
        var current = BN.store.get(id);
        var name = window.prompt("שם חדש", current ? current.title : "");
        if (name && current) {
          current.title = name;
          current.updatedAt = new Date().toISOString();
          BN.store.schedule(current);
          BN.store.flush().then(renderList);
        }
      }
      if (more.dataset.more === "del") removeScore(id);
      return;
    }
    var btn = e.target.closest("[data-action], [data-chip], [data-rate], [data-zoom], [data-keyname], [data-time], [data-set-layout], [data-bar]");
    if (!btn) {
      if (!e.target.closest("#pop")) closePop();
      return;
    }
    var action = btn.dataset.action;
    if (action === "theme") cycleTheme();
    if (action === "share") shareApp();
    if (action === "new-score") {
      var menu = $("#new-menu");
      if (menu) menu.hidden = !menu.hidden;
    }
    if (action === "open") go("#score/" + encodeURIComponent(btn.dataset.id));
    if (action === "more") {
      openPop(
        '<button type="button" data-more="dup" data-id="' + btn.dataset.id + '">שכפול</button><button type="button" data-more="rename" data-id="' + btn.dataset.id + '">שינוי שם</button><button type="button" data-more="del" data-id="' + btn.dataset.id + '">מחיקה</button>',
        e.clientX - 80,
        e.clientY
      );
    }
    if (action === "back") go("#list");
    if (action === "play" && BN.state.current) {
      if (BN.playback.isPlaying()) {
        BN.playback.pause();
        btn.textContent = "▶";
      } else {
        BN.playback.play(BN.state.current, { bpm: BN.state.current.tempo.bpm * rate });
        btn.textContent = "⏸";
      }
    }
    if (action === "stop") {
      BN.playback.stop();
      var play = document.querySelector("[data-action='play']");
      if (play) play.textContent = "▶";
    }
    if (action === "bpm-down") setBpm(BN.state.current.tempo.bpm - 1);
    if (action === "bpm-up") setBpm(BN.state.current.tempo.bpm + 1);
    if (btn.dataset.rate) {
      rate = Number(btn.dataset.rate);
      BN.state.rate = rate;
      refreshRate();
      refreshChips();
      if (BN.state.current && BN.playback.isPlaying()) BN.playback.setTempo(BN.state.current, BN.state.current.tempo.bpm * rate);
    }
    if (btn.dataset.zoom && BN.state.current) {
      var zoom = BN.state.zoom || 1;
      zoom = btn.dataset.zoom === "in" ? Math.min(2, zoom + 0.2) : Math.max(0.6, zoom - 0.2);
      BN.state.zoom = zoom;
      var host = $("#score");
      if (host) {
        host.style.transformOrigin = "top center";
        host.style.transform = "scale(" + zoom + ")";
      }
      if (BN.editor && BN.editor.positionSelection) BN.editor.positionSelection();
    }
    if (action === "export-musicxml") exportMusicXml();
    if (action === "export-pdf") exportPdf();
    if (action === "export-png") exportPng();
    if (action === "backup") {
      var blob = new Blob([JSON.stringify(BN.export.toJSON(), null, 2)], { type: "application/json" });
      BN.export.download(blob, "bass-notebook-backup.json");
      localStorage.setItem(BN.KEYS.backup, String(Date.now()));
    }
    if (btn.dataset.chip && BN.state.current) {
      var menus = { key: keyMenu, time: timeMenu, tempo: tempoMenu, clef: clefMenu, barline: barMenu };
      openPop(menus[btn.dataset.chip](), e.clientX - 40, e.clientY + 8);
    }
    if (btn.dataset.keyname && BN.state.current) {
      var key = BN.music.keyFromName(btn.dataset.keyname);
      edit(function (score) { BN.model.setKeyFrom(score, 0, key); });
      closePop();
    }
    if (btn.dataset.time && BN.state.current) {
      var bits = btn.dataset.time.split("/");
      edit(function (score) { BN.model.setTimeFrom(score, 0, { beats: Number(bits[0]), beatType: Number(bits[1]) }); });
      closePop();
    }
    if (action === "time-custom" && BN.state.current) {
      var beats = Math.max(1, Math.min(16, Number($("#custom-beats").value || 4)));
      var beatType = Number($("#custom-type").value || 4);
      edit(function (score) { BN.model.setTimeFrom(score, 0, { beats: beats, beatType: beatType }); });
      closePop();
    }
    if (action === "bpm-set") setBpm(Number($("#bpm-input").value || 100));
    if (action === "tap-tempo") {
      var t = Date.now();
      tapTimes.push(t);
      tapTimes = tapTimes.filter(function (n) { return t - n < 2500; });
      if (tapTimes.length >= 2) {
        var gaps = [];
        for (var i = 1; i < tapTimes.length; i++) gaps.push(tapTimes[i] - tapTimes[i - 1]);
        var avg = gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length;
        setBpm(60000 / avg);
      }
    }
    if (btn.dataset.setLayout) applyLayout(btn.dataset.setLayout);
    if (btn.dataset.bar) applyBar(btn.dataset.bar);
  }
  function boot() {
    if (!location.hash) location.hash = "#list";
    applyTheme();
    document.addEventListener("click", onClick);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") BN.store.flush();
    });
    window.addEventListener("pagehide", function () { BN.store.flush(); });
    window.addEventListener("hashchange", render);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    if ("serviceWorker" in navigator && location.search.indexOf("nosw=1") < 0) {
      navigator.serviceWorker.register("./sw.js").then(function (reg) {
        reg.addEventListener("updatefound", function () {
          var worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", function () {
            if (worker.state === "installed" && navigator.serviceWorker.controller) toast("גרסה חדשה — רענן");
          });
        });
      }).catch(function () {});
    }
    BN.store.ready().then(render);
  }
  boot();
})();
