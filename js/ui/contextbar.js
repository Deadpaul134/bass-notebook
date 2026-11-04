/* Bar floating above the selection: pitch label, steps, accidentals, duration, dot, delete. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var root = null;
  var repeat = null;

  function ed() { return BN.editor; }

  function btn(act, icon, label, extra) {
    return '<button type="button" class="cb" data-cb="' + act + '" aria-label="' + label + '"' + (extra || "") + ">" + icon + "</button>";
  }

  function content(refs) {
    var S = BN.state;
    if (!refs.length) {
      var m = (S.selMeasures || [])[0];
      return '<span class="cb-label">תיבה ' + (m + 1) + "</span>" +
        btn("paste", BN.icons.svg("paste", 22), "הדבקה") +
        btn("del", BN.icons.svg("trash", 22), "מחיקה", ' disabled');
    }
    var first = refs[0].note;
    var one = refs.length === 1;
    var label;
    if (one) label = (first.rest ? "הפסקה" : BN.music.pitchName(first.pitch)) + " · " + BN.music.durationLabel(first.type, first.dots);
    else label = refs.length + " תווים";
    var pitched = refs.some(function (r) { return !r.note.rest; });
    var durIcon = BN.icons.svg(first.type, 22);
    return '<span class="cb-label" id="cb-label">' + label + "</span>" +
      btn("up", BN.icons.svg("up", 22), "גובה למעלה", pitched ? "" : " disabled") +
      btn("down", BN.icons.svg("down", 22), "גובה למטה", pitched ? "" : " disabled") +
      btn("sharp", BN.icons.svg("sharp", 22), "דיאז", pitched ? "" : " disabled") +
      btn("flat", BN.icons.svg("flat", 22), "במול", pitched ? "" : " disabled") +
      btn("dur", durIcon, "שינוי משך") +
      btn("dot", BN.icons.svg("dot", 22), "נקודה") +
      (one ? "" : btn("copy", BN.icons.svg("copy", 22), "העתקה") + btn("paste", BN.icons.svg("paste", 22), "הדבקה")) +
      btn("del", BN.icons.svg("trash", 22), "מחיקה", ' class-extra="del"');
  }

  function act(name) {
    var E = ed();
    if (name === "up") E.stepSelection(1);
    else if (name === "down") E.stepSelection(-1);
    else if (name === "sharp") E.shiftAlter(1);
    else if (name === "flat") E.shiftAlter(-1);
    else if (name === "dur") E.cycleDuration();
    else if (name === "dot") E.toggleDot();
    else if (name === "copy") E.copy();
    else if (name === "paste") E.paste();
    else if (name === "del") E.deleteSelection();
  }

  function stopRepeat() {
    if (repeat) { clearTimeout(repeat.t); clearInterval(repeat.i); repeat = null; }
  }

  BN.ui = BN.ui || {};
  BN.ui.contextbar = {
    mount: function (el) {
      root = el;
      el.addEventListener("pointerdown", function (e) {
        var b = e.target.closest("button.cb");
        if (!b || b.disabled) return;
        e.preventDefault();
        var name = b.dataset.cb;
        act(name);
        if (name === "up" || name === "down") {
          stopRepeat();
          repeat = { t: setTimeout(function () { repeat.i = setInterval(function () { act(name); }, 130); }, 420) };
        }
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) { el.addEventListener(t, stopRepeat); });
      el.addEventListener("click", function (e) {
        /* keyboard activation only; pointer input is handled on pointerdown */
        var b = e.target.closest("button.cb");
        if (b && e.detail === 0) act(b.dataset.cb);
      });
    },
    sync: function () {
      if (!root) return;
      var S = BN.state;
      if (!S.current || document.body.dataset.screen !== "editor") { root.hidden = true; return; }
      var refs = ed().selected();
      var hasMeasure = !refs.length && S.selMeasures && S.selMeasures.length;
      if (!refs.length && !hasMeasure) { root.hidden = true; stopRepeat(); return; }
      root.innerHTML = content(refs);
      root.querySelectorAll("[class-extra]").forEach(function (b) { b.classList.add("del"); b.removeAttribute("class-extra"); });
      var rect;
      if (refs.length) {
        var rects = refs.map(function (r) { return BN.render.noteRect(r.note.id); }).filter(Boolean);
        if (rects.length) {
          rect = {
            left: Math.min.apply(null, rects.map(function (r) { return r.left; })),
            right: Math.max.apply(null, rects.map(function (r) { return r.right; })),
            top: Math.min.apply(null, rects.map(function (r) { return r.top; })),
            bottom: Math.max.apply(null, rects.map(function (r) { return r.bottom; }))
          };
        }
      } else rect = BN.render.measureRect(S.selMeasures[0]);
      var desk = document.getElementById("stage").getBoundingClientRect();
      if (!rect || rect.bottom < desk.top || rect.top > desk.bottom) { root.hidden = true; return; }
      root.hidden = false;
      var w = root.offsetWidth;
      var h = root.offsetHeight;
      var cx = (rect.left + rect.right) / 2;
      var left = Math.max(desk.left + 8, Math.min(desk.right - w - 8, cx - w / 2));
      var top = rect.top - h - 8;
      if (top < desk.top + 6) top = Math.min(desk.bottom - h - 8, rect.bottom + 8);
      root.style.left = left + "px";
      root.style.top = top + "px";
    }
  };
})();
