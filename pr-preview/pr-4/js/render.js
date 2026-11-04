/* VexFlow engraving and hit testing.
   Staff lines are wider than the VexFlow default so a finger can tell one
   diatonic step from the next. The SVG is then scaled onto the page. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var SCALE = 2.4;
  var LINE = 16;

  function vf() { return window.Vex && window.Vex.Flow; }

  function colors() {
    var s = getComputedStyle(document.documentElement);
    return {
      text: (s.getPropertyValue("--text") || "#3b2f28").trim(),
      staff: (s.getPropertyValue("--staff-line") || "#8a7868").trim(),
      accent: (s.getPropertyValue("--accent") || "#de7a60").trim()
    };
  }

  function durString(note) {
    var map = { whole: "w", half: "h", quarter: "q", eighth: "8", "16th": "16" };
    return (map[note.type] || "q") + (note.rest ? "r" : "");
  }

  function keyName(pitch) {
    return pitch.step.toLowerCase() + "/" + pitch.octave;
  }

  function restKey(sign) { return sign === "G" ? "b/4" : "d/3"; }

  function yFor(stave, pos) { return stave.getYForNote(1 + pos / 2); }

  function tune(stave) {
    if (!stave.options) return stave;
    stave.options.spacing_between_lines_px = LINE;
    stave.options.space_above_staff_ln = 4;
    stave.options.space_below_staff_ln = 4;
    if (typeof stave.resetLines === "function") stave.resetLines();
    return stave;
  }

  function systemBox(grand) {
    var yT = LINE + 8;
    var yB = yT + LINE * 8;
    var below = (4 + 9) * LINE + 28;
    return { yT: yT, yB: yB, height: (grand ? yB : yT) + below };
  }

  BN.render = {
    layout: null,
    scale: SCALE,
    draw: function (score, host, opts) {
      opts = opts || {};
      var Flow = vf();
      if (!Flow || !score) return null;
      var ink = opts.colors || colors();
      var cssWidth = opts.width || host.clientWidth || 800;
      var userWidth = Math.max(240, cssWidth / SCALE);
      var systems = BN.layout.systems(score, userWidth);
      var part = score.parts[0];
      var grand = score.staffLayout === "grand";
      var frame = systemBox(grand);
      var height = frame.height;
      host.innerHTML = "";
      var map = { systems: [], byMeasure: {}, notes: {}, svg: [] };
      var selected = (opts.selectedIds || []).reduce(function (a, id) { a[id] = true; return a; }, {});
      var playing = opts.playingId || null;
      systems.forEach(function (system, si) {
        var wrap = document.createElement("div");
        wrap.className = "system";
        wrap.dataset.system = String(si);
        host.appendChild(wrap);
        var viewW = Math.max(system.width, userWidth);
        var renderer = new Flow.Renderer(wrap, Flow.Renderer.Backends.SVG);
        renderer.resize(viewW, height);
        var ctx = renderer.getContext();
        var svg = wrap.querySelector("svg");
        var shown = cssWidth / viewW;
        var box = svg.viewBox && svg.viewBox.baseVal;
        var vbW = box && box.width ? box.width : viewW;
        var vbH = box && box.height ? box.height : height;
        shown = cssWidth / vbW;
        svg.setAttribute("width", String(Math.round(cssWidth)));
        svg.setAttribute("height", String(Math.ceil(vbH * shown)));
        svg.style.width = cssWidth + "px";
        svg.style.height = Math.ceil(vbH * shown) + "px";
        svg.style.display = "block";
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("data-system", String(si));
        map.svg.push(svg);
        var boxes = [];
        system.measures.forEach(function (box) {
          var measure = part.measures[box.index];
          var yT = frame.yT;
          var yB = frame.yB;
          var staves = [];
          function make(y, staffNum, sign) {
            var stave = tune(new Flow.Stave(box.x, y, box.w));
            if (box === system.measures[0]) {
              stave.addClef(sign === "G" ? "treble" : "bass");
              var key = BN.model.keyOf(part, box.index);
              if ((key.fifths || 0) !== 0 || key.mode === "minor") stave.addKeySignature(BN.music.vfKey(key));
              var time = BN.model.timeOf(part, box.index);
              if ((si === 0 && box === system.measures[0]) || (measure.attributes && measure.attributes.time)) {
                stave.addTimeSignature(time.beats + "/" + time.beatType);
              }
            }
            /* Tempo is the HTML label. VexFlow's tempo glyph stays black in dark mode. */
            if (measure.barline) {
              var mapBar = { regular: "single", "light-light": "double", "light-heavy": "end" };
              var Bar = Flow.Barline.type;
              var kind = mapBar[measure.barline.right] || "single";
              if (measure.barline.repeat === "backward") stave.setEndBarType(Bar.REPEAT_END);
              else if (kind === "double") stave.setEndBarType(Bar.DOUBLE);
              else if (kind === "end") stave.setEndBarType(Bar.END);
              else stave.setEndBarType(Bar.SINGLE);
              if (measure.barline.repeat === "forward") stave.setBegBarType(Bar.REPEAT_BEGIN);
            }
            stave.setContext(ctx).setStyle({ strokeStyle: ink.staff, fillStyle: ink.staff }).draw();
            return stave;
          }
          if (grand) {
            staves[1] = make(yT, 1, "G");
            staves[2] = make(yB, 2, "F");
            ctx.openGroup("brace");
            var brace = new Flow.StaveConnector(staves[1], staves[2]);
            brace.setType(Flow.StaveConnector.type.BRACE).setContext(ctx).draw();
            ctx.closeGroup();
            new Flow.StaveConnector(staves[1], staves[2]).setType("singleLeft").setContext(ctx).draw();
            var right = "singleRight";
            if (measure.barline && measure.barline.right === "light-heavy") right = "boldDoubleRight";
            if (measure.barline && measure.barline.right === "light-light") right = "thinDouble";
            new Flow.StaveConnector(staves[1], staves[2]).setType(right).setContext(ctx).draw();
          } else {
            var sign = score.staffLayout === "treble" ? "G" : "F";
            staves[1] = make(yT, 1, sign);
          }
          boxes.push({ index: box.index, x: box.x, w: box.w, staves: staves, slots: { 1: [], 2: [] } });
        });
        if (si === 0) {
          var label = document.createElement("div");
          label.className = "tempo-label";
          label.textContent = "♩ = " + score.tempo.bpm;
          wrap.insertBefore(label, wrap.firstChild);
        }
        boxes.forEach(function (box) {
          var measure = part.measures[box.index];
          [1, 2].forEach(function (staffNum) {
            if (!box.staves[staffNum]) return;
            var stave = box.staves[staffNum];
            var notes = measure.notes.filter(function (n) { return n.staff === staffNum; });
            if (!notes.length) return;
            var sign = "F";
            if (grand) sign = staffNum === 1 ? "G" : "F";
            else if (score.staffLayout === "treble") sign = "G";
            var clefName = sign === "G" ? "treble" : "bass";
            var tickables = [];
            var builtIds = [];
            var key = BN.model.keyOf(part, box.index);
            notes.forEach(function (note, ni) {
              var built;
              try {
                built = new Flow.StaveNote({
                  clef: clefName,
                  keys: [note.rest ? restKey(sign) : keyName(note.pitch)],
                  duration: durString(note),
                  auto_stem: !note.rest
                });
              } catch (err) { return; }
              if (note.dots) for (var d = 0; d < note.dots; d++) built.addModifier(new Flow.Dot(), 0);
              if (!note.rest) {
                var show = BN.music.displayAccidental(notes, ni, key);
                if (show) built.addModifier(new Flow.Accidental(show === "sharp" ? "#" : show === "flat" ? "b" : "n"), 0);
              }
              var color = (selected[note.id] || playing === note.id) ? ink.accent : ink.text;
              built.setStyle({ fillStyle: color, strokeStyle: color });
              tickables.push(built);
              builtIds.push(note.id);
              var pitchY = note.rest ? stave.getYForLine(2) : yFor(stave, BN.music.pitchToPos(clefName, note.pitch));
              map.notes[note.id] = { id: note.id, measure: box.index, staff: staffNum, system: si };
              box.slots[staffNum].push({ id: note.id, note: built, pitchY: pitchY });
            });
            if (!tickables.length) return;
            var time = BN.model.timeOf(part, box.index);
            var voice = new Flow.Voice({ num_beats: time.beats, beat_value: time.beatType }).setMode(Flow.Voice.Mode.SOFT);
            voice.addTickables(tickables);
            var room = Math.max(40, stave.getNoteEndX() - stave.getNoteStartX() - 8);
            try {
              new Flow.Formatter().joinVoices([voice]).format([voice], room);
              voice.draw(ctx, stave);
              var heads = svg.querySelectorAll(".vf-stavenote");
              var headStart = heads.length - builtIds.length;
              builtIds.forEach(function (id, i) {
                var el = heads[headStart + i];
                if (!el) return;
                el.setAttribute("data-note-id", id);
                if (selected[id]) el.classList.add("is-selected");
              });
              var groups = Flow.Beam.getDefaultBeamGroups(time.beats + "/" + time.beatType);
              Flow.Beam.generateBeams(tickables, { groups: groups }).forEach(function (beam) {
                beam.setStyle({ fillStyle: ink.text, strokeStyle: ink.text });
                beam.setContext(ctx).draw();
              });
            } catch (err) { /* keep the staff */ }
            box.slots[staffNum].forEach(function (slot) {
              try {
                var bb = slot.note.getBoundingBox();
                slot.x = bb.getX();
                slot.w = Math.max(8, bb.getW());
              } catch (err2) {
                slot.x = stave.getNoteStartX();
                slot.w = 12;
              }
              map.notes[slot.id].x = slot.x;
              map.notes[slot.id].w = slot.w;
              map.notes[slot.id].pitchY = slot.pitchY;
              map.notes[slot.id].svg = svg;
            });
          });
          map.byMeasure[box.index] = {
            index: box.index,
            x: box.x,
            w: box.w,
            system: si,
            svg: svg,
            endX: box.staves[1].getNoteEndX(),
            staves: box.staves,
            slots: box.slots
          };
        });
        if (playing && map.notes[playing] && map.notes[playing].system === si) {
          var meta = map.notes[playing];
          var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("class", "playhead");
          line.setAttribute("x1", meta.x + meta.w / 2);
          line.setAttribute("x2", meta.x + meta.w / 2);
          line.setAttribute("y1", "8");
          line.setAttribute("y2", String(height - 8));
          line.setAttribute("stroke", ink.accent);
          line.setAttribute("stroke-width", "1.5");
          svg.appendChild(line);
        }
        map.systems.push({ index: si, svg: svg, height: height });
      });
      BN.render.layout = map;
      return map;
    },

    client: function (svg, x, y) {
      var pt = svg.createSVGPoint();
      pt.x = x;
      pt.y = y;
      var ctm = svg.getScreenCTM();
      if (!ctm) return { x: x, y: y };
      var p = pt.matrixTransform(ctm);
      return { x: p.x, y: p.y };
    },

    svgPoint: function (svg, clientX, clientY) {
      var pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      var ctm = svg.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      return pt.matrixTransform(ctm.inverse());
    },

    stepPx: function (measure, staff) {
      var box = BN.render.layout && BN.render.layout.byMeasure[measure || 0];
      if (!box) return 0;
      var stave = box.staves[staff || 1] || box.staves[1];
      var a = BN.render.client(box.svg, 0, yFor(stave, 0));
      var b = BN.render.client(box.svg, 0, yFor(stave, 1));
      return Math.abs(b.y - a.y);
    },

    pitchClient: function (hit) {
      var box = BN.render.layout && BN.render.layout.byMeasure[hit.measure];
      if (!box) return { x: 0, y: 0 };
      var stave = box.staves[hit.staff] || box.staves[1];
      var y = yFor(stave, hit.pos);
      var x = hit.svg ? hit.svg.x : stave.getNoteStartX();
      return BN.render.client(box.svg, x, y);
    },

    locate: function (spec) {
      var map = BN.render.layout;
      var box = map && map.byMeasure[spec.measure || 0];
      if (!box) return { x: 0, y: 0 };
      var staff = spec.staff || 1;
      var stave = box.staves[staff] || box.staves[1];
      var pos = spec.pos || 0;
      var y = yFor(stave, pos);
      var slots = box.slots[staff] || [];
      var startX = stave.getNoteStartX();
      var endX = Math.max(startX + 12, stave.getNoteEndX() - 6);
      var x;
      if (typeof spec.slot === "number") {
        var slot = slots[spec.slot];
        x = slot ? slot.x + slot.w / 2 : startX + 12;
      } else if (spec.slot && String(spec.slot).indexOf("before:") === 0) {
        var idx = Number(String(spec.slot).split(":")[1]);
        var target = slots[idx];
        if (target) x = Math.max(startX + 2, target.x - 8);
        else if (slots.length) x = Math.min(endX, slots[slots.length - 1].x + slots[slots.length - 1].w + 8);
        else x = startX + 12;
      } else {
        var last = slots[slots.length - 1];
        x = last ? Math.min(endX, last.x + last.w + 8) : startX + 12;
        if (last && x <= last.x + last.w) x = Math.min(endX, last.x + last.w + 4);
      }
      var left = box.x + 6;
      var right = box.x + box.w - 4;
      if (right > left) x = Math.max(left, Math.min(right, x));
      return BN.render.client(box.svg, x, y);
    },

    hit: function (score, clientX, clientY) {
      var map = BN.render.layout;
      if (!map) return null;
      var best = null;
      var bestDist = Infinity;
      Object.keys(map.byMeasure).forEach(function (key) {
        var box = map.byMeasure[key];
        var rect = box.svg.getBoundingClientRect();
        if (clientX < rect.left - 24 || clientX > rect.right + 24 || clientY < rect.top - 72 || clientY > rect.bottom + 72) return;
        var p = BN.render.svgPoint(box.svg, clientX, clientY);
        if (p.x < box.x - 8 || p.x > box.x + box.w + 12) return;
        var staff = 1;
        if (score.staffLayout === "grand" && box.staves[2]) {
          var mid = (box.staves[1].getYForLine(4) + box.staves[2].getYForLine(0)) / 2;
          staff = p.y < mid ? 1 : 2;
        }
        var stave = box.staves[staff];
        if (!stave) return;
        var top = yFor(stave, 18) - 8;
        var bottom = yFor(stave, -10) + 8;
        if (p.y < top) p = { x: p.x, y: top };
        if (p.y > bottom) p = { x: p.x, y: bottom };
        var spacing = stave.getSpacingBetweenLines() || 10;
        var pos = BN.music.clampPos(Math.round(2 * ((stave.getYForNote(0) - p.y) / spacing - 1)));
        /* getYForNote(0) is one step below the bottom line (pos 0 → note line 1). */
        var slots = box.slots[staff] || [];
        var noteHit = null;
        slots.forEach(function (slot) {
          var midX = slot.x + slot.w / 2;
          if (Math.abs(p.x - midX) <= Math.max(4, slot.w * 0.28)) noteHit = slot;
        });
        var lastSlot = slots[slots.length - 1];
        if (lastSlot && p.x > lastSlot.x + lastSlot.w * 0.55) noteHit = null;
        var insertAt = slots.length;
        slots.forEach(function (slot, i) {
          if (!noteHit && p.x < slot.x) insertAt = Math.min(insertAt, i);
        });
        var cy = (rect.top + rect.bottom) / 2;
        var dist = Math.abs(clientY - cy);
        if (dist < bestDist) {
          bestDist = dist;
          best = { measure: box.index, staff: staff, pos: pos, noteId: noteHit && noteHit.id, insertAt: insertAt, svg: p };
        }
      });
      return best;
    }
  };
})();
