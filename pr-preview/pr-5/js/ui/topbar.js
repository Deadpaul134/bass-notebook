/* Top bar: back, title, mode tabs, undo/redo, play, menu. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var root = null;
  var saveTimer = 0;
  var pending = false;
  var TABS = [["input", "הזנת תווים"], ["marks", "סימנים"], ["measures", "תיבות"], ["text", "טקסט"], ["play", "השמעה"]];

  function fmtDate(iso) {
    var d = iso ? new Date(iso) : new Date();
    if (isNaN(d)) d = new Date();
    return String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear();
  }

  function menuHtml() {
    return '<button type="button" data-menu="musicxml">ייצוא MusicXML</button>' +
      '<button type="button" data-menu="pdf">ייצוא PDF</button>' +
      '<button type="button" data-menu="png">ייצוא PNG</button>' +
      '<button type="button" data-menu="json">גיבוי JSON</button>' +
      '<hr><button type="button" data-menu="page">הגדרות דף</button>' +
      '<button type="button" data-menu="settings">הגדרות</button>' +
      '<button type="button" data-menu="list">המחברת שלי</button>';
  }

  function pageHtml() {
    var sc = BN.state.current;
    var l = sc.staffLayout;
    return '<div class="pop-title">הגדרות דף</div><div class="seg" role="group" aria-label="מפתח">' +
      [["bass", "פה"], ["treble", "סול"], ["grand", "כפול"]].map(function (o) {
        return '<button type="button" data-layout-set="' + o[0] + '" aria-pressed="' + (l === o[0]) + '">' + o[1] + "</button>";
      }).join("") + '</div><label class="field-row">מלחין<input id="pg-composer" class="field" value="' + BN.esc(sc.composer || "") + '"></label>';
  }

  BN.ui = BN.ui || {};
  BN.ui.topbar = {
    mount: function (el) {
      root = el;
      el.innerHTML =
        '<button type="button" class="tb-btn" data-action="back" aria-label="חזרה למחברת">' + BN.icons.svg("back", 24) + "</button>" +
        '<div class="tb-title"><input id="score-title" class="title-input" aria-label="כותרת" autocomplete="off"><div class="tb-sub" id="save-state"></div></div>' +
        '<div class="tabs" role="tablist" aria-label="מצב">' +
        TABS.map(function (t) { return '<button type="button" role="tab" class="tab" data-tab="' + t[0] + '">' + t[1] + "</button>"; }).join("") + "</div>" +
        '<button type="button" class="tb-btn box" data-action="undo" aria-label="בטל" title="בטל">' + BN.icons.svg("undo", 24) + "</button>" +
        '<button type="button" class="tb-btn box" data-action="redo" aria-label="בצע שוב" title="בצע שוב">' + BN.icons.svg("redo", 24) + "</button>" +
        '<button type="button" class="tb-btn play" data-action="play" aria-label="השמעה" title="השמעה">' + BN.icons.svg("play", 24) + "</button>" +
        '<button type="button" class="tb-btn" data-action="more" aria-label="עוד" title="עוד">' + BN.icons.svg("more", 24) + "</button>";
      var title = el.querySelector("#score-title");
      title.addEventListener("input", function () {
        var sc = BN.state.current;
        if (!sc) return;
        if (title.dataset.undoOpen !== "1") {
          BN.editor.commit(function (s) { s.title = title.value; }, { noRedraw: true });
          title.dataset.undoOpen = "1";
        } else {
          sc.title = title.value;
          BN.store.schedule(sc);
        }
        BN.editor.syncHeader();
        BN.ui.topbar.saving();
      });
      title.addEventListener("blur", function () { title.dataset.undoOpen = ""; });
      el.addEventListener("click", function (e) {
        var btn = e.target.closest("button");
        if (!btn) return;
        var a = btn.dataset.action;
        if (btn.dataset.tab) { BN.state.tab = btn.dataset.tab; BN.ui.syncAll(); BN.pop.close(); return; }
        if (a === "back") BN.app.go("#list");
        else if (a === "undo") BN.editor.undo();
        else if (a === "redo") BN.editor.redo();
        else if (a === "play") BN.actions.play();
        else if (a === "more") {
          if (BN.pop.isOpen() && BN.pop.owner() === btn) { BN.pop.close(); return; }
          BN.pop.open(btn, menuHtml(), "menu");
        }
      });
    },
    togglePlay: function () { BN.actions.play(); },
    saving: function () {
      var s = document.getElementById("save-state");
      if (!s) return;
      pending = true;
      s.textContent = "שומר…";
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        BN.store.flush().then(function () { pending = false; BN.ui.topbar.sync(); });
      }, 450);
    },
    pageHtml: pageHtml,
    sync: function () {
      var sc = BN.state.current;
      if (!root || !sc) return;
      var title = root.querySelector("#score-title");
      if (title && document.activeElement !== title) {
        title.value = sc.title || "";
        title.dataset.undoOpen = "";
      }
      var st = root.querySelector("#save-state");
      if (st && !pending) st.textContent = "נשמר · " + fmtDate(sc.updatedAt || sc.date);
      root.querySelectorAll(".tab").forEach(function (t) {
        var on = t.dataset.tab === BN.state.tab;
        t.classList.toggle("on", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      root.querySelector("[data-action='undo']").disabled = !BN.history.canUndo(sc.id);
      root.querySelector("[data-action='redo']").disabled = !BN.history.canRedo(sc.id);
      var play = root.querySelector("[data-action='play']");
      var playing = BN.playback.isPlaying();
      play.innerHTML = BN.icons.svg(playing ? "pause" : "play", 24);
      play.setAttribute("aria-label", playing ? "השהיה" : "השמעה");
      play.classList.toggle("off", !BN.data.settings().playback);
    }
  };

  /* menu + page popover clicks are handled on the popover itself */
  document.addEventListener("click", function (e) {
    var m = e.target.closest("#pop [data-menu]");
    if (m) {
      var k = m.dataset.menu;
      BN.pop.close();
      if (k === "musicxml") BN.actions.exportMusicXml();
      else if (k === "pdf") BN.actions.exportPdf();
      else if (k === "png") BN.actions.exportPng();
      else if (k === "json") BN.actions.backup();
      else if (k === "settings") BN.app.go("#settings");
      else if (k === "list") BN.app.go("#list");
      else if (k === "page") BN.pop.open(root.querySelector("[data-action='more']"), pageHtml(), "menu wide");
      return;
    }
    var l = e.target.closest("#pop [data-layout-set]");
    if (l) { BN.pop.close(); BN.actions.applyLayout(l.dataset.layoutSet); }
  });
  document.addEventListener("input", function (e) {
    if (e.target && e.target.id === "pg-composer" && BN.state.current) {
      BN.state.current.composer = e.target.value;
      BN.store.schedule(BN.state.current);
      BN.editor.syncHeader();
    }
  });
})();
