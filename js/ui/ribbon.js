/* Ribbon: chips and tools for the active tab, with small popovers. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var root = null;
  var popFrom = 0;

  function sc() { return BN.state.current; }

  function keyLabel(key) {
    var name = BN.music.vfKey(key);
    var minor = name.slice(-1) === "m";
    var base = (minor ? name.slice(0, -1) : name).replace("b", "♭").replace("#", "♯");
    return base + (minor ? " מינור" : " מז'ור");
  }
  function clefLabel(layout) { return layout === "grand" ? "כפול" : layout === "treble" ? "סול" : "פה"; }

  function chip(id, label, value, extra) {
    return '<button type="button" class="chip" data-chip="' + id + '"' + (extra || "") + '><span class="chip-l">' + label + "</span> <b>" + value + "</b></button>";
  }
  function tool(attrs, icon, text, label) {
    return '<button type="button" class="chip tool" ' + attrs + ' aria-label="' + BN.esc(label || text) + '">' + (icon ? BN.icons.svg(icon, 22) : "") + (text ? "<span>" + text + "</span>" : "") + "</button>";
  }
  function toggle(attrs, text, on) {
    return '<button type="button" class="chip tool" ' + attrs + ' aria-pressed="' + (on ? "true" : "false") + '">' + text + "</button>";
  }

  function build() {
    var s = sc();
    var part = s.parts[0];
    var tab = BN.state.tab;
    var set = BN.data.settings();
    var html = "";
    if (tab === "input") {
      html = chip("clef", "מפתח", clefLabel(s.staffLayout)) +
        chip("key", "סולם", keyLabel(BN.model.keyOf(part, 0))) +
        chip("time", "משקל", BN.model.timeOf(part, 0).beats + "/" + BN.model.timeOf(part, 0).beatType) +
        chip("tempo", BN.icons.svg("quarter", 16, "ic-inline") + " =", s.tempo.bpm) +
        '<span class="sep"></span>' +
        chip("input", "קלט:", set.tapInput ? "הקשה + לוח" : "לוח בלבד") +
        chip("zoom", "זום", Math.round(BN.state.zoom * 100) + "%");
    } else if (tab === "marks") {
      html = tool('data-mark="artic:staccato"', "staccato", "סטקטו") + tool('data-mark="artic:accent"', "accent", "אקצנט") +
        tool('data-mark="artic:tenuto"', "tenuto", "טנוטו") + tool('data-mark="artic:fermata"', "fermata", "פרמטה") +
        '<span class="sep"></span>' +
        ["pp", "p", "mp", "mf", "f", "ff"].map(function (d) { return '<button type="button" class="chip tool dyn" data-mark="dyn:' + d + '" aria-label="דינמיקה ' + d + '">' + d + "</button>"; }).join("");
    } else if (tab === "measures") {
      var mi = BN.editor.targetMeasure();
      html = tool('data-rb="add-measure"', "measureAdd", "הוספת תיבה") + tool('data-rb="del-measure"', "measureDel", "מחיקת תיבה") +
        tool('data-rb="sel-measure"', "select", "בחירת תיבה") + tool('data-rb="sel-row"', "selectAll", "בחירת שורה") +
        '<span class="sep"></span>' +
        tool('data-bar="regular"', "bar", "רגיל", "קו תיבה רגיל") + tool('data-bar="light-light"', "barDouble", "כפול", "קו כפול") +
        tool('data-bar="light-heavy"', "barFinal", "סיום", "קו סיום") + tool('data-bar="forward"', "repeatStart", "חזרה", "תחילת חזרה") +
        tool('data-bar="backward"', "repeatEnd", "חזרה", "סוף חזרה") +
        '<span class="sep"></span>' +
        chip("key-from", "סולם מכאן", "תיבה " + (mi + 1)) + chip("time-from", "משקל מכאן", "תיבה " + (mi + 1));
    } else if (tab === "text") {
      html = '<label class="field-inline">כותרת <input id="rb-title" class="field" value="' + BN.esc(s.title || "") + '"></label>' +
        '<label class="field-inline">מלחין <input id="rb-composer" class="field" value="' + BN.esc(s.composer || "") + '"></label>' +
        '<label class="field-inline">הערה <input id="rb-comment" class="field" value="' + BN.esc(s.comment || "") + '"></label>';
    } else if (tab === "play") {
      html = chip("tempo", BN.icons.svg("quarter", 16, "ic-inline") + " =", Math.round(s.tempo.bpm * BN.state.rate)) +
        '<span class="sep"></span>' +
        [0.5, 0.75, 1].map(function (r) { return toggle('data-rate="' + r + '"', "×" + r, BN.state.rate === r); }).join("") +
        '<span class="sep"></span>' +
        toggle('data-set="metronome"', "מטרונום", set.metronome) + toggle('data-set="countIn"', "ספירה לפני", set.countIn) +
        toggle('data-set="loop"', "לולאה", BN.state.loop);
    }
    return html;
  }

  function popFor(id) {
    var s = sc();
    var part = s.parts[0];
    if (id === "clef") {
      return '<div class="seg" role="group">' + [["bass", "פה"], ["treble", "סול"], ["grand", "כפול"]].map(function (o) {
        return '<button type="button" data-layout-set="' + o[0] + '" aria-pressed="' + (s.staffLayout === o[0]) + '">' + o[1] + "</button>";
      }).join("") + "</div>";
    }
    if (id === "key" || id === "key-from") {
      var cur = BN.model.keyOf(part, popFrom);
      var curName = BN.music.vfKey(cur);
      var maj = "";
      var min = "";
      BN.music.MAJOR.forEach(function (row) {
        var m = BN.music.MINOR_OF[row[1]];
        maj += '<button type="button" data-keyname="' + row[1] + '" aria-pressed="' + (curName === row[1]) + '">' + row[1].replace("b", "♭").replace("#", "♯") + "</button>";
        min += '<button type="button" data-keyname="' + m + '" aria-pressed="' + (curName === m) + '">' + m.replace("b", "♭").replace("#", "♯") + "</button>";
      });
      return '<div class="pop-title">מז\'ור</div><div class="key-grid">' + maj + '</div><div class="pop-title">מינור</div><div class="key-grid">' + min + "</div>";
    }
    if (id === "time" || id === "time-from") {
      var t = BN.model.timeOf(part, popFrom);
      var presets = ["2/4", "3/4", "4/4", "5/4", "6/8", "7/8", "9/8", "12/8"];
      return '<div class="key-grid four">' + presets.map(function (p) {
        return '<button type="button" data-time="' + p + '" aria-pressed="' + (p === t.beats + "/" + t.beatType) + '">' + p + "</button>";
      }).join("") + '</div><div class="field-row"><label>מונה <input id="custom-beats" class="field num" type="number" min="1" max="16" value="' + t.beats + '"></label>' +
        '<label>מכנה <select id="custom-type" class="field"><option>2</option><option>4</option><option>8</option><option>16</option></select></label>' +
        '<button type="button" class="chip tool" data-action="time-custom">שמירה</button></div>';
    }
    if (id === "tempo") {
      return '<div class="stepper"><button type="button" data-bpm="-5" aria-label="הפחתת 5">' + BN.icons.svg("minus") + '</button><input id="bpm-input" class="field num" type="number" min="40" max="240" value="' + s.tempo.bpm + '" aria-label="טמפו"><button type="button" data-bpm="5" aria-label="הוספת 5">' + BN.icons.svg("plus") + '</button></div>' +
        '<div class="field-row"><button type="button" class="chip tool" data-action="bpm-set">שמירה</button><button type="button" class="chip tool" data-action="tap-tempo">הקשת טמפו</button></div>';
    }
    if (id === "input") {
      var on = BN.data.settings().tapInput;
      return '<div class="seg col"><button type="button" data-input="tap" aria-pressed="' + on + '">הקשה על החמשה + לוח</button><button type="button" data-input="pad" aria-pressed="' + !on + '">לוח בלבד</button></div>';
    }
    if (id === "zoom") {
      return '<div class="stepper"><button type="button" data-zoom="-0.1" aria-label="הקטנה">' + BN.icons.svg("minus") + '</button><span class="zoom-val">' + Math.round(BN.state.zoom * 100) + '%</span><button type="button" data-zoom="0.1" aria-label="הגדלה">' + BN.icons.svg("plus") + '</button></div><div class="field-row"><button type="button" class="chip tool" data-zoom-set="1">100%</button></div>';
    }
    return "";
  }

  BN.ui = BN.ui || {};
  BN.ui.ribbon = {
    mount: function (el) {
      root = el;
      el.addEventListener("click", onRibbon);
      el.addEventListener("input", onRibbonInput);
    },
    closePop: function () { BN.pop.close(); },
    sync: function () {
      if (!root || !sc()) return;
      var typing = document.activeElement && root.contains(document.activeElement) && document.activeElement.tagName === "INPUT";
      if (typing) return;
      root.innerHTML = build();
      root.dataset.tab = BN.state.tab;
    },
    keyLabel: keyLabel
  };

  function onRibbon(e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.chip) {
      var id = btn.dataset.chip;
      var own = BN.pop.owner();
      if (BN.pop.isOpen() && own && own.dataset && own.dataset.chip === id) { BN.pop.close(); return; }
      popFrom = id.indexOf("-from") > 0 ? BN.editor.targetMeasure() : 0;
      BN.pop.open(btn, popFor(id), "pop-" + id);
      return;
    }
    if (btn.dataset.mark) {
      var parts = btn.dataset.mark.split(":");
      BN.editor.toggleMark(parts[0], parts[1]);
      return;
    }
    if (btn.dataset.bar) { BN.editor.setBarline(btn.dataset.bar); return; }
    var rb = btn.dataset.rb;
    if (rb === "add-measure") BN.editor.addMeasure();
    else if (rb === "del-measure") BN.editor.removeMeasure();
    else if (rb === "sel-measure") { var m = BN.editor.targetMeasure(); BN.editor.selectMeasures(m, m); }
    else if (rb === "sel-row") BN.editor.selectRow(BN.editor.targetMeasure());
    if (btn.dataset.rate) BN.actions.setRate(Number(btn.dataset.rate));
    if (btn.dataset.set) {
      var k = btn.dataset.set;
      if (k === "loop") { BN.state.loop = !BN.state.loop; BN.ui.syncAll(); return; }
      var patch = {};
      patch[k] = !BN.data.settings()[k];
      BN.data.saveSettings(patch);
      BN.ui.syncAll();
    }
  }

  function onRibbonInput(e) {
    var s = sc();
    if (!s) return;
    var t = e.target;
    if (t.id === "rb-title") { s.title = t.value; BN.store.schedule(s); BN.editor.syncHeader(); }
    if (t.id === "rb-composer") { s.composer = t.value; BN.store.schedule(s); BN.editor.syncHeader(); }
    if (t.id === "rb-comment") { s.comment = t.value; BN.store.schedule(s); }
  }

  /* popover clicks */
  document.addEventListener("click", function (e) {
    var pop = e.target.closest("#pop");
    if (!pop || !sc()) return;
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.keyname) {
      BN.actions.setKey(BN.music.keyFromName(b.dataset.keyname), popFrom);
      BN.pop.close();
    } else if (b.dataset.time) {
      var bits = b.dataset.time.split("/");
      BN.actions.setTime({ beats: Number(bits[0]), beatType: Number(bits[1]) }, popFrom);
      BN.pop.close();
    } else if (b.dataset.action === "time-custom") {
      var beats = Math.max(1, Math.min(16, Number(document.getElementById("custom-beats").value || 4)));
      BN.actions.setTime({ beats: beats, beatType: Number(document.getElementById("custom-type").value || 4) }, popFrom);
      BN.pop.close();
    } else if (b.dataset.bpm) {
      var inp = document.getElementById("bpm-input");
      inp.value = Math.max(40, Math.min(240, Number(inp.value || 100) + Number(b.dataset.bpm)));
      BN.actions.setBpm(Number(inp.value));
    } else if (b.dataset.action === "bpm-set") {
      BN.actions.setBpm(Number(document.getElementById("bpm-input").value || 100));
      BN.pop.close();
    } else if (b.dataset.action === "tap-tempo") BN.actions.tapTempo();
    else if (b.dataset.input) {
      BN.data.saveSettings({ tapInput: b.dataset.input === "tap" });
      BN.pop.close();
      BN.ui.syncAll();
    } else if (b.dataset.zoom) {
      BN.editor.setZoom(BN.state.zoom + Number(b.dataset.zoom));
      var zv = pop.querySelector(".zoom-val");
      if (zv) zv.textContent = Math.round(BN.state.zoom * 100) + "%";
    } else if (b.dataset.zoomSet) {
      BN.editor.setZoom(Number(b.dataset.zoomSet));
      BN.pop.close();
    }
  });
})();
