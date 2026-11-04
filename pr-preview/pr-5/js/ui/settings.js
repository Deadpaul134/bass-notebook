/* Settings: theme, Keypad side, input, sound, backup. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});

  function $(s) { return document.querySelector(s); }
  function seg(name, options, value) {
    return '<div class="seg" role="group" data-seg="' + name + '">' + options.map(function (o) {
      return '<button type="button" data-val="' + o[0] + '" aria-pressed="' + (String(value) === String(o[0])) + '">' + o[1] + "</button>";
    }).join("") + "</div>";
  }
  function check(id, text, on) {
    return '<label class="check"><input id="' + id + '" type="checkbox"' + (on ? " checked" : "") + "> " + text + "</label>";
  }

  function restoreFile(file, mode) {
    var reader = new FileReader();
    reader.onload = function () {
      var error = $("#form-error");
      try {
        var data = BN.export.validate(JSON.parse(String(reader.result || "")));
        if (mode === "replace") {
          if (!window.confirm("להחליף את כל המחברת? הפעולה מוחקת את היצירות הנוכחיות.")) return;
          if (!window.confirm("אישור שני: להחליף הכל עכשיו?")) return;
        }
        BN.export.importData(data, mode).then(function () {
          localStorage.setItem(BN.KEYS.backup, String(Date.now()));
          if (error) error.textContent = "";
          BN.toast.show(mode === "replace" ? "המחברת הוחלפה" : "הגיבוי מוזג");
        });
      } catch (err) {
        var message = err && err.message && /גיבוי|פגום/.test(err.message) ? err.message : "הקובץ פגום";
        if (error) error.textContent = message;
      }
    };
    reader.readAsText(file);
  }

  BN.ui = BN.ui || {};
  BN.ui.settings = {
    render: function (host) {
      var s = BN.data.settings();
      host.innerHTML =
        '<header class="topbar"><a class="tb-btn" href="#list" aria-label="חזרה">' + BN.icons.svg("back", 24) + "</a><h1>הגדרות</h1></header>" +
        '<div class="settings-body">' +
        '<section class="card"><h2>מראה</h2><div class="row"><span>ערכת צבע</span>' + seg("theme", [["light", "בהיר"], ["dark", "כהה"], ["system", "מערכת"]], BN.app.themePref()) + "</div>" +
        '<div class="row"><span>מפתח לרעיון חדש</span>' + seg("clef", [["bass", "פה"], ["treble", "סול"], ["grand", "כפול"]], s.clef) + "</div>" +
        '<div class="row"><span>יד דומיננטית (הלוח בצד הנגדי)</span>' + seg("hand", [["right", "ימין"], ["left", "שמאל"]], s.hand) + "</div>" +
        '<div class="row"><span>מלחין ברירת מחדל</span><input id="set-composer" class="field" value="' + BN.esc(s.composer || "") + '"></div>' +
        '<div class="row"><button type="button" class="btn-text" data-action="reset-keypad">איפוס מיקום הלוח</button></div></section>' +
        '<section class="card"><h2>הזנה</h2>' +
        check("set-drag", "גרירה על הלוח קובעת גובה (החזקה וגרירה על משך)", s.dragEntry) +
        check("set-tap", "הקשה על החמשה מוסיפה תו", s.tapInput) + "</section>" +
        '<section class="card"><h2>צליל</h2>' +
        check("set-playback", "השמעה (כבויה: אין צליל בהזנה ואין כפתור השמעה)", s.playback) +
        '<p class="note">סינתזה מקומית, בלי קבצי דגימה. בס: שן מסור, סול: משולש.</p>' +
        '<label class="check">עוצמה <input id="set-volume" type="range" min="0" max="1" step="0.05" value="' + s.volume + '"></label>' +
        check("set-metro", "מטרונום בהשמעה", s.metronome) + check("set-count", "ספירה של תיבה לפני ההשמעה", s.countIn) + "</section>" +
        '<section class="card"><h2>גיבוי</h2><p class="note">הנתונים נשמרים רק במכשיר הזה. קובץ פגום לא ישנה כלום.</p>' +
        '<button type="button" class="btn-text" data-action="backup">הורדת גיבוי JSON</button>' +
        '<div class="row"><span>שחזור</span>' + seg("restore", [["merge", "מיזוג"], ["replace", "החלפה"]], "merge") + "</div>" +
        '<label class="file">קובץ גיבוי <input id="restore-file" type="file" accept="application/json,.json"></label>' +
        '<p id="form-error" class="form-error"></p></section>' +
        '<section class="card"><h2>אודות</h2><p>מחברת בס — כתיבת תווים חינמית, בלי חשבון ובלי פרסומות. רישיון MIT © Paul Samson.</p>' +
        "<p>VexFlow ו-Bravura, jsPDF, svg2pdf.js, Heebo. הפירוט ב-THIRD_PARTY_NOTICES.</p></section></div>";
      host.querySelectorAll("[data-seg]").forEach(function (group) {
        group.addEventListener("click", function (e) {
          var b = e.target.closest("button");
          if (!b) return;
          var name = group.dataset.seg;
          var val = b.dataset.val;
          if (name === "theme") BN.app.applyTheme(val);
          else if (name === "clef") BN.data.saveSettings({ clef: val });
          else if (name === "hand") { BN.data.saveSettings({ hand: val }); BN.ui.keypad.place(); }
          group.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        });
      });
      $("#set-composer").oninput = function (e) { BN.data.saveSettings({ composer: e.target.value }); };
      $("#set-drag").onchange = function (e) { BN.data.saveSettings({ dragEntry: e.target.checked }); };
      $("#set-tap").onchange = function (e) { BN.data.saveSettings({ tapInput: e.target.checked }); };
      $("#set-playback").onchange = function (e) { BN.data.saveSettings({ playback: e.target.checked }); };
      $("#set-volume").oninput = function (e) { BN.data.saveSettings({ volume: Number(e.target.value) }); };
      $("#set-metro").onchange = function (e) { BN.data.saveSettings({ metronome: e.target.checked }); };
      $("#set-count").onchange = function (e) { BN.data.saveSettings({ countIn: e.target.checked }); };
      $("#restore-file").onchange = function (e) {
        var file = e.target.files && e.target.files[0];
        var mode = host.querySelector("[data-seg='restore'] [aria-pressed='true']").dataset.val;
        if (file) restoreFile(file, mode);
        e.target.value = "";
      };
      host.onclick = function (e) {
        var b = e.target.closest("[data-action]");
        if (!b) return;
        if (b.dataset.action === "backup") BN.actions.backup();
        if (b.dataset.action === "reset-keypad") { BN.ui.keypad.resetPosition(); BN.ui.keypad.setHidden(false); BN.toast.show("מיקום הלוח אופס"); }
      };
    }
  };
})();
