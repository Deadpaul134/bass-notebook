/* Editing controller: selection, cursor, entry, and the gestures on the page.
   The Keypad, piano, context bar, and ribbon call these functions. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var S = BN.state;
  var pointers = new Map();
  var gesture = 0;
  var lastTouchAt = 0;
  var lastTap = null;
  var zoomFrame = 0;
  var HOLD_MS = 350;
  var DEFAULT_POS = 4; /* D3 on the bass staff, B4 on the treble staff */

  function score() { return S.current; }
  function pal() { return S.palette; }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function ui() { return BN.ui || {}; }

  function exists(id) { return !!BN.model.find(score(), id); }
  function selIds() {
    if (!score()) return [];
    S.selection = (S.selection || []).filter(exists);
    return S.selection.slice();
  }
  function selNotes() {
    return selIds().map(function (id) { return BN.model.find(score(), id); }).filter(Boolean);
  }

  function clefOf(staff) { return BN.model.clefName(score(), staff || 1); }
  function keyAt(mi) { return BN.model.keyOf(score().parts[0], mi || 0); }

  function endCursor(staff) {
    var list = BN.model.refs(score(), staff);
    if (!list.length) return { staff: staff, measure: 0, index: 0 };
    return BN.model.cursorAfter(score(), staff, list[list.length - 1].note.id);
  }

  function cursor() {
    var sc = score();
    if (!sc) return null;
    var c = S.cursor || endCursor(1);
    S.cursor = BN.model.clampCursor(sc, c);
    return S.cursor;
  }

  function lastPos(staff) {
    S.lastPos = S.lastPos || {};
    return S.lastPos[staff] == null ? DEFAULT_POS : S.lastPos[staff];
  }

  function commit(mutate, opts) {
    var sc = score();
    var before = clone(sc);
    var t0 = performance.now();
    if (mutate(sc) === false) return false;
    BN.history.push(sc, before);
    BN.store.schedule(sc);
    if (ui().topbar) ui().topbar.saving();
    if (!(opts && opts.noRedraw)) BN.editor.redraw();
    BN.editor.lastCommitMs = performance.now() - t0;
    return true;
  }

  function preview(pitch, staff) {
    if (!pitch || !BN.data.settings().playback) return;
    BN.playback.preview(BN.music.pitchToMidi(pitch), staff, score());
  }

  function syncPaletteFrom(refs) {
    if (refs.length !== 1) return;
    var n = refs[0].note;
    pal().type = n.type;
    pal().dots = n.dots || 0;
  }

  function revealCursor() {
    var map = BN.render.layout;
    var stage = document.getElementById("stage");
    if (!map || !stage || !map.cursor) return;
    var p = BN.render.client(map.cursor.svg, map.cursor.x, (map.cursor.y1 + map.cursor.y2) / 2);
    var r = stage.getBoundingClientRect();
    var kp = ui().keypad && ui().keypad.rect && ui().keypad.rect();
    if (p.y < r.top + 70) stage.scrollTop -= r.top + 140 - p.y;
    else if (p.y > r.bottom - 90) stage.scrollTop += p.y - (r.bottom - 160);
    void kp;
  }

  function measureCount(staff, mi) {
    return score().parts[0].measures[mi].notes.filter(function (n) { return n.staff === staff && !n.generated; }).length;
  }

  /* ---------- selection ---------- */

  function select(ids, opts) {
    opts = opts || {};
    S.selection = ids.slice();
    S.selMeasures = opts.measures || [];
    var refs = selNotes();
    syncPaletteFrom(refs);
    if (opts.cursor) S.cursor = opts.cursor;
    else if (refs.length) {
      var last = refs[refs.length - 1].note;
      S.cursor = BN.model.cursorAfter(score(), last.staff, last.id) || S.cursor;
    }
    BN.editor.redraw();
  }

  function clearSelection() {
    if (!(S.selection && S.selection.length) && !(S.selMeasures && S.selMeasures.length)) return;
    S.selection = [];
    S.selMeasures = [];
    BN.editor.redraw();
  }

  function selectMeasures(from, to, staff) {
    var lo = Math.min(from, to);
    var hi = Math.max(from, to);
    var list = [];
    for (var i = lo; i <= hi; i++) list.push(i);
    select(BN.model.noteIdsInMeasures(score(), lo, hi), {
      measures: list,
      cursor: { staff: staff || (S.cursor && S.cursor.staff) || 1, measure: lo, index: 0 }
    });
  }

  function selectRow(measure) {
    var map = BN.render.layout;
    if (!map) return;
    var row = map.systems.filter(function (s) { return s.measures.indexOf(measure) >= 0; })[0];
    if (!row) return;
    selectMeasures(row.measures[0], row.measures[row.measures.length - 1]);
  }

  function selectAll() {
    var n = score().parts[0].measures.length;
    selectMeasures(0, n - 1);
  }

  /* ---------- entry ---------- */

  function buildPitch(staff, measure, index, pos, shift) {
    var clef = clefOf(staff);
    var key = keyAt(measure);
    var base = BN.music.posToPitch(clef, pos, key);
    var alter = BN.model.alterFor(score(), staff, measure, index, base.step, base.octave);
    if (shift) alter = Math.max(-1, Math.min(1, BN.music.fifthsAlter(base.step, key.fifths) + shift));
    var acc = pal().accidental;
    if (acc) alter = acc === "sharp" ? 1 : acc === "flat" ? -1 : 0;
    return { step: base.step, alter: alter, octave: base.octave };
  }

  /* Insert one note at (measure, index). Returns the new note. */
  function insertNote(staff, measure, index, pitch, opts) {
    opts = opts || {};
    var p = pal();
    var rest = !!opts.rest;
    var note = BN.model.noteFromPalette({ type: p.type, dots: p.dots, rest: rest, staff: staff }, pitch || { step: "C", octave: 3, alter: 0 });
    if (!rest) {
      var inForce = BN.model.alterFor(score(), staff, measure, index, pitch.step, pitch.octave);
      if ((pitch.alter || 0) !== inForce || (pitch.alter || 0) !== BN.music.fifthsAlter(pitch.step, keyAt(measure).fifths)) {
        var keyAlter = BN.music.fifthsAlter(pitch.step, keyAt(measure).fifths);
        if ((pitch.alter || 0) !== keyAlter) note.accidental = pitch.alter === 1 ? "sharp" : pitch.alter === -1 ? "flat" : "natural";
      }
    }
    var wantTie = p.tie && !rest;
    var ok = commit(function (sc) {
      BN.model.insertAt(sc, staff, measure, index, note);
      if (wantTie) {
        var list = BN.model.refs(sc, staff);
        var at = list.findIndex(function (r) { return r.note.id === note.id; });
        var prev = list[at - 1];
        if (prev) BN.model.toggleTie(sc, [prev.note.id]);
      }
    }, { noRedraw: true });
    if (!ok) return null;
    p.tie = false;
    p.accidental = null;
    S.selection = [];
    S.selMeasures = [];
    S.cursor = BN.model.cursorAfter(score(), staff, note.id) || S.cursor;
    if (!rest) {
      S.lastPos = S.lastPos || {};
      S.lastPos[staff] = BN.music.pitchToPos(clefOf(staff), pitch);
    }
    BN.editor.redraw();
    revealCursor();
    if (!rest) preview(pitch, staff);
    return note;
  }

  /* A pitch from the piano or the ghost: replaces a single selected note, otherwise inserts at the cursor. */
  function enterPitch(pitch, opts) {
    opts = opts || {};
    var refs = selNotes();
    if (refs.length === 1 && !opts.insert) {
      var id = refs[0].note.id;
      commit(function (sc) { BN.model.setPitchOf(sc, id, pitch); });
      S.lastPos = S.lastPos || {};
      S.lastPos[refs[0].note.staff] = BN.music.pitchToPos(clefOf(refs[0].note.staff), pitch);
      preview(pitch, refs[0].note.staff);
      return refs[0].note;
    }
    var c = cursor();
    var staff = opts.staff || c.staff;
    if (staff !== c.staff) c = { staff: staff, measure: c.measure, index: measureCount(staff, c.measure) };
    return insertNote(staff, c.measure, c.index, pitch, opts);
  }

  function insertRest() {
    var refs = selNotes();
    if (refs.length) {
      var ids = refs.map(function (r) { return r.note.id; });
      commit(function (sc) { BN.model.toRest(sc, ids); });
      return;
    }
    var c = cursor();
    insertNote(c.staff, c.measure, c.index, null, { rest: true });
  }

  /* ---------- changes to the selection ---------- */

  function pressDuration(type) {
    pal().type = type;
    var ids = selIds();
    if (ids.length) commit(function (sc) { BN.model.setDuration(sc, ids, type, pal().dots); });
    else ui().syncAll && ui().syncAll();
  }

  function setDots(n) {
    pal().dots = n;
    var ids = selIds();
    if (ids.length) {
      commit(function (sc) {
        ids.forEach(function (id) {
          var r = BN.model.find(sc, id);
          if (r) BN.model.setDuration(sc, [id], r.note.type, n);
        });
      });
    } else ui().syncAll && ui().syncAll();
  }

  function toggleDot() { setDots(((pal().dots || 0) + 1) % 3); }

  function toggleTie() {
    var ids = selIds();
    if (!ids.length) {
      pal().tie = !pal().tie;
      ui().syncAll && ui().syncAll();
      return;
    }
    var did = commit(function (sc) { return BN.model.toggleTie(sc, ids) ? undefined : false; });
    if (did === false) BN.toast.show("אין תו באותו גובה מיד אחרי התו הנבחר");
  }

  function pressAccidental(kind) {
    var ids = selIds();
    if (ids.length) {
      var alter = kind === "sharp" ? 1 : kind === "flat" ? -1 : 0;
      commit(function (sc) { BN.model.setAlterOf(sc, ids, alter); });
      var first = BN.model.find(score(), ids[0]);
      if (first && first.note.pitch) preview(first.note.pitch, first.note.staff);
    } else {
      pal().accidental = pal().accidental === kind ? null : kind;
      ui().syncAll && ui().syncAll();
    }
  }

  function stepSelection(steps) {
    var ids = selIds();
    if (!ids.length) return;
    commit(function (sc) { BN.model.stepNotes(sc, ids, steps); });
    var first = BN.model.find(score(), ids[0]);
    if (first && first.note.pitch) preview(first.note.pitch, first.note.staff);
  }

  function shiftAlter(delta) {
    var ids = selIds();
    if (!ids.length) return;
    commit(function (sc) { BN.model.shiftAlter(sc, ids, delta); });
    var first = BN.model.find(score(), ids[0]);
    if (first && first.note.pitch) preview(first.note.pitch, first.note.staff);
  }

  function shiftOctave(dir) {
    var ids = selIds();
    if (ids.length) commit(function (sc) { BN.model.shiftOctave(sc, ids, dir); });
  }

  function cycleDuration() {
    var ids = selIds();
    if (!ids.length) return;
    var first = BN.model.find(score(), ids[0]);
    var order = BN.music.DUR_ORDER;
    var at = order.indexOf(first.note.type);
    var type = order[(at + 1) % order.length];
    pal().type = type;
    commit(function (sc) { BN.model.setDuration(sc, ids, type, pal().dots); });
  }

  function deleteSelection() {
    var ids = selIds();
    if (!ids.length) {
      /* nothing selected: remove the note before the cursor */
      var c = cursor();
      var list = BN.model.refs(score(), c.staff);
      var m = score().parts[0].measures[c.measure];
      var own = m.notes.filter(function (n) { return n.staff === c.staff && !n.generated; });
      var prev = c.index > 0 ? own[c.index - 1] : null;
      if (!prev) {
        var before = list.filter(function (r) { return r.mi < c.measure; });
        prev = before.length ? before[before.length - 1].note : null;
      }
      if (!prev) return;
      ids = [prev.id];
    }
    var first = BN.model.find(score(), ids[0]);
    var staff = first ? first.note.staff : 1;
    var at = first ? { staff: staff, measure: first.measureIndex, index: first.measure.notes.filter(function (n) { return n.staff === staff && !n.generated; }).indexOf(first.note) } : null;
    commit(function (sc) { BN.model.deleteNotes(sc, ids, "rest"); });
    S.selection = [];
    S.selMeasures = [];
    if (at) S.cursor = BN.model.clampCursor(score(), at);
    BN.editor.redraw();
    BN.toast.show(ids.length > 1 ? "נמחקו " + ids.length + " תווים" : "נמחק", { undo: BN.editor.undo });
  }

  function copySelection() {
    var ids = selIds();
    if (!ids.length) return;
    S.clipboard = BN.model.copyNotes(score(), ids);
    BN.toast.show(ids.length > 1 ? "הועתקו " + ids.length + " תווים" : "הועתק");
  }

  function cutSelection() {
    copySelection();
    if (selIds().length) deleteSelection();
  }

  function pasteAtCursor() {
    if (!S.clipboard || !S.clipboard.length) {
      BN.toast.show("אין מה להדביק");
      return;
    }
    var c = cursor();
    var lastId = null;
    var ok = commit(function (sc) { lastId = BN.model.pasteNotes(sc, c.staff, c.measure, c.index, S.clipboard); }, { noRedraw: true });
    if (ok && lastId) {
      S.selection = [];
      S.selMeasures = [];
      S.cursor = BN.model.cursorAfter(score(), c.staff, lastId) || S.cursor;
    }
    BN.editor.redraw();
    revealCursor();
  }

  function duplicateSelection() {
    var ids = selIds();
    if (!ids.length) return;
    S.clipboard = BN.model.copyNotes(score(), ids);
    var last = BN.model.find(score(), ids[ids.length - 1]);
    var cur = BN.model.cursorAfter(score(), last.note.staff, last.note.id);
    if (cur) S.cursor = cur;
    pasteAtCursor();
  }

  function toggleMark(kind, value) {
    var ids = selIds();
    if (!ids.length) {
      BN.toast.show("בחרו תו קודם");
      return;
    }
    var r = commit(function (sc) {
      var did;
      if (kind === "artic") did = BN.model.toggleArticulation(sc, ids, value);
      else if (kind === "dyn") did = BN.model.setDynamic(sc, ids, value);
      else if (kind === "ghost") did = BN.model.toggleGhost(sc, ids);
      else if (kind === "slur") did = BN.model.toggleSlur(sc, ids);
      return did ? undefined : false;
    });
    if (r === false && kind === "slur") BN.toast.show("לצורך קשת בחרו לפחות שני תווים");
  }

  function targetMeasure() {
    if (S.selMeasures && S.selMeasures.length) return S.selMeasures[0];
    var refs = selNotes();
    if (refs.length) return refs[0].measureIndex;
    return cursor().measure;
  }

  function setBarline(kind) {
    var mi = targetMeasure();
    commit(function (sc) {
      var m = sc.parts[0].measures[mi];
      if (!m) return false;
      if (kind === "regular") delete m.barline;
      else if (kind === "light-light") m.barline = { right: "light-light" };
      else if (kind === "light-heavy") m.barline = { right: "light-heavy" };
      else if (kind === "forward") BN.model.setRepeat(sc, mi, "forward");
      else if (kind === "backward") BN.model.setRepeat(sc, mi, "backward");
    });
  }

  function addMeasure() {
    var mi = targetMeasure();
    commit(function (sc) { BN.model.insertMeasure(sc, mi); });
    S.selection = [];
    S.selMeasures = [];
    S.cursor = { staff: cursor().staff, measure: Math.min(mi + 1, score().parts[0].measures.length - 1), index: 0 };
    BN.editor.redraw();
  }

  function removeMeasure() {
    var mi = targetMeasure();
    var m = score().parts[0].measures;
    if (m.length <= 1) return;
    commit(function (sc) { BN.model.removeMeasure(sc, mi); });
    S.selection = [];
    S.selMeasures = [];
    BN.editor.redraw();
    BN.toast.show("התיבה נמחקה", { undo: BN.editor.undo });
  }

  function moveCursor(dir) {
    var c = cursor();
    var count = measureCount(c.staff, c.measure);
    var next = { staff: c.staff, measure: c.measure, index: c.index + dir };
    var last = score().parts[0].measures.length - 1;
    if (next.index < 0) {
      if (c.measure === 0) return;
      next.measure = c.measure - 1;
      next.index = measureCount(c.staff, next.measure);
    } else if (next.index > count) {
      if (c.measure >= last) return;
      next.measure = c.measure + 1;
      next.index = 0;
    }
    S.cursor = next;
    S.selection = [];
    S.selMeasures = [];
    BN.editor.redraw();
    revealCursor();
  }

  /* ---------- ghost (a preview of the note before it is placed) ---------- */

  function ghostAt(staff, measure, index, pos, shift, opts) {
    var p = BN.render.posClient(measure, staff, pos, index);
    if (!p) return null;
    var pitch = buildPitch(staff, measure, index, pos, shift);
    var label = pal().type && opts && opts.rest ? "הפסקה" : BN.music.pitchName(pitch);
    BN.ghost.show({ x: p.x, y: p.y, label: label, type: pal().type, touch: !!(opts && opts.touch) });
    return { pitch: pitch, pos: pos, label: label };
  }

  /* ---------- page gestures ---------- */

  function ignoreEmulatedMouse(e) {
    return e.pointerType === "mouse" && Date.now() - lastTouchAt < 900;
  }

  function noteIdAtNearest(hit) {
    var box = BN.render.layout && BN.render.layout.byMeasure[hit.measure];
    var slots = box && box.slots[hit.staff];
    if (!slots || !slots.length) return null;
    var best = slots[0];
    slots.forEach(function (s) { if (Math.abs(s.headX - hit.svg.x) < Math.abs(best.headX - hit.svg.x)) best = s; });
    return best.id;
  }

  function lassoTo(rec, e) {
    var hit = BN.render.hit(score(), e.clientX, e.clientY);
    if (!hit || !rec.lassoStart) return;
    var a = rec.lassoStart;
    var b = noteIdAtNearest(hit);
    if (!a || !b || hit.staff !== rec.lassoStaff) return;
    var ids = BN.model.rangeIds(score(), rec.lassoStaff, a, b);
    S.selection = ids;
    S.selMeasures = [];
    BN.editor.redraw();
  }

  function onDown(e) {
    if (!score()) return;
    if (ignoreEmulatedMouse(e)) return;
    if (e.pointerType === "touch") lastTouchAt = Date.now();
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target.closest("button, a, input, select, textarea")) return;
    var inScore = !!e.target.closest("#score");
    var rec = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: Date.now(), moved: 0, pointerType: e.pointerType, inScore: inScore };
    pointers.set(e.pointerId, rec);
    if (pointers.size > gesture) gesture = pointers.size;
    if (inScore) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
    }
    if (pointers.size >= 2) {
      pointers.forEach(function (r) { if (r.timer) clearTimeout(r.timer); r.cancelled = true; });
      BN.ghost.hide();
      return;
    }
    if (!inScore) return;
    var hit = BN.render.hit(score(), e.clientX, e.clientY);
    rec.hit = hit;
    if (!hit) return;
    var tapEnter = BN.data.settings().tapInput && !hit.noteId && hit.inside;
    rec.mode = hit.noteId ? "note" : tapEnter ? "enter" : "cursor";
    if (rec.mode === "enter") {
      rec.preview = ghostAt(hit.staff, hit.measure, hit.insertAt, hit.pos, 0, { touch: e.pointerType === "touch" });
    }
    rec.timer = setTimeout(function () {
      if (rec.cancelled || rec.moved > 8 || !pointers.has(e.pointerId)) return;
      rec.long = true;
      BN.ghost.hide();
      rec.preview = null;
      if (rec.hit.noteId) {
        var ids = selIds();
        if (ids.length && BN.model.find(score(), ids[0]).note.staff === rec.hit.staff) {
          S.selection = BN.model.rangeIds(score(), rec.hit.staff, ids[0], rec.hit.noteId);
          S.selMeasures = [];
          BN.editor.redraw();
          rec.extended = true;
        } else {
          rec.lassoStart = rec.hit.noteId;
          rec.lassoStaff = rec.hit.staff;
          rec.lasso = true;
          select([rec.hit.noteId]);
        }
      } else {
        rec.lasso = true;
        rec.lassoStart = noteIdAtNearest(rec.hit);
        rec.lassoStaff = rec.hit.staff;
        rec.lassoFresh = true;
      }
    }, HOLD_MS);
  }

  function onMove(e) {
    if (ignoreEmulatedMouse(e) && !pointers.has(e.pointerId)) return;
    var rec = pointers.get(e.pointerId);
    if (!rec) return;
    rec.moved += Math.abs(e.clientX - rec.x) + Math.abs(e.clientY - rec.y);
    var dx = e.clientX - rec.x;
    var dy = e.clientY - rec.y;
    rec.x = e.clientX;
    rec.y = e.clientY;
    if (pointers.size >= 2) {
      var pts = Array.from(pointers.values());
      var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      var midY = (pts[0].y + pts[1].y) / 2;
      if (rec.pinchDist == null) rec.pinchDist = dist;
      if (rec.midY == null) rec.midY = midY;
      var stage = document.getElementById("stage");
      if (Math.abs(dist - rec.pinchDist) > 24) {
        pts.forEach(function (p) { p.pinch = true; });
        BN.editor.setZoom(S.zoom * (dist > rec.pinchDist ? 1.04 : 0.96), true);
        rec.pinchDist = dist;
      } else if (Math.abs(midY - rec.midY) > 2 && stage) {
        stage.scrollTop -= midY - rec.midY;
        pts.forEach(function (p) { p.scrolled = true; });
      }
      rec.midY = midY;
      return;
    }
    void dx; void dy;
    if (!rec.inScore || rec.cancelled) return;
    if (rec.lasso) {
      if (rec.lassoFresh && rec.moved > 2) rec.lassoFresh = false;
      lassoTo(rec, e);
      return;
    }
    var hit = BN.render.hit(score(), e.clientX, e.clientY);
    if (!hit) return;
    if (rec.mode === "enter") {
      if (rec.moved > 8) {
        rec.dragged = true;
        if (rec.timer) { clearTimeout(rec.timer); rec.timer = 0; }
      }
      rec.hit = hit.noteId ? Object.assign({}, hit, { noteId: null }) : hit;
      rec.preview = ghostAt(rec.hit.staff, rec.hit.measure, rec.hit.insertAt, rec.hit.pos, 0, { touch: rec.pointerType === "touch" });
      if (rec.dragged && rec.preview && rec.preview.pitch && rec.preview.pos !== rec.lastPos) {
        rec.lastPos = rec.preview.pos;
        preview(rec.preview.pitch, rec.hit.staff);
      }
    } else if (rec.mode === "cursor" && rec.moved > 10) {
      /* pad-only mode: dragging across the page selects like a lasso */
      if (rec.timer) { clearTimeout(rec.timer); rec.timer = 0; }
      var start = BN.render.hit(score(), rec.x0, rec.y0);
      if (start) {
        rec.lasso = true;
        rec.lassoStart = noteIdAtNearest(start);
        rec.lassoStaff = start.staff;
        lassoTo(rec, e);
      }
    } else if (rec.mode === "note" && rec.moved > 10) {
      if (rec.timer) { clearTimeout(rec.timer); rec.timer = 0; }
    }
  }

  function onUp(e) {
    if (e.pointerType === "touch") lastTouchAt = Date.now();
    BN.ghost.hide();
    if (ignoreEmulatedMouse(e) && !pointers.has(e.pointerId)) return;
    var rec = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (rec && rec.timer) clearTimeout(rec.timer);
    if (pointers.size > 0) return;
    var fingers = gesture;
    gesture = 0;
    if (fingers >= 3) { BN.editor.redo(); return; }
    if (fingers >= 2) {
      if (rec && (rec.pinch || rec.scrolled)) return;
      if (rec && Date.now() - rec.t < 600) BN.editor.undo();
      return;
    }
    if (!rec || rec.cancelled) return;
    if (!rec.inScore) {
      /* tap on the paper outside the staves */
      if (rec.moved < 10 && Date.now() - rec.t < 500) clearSelection();
      return;
    }
    if (rec.lasso || rec.extended) return;
    var hit = rec.hit;
    if (!hit) { clearSelection(); return; }
    if (rec.mode === "note") {
      if (rec.moved < 14 && Date.now() - rec.t < 600) select([hit.noteId]);
      return;
    }
    if (rec.mode === "enter") {
      if (rec.moved > 400) return;
      var staff = hit.staff;
      var pitch = rec.preview ? rec.preview.pitch : buildPitch(staff, hit.measure, hit.insertAt, hit.pos, 0);
      var prevSel = selIds();
      void prevSel;
      S.cursor = { staff: staff, measure: hit.measure, index: hit.insertAt };
      S.selection = [];
      insertNote(staff, hit.measure, hit.insertAt, pitch);
      return;
    }
    /* cursor mode: place the cursor and select the measure; a second tap selects the row */
    if (!hit.inside) { clearSelection(); return; }
    var now = Date.now();
    if (lastTap && lastTap.measure === hit.measure && now - lastTap.t < 420) {
      lastTap = null;
      selectRow(hit.measure);
      return;
    }
    lastTap = { measure: hit.measure, t: now };
    selectMeasures(hit.measure, hit.measure, hit.staff);
    S.cursor = { staff: hit.staff, measure: hit.measure, index: hit.insertAt };
    BN.editor.redraw();
  }

  function onCancel(e) {
    var rec = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (rec && rec.timer) clearTimeout(rec.timer);
    BN.ghost.hide();
    if (!pointers.size) gesture = 0;
  }

  function isTyping(e) {
    var t = e.target;
    return t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  }

  function onKey(e) {
    if (!score() || isTyping(e) || document.body.dataset.screen !== "editor") return;
    var key = e.key;
    var mod = e.ctrlKey || e.metaKey;
    if (mod && (key === "z" || key === "Z")) { e.preventDefault(); if (e.shiftKey) BN.editor.redo(); else BN.editor.undo(); return; }
    if (mod && (key === "y" || key === "Y")) { e.preventDefault(); BN.editor.redo(); return; }
    if (mod && (key === "c" || key === "C")) { e.preventDefault(); copySelection(); return; }
    if (mod && (key === "x" || key === "X")) { e.preventDefault(); cutSelection(); return; }
    if (mod && (key === "v" || key === "V")) { e.preventDefault(); pasteAtCursor(); return; }
    if (mod && (key === "a" || key === "A")) { e.preventDefault(); selectAll(); return; }
    if (mod && key !== "ArrowUp" && key !== "ArrowDown") return;
    var durs = { "1": "whole", "2": "half", "3": "quarter", "4": "eighth", "5": "16th" };
    if (durs[key]) { e.preventDefault(); pressDuration(durs[key]); return; }
    if (key === "6" || key === "r" || key === "R") { e.preventDefault(); insertRest(); return; }
    if (key === "Backspace" || key === "Delete") { e.preventDefault(); deleteSelection(); return; }
    if (key === "Escape") { clearSelection(); if (ui().ribbon) ui().ribbon.closePop(); return; }
    if (key === ".") { e.preventDefault(); toggleDot(); return; }
    if (key === "+") { e.preventDefault(); pressAccidental("sharp"); return; }
    if (key === "-") { e.preventDefault(); pressAccidental("flat"); return; }
    if (key === "=") { e.preventDefault(); pressAccidental("natural"); return; }
    if (key === "t" || key === "T") { e.preventDefault(); toggleTie(); return; }
    if (key === " ") { e.preventDefault(); if (ui().topbar) ui().topbar.togglePlay(); return; }
    if (key === "ArrowUp" || key === "ArrowDown") {
      e.preventDefault();
      var dir = key === "ArrowUp" ? 1 : -1;
      if (mod) shiftOctave(dir); else stepSelection(dir);
      return;
    }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      e.preventDefault();
      var ltr = key === "ArrowRight" ? 1 : -1;
      var ids = selIds();
      if (ids.length) {
        var r = BN.model.find(score(), ids[ids.length - 1]);
        var list = BN.model.refs(score(), r.note.staff);
        var at = list.findIndex(function (x) { return x.note.id === r.note.id; });
        var nx = list[at + ltr];
        if (nx) select([nx.note.id]);
      } else moveCursor(ltr);
      return;
    }
    if (/^[a-gA-G]$/.test(key)) {
      e.preventDefault();
      var c = cursor();
      var step = key.toUpperCase();
      var clef = clefOf(c.staff);
      var from = lastPos(c.staff);
      var best = null;
      for (var pos = from - 3; pos <= from + 3; pos++) {
        var pp = BN.music.posToPitch(clef, pos, keyAt(c.measure));
        if (pp.step === step && (best === null || Math.abs(pos - from) < Math.abs(best - from))) best = pos;
      }
      if (best !== null) {
        var pitch = buildPitch(c.staff, c.measure, c.index, best, 0);
        enterPitch(pitch);
      }
    }
  }

  BN.editor = {
    cursor: cursor,
    select: select,
    clearSelection: clearSelection,
    selectMeasures: selectMeasures,
    selectRow: selectRow,
    selectAll: selectAll,
    selected: selNotes,
    selectedIds: selIds,
    pressDuration: pressDuration,
    setDots: setDots,
    toggleDot: toggleDot,
    toggleTie: toggleTie,
    pressAccidental: pressAccidental,
    stepSelection: stepSelection,
    shiftAlter: shiftAlter,
    shiftOctave: shiftOctave,
    cycleDuration: cycleDuration,
    deleteSelection: deleteSelection,
    insertRest: insertRest,
    enterPitch: enterPitch,
    insertNote: insertNote,
    buildPitch: buildPitch,
    ghostAt: ghostAt,
    lastPos: lastPos,
    copy: copySelection,
    cut: cutSelection,
    paste: pasteAtCursor,
    duplicate: duplicateSelection,
    toggleMark: toggleMark,
    setBarline: setBarline,
    addMeasure: addMeasure,
    removeMeasure: removeMeasure,
    targetMeasure: targetMeasure,
    commit: commit,
    clefOf: clefOf,
    keyAt: keyAt,
    revealCursor: revealCursor,
    pal: pal,
    DEFAULT_POS: DEFAULT_POS,

    /* Piano: a MIDI key becomes the exact pitch; black keys follow the key signature. */
    pianoKey: function (midi) {
      var c = cursor();
      var refs = selNotes();
      var staff = refs.length ? refs[0].note.staff : c.staff;
      var pitch = BN.music.midiToPitch(midi, keyAt(refs.length ? refs[0].measureIndex : c.measure));
      return enterPitch(pitch, { staff: staff });
    },

    redraw: function () {
      var host = document.getElementById("score");
      if (!host || !score()) return;
      var t0 = performance.now();
      var sel = selIds();
      BN.render.draw(score(), host, {
        width: host.clientWidth || 700,
        scale: S.zoom || 1,
        selectedIds: sel,
        selMeasures: S.selMeasures || [],
        cursor: cursor(),
        playingId: S.playingId
      });
      BN.editor.lastDrawMs = performance.now() - t0;
      BN.editor.syncHeader();
      if (ui().syncAll) ui().syncAll();
    },

    syncHeader: function () {
      var sc = score();
      var title = document.getElementById("doc-title");
      var comp = document.getElementById("doc-composer");
      var tempo = document.getElementById("doc-tempo");
      if (title) title.textContent = sc.title || "";
      if (comp) comp.textContent = sc.composer || "";
      if (tempo) tempo.innerHTML = BN.icons.svg("quarter", 14, "ic-inline") + " = " + sc.tempo.bpm;
      var status = document.getElementById("status");
      if (status) {
        var c = cursor();
        var m = sc.parts[0].measures[c.measure];
        var own = m.notes.filter(function (n) { return n.staff === c.staff; });
        var ticks = 0;
        for (var i = 0; i < c.index && i < own.length; i++) ticks += own[i].duration;
        var time = BN.model.timeOf(sc.parts[0], c.measure);
        var beat = Math.floor(ticks / (192 / time.beatType)) + 1;
        status.textContent = "תיבה " + (c.measure + 1) + " · פעמה " + beat + " · קול 1";
      }
    },

    setZoom: function (z, defer) {
      S.zoom = Math.max(0.6, Math.min(2, Math.round(z * 100) / 100));
      if (defer) {
        if (zoomFrame) return;
        zoomFrame = requestAnimationFrame(function () { zoomFrame = 0; BN.editor.redraw(); });
      } else BN.editor.redraw();
    },

    undo: function () {
      if (!score()) return;
      var next = BN.history.undo(score());
      if (next === score()) return;
      S.current = next;
      BN.store.schedule(next);
      S.cursor = S.cursor ? BN.model.clampCursor(next, S.cursor) : null;
      BN.editor.redraw();
    },

    redo: function () {
      if (!score()) return;
      var next = BN.history.redo(score());
      if (next === score()) return;
      S.current = next;
      BN.store.schedule(next);
      S.cursor = S.cursor ? BN.model.clampCursor(next, S.cursor) : null;
      BN.editor.redraw();
    },

    onPlayhead: function (id) {
      S.playingId = id;
      var stage = document.getElementById("stage");
      if (id && BN.render.layout && BN.render.layout.notes[id] && stage) {
        var meta = BN.render.layout.notes[id];
        var pt = BN.render.client(meta.svg, meta.x, meta.pitchY || 0);
        var rect = stage.getBoundingClientRect();
        if (pt.y < rect.top + 40 || pt.y > rect.bottom - 120) stage.scrollTop += pt.y - rect.top - rect.height / 3;
      }
      BN.editor.redraw();
    },

    mount: function (stage) {
      stage.addEventListener("pointerdown", onDown, { passive: false });
      stage.addEventListener("pointermove", onMove);
      stage.addEventListener("pointerup", onUp);
      stage.addEventListener("pointercancel", onCancel);
      stage.addEventListener("contextmenu", function (e) { e.preventDefault(); });
      stage.addEventListener("scroll", function () { if (ui().contextbar) ui().contextbar.sync(); }, { passive: true });
      document.addEventListener("keydown", onKey);
      window.addEventListener("resize", function () {
        if (document.body.dataset.screen === "editor") BN.editor.redraw();
      });
    }
  };
})();
