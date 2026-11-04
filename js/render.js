/* VexFlow engraving and hit testing.
   One SVG per system. Staff lines are 10 units apart; `scale` (zoom) maps units to CSS pixels. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var LINE = 10;
  var NS = "http://www.w3.org/2000/svg";

  function vf() { return window.Vex && window.Vex.Flow; }

  function colors() {
    var s = getComputedStyle(document.documentElement);
    function v(name, dflt) { return (s.getPropertyValue(name) || dflt).trim() || dflt; }
    return {
      text: v("--ink", "#16181c"),
      staff: v("--ink", "#16181c"),
      accent: v("--accent", "#6b4ee6"),
      select: v("--select", "#1f6fe0"),
      selectSoft: v("--select-soft", "rgba(31,111,224,.12)"),
      play: v("--play", "#2e9d62"),
      muted: "#555a63"
    };
  }

  function durString(note) {
    var map = { whole: "w", half: "h", quarter: "q", eighth: "8", "16th": "16" };
    return (map[note.type] || "q") + (note.rest ? "r" : "");
  }

  function keyName(note) {
    var p = note.pitch;
    return p.step.toLowerCase() + "/" + p.octave + (note.ghost ? "/x2" : "");
  }

  function restKey(sign) { return sign === "G" ? "b/4" : "d/3"; }

  function yFor(stave, pos) { return stave.getYForNote(1 + pos / 2); }

  function tune(stave) {
    if (!stave.options) return stave;
    stave.options.spacing_between_lines_px = LINE;
    stave.options.space_above_staff_ln = 5;
    stave.options.space_below_staff_ln = 7;
    if (typeof stave.resetLines === "function") stave.resetLines();
    return stave;
  }

  function systemBox(grand) {
    var yT = 4;
    var yB = yT + LINE * 10;
    return { yT: yT, yB: yB, height: (grand ? yB : yT) + LINE * 16 };
  }

  function svgEl(name, attrs) {
    var el = document.createElementNS(NS, name);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  function signFor(score, staffNum) {
    if (score.staffLayout === "grand") return staffNum === 1 ? "G" : "F";
    return score.staffLayout === "treble" ? "G" : "F";
  }

  BN.render = {
    layout: null,
    LINE: LINE,
    draw: function (score, host, opts) {
      opts = opts || {};
      var Flow = vf();
      if (!Flow || !score) return null;
      var ink = opts.colors || colors();
      var scale = opts.scale || 1;
      var cssWidth = opts.width || host.clientWidth || 800;
      var userWidth = Math.max(240, cssWidth / scale);
      var systems = BN.layout.systems(score, userWidth);
      var part = score.parts[0];
      var grand = score.staffLayout === "grand";
      var frame = systemBox(grand);
      var height = frame.height;
      host.innerHTML = "";
      var map = { systems: [], byMeasure: {}, notes: {}, svg: [], scale: scale };
      var selected = (opts.selectedIds || []).reduce(function (a, id) { a[id] = true; return a; }, {});
      var selMeasures = (opts.selMeasures || []).reduce(function (a, i) { a[i] = true; return a; }, {});
      var playing = opts.playingId || null;
      var built = {};
      var allOrder = { 1: [], 2: [] };
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
        var box0 = svg.viewBox && svg.viewBox.baseVal;
        var vbW = box0 && box0.width ? box0.width : viewW;
        var vbH = box0 && box0.height ? box0.height : height;
        var shown = cssWidth / vbW;
        svg.setAttribute("width", String(Math.round(cssWidth)));
        svg.setAttribute("height", String(Math.ceil(vbH * shown)));
        svg.style.width = cssWidth + "px";
        svg.style.height = Math.ceil(vbH * shown) + "px";
        svg.style.display = "block";
        svg.setAttribute("preserveAspectRatio", "none");
        svg.setAttribute("data-system", String(si));
        map.svg.push(svg);
        var boxes = [];
        system.measures.forEach(function (box, bi) {
          var measure = part.measures[box.index];
          var staves = [];
          var first = bi === 0;
          function make(y, sign) {
            var stave = tune(new Flow.Stave(box.x, y, box.w));
            var key = BN.model.keyOf(part, box.index);
            var keyChanged = !!(measure.attributes && measure.attributes.key && box.index > 0);
            if (first) stave.addClef(sign === "G" ? "treble" : "bass");
            if (first || keyChanged) {
              if ((key.fifths || 0) !== 0 || key.mode === "minor") {
                stave.addKeySignature(BN.music.vfKey(key), keyChanged ? BN.music.vfKey(BN.model.keyOf(part, box.index - 1)) : undefined);
              } else if (keyChanged) {
                stave.addKeySignature("C", BN.music.vfKey(BN.model.keyOf(part, box.index - 1)));
              }
            }
            if (box.index === 0 || (measure.attributes && measure.attributes.time && box.index > 0)) {
              var time = BN.model.timeOf(part, box.index);
              stave.addTimeSignature(time.beats + "/" + time.beatType);
            }
            if (measure.barline) {
              var Bar = Flow.Barline.type;
              if (measure.barline.repeat === "backward") stave.setEndBarType(Bar.REPEAT_END);
              else if (measure.barline.right === "light-light") stave.setEndBarType(Bar.DOUBLE);
              else if (measure.barline.right === "light-heavy") stave.setEndBarType(Bar.END);
              if (measure.barline.repeat === "forward") stave.setBegBarType(Bar.REPEAT_BEGIN);
            }
            stave.setContext(ctx).setStyle({ strokeStyle: ink.staff, fillStyle: ink.staff }).draw();
            return stave;
          }
          if (grand) {
            staves[1] = make(frame.yT, "G");
            staves[2] = make(frame.yB, "F");
            if (first) {
              ctx.openGroup("brace");
              var brace = new Flow.StaveConnector(staves[1], staves[2]);
              brace.setType(Flow.StaveConnector.type.BRACE).setContext(ctx).draw();
              ctx.closeGroup();
              new Flow.StaveConnector(staves[1], staves[2]).setType("singleLeft").setContext(ctx).draw();
            }
            var right = "singleRight";
            if (measure.barline && measure.barline.right === "light-heavy") right = "boldDoubleRight";
            if (measure.barline && measure.barline.right === "light-light") right = "thinDouble";
            new Flow.StaveConnector(staves[1], staves[2]).setType(right).setContext(ctx).draw();
          } else {
            staves[1] = make(frame.yT, signFor(score, 1));
          }
          if (first && box.index > 0) {
            ctx.save();
            ctx.setFont("Heebo, sans-serif", 8, "");
            ctx.setFillStyle(ink.muted);
            ctx.fillText(String(box.index + 1), box.x + 2, staves[1].getYForLine(0) - 14);
            ctx.restore();
          }
          boxes.push({ index: box.index, x: box.x, w: box.w, staves: staves, slots: { 1: [], 2: [] } });
        });
        boxes.forEach(function (box) {
          var measure = part.measures[box.index];
          var time = BN.model.timeOf(part, box.index);
          [1, 2].forEach(function (staffNum) {
            if (!box.staves[staffNum]) return;
            var stave = box.staves[staffNum];
            var notes = measure.notes.filter(function (n) { return n.staff === staffNum; });
            if (!notes.length) return;
            var sign = signFor(score, staffNum);
            var clefName = sign === "G" ? "treble" : "bass";
            var tickables = [];
            var builtIds = [];
            var key = BN.model.keyOf(part, box.index);
            notes.forEach(function (note, ni) {
              var made;
              try {
                made = new Flow.StaveNote({
                  clef: clefName,
                  keys: [note.rest ? restKey(sign) : keyName(note)],
                  duration: durString(note),
                  auto_stem: !note.rest
                });
              } catch (err) {
                try {
                  made = new Flow.StaveNote({ clef: clefName, keys: [note.rest ? restKey(sign) : keyName({ pitch: note.pitch })], duration: durString(note), auto_stem: !note.rest });
                } catch (err2) { return; }
              }
              if (note.dots) for (var d = 0; d < note.dots; d++) Flow.Dot.buildAndAttach([made], { all: true });
              if (!note.rest) {
                var show = BN.music.displayAccidental(notes, ni, key);
                if (show) made.addModifier(new Flow.Accidental(show === "sharp" ? "#" : show === "flat" ? "b" : "n"), 0);
                (note.artic || []).forEach(function (a) {
                  var code = { staccato: "a.", accent: "a>", tenuto: "a-", fermata: "a@a" }[a];
                  if (!code) return;
                  var art = new Flow.Articulation(code);
                  art.setPosition(a === "fermata" ? Flow.Modifier.Position.ABOVE : Flow.Modifier.Position.BELOW);
                  made.addModifier(art, 0);
                });
              }
              var color = playing === note.id ? ink.play : selected[note.id] ? ink.select : ink.text;
              made.setStyle({ fillStyle: color, strokeStyle: color });
              tickables.push(made);
              builtIds.push(note.id);
              built[note.id] = made;
              allOrder[staffNum].push(note);
              var pitchY = note.rest ? stave.getYForLine(2) : yFor(stave, BN.music.pitchToPos(clefName, note.pitch));
              map.notes[note.id] = { id: note.id, measure: box.index, staff: staffNum, system: si, note: note };
              box.slots[staffNum].push({ id: note.id, note: made, pitchY: pitchY, model: note });
            });
            if (!tickables.length) return;
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
            } catch (err) { if (window.BN_DEBUG) console.error(err); }
            box.slots[staffNum].forEach(function (slot) {
              try {
                var bb = slot.note.getBoundingBox();
                slot.x = bb.getX();
                slot.w = Math.max(8, bb.getW());
                slot.headX = slot.note.getAbsoluteX();
              } catch (err2) {
                slot.x = stave.getNoteStartX();
                slot.w = 12;
                slot.headX = slot.x;
              }
              var m = map.notes[slot.id];
              m.x = slot.x;
              m.w = slot.w;
              m.pitchY = slot.pitchY;
              m.svg = svg;
              var md = slot.model;
              if (md.dyn && !md.rest) {
                ctx.save();
                ctx.setFont("Times New Roman, serif", 11, "bold", "italic");
                ctx.setFillStyle(ink.text);
                ctx.fillText(md.dyn, slot.headX - 2, stave.getYForLine(4) + LINE * 3.2);
                ctx.restore();
              }
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
        map.systems.push({ index: si, svg: svg, height: height, measures: boxes.map(function (b) { return b.index; }) });
      });

      /* Ties and slurs once every note has a position. */
      [1, 2].forEach(function (staffNum) {
        var list = allOrder[staffNum];
        list.forEach(function (note, i) {
          var a = built[note.id];
          var nextNote = list[i + 1];
          var drawTie = function (first, last, svgFor, ctxFor) {
            try {
              new Flow.StaveTie({ first_note: first, last_note: last, first_indices: [0], last_indices: [0] })
                .setStyle({ strokeStyle: ink.text, fillStyle: ink.text }).setContext(ctxFor).draw();
            } catch (err) { /* skip a tie VexFlow cannot place */ }
          };
          if (note.tie && note.tie.start && nextNote && nextNote.tie && nextNote.tie.stop) {
            var b = built[nextNote.id];
            var sa = map.notes[note.id].system;
            var sb = map.notes[nextNote.id].system;
            if (sa === sb) drawTie(a, b, null, a.getContext());
            else {
              drawTie(a, null, null, a.getContext());
              drawTie(null, b, null, b.getContext());
            }
          }
          if (note.slur && note.slur.start) {
            var endIdx = -1;
            for (var j = i + 1; j < list.length; j++) if (list[j].slur && list[j].slur.stop) { endIdx = j; break; }
            if (endIdx > 0 && map.notes[list[endIdx].id].system === map.notes[note.id].system) {
              try {
                new Flow.Curve(a, built[list[endIdx].id], { position: Flow.Curve.Position.NEAR_TOP, position_end: Flow.Curve.Position.NEAR_TOP })
                  .setContext(a.getContext()).draw();
              } catch (err) { /* skip */ }
            }
          }
        });
      });

      /* Selection background, cursor, playhead — drawn on top as translucent shapes. */
      var topOf = function (box, staffNum) { return box.staves[staffNum].getYForLine(0); };
      var botOf = function (box, staffNum) { return box.staves[staffNum].getYForLine(4); };
      Object.keys(map.byMeasure).forEach(function (k) {
        var box = map.byMeasure[k];
        var staffCount = grand ? 2 : 1;
        var y1 = topOf(box, 1) - LINE * 2;
        var y2 = botOf(box, staffCount) + LINE * 3;
        if (selMeasures[k]) {
          box.svg.appendChild(svgEl("rect", { "class": "sel-bg", x: box.x, y: y1, width: box.w, height: y2 - y1, fill: ink.selectSoft }));
        }
        [1, 2].forEach(function (staffNum) {
          var slots = (box.slots[staffNum] || []).filter(function (s) { return selected[s.id]; });
          if (!slots.length) return;
          var x1 = Math.min.apply(null, slots.map(function (s) { return s.headX; })) - 9;
          var x2 = Math.max.apply(null, slots.map(function (s) { return s.headX; })) + 24;
          var ya = topOf(box, staffNum) - LINE * 2;
          var yb = botOf(box, staffNum) + LINE * 3;
          box.svg.appendChild(svgEl("rect", { "class": "sel-bg", x: x1, y: ya, width: x2 - x1, height: yb - ya, fill: ink.selectSoft }));
        });
      });
      var cur = opts.cursor;
      if (cur && map.byMeasure[cur.measure]) {
        var cbox = map.byMeasure[cur.measure];
        var cstaff = Math.min(cur.staff || 1, grand ? 2 : 1);
        var slots = cbox.slots[cstaff] || [];
        var stave = cbox.staves[cstaff];
        var cx;
        if (slots[cur.index]) cx = slots[cur.index].headX - 8;
        else if (slots.length) cx = Math.min(stave.getNoteEndX() - 4, slots[slots.length - 1].headX + 26);
        else cx = stave.getNoteStartX() + 4;
        cx = Math.max(cbox.x + 2, cx);
        var cy1 = topOf(cbox, cstaff) - LINE * 1.5;
        var cy2 = botOf(cbox, cstaff) + LINE * 1.5;
        cbox.svg.appendChild(svgEl("rect", { "class": "cursor-line", x: cx, y: cy1, width: 3, height: cy2 - cy1, rx: 1, fill: ink.accent }));
        map.cursor = { x: cx, y1: cy1, y2: cy2, svg: cbox.svg, measure: cur.measure, staff: cstaff };
      }
      if (playing && map.notes[playing]) {
        var meta = map.notes[playing];
        if (meta.svg) {
          meta.svg.appendChild(svgEl("line", { "class": "playhead", x1: meta.x + meta.w / 2, x2: meta.x + meta.w / 2, y1: "6", y2: String(height - 6), stroke: ink.play, "stroke-width": "1.5" }));
        }
      }
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

    /* Client position of a pitch step at the cursor (or at x of a measure). */
    posClient: function (measure, staff, pos, index) {
      var map = BN.render.layout;
      var box = map && map.byMeasure[measure];
      if (!box) return null;
      var stave = box.staves[staff] || box.staves[1];
      var slots = box.slots[staff] || [];
      var x;
      if (slots[index]) x = slots[index].headX - 4;
      else if (slots.length) x = Math.min(stave.getNoteEndX() - 12, slots[slots.length - 1].headX + 30);
      else x = stave.getNoteStartX() + 18;
      var p = BN.render.client(box.svg, x, yFor(stave, pos));
      p.step = BN.render.stepPx(measure, staff);
      return p;
    },

    /* Client rectangle of a drawn note head and its staff band. */
    noteRect: function (id) {
      var meta = BN.render.layout && BN.render.layout.notes[id];
      if (!meta || !meta.svg) return null;
      var box = BN.render.layout.byMeasure[meta.measure];
      var stave = box.staves[meta.staff];
      var a = BN.render.client(meta.svg, meta.x, stave.getYForLine(0) - LINE * 2);
      var b = BN.render.client(meta.svg, meta.x + meta.w, stave.getYForLine(4) + LINE * 3);
      var c = BN.render.client(meta.svg, meta.x + meta.w / 2, meta.pitchY || 0);
      return { left: a.x, right: b.x, top: a.y, bottom: b.y, cx: c.x, cy: c.y };
    },

    measureRect: function (index) {
      var map = BN.render.layout;
      var box = map && map.byMeasure[index];
      if (!box) return null;
      var last = box.staves[2] || box.staves[1];
      var a = BN.render.client(box.svg, box.x, box.staves[1].getYForLine(0) - LINE * 2);
      var b = BN.render.client(box.svg, box.x + box.w, last.getYForLine(4) + LINE * 3);
      return { left: a.x, right: b.x, top: a.y, bottom: b.y };
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
        var inside = clientY >= rect.top && clientY <= rect.bottom;
        var top = yFor(stave, 18) - 8;
        var bottom = yFor(stave, -10) + 8;
        if (p.y < top) p = { x: p.x, y: top };
        if (p.y > bottom) p = { x: p.x, y: bottom };
        var spacing = stave.getSpacingBetweenLines() || 10;
        var pos = BN.music.clampPos(Math.round(2 * ((stave.getYForNote(0) - p.y) / spacing - 1)));
        var slots = box.slots[staff] || [];
        var noteHit = null;
        slots.forEach(function (slot) {
          var midX = slot.headX != null ? slot.headX + 5 : slot.x + slot.w / 2;
          if (Math.abs(p.x - midX) <= 9) noteHit = slot;
        });
        var insertAt = slots.length;
        var pastLast = slots.length && p.x > slots[slots.length - 1].headX + 14;
        if (!pastLast) {
          for (var i = 0; i < slots.length; i++) {
            if (noteHit ? slots[i] === noteHit : p.x < slots[i].headX + 5) { insertAt = i; break; }
          }
        }
        var cy = (rect.top + rect.bottom) / 2;
        var dist = Math.abs(clientY - cy) + (inside ? 0 : 1000);
        if (dist < bestDist) {
          bestDist = dist;
          best = { measure: box.index, staff: staff, pos: pos, noteId: noteHit && noteHit.id, insertAt: insertAt, svg: p, inside: inside, system: box.system };
        }
      });
      return best;
    }
  };
})();
