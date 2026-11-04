/* Collapsible piano: a key enters (or replaces) a note at its exact pitch. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var root = null;
  var handle = null;
  var keys = null;
  var rangeKey = "";
  var WHITE = [0, 2, 4, 5, 7, 9, 11];
  var NAMES = ["C", "D", "E", "F", "G", "A", "B"];
  var BLACK_AFTER = { 0: 1, 1: 3, 3: 6, 4: 8, 5: 10 };

  function range(clef) { return clef === "treble" ? [60, 84] : [24, 60]; }

  function build(clef) {
    var r = range(clef);
    var html = "";
    for (var midi = r[0]; midi <= r[1]; midi++) {
      var pc = midi % 12;
      var wi = WHITE.indexOf(pc);
      if (wi < 0) continue;
      var label = pc === 0 ? "C" + (Math.floor(midi / 12) - 1) : "";
      var black = midi + 1 <= r[1] && BLACK_AFTER[wi] ? '<span class="bk" data-midi="' + (midi + 1) + '" aria-label="' + BN.music.pitchName(BN.music.midiToPitch(midi + 1, { fifths: 0 })) + '"></span>' : "";
      html += '<div class="wk" data-midi="' + midi + '" aria-label="' + NAMES[wi] + (Math.floor(midi / 12) - 1) + '">' + black + '<span class="wl">' + label + "</span></div>";
    }
    keys.innerHTML = html;
    var lo = BN.music.pitchName(BN.music.midiToPitch(r[0], { fifths: 0 }));
    var hi = BN.music.pitchName(BN.music.midiToPitch(r[1], { fifths: 0 }));
    handle.dataset.range = lo + "–" + hi;
    rangeKey = clef;
    var first = keys.querySelector(".wk");
    void first;
  }

  function activeClef() {
    var E = BN.editor;
    var refs = E.selected();
    var staff = refs.length ? refs[0].note.staff : E.cursor().staff;
    return E.clefOf(staff);
  }

  function setOpen(open) {
    BN.ui.set({ pianoOpen: open });
    BN.ui.piano.sync();
    if (BN.ui.keypad) BN.ui.keypad.place();
  }

  BN.ui = BN.ui || {};
  BN.ui.piano = {
    mount: function (dock, h, k) {
      root = dock;
      handle = h;
      keys = k;
      handle.addEventListener("click", function () { setOpen(!BN.ui.get().pianoOpen); });
      var down = null;
      keys.addEventListener("pointerdown", function (e) {
        var key = e.target.closest("[data-midi]");
        if (!key) return;
        down = { x: e.clientX, y: e.clientY, midi: Number(key.dataset.midi), el: key };
        key.classList.add("down");
      });
      keys.addEventListener("pointerup", function (e) {
        if (!down) return;
        var d = down;
        down = null;
        d.el.classList.remove("down");
        if (Math.abs(e.clientX - d.x) < 10 && Math.abs(e.clientY - d.y) < 10) BN.editor.pianoKey(d.midi);
      });
      keys.addEventListener("pointercancel", function () {
        if (down) down.el.classList.remove("down");
        down = null;
      });
      keys.addEventListener("pointerleave", function () {
        if (down) down.el.classList.remove("down");
        down = null;
      });
    },
    sync: function () {
      if (!root || !BN.state.current) return;
      var open = BN.ui.get().pianoOpen;
      root.classList.toggle("closed", !open);
      handle.setAttribute("aria-expanded", open ? "true" : "false");
      var clef = activeClef();
      if (clef !== rangeKey) build(clef);
      handle.innerHTML = "פסנתר " + BN.icons.svg("chevron", 14, "chev") + " · " + handle.dataset.range;
      keys.querySelectorAll(".hit").forEach(function (k) { k.classList.remove("hit"); });
      var refs = BN.editor.selected();
      if (refs.length === 1 && refs[0].note.pitch && !refs[0].note.rest) {
        var midi = BN.music.pitchToMidi(refs[0].note.pitch);
        var key = keys.querySelector('[data-midi="' + midi + '"]');
        if (key) {
          key.classList.add("hit");
          var box = keys.parentElement;
          var kr = key.getBoundingClientRect();
          var br = box.getBoundingClientRect();
          if (kr.left < br.left || kr.right > br.right) box.scrollLeft += kr.left - br.left - br.width / 2;
        }
      }
    }
  };
})();
