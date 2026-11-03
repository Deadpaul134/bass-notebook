/* Bass Notebook — tap entry, selection, measure overflow. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var palette = { dur: "q", dots: 0, acc: null, rest: false };
  var selection = null;
  var cursor = { system: 0, staff: 0, measure: 0 };
  var drag = null;

  function pitchName(pitch) {
    if (!pitch) return "";
    var acc = pitch.acc === "#" ? "♯" : pitch.acc === "b" ? "♭" : pitch.acc === "n" ? "♮" : "";
    return pitch.step + acc + pitch.oct;
  }

  function ensureMeasures(page, systemIdx, count) {
    var sys = page.systems[systemIdx];
    sys.staves.forEach(function (staff) {
      while (staff.measures.length < count) {
        var prev = staff.measures[staff.measures.length - 1];
        staff.measures.push({
          barEnd: "single",
          events: []
        });
        if (prev && prev.barEnd === "end") prev.barEnd = "single";
      }
    });
  }

  function addMeasure(page, systemIdx) {
    var sys = page.systems[systemIdx];
    var n = sys.staves[0].measures.length + 1;
    ensureMeasures(page, systemIdx, n);
  }

  function place(page, systemIdx, staffIdx, measureIdx, event) {
    ensureMeasures(page, systemIdx, measureIdx + 1);
    var guard = 0;
    while (guard < 64) {
      guard += 1;
      var sys = page.systems[systemIdx];
      var staff = sys.staves[staffIdx];
      ensureMeasures(page, systemIdx, measureIdx + 1);
      var measure = staff.measures[measureIdx];
      var trial = {
        time: measure.time,
        events: measure.events.concat([event])
      };
      var fill = BN.music.measureFill(trial, page.time);
      if (fill !== "over" || measure.events.length === 0) {
        measure.events.push(event);
        cursor = { system: systemIdx, staff: staffIdx, measure: measureIdx };
        selection = { system: systemIdx, staff: staffIdx, measure: measureIdx, index: measure.events.length - 1 };
        return;
      }
      measureIdx += 1;
      if (measureIdx >= staff.measures.length) addMeasure(page, systemIdx);
    }
  }

  function reflow(page, systemIdx, staffIdx, measureIdx) {
    var staff = page.systems[systemIdx].staves[staffIdx];
    var i = measureIdx;
    while (i < staff.measures.length) {
      var measure = staff.measures[i];
      while (BN.music.measureFill(measure, page.time) === "over" && measure.events.length > 1) {
        var moved = measure.events.pop();
        if (i + 1 >= staff.measures.length) addMeasure(page, systemIdx);
        staff.measures[i + 1].events.unshift(moved);
      }
      if (BN.music.measureFill(measure, page.time) === "over") break;
      i += 1;
    }
  }

  function showGhost(clientX, clientY, text) {
    var ghost = document.getElementById("ghost");
    if (!ghost) return;
    ghost.hidden = false;
    ghost.style.left = clientX + 16 + "px";
    ghost.style.top = clientY - 28 + "px";
    ghost.textContent = text;
    var loupe = document.getElementById("loupe");
    if (!loupe) return;
    var step = BN.render.screenStep ? BN.render.screenStep() : 12;
    var zoom = Number(document.documentElement.getAttribute("data-zoom") || "1");
    if (step < 12 || zoom < 0.85) {
      loupe.hidden = false;
      loupe.style.left = Math.min(window.innerWidth - 140, clientX + 24) + "px";
      loupe.style.top = Math.max(8, clientY - 120) + "px";
      loupe.querySelector("b").textContent = text;
    } else {
      loupe.hidden = true;
    }
  }

  function hideGhost() {
    var ghost = document.getElementById("ghost");
    var loupe = document.getElementById("loupe");
    if (ghost) ghost.hidden = true;
    if (loupe) loupe.hidden = true;
  }

  BN.tap = {
    palette: function () {
      return {
        dur: palette.dur,
        dots: palette.dots,
        acc: palette.acc,
        rest: palette.rest
      };
    },
    selection: function () {
      return selection ? Object.assign({}, selection) : null;
    },
    cursor: function () {
      return Object.assign({}, cursor);
    },
    clearSelection: function () {
      selection = null;
    },
    setPalette: function (patch) {
      Object.keys(patch).forEach(function (k) {
        palette[k] = patch[k];
      });
    },

    down: function (page, e) {
      var note = BN.render.hitNote(e.clientX, e.clientY);
      if (note) {
        selection = { system: note.system, staff: note.staff, measure: note.measure, index: note.index };
        cursor = { system: note.system, staff: note.staff, measure: note.measure };
        var ev = page.systems[note.system].staves[note.staff].measures[note.measure].events[note.index];
        drag = {
          pointerId: e.pointerId,
          note: note,
          origin: ev && ev.pitch ? Object.assign({}, ev.pitch) : null,
          moved: false,
          lastPos: null
        };
        return { kind: "select" };
      }
      var hit = BN.render.hitStaff(e.clientX, e.clientY);
      if (!hit) return null;
      if (hit.clef) return { kind: "clef", system: hit.system };
      drag = { pointerId: e.pointerId, hit: hit, moved: false };
      var pitch = BN.music.posToPitch(page.systems[hit.system].staves[hit.staff].clef, hit.pos);
      if (palette.acc) pitch.acc = palette.acc;
      showGhost(e.clientX, e.clientY, palette.rest ? "הפסקה" : pitchName(pitch));
      return { kind: "ghost" };
    },

    move: function (page, e) {
      if (!drag || e.pointerId !== drag.pointerId) return null;
      if (drag.note) {
        var hitN = BN.render.hitStaff(e.clientX, e.clientY);
        if (!hitN) return null;
        var ev = page.systems[drag.note.system].staves[drag.note.staff].measures[drag.note.measure].events[drag.note.index];
        if (!ev || ev.kind === "rest") return null;
        if (hitN.pos !== drag.lastPos) {
          drag.moved = true;
          drag.lastPos = hitN.pos;
          var clef = page.systems[drag.note.system].staves[drag.note.staff].clef;
          var next = BN.music.posToPitch(clef, hitN.pos);
          next.acc = ev.pitch && ev.pitch.acc ? ev.pitch.acc : null;
          showGhost(e.clientX, e.clientY, pitchName(next));
          return { kind: "drag", pitch: next };
        }
        return null;
      }
      if (drag.hit) {
        var hit = BN.render.hitStaff(e.clientX, e.clientY) || drag.hit;
        drag.hit = hit;
        drag.moved = true;
        var pitch = BN.music.posToPitch(page.systems[hit.system].staves[hit.staff].clef, hit.pos);
        if (palette.acc) pitch.acc = palette.acc;
        showGhost(e.clientX, e.clientY, palette.rest ? "הפסקה" : pitchName(pitch));
      }
      return null;
    },

    up: function (page, e) {
      hideGhost();
      if (!drag || (e && e.pointerId !== drag.pointerId)) {
        drag = null;
        return null;
      }
      var action = null;
      if (drag.note && drag.moved && drag.lastPos != null) {
        var ev = page.systems[drag.note.system].staves[drag.note.staff].measures[drag.note.measure].events[drag.note.index];
        var clef = page.systems[drag.note.system].staves[drag.note.staff].clef;
        var next = BN.music.posToPitch(clef, drag.lastPos);
        var acc = (ev.pitch && ev.pitch.acc) || null;
        action = {
          kind: "pitch",
          system: drag.note.system,
          staff: drag.note.staff,
          measure: drag.note.measure,
          index: drag.note.index,
          pitch: { step: next.step, oct: next.oct, acc: acc }
        };
      } else if (drag.hit && !drag.note) {
        var hit = drag.hit;
        var staff = page.systems[hit.system].staves[hit.staff];
        var event = {
          id: BN.uid("e"),
          kind: palette.rest ? "rest" : "note",
          dur: palette.dur,
          dots: palette.dots
        };
        if (!palette.rest) {
          var pitch = BN.music.posToPitch(staff.clef, hit.pos);
          event.pitch = { step: pitch.step, oct: pitch.oct, acc: palette.acc || null };
        }
        action = { kind: "add", system: hit.system, staff: hit.staff, measure: hit.measure, event: event };
      }
      drag = null;
      return action;
    },

    applyAdd: function (page, action) {
      place(page, action.system, action.staff, action.measure, action.event);
    },

    applyPitch: function (page, action) {
      var ev = page.systems[action.system].staves[action.staff].measures[action.measure].events[action.index];
      if (!ev) return;
      ev.pitch = { step: action.pitch.step, oct: action.pitch.oct, acc: action.pitch.acc || null };
      selection = { system: action.system, staff: action.staff, measure: action.measure, index: action.index };
    },

    selectedEvent: function (page) {
      if (!selection) return null;
      var staff = page.systems[selection.system] && page.systems[selection.system].staves[selection.staff];
      if (!staff) return null;
      var measure = staff.measures[selection.measure];
      if (!measure) return null;
      return measure.events[selection.index] || null;
    },

    patchSelected: function (page, patch) {
      var ev = BN.tap.selectedEvent(page);
      if (!ev) return false;
      Object.keys(patch).forEach(function (k) {
        ev[k] = patch[k];
      });
      if (patch.dur || patch.dots != null) reflow(page, selection.system, selection.staff, selection.measure);
      return true;
    },

    deleteSelected: function (page) {
      if (!selection) return false;
      var measure = page.systems[selection.system].staves[selection.staff].measures[selection.measure];
      measure.events.splice(selection.index, 1);
      selection = null;
      return true;
    },

    setBar: function (page, kind) {
      var target = selection || cursor;
      var sys = page.systems[target.system];
      if (!sys) return;
      sys.staves.forEach(function (staff) {
        var measure = staff.measures[target.measure];
        if (!measure) return;
        if (kind === "repeatStart") measure.barStart = measure.barStart === "repeatStart" ? undefined : "repeatStart";
        else measure.barEnd = kind;
      });
    },

    setMeasureTime: function (page, time, scope) {
      if (scope === "measure") {
        var target = selection || cursor;
        page.systems[target.system].staves.forEach(function (staff) {
          if (staff.measures[target.measure]) staff.measures[target.measure].time = time;
        });
        return;
      }
      page.time = time;
      page.systems.forEach(function (sys) {
        sys.staves.forEach(function (staff) {
          staff.measures.forEach(function (measure) {
            delete measure.time;
          });
        });
      });
    },

    setMeasureKey: function (page, key, scope) {
      if (scope === "measure") {
        var target = selection || cursor;
        page.systems[target.system].staves.forEach(function (staff) {
          if (staff.measures[target.measure]) staff.measures[target.measure].key = key;
        });
        return;
      }
      page.key = key;
      page.systems.forEach(function (sys) {
        sys.staves.forEach(function (staff) {
          staff.measures.forEach(function (measure) {
            delete measure.key;
          });
        });
      });
    },

    moveSelection: function (page, dir) {
      var flat = [];
      page.systems.forEach(function (sys, s) {
        sys.staves.forEach(function (staff, t) {
          staff.measures.forEach(function (measure, m) {
            measure.events.forEach(function (ev, i) {
              flat.push({ system: s, staff: t, measure: m, index: i });
            });
          });
        });
      });
      if (!flat.length) return;
      var at = 0;
      if (selection) {
        flat.forEach(function (item, idx) {
          if (
            item.system === selection.system &&
            item.staff === selection.staff &&
            item.measure === selection.measure &&
            item.index === selection.index
          ) at = idx;
        });
        at = Math.max(0, Math.min(flat.length - 1, at + dir));
      }
      selection = flat[at];
      cursor = { system: selection.system, staff: selection.staff, measure: selection.measure };
    },

    typeStep: function (page, step) {
      var ev = BN.tap.selectedEvent(page);
      if (ev && ev.kind === "note" && ev.pitch) {
        ev.pitch.step = step;
        return true;
      }
      var target = cursor;
      var sys = page.systems[target.system];
      if (!sys) return false;
      var staff = sys.staves[target.staff] || sys.staves[0];
      var origin = staff.clef === "treble" ? 4 : 2;
      var event = {
        id: BN.uid("e"),
        kind: palette.rest ? "rest" : "note",
        dur: palette.dur,
        dots: palette.dots,
        pitch: { step: step, oct: origin, acc: palette.acc || null }
      };
      if (palette.rest) {
        event.kind = "rest";
        delete event.pitch;
      }
      var staffIdx = sys.staves.indexOf(staff);
      place(page, target.system, staffIdx < 0 ? 0 : staffIdx, target.measure, event);
      return true;
    },

    addSystem: function (page) {
      page.systems.push(BN.data.emptySystem(page.clef || "bass"));
    },

    deleteSystem: function (page, index) {
      if (page.systems.length <= 1) return false;
      page.systems.splice(index, 1);
      selection = null;
      return true;
    },

    changeSystemClef: function (page, index, clef) {
      var sys = page.systems[index];
      if (!sys) return;
      if (clef === "grand") {
        if (sys.layout === "grand") return;
        var current = sys.staves[0];
        var other = current.clef === "bass" ? "treble" : "bass";
        var fresh = {
          id: BN.uid("s"),
          clef: other,
          measures: current.measures.map(function (measure) {
            return {
              time: measure.time,
              key: measure.key,
              barEnd: measure.barEnd,
              barStart: measure.barStart,
              events: []
            };
          })
        };
        sys.layout = "grand";
        sys.staves = current.clef === "treble" ? [current, fresh] : [fresh, current];
        if (current.clef === "bass") sys.staves = [fresh, current];
        else sys.staves = [current, fresh];
        return;
      }
      if (sys.layout === "grand") {
        var keep = sys.staves.filter(function (staff) {
          return staff.clef === clef;
        })[0] || sys.staves[0];
        var drop = sys.staves.filter(function (staff) {
          return staff !== keep;
        })[0];
        if (drop) {
          keep.measures.forEach(function (measure, i) {
            var extra = drop.measures[i] ? drop.measures[i].events : [];
            measure.events = measure.events.concat(extra);
          });
        }
        keep.clef = clef;
        sys.layout = "single";
        sys.staves = [keep];
        keep.measures.forEach(function (measure, i) {
          reflow(page, index, 0, i);
        });
        return;
      }
      sys.staves[0].clef = clef;
      sys.layout = "single";
    }
  };
})();
