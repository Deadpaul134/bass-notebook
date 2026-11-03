/* Palette, tap-to-engrave, selection, keyboard. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var pointers = new Map();
  var gesture = 0;

  function palette() {
    BN.state.palette = BN.state.palette || { type: "quarter", dots: 0, rest: false, tie: false, accidental: null, select: false };
    return BN.state.palette;
  }

  function clefName(score, staff) {
    if (score.staffLayout === "grand") return staff === 1 ? "treble" : "bass";
    return score.staffLayout === "treble" ? "treble" : "bass";
  }

  function commit(mutate) {
    BN.history.exec(BN.state.current, function (score) {
      mutate(score);
    });
    BN.store.schedule(BN.state.current);
    BN.editor.redraw();
  }

  function place(hit, pitch) {
    var pal = palette();
    var note = BN.model.noteFromPalette({
      type: pal.type,
      dots: pal.dots,
      rest: pal.rest,
      tie: pal.tie,
      accidental: pal.accidental,
      staff: hit.staff
    }, pitch);
    if (!pal.rest && !pal.accidental) {
      var part = BN.state.current.parts[0];
      var measure = part.measures[hit.measure];
      var prior = (measure ? measure.notes : []).filter(function (n) { return n.staff === hit.staff && !n.generated; });
      var alter = BN.music.fifthsAlter(pitch.step, BN.model.keyOf(part, hit.measure).fifths);
      prior.forEach(function (n) {
        if (n.pitch && n.pitch.step === pitch.step && n.pitch.octave === pitch.octave) alter = n.pitch.alter || 0;
      });
      note.pitch.alter = alter;
    }
    var replacing = !!(hit.noteId && !pal.rest);
    BN.state.selection = replacing ? [hit.noteId] : [];
    commit(function (score) {
      if (replacing) {
        BN.model.replacePitch(score, hit.noteId, note.pitch);
        var item = BN.model.find(score, hit.noteId);
        if (item) {
          if (pal.accidental) item.note.accidental = pal.accidental;
          else delete item.note.accidental;
        }
      } else if (typeof hit.insertAt === "number" && hit.insertAt < 99) BN.model.insertAt(score, hit.staff, hit.measure, hit.insertAt, note);
      else BN.model.append(score, hit.staff, note);
    });
    pal.accidental = null;
    BN.state.cursor = { staff: hit.staff, measure: hit.measure, insertAt: (hit.insertAt || 0) + 1 };
    if (note.pitch) BN.playback.preview(BN.music.pitchToMidi(note.pitch), hit.staff, BN.state.current);
    BN.editor.syncPalette();
  }

  function showGhost(x, y, text) {
    var ghost = document.getElementById("ghost");
    if (!ghost) return;
    ghost.hidden = false;
    ghost.style.left = (x + 14) + "px";
    ghost.style.top = (y - 36) + "px";
    ghost.textContent = text;
  }

  function hideGhost() {
    var ghost = document.getElementById("ghost");
    if (ghost) ghost.hidden = true;
  }

  BN.editor = {
    redraw: function () {
      var host = document.getElementById("score");
      if (!host || !BN.state.current) return;
      var t0 = performance.now();
      BN.render.draw(BN.state.current, host, {
        width: host.clientWidth || 700,
        selectedIds: BN.state.selection || [],
        playingId: BN.state.playingId
      });
      var mark = document.getElementById("cursor");
      if (mark && BN.state.cursor && BN.render.layout) {
        var c = BN.state.cursor;
        var pt = BN.render.locate({ staff: c.staff, measure: c.measure, pos: 4, slot: "before:" + (c.insertAt || 0) });
        mark.hidden = false;
        mark.style.left = pt.x + "px";
        mark.style.top = (pt.y - 48) + "px";
      } else if (mark && !BN.state.playingId) {
        mark.hidden = true;
      }
      BN.editor.lastDrawMs = performance.now() - t0;
      BN.editor.syncPalette();
    },
    syncPalette: function () {
      document.querySelectorAll("[data-type]").forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.dataset.type === palette().type ? "true" : "false");
      });
      var rest = document.querySelector("[data-action='rest']");
      if (rest) rest.setAttribute("aria-pressed", palette().rest ? "true" : "false");
      var dots = document.querySelector("[data-action='dots']");
      if (dots) {
        dots.textContent = palette().dots === 2 ? "··" : "·";
        dots.setAttribute("aria-pressed", palette().dots ? "true" : "false");
      }
      var tieBtn = document.querySelector("[data-action='tie']");
      if (tieBtn) tieBtn.setAttribute("aria-pressed", palette().tie ? "true" : "false");
      var selectBtn = document.querySelector("[data-action='select']");
      if (selectBtn) selectBtn.setAttribute("aria-pressed", palette().select ? "true" : "false");
      document.querySelectorAll("[data-acc]").forEach(function (btn) {
        btn.setAttribute("aria-pressed", btn.dataset.acc === palette().accidental ? "true" : "false");
      });
      var canUndo = BN.state.current ? BN.history.canUndo(BN.state.current.id) : false;
      document.querySelectorAll("[data-action='undo'], [data-hist='undo']").forEach(function (undo) {
        undo.disabled = !canUndo;
      });
      var redo = document.querySelector("[data-action='redo']");
      if (redo && BN.state.current) redo.disabled = !BN.history.canRedo(BN.state.current.id);
    },
    onPlayhead: function (id) {
      BN.state.playingId = id;
      var host = document.getElementById("score");
      if (!host || !BN.render.layout) return;
      document.querySelectorAll(".vf-stavenote").forEach(function (el) { el.style.opacity = ""; });
      if (!id || !BN.render.layout.notes[id]) {
        BN.editor.redraw();
        return;
      }
      var meta = BN.render.layout.notes[id];
      var pt = BN.render.client(meta.svg, meta.x, meta.pitchY || 0);
      var scroller = document.getElementById("stage");
      if (scroller) {
        var rect = scroller.getBoundingClientRect();
        if (pt.y < rect.top + 40 || pt.y > rect.bottom - 40) scroller.scrollTop += pt.y - rect.top - rect.height / 3;
      }
      BN.editor.redraw();
    },
    undo: function () {
      if (!BN.state.current) return;
      var next = BN.history.undo(BN.state.current);
      if (next === BN.state.current) return;
      BN.state.current = next;
      BN.store.schedule(next);
      BN.editor.redraw();
      if (BN.syncChrome) BN.syncChrome();
    },
    redo: function () {
      if (!BN.state.current) return;
      var next = BN.history.redo(BN.state.current);
      if (next === BN.state.current) return;
      BN.state.current = next;
      BN.store.schedule(next);
      BN.editor.redraw();
      if (BN.syncChrome) BN.syncChrome();
    },
    mount: function (root) {
      root.addEventListener("pointerdown", onDown);
      root.addEventListener("pointermove", onMove);
      root.addEventListener("pointerup", onUp);
      root.addEventListener("pointercancel", onCancel);
      if (!BN.editor._keys) {
        document.addEventListener("keydown", onKey);
        BN.editor._keys = true;
      }
    }
  };

  function selectedNote() {
    var ids = BN.state.selection || [];
    if (!ids.length) return null;
    return BN.model.find(BN.state.current, ids[0]);
  }

  function pitchAt(hit) {
    var clef = clefName(BN.state.current, hit.staff);
    var key = BN.model.keyOf(BN.state.current.parts[0], hit.measure);
    return BN.music.posToPitch(clef, hit.pos, key);
  }

  function labelFor(pitch) {
    if (palette().rest || !pitch) return "הפסקה";
    return pitch.step + (pitch.alter === 1 ? "♯" : pitch.alter === -1 ? "♭" : "") + pitch.octave;
  }

  function onDown(e) {
    if (e.target.closest("button, a, input, select, textarea")) return;
    var rec = { x: e.clientX, y: e.clientY, t: Date.now(), moved: 0 };
    pointers.set(e.pointerId, rec);
    if (pointers.size > gesture) gesture = pointers.size;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    if (pointers.size >= 2) return;
    var hit = BN.render.hit(BN.state.current, e.clientX, e.clientY);
    if (!hit) return;
    rec.hit = hit;
    rec.origin = hit;
    rec.pitch = pitchAt(hit);
    showGhost(e.clientX, e.clientY, labelFor(rec.pitch));
    if (BN.render.stepPx && BN.render.stepPx(hit.measure, hit.staff) < 12) {
      var loupe = document.getElementById("loupe");
      if (loupe) {
        loupe.hidden = false;
        loupe.style.left = (e.clientX - 130) + "px";
        loupe.style.top = (e.clientY - 110) + "px";
        loupe.innerHTML = "<b>" + labelFor(rec.pitch) + "</b>";
      }
    }
    rec.timer = setTimeout(function () {
      if (rec.origin && rec.origin.noteId && rec.moved < 10) {
        rec.long = true;
        BN.state.selection = [rec.origin.noteId];
        BN.editor.redraw();
      }
    }, 350);
  }

  function onMove(e) {
    var rec = pointers.get(e.pointerId);
    if (!rec) return;
    rec.moved += Math.abs(e.clientX - rec.x) + Math.abs(e.clientY - rec.y);
    rec.x = e.clientX;
    rec.y = e.clientY;
    if (pointers.size >= 2) {
      var pts = Array.from(pointers.values());
      if (pts.length >= 2) {
        var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (rec.pinchDist == null) rec.pinchDist = dist;
        if (Math.abs(dist - rec.pinchDist) > 28) {
          pts.forEach(function (p) { p.pinch = true; });
          var zoom = BN.state.zoom || 1;
          BN.state.zoom = Math.max(0.6, Math.min(2, zoom * (dist > rec.pinchDist ? 1.03 : 0.97)));
          var host = document.getElementById("score");
          if (host) {
            host.style.transformOrigin = "top center";
            host.style.transform = "scale(" + BN.state.zoom + ")";
          }
          rec.pinchDist = dist;
        }
      }
      return;
    }
    if (!rec.origin) return;
    var hit = BN.render.hit(BN.state.current, e.clientX, e.clientY);
    if (!hit) return;
    if (rec.origin.noteId) {
      hit = Object.assign({}, hit, { noteId: rec.origin.noteId, staff: rec.origin.staff, measure: rec.origin.measure, insertAt: 99 });
    }
    rec.hit = hit;
    rec.pitch = pitchAt(hit);
    if (rec.moved > 8) rec.dragged = true;
    showGhost(e.clientX, e.clientY, labelFor(rec.pitch));
    var loupe = document.getElementById("loupe");
    if (loupe && !loupe.hidden) loupe.innerHTML = "<b>" + labelFor(rec.pitch) + "</b>";
    if (rec.dragged && rec.pitch && !palette().rest) {
      var midi = BN.music.pitchToMidi(rec.pitch);
      if (midi !== rec.lastMidi) {
        rec.lastMidi = midi;
        BN.playback.preview(midi, hit.staff, BN.state.current);
      }
    }
  }

  function selectRange(a, b) {
    var box = BN.render.layout && BN.render.layout.byMeasure[a.measure];
    if (!box) return;
    var slots = (box.slots && box.slots[a.staff]) || [];
    var x1 = Math.min(a.svg.x, b.svg.x);
    var x2 = Math.max(a.svg.x, b.svg.x);
    BN.state.selection = slots.filter(function (slot) {
      return slot.x <= x2 && slot.x + slot.w >= x1;
    }).map(function (slot) { return slot.id; });
    BN.editor.redraw();
  }

  function onUp(e) {
    hideGhost();
    var loupe = document.getElementById("loupe");
    if (loupe) loupe.hidden = true;
    var rec = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (rec && rec.timer) clearTimeout(rec.timer);
    if (pointers.size > 0) return;
    var fingers = gesture;
    gesture = 0;
    if (fingers >= 3) { BN.editor.redo(); return; }
    if (fingers >= 2) {
      if (rec && rec.pinch) return;
      BN.editor.undo();
      return;
    }
    if (!rec || !rec.origin || !rec.hit) return;
    if (rec.long && rec.moved < 12 && rec.origin.noteId) {
      BN.state.selection = [rec.origin.noteId];
      BN.editor.redraw();
      return;
    }
    if (palette().select && rec.origin.noteId && rec.moved < 12) {
      BN.state.selection = [rec.origin.noteId];
      BN.editor.redraw();
      return;
    }
    if (palette().select && rec.moved > 16 && !rec.origin.noteId) {
      selectRange(rec.origin, rec.hit);
      return;
    }
    place(rec.hit, rec.pitch);
  }

  function onCancel() {
    hideGhost();
    var loupe = document.getElementById("loupe");
    if (loupe) loupe.hidden = true;
    pointers.forEach(function (rec) { if (rec.timer) clearTimeout(rec.timer); });
    pointers.clear();
    gesture = 0;
  }

  function onKey(e) {
    if (!BN.state.current || location.hash.indexOf("#score/") !== 0) return;
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    var pal = palette();
    if (e.key === " ") { e.preventDefault(); BN.state.playing ? BN.playback.pause() : BN.playback.play(BN.state.current); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? BN.editor.redo() : BN.editor.undo(); return; }
    if (/^[1-5]$/.test(e.key)) {
      pal.type = { "1": "whole", "2": "half", "3": "quarter", "4": "eighth", "5": "16th" }[e.key];
      var sel = selectedNote();
      if (sel) commit(function () {
        sel.note.type = pal.type;
        sel.note.dots = pal.dots;
        sel.note.duration = BN.music.ticksOf(pal.type, pal.dots);
        BN.model.normalize(BN.state.current);
      });
      BN.editor.syncPalette();
    } else if (e.key === ".") {
      pal.dots = (pal.dots + 1) % 3;
      var dotted = selectedNote();
      if (dotted) commit(function (score) {
        var item = BN.model.find(score, dotted.note.id);
        if (!item) return;
        item.note.dots = pal.dots;
        item.note.duration = BN.music.ticksOf(item.note.type, pal.dots);
        BN.model.normalize(score);
      });
      BN.editor.syncPalette();
    } else if (e.key === "+" || e.key === "=") {
      applyAcc("sharp");
    } else if (e.key === "-") {
      applyAcc("flat");
    } else if (e.key === "n" || e.key === "N") {
      applyAcc("natural");
    } else if (/^[a-gA-G]$/.test(e.key)) {
      var step = e.key.toUpperCase();
      var hit = recHit() || { staff: 1, measure: contentMeasure(), pos: 4, insertAt: 99 };
      var pitch = BN.music.posToPitch(clefName(BN.state.current, hit.staff), 4, BN.model.keyOf(BN.state.current.parts[0], hit.measure));
      pitch.step = step;
      pitch.alter = BN.music.fifthsAlter(step, BN.model.keyOf(BN.state.current.parts[0], hit.measure).fifths);
      place(hit, pitch);
    } else if (e.key === "r" || e.key === "R") {
      pal.rest = !pal.rest;
      BN.editor.syncPalette();
    } else if (e.key === "t" || e.key === "T") {
      pal.tie = !pal.tie;
    } else if (e.key === "Backspace" || e.key === "Delete") {
      var found = selectedNote();
      if (found) {
        e.preventDefault();
        commit(function (score) { BN.model.deleteNote(score, found.note.id, "rest"); });
        BN.state.selection = [];
      }
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      var selN = selectedNote();
      if (!selN || selN.note.rest) return;
      e.preventDefault();
      var delta = e.key === "ArrowUp" ? 1 : -1;
      if (e.ctrlKey || e.metaKey) delta *= 7;
      var pos = BN.music.pitchToPos(clefName(BN.state.current, selN.note.staff), selN.note.pitch) + delta;
      var pitch = BN.music.posToPitch(clefName(BN.state.current, selN.note.staff), pos, BN.model.keyOf(BN.state.current.parts[0], selN.measureIndex));
      commit(function (score) { BN.model.replacePitch(score, selN.note.id, pitch); });
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      var cursor = BN.state.cursor || { staff: 1, measure: contentMeasure(), insertAt: 0 };
      cursor.insertAt = Math.max(0, cursor.insertAt + (e.key === "ArrowRight" ? 1 : -1));
      BN.state.cursor = cursor;
      BN.editor.redraw();
    }
  }

  function applyAcc(name) {
    var pal = palette();
    pal.accidental = pal.accidental === name ? null : name;
    var sel = selectedNote();
    if (sel) commit(function (score) { BN.model.setAccidental(score, sel.note.id, pal.accidental); });
    BN.editor.syncPalette();
  }

  function contentMeasure() {
    var measures = BN.state.current.parts[0].measures;
    for (var i = measures.length - 1; i >= 0; i--) {
      if (measures[i].notes.some(function (n) { return !n.generated; })) return i;
    }
    return 0;
  }

  function recHit() { return null; }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-type], [data-acc], [data-action='rest'], [data-action='dots'], [data-action='tie'], [data-action='select'], [data-action='delete'], [data-action='undo'], [data-hist='undo'], [data-action='redo']");
    if (!btn || !BN.state.current) return;
    var pal = palette();
    if (btn.dataset.type) {
      pal.type = btn.dataset.type;
      var sel = selectedNote();
      if (sel) commit(function (score) {
        var item = BN.model.find(score, sel.note.id);
        if (!item) return;
        item.note.type = pal.type;
        item.note.duration = BN.music.ticksOf(pal.type, item.note.dots || 0);
        BN.model.normalize(score);
      });
    }
    if (btn.dataset.action === "rest") pal.rest = !pal.rest;
    if (btn.dataset.action === "dots") {
      pal.dots = (pal.dots + 1) % 3;
      var selD = selectedNote();
      if (selD) commit(function (score) {
        var item = BN.model.find(score, selD.note.id);
        if (!item) return;
        item.note.dots = pal.dots;
        item.note.duration = BN.music.ticksOf(item.note.type, pal.dots);
        BN.model.normalize(score);
      });
    }
    if (btn.dataset.action === "tie") {
      pal.tie = !pal.tie;
      var selT = selectedNote();
      if (selT) commit(function (score) {
        var item = BN.model.find(score, selT.note.id);
        if (!item || item.note.rest) return;
        item.note.tie = item.note.tie && item.note.tie.start ? undefined : { start: true };
        if (!item.note.tie) delete item.note.tie;
      });
    }
    if (btn.dataset.acc) {
      pal.accidental = pal.accidental === btn.dataset.acc ? null : btn.dataset.acc;
      var selA = selectedNote();
      if (selA) commit(function (score) { BN.model.setAccidental(score, selA.note.id, pal.accidental); });
    }
    if (btn.dataset.action === "select") pal.select = !pal.select;
    if (btn.dataset.action === "delete") {
      var ids = (BN.state.selection || []).slice();
      if (ids.length) commit(function (score) {
        ids.forEach(function (id) { BN.model.deleteNote(score, id, "rest"); });
      });
      BN.state.selection = [];
    }
    if (btn.dataset.action === "undo" || btn.dataset.hist === "undo") BN.editor.undo();
    if (btn.dataset.action === "redo") BN.editor.redo();
    BN.editor.syncPalette();
  });
})();
