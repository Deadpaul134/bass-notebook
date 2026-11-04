/* Floating Keypad: layouts, drag-to-aim pitch entry, move, hide, per-orientation position. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var root = null;
  var showBtn = null;
  var tab = 0;
  var STEP_PX = 14;
  var SHIFT_PX = 28;
  var HOLD_MS = 350;
  var drag = null;
  var move = null;

  function ed() { return BN.editor; }
  function orient() { return window.innerHeight > window.innerWidth ? "portrait" : "landscape"; }

  function cellHtml(c) {
    if (c.kind === "empty") return '<span class="k empty" aria-hidden="true"></span>';
    var inner = c.icon ? BN.icons.svg(c.icon, 30) : "";
    if (c.text) inner += '<span class="k-t">' + c.text + "</span>";
    var attrs = c.kind === "dur" ? ' data-dur="' + c.type + '"' : ' data-op="' + c.op + '"';
    return '<button type="button" class="k ' + (c.cls || "") + '"' + attrs + ' aria-label="' + BN.esc(c.label) + '" aria-pressed="false">' + inner + "</button>";
  }

  function render() {
    var layout = BN.keypadLayouts[tab];
    root.querySelector(".kp-grid").innerHTML = layout.cells.map(cellHtml).join("");
    root.querySelectorAll(".kp-tabs .kt").forEach(function (b, i) {
      b.setAttribute("aria-selected", i === tab ? "true" : "false");
      b.classList.toggle("on", i === tab);
    });
    BN.ui.keypad.sync();
  }

  function pressedFor(op) {
    var pal = ed().pal();
    var refs = ed().selected();
    var first = refs[0] && refs[0].note;
    if (op === "dot") return !!pal.dots && pal.dots === 1;
    if (op === "dot2") return pal.dots === 2;
    if (op === "tie") return refs.length ? !!(first && first.tie && first.tie.start) : !!pal.tie;
    if (op === "sharp" || op === "flat" || op === "natural") return pal.accidental === op;
    if (op === "slur") return !!(first && first.slur && first.slur.start);
    if (op === "ghost") return !!(first && first.ghost);
    if (op.indexOf("artic:") === 0) return !!(first && (first.artic || []).indexOf(op.slice(6)) >= 0);
    if (op.indexOf("dyn:") === 0) return !!(first && first.dyn === op.slice(4));
    return false;
  }

  function runOp(op) {
    var E = ed();
    if (op === "dot") E.setDots(E.pal().dots === 1 ? 0 : 1);
    else if (op === "dot2") E.setDots(E.pal().dots === 2 ? 0 : 2);
    else if (op === "tie") E.toggleTie();
    else if (op === "rest") E.insertRest();
    else if (op === "sharp" || op === "flat" || op === "natural") E.pressAccidental(op);
    else if (op === "octUp") E.shiftOctave(1);
    else if (op === "octDown") E.shiftOctave(-1);
    else if (op === "duplicate") E.duplicate();
    else if (op === "copy") E.copy();
    else if (op === "paste") E.paste();
    else if (op === "cut") E.cut();
    else if (op === "selectAll") E.selectAll();
    else if (op === "measureAdd") E.addMeasure();
    else if (op === "measureDel") E.removeMeasure();
    else if (op === "slur") E.toggleMark("slur");
    else if (op === "ghost") E.toggleMark("ghost");
    else if (op.indexOf("artic:") === 0) E.toggleMark("artic", op.slice(6));
    else if (op.indexOf("dyn:") === 0) E.toggleMark("dyn", op.slice(4));
    else if (op.indexOf("bar:") === 0) E.setBarline(op.slice(4));
  }

  /* ---------- aim by dragging on a duration (or the ↕ key) ---------- */

  function baseFor() {
    var E = ed();
    var refs = E.selected();
    if (refs.length && refs[0].note.pitch && !refs[0].note.rest) {
      var n = refs[0].note;
      var own = refs[0].measure.notes.filter(function (x) { return x.staff === n.staff && !x.generated; });
      return { staff: n.staff, measure: refs[0].measureIndex, index: own.indexOf(n), pos: BN.music.pitchToPos(E.clefOf(n.staff), n.pitch), selected: true };
    }
    var c = E.cursor();
    return { staff: c.staff, measure: c.measure, index: c.index, pos: E.lastPos(c.staff), selected: false };
  }

  function showAim(rec, steps, shift) {
    var b = rec.base;
    var pos = Math.max(-12, Math.min(20, b.pos + steps));
    var g = ed().ghostAt(b.staff, b.measure, b.index, pos, shift, {});
    rec.last = { pos: pos, shift: shift, steps: pos - b.pos };
    return g;
  }

  function dragStart(btn, e) {
    var kind = btn.dataset.dur ? "dur" : btn.dataset.op === "pitch" ? "pitch" : "rest";
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: Date.now(), kind: kind, btn: btn, type: btn.dataset.dur, moved: false, ghost: false, base: baseFor() };
    try { btn.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
    var enabled = BN.data.settings().dragEntry;
    if (kind === "rest") return;
    if (!enabled) return;
    ed().revealCursor();
    drag.timer = setTimeout(function () {
      if (!drag || drag.moved) return;
      drag.hold = true;
      drag.ghost = true;
      drag.base = baseFor();
      showAim(drag, 0, 0);
    }, HOLD_MS);
  }

  function dragMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x0;
    var dy = e.clientY - drag.y0;
    var enabled = BN.data.settings().dragEntry;
    if (!drag.moved && Math.hypot(dx, dy) > 8) {
      drag.moved = true;
      if (drag.timer) clearTimeout(drag.timer);
      if (drag.kind !== "rest" && enabled) { drag.base = baseFor(); drag.ghost = true; }
    }
    if (!drag.moved) return;
    if (drag.kind === "rest") {
      var idx = Math.max(0, Math.min(4, BN.music.DUR_ORDER.indexOf(ed().pal().type)));
      if (drag.restBase == null) drag.restBase = idx;
      var n = Math.max(0, Math.min(4, drag.restBase + Math.round(dx / SHIFT_PX)));
      drag.restType = BN.music.DUR_ORDER[n];
      var hint = root.querySelector(".kp-hint");
      if (hint) hint.textContent = "הפסקה: " + BN.music.durationLabel(drag.restType, ed().pal().dots);
      return;
    }
    if (!enabled) return;
    var steps = -Math.round(dy / STEP_PX);
    var shift = dx > SHIFT_PX ? 1 : dx < -SHIFT_PX ? -1 : 0;
    showAim(drag, steps, shift);
  }

  function dragEnd(e, cancelled) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag;
    drag = null;
    if (d.timer) clearTimeout(d.timer);
    BN.ghost.hide();
    var hint = root.querySelector(".kp-hint");
    if (hint) hint.textContent = BN.keypadLayouts[tab].hint;
    if (cancelled) return;
    var E = ed();
    var enabled = BN.data.settings().dragEntry;
    if (d.kind === "rest") {
      if (d.moved && d.restType) E.pal().type = d.restType;
      E.insertRest();
      return;
    }
    var aimed = enabled && (d.hold || d.moved) && d.last;
    if (!aimed) {
      if (d.moved) return; /* a slide that never aimed: ignore */
      if (d.kind === "dur") E.pressDuration(d.type);
      return;
    }
    var refs = E.selected();
    var steps = d.last.steps;
    var shift = d.last.shift;
    if (d.kind === "dur") E.pal().type = d.type;
    if (refs.length) {
      var ids = refs.map(function (r) { return r.note.id; });
      E.commit(function (sc) {
        if (d.kind === "dur") BN.model.setDuration(sc, ids, d.type, E.pal().dots);
        if (steps) BN.model.stepNotes(sc, ids, steps);
        if (shift) BN.model.shiftAlter(sc, ids, shift);
      });
      var f = BN.model.find(BN.state.current, ids[0]);
      if (f && f.note.pitch && BN.data.settings().playback) BN.playback.preview(BN.music.pitchToMidi(f.note.pitch), f.note.staff, BN.state.current);
      return;
    }
    var b = d.base;
    var pitch = E.buildPitch(b.staff, b.measure, b.index, d.last.pos, shift);
    E.enterPitch(pitch, { staff: b.staff, insert: true });
  }

  /* ---------- moving the whole Keypad ---------- */

  function clampPos(x, y) {
    var w = root.offsetWidth;
    var h = root.offsetHeight;
    return {
      x: Math.max(0, Math.min(window.innerWidth - w, x)),
      y: Math.max(0, Math.min(window.innerHeight - h, y))
    };
  }

  function applyPosition() {
    if (!root) return;
    var ui = BN.ui.get().keypad;
    var hidden = !!ui.hidden;
    root.hidden = hidden;
    showBtn.hidden = !hidden;
    var saved = ui[orient()];
    root.classList.toggle("docked", orient() === "portrait" && !saved);
    root.classList.toggle("float", !(orient() === "portrait" && !saved));
    root.style.left = root.style.top = root.style.right = root.style.bottom = "";
    if (hidden) return;
    if (saved && root.classList.contains("float")) {
      var p = clampPos(saved.x, saved.y);
      root.style.left = p.x + "px";
      root.style.top = p.y + "px";
    } else if (root.classList.contains("float")) {
      var side = BN.data.settings().hand === "left" ? "right" : "left";
      root.style[side] = "24px";
      var dock = document.getElementById("piano-dock");
      var below = dock ? dock.getBoundingClientRect().top : window.innerHeight;
      root.style.bottom = Math.max(8, window.innerHeight - below + 12) + "px";
    }
    var side2 = BN.data.settings().hand === "left" ? "right" : "left";
    showBtn.style.left = showBtn.style.right = "";
    showBtn.style[side2] = "24px";
  }

  function onRootDown(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    var btn = e.target.closest("button");
    if (btn) {
      if (btn.dataset.dur || btn.dataset.op === "pitch" || btn.dataset.op === "rest") dragStart(btn, e);
      return;
    }
    if (e.target.closest(".kp-tabs")) return;
    var r = root.getBoundingClientRect();
    move = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false };
    try { root.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
    e.preventDefault();
  }

  function onRootMove(e) {
    if (drag) { dragMove(e); return; }
    if (!move || e.pointerId !== move.id) return;
    move.moved = true;
    var p = clampPos(e.clientX - move.dx, e.clientY - move.dy);
    root.classList.remove("docked");
    root.classList.add("float", "moving");
    root.style.right = root.style.bottom = "";
    root.style.left = p.x + "px";
    root.style.top = p.y + "px";
  }

  function onRootUp(e) {
    if (drag) { dragEnd(e, false); return; }
    if (!move || e.pointerId !== move.id) return;
    var m = move;
    move = null;
    root.classList.remove("moving");
    if (!m.moved) return;
    var r = root.getBoundingClientRect();
    var ui = BN.ui.get().keypad;
    ui[orient()] = { x: Math.round(r.left), y: Math.round(r.top) };
    BN.ui.set({ keypad: ui });
    applyPosition();
  }

  BN.ui = BN.ui || {};
  BN.ui.keypad = {
    mount: function (el, btn) {
      root = el;
      showBtn = btn;
      tab = Math.max(0, Math.min(5, (BN.ui.get().keypad.tab || 0)));
      root.innerHTML =
        '<div class="kp-grip" aria-hidden="true"><i></i></div>' +
        '<div class="kp-actions">' +
        '<button type="button" class="k small del" data-op="delete" aria-label="מחיקה">' + BN.icons.svg("trash", 22) + "<span>מחק</span></button>" +
        '<button type="button" class="k small" data-action="undo" aria-label="בטל">' + BN.icons.svg("undo", 22) + "<span>בטל</span></button>" +
        '<button type="button" class="k small" data-action="redo" aria-label="שוב">' + BN.icons.svg("redo", 22) + "<span>שוב</span></button>" +
        '<button type="button" class="k small" data-op="hide" aria-label="הסתרת הלוח">' + BN.icons.svg("close", 22) + "<span>הסתר</span></button></div>" +
        '<div class="kp-tabs" role="tablist" aria-label="פריסות">' +
        BN.keypadLayouts.map(function (l, i) { return '<button type="button" role="tab" class="kt" data-kt="' + i + '">' + l.name + "</button>"; }).join("") + "</div>" +
        '<div class="kp-grid"></div><div class="kp-hint"></div>';
      showBtn.innerHTML = BN.icons.svg("plus", 26) + "<span>לוח</span>";
      showBtn.addEventListener("click", function () { BN.ui.keypad.setHidden(false); });
      root.addEventListener("pointerdown", onRootDown);
      root.addEventListener("pointermove", onRootMove);
      root.addEventListener("pointerup", onRootUp);
      root.addEventListener("pointercancel", function (e) { if (drag) dragEnd(e, true); move = null; });
      root.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      root.addEventListener("click", function (e) {
        var kt = e.target.closest("[data-kt]");
        if (kt) {
          tab = Number(kt.dataset.kt);
          BN.ui.set({ keypad: Object.assign(BN.ui.get().keypad, { tab: tab }) });
          render();
          return;
        }
        var b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.action === "undo") { ed().undo(); return; }
        if (b.dataset.action === "redo") { ed().redo(); return; }
        var op = b.dataset.op;
        if (op === "delete") { ed().deleteSelection(); return; }
        if (op === "hide") { BN.ui.keypad.setHidden(true); return; }
        if (b.dataset.dur || op === "pitch" || op === "rest") {
          if (e.detail === 0) { if (b.dataset.dur) ed().pressDuration(b.dataset.dur); else if (op === "rest") ed().insertRest(); }
          return;
        }
        if (op) runOp(op);
      });
      window.addEventListener("resize", applyPosition);
      render();
      applyPosition();
    },
    setHidden: function (hidden) {
      var ui = BN.ui.get().keypad;
      ui.hidden = hidden;
      BN.ui.set({ keypad: ui });
      applyPosition();
    },
    resetPosition: function () {
      var ui = BN.ui.get().keypad;
      ui.landscape = null;
      ui.portrait = null;
      BN.ui.set({ keypad: ui });
      applyPosition();
    },
    place: applyPosition,
    rect: function () { return root && !root.hidden ? root.getBoundingClientRect() : null; },
    sync: function () {
      if (!root || !BN.state.current) return;
      var pal = ed().pal();
      var enabled = BN.data.settings().dragEntry;
      root.querySelectorAll("[data-dur]").forEach(function (b) {
        var on = b.dataset.dur === pal.type;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      root.querySelectorAll("[data-op]").forEach(function (b) {
        var op = b.dataset.op;
        var on = pressedFor(op);
        b.classList.toggle("pressed", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
        if (op === "pitch") b.classList.toggle("dim", !enabled);
      });
      var sc = BN.state.current;
      var undo = root.querySelector("[data-action='undo']");
      var redo = root.querySelector("[data-action='redo']");
      if (undo) undo.disabled = !BN.history.canUndo(sc.id);
      if (redo) redo.disabled = !BN.history.canRedo(sc.id);
      var hint = root.querySelector(".kp-hint");
      if (hint && !drag) hint.textContent = tab === 0 && !enabled ? "הזנה בלחיצה על החמשה או בפסנתר" : BN.keypadLayouts[tab].hint;
    }
  };
})();
