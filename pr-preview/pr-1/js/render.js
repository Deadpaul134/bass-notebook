/* Bass Notebook — VexFlow drawing and hit testing.
   The score is drawn in VexFlow user units and stretched uniformly onto a
   logical page that is 1000 units wide, so strokes and notes share one space.
*/
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var G = 3;
  var USER_W = 1000 / G;
  var MIN_CSS = Math.ceil((12 * USER_W) / 5);

  function vf() {
    return window.Vex && window.Vex.Flow;
  }

  function colorsFromCss() {
    var s = getComputedStyle(document.documentElement);
    return {
      text: (s.getPropertyValue("--text") || "#3b2f28").trim(),
      staff: (s.getPropertyValue("--staff-line") || "#8a7868").trim(),
      accent: (s.getPropertyValue("--accent") || "#de7a60").trim(),
      under: "rgba(222,122,96,0.13)",
      over: "rgba(200,90,72,0.18)"
    };
  }

  function lightColors() {
    return {
      text: "#3b2f28",
      staff: "#8a7868",
      accent: "#de7a60",
      under: "rgba(222,122,96,0.13)",
      over: "rgba(200,90,72,0.18)"
    };
  }

  function restKey(clef) {
    return clef === "treble" ? "b/4" : "d/3";
  }

  function noteKey(pitch) {
    return String(pitch.step || "C").toLowerCase() + "/" + pitch.oct;
  }

  function timeOf(page, measure) {
    return (measure && measure.time) || page.time || "4/4";
  }

  function keyOf(page, measure) {
    return (measure && measure.key) || page.key || "C";
  }

  function barType(name) {
    var Bar = vf().Barline.type;
    if (name === "double") return Bar.DOUBLE;
    if (name === "end") return Bar.END;
    if (name === "repeatEnd") return Bar.REPEAT_END;
    if (name === "repeatStart") return Bar.REPEAT_BEGIN;
    return Bar.SINGLE;
  }

  function connectorType(name) {
    if (name === "double") return "thinDouble";
    if (name === "end" || name === "repeatEnd") return "boldDoubleRight";
    return "singleRight";
  }

  BN.render = {
    G: G,
    USER_W: USER_W,
    MIN_CSS: MIN_CSS,
    layout: null,

    draw: function (page, host, opts) {
      opts = opts || {};
      var Flow = vf();
      if (!Flow) return null;
      BN.migrate(page);
      var colors = opts.colors || (opts.light ? lightColors() : colorsFromCss());
      host.innerHTML = "";
      var userW = USER_W;
      var marginL = 8;
      var marginR = 6;
      var y = 2;
      var systems = [];
      var selection = opts.selection || null;

      page.systems.forEach(function (sys, sysIndex) {
        var measures = (sys.staves[0] && sys.staves[0].measures) || [];
        var count = Math.max(1, measures.length);
        var sig = BN.music.keyAccidentals(keyOf(page, measures[0]));
        var sigCount = Object.keys(sig).length;
        var extra = 28 + sigCount * 6 + 16;
        var inner = Math.max(40, userW - marginL - marginR - extra);
        var each = inner / count;
        var widths = [];
        for (var i = 0; i < count; i++) widths.push(i === 0 ? each + extra : each);
        var gap = sys.layout === "grand" ? 56 : 0;
        var staffTop = [];
        var cursorY = y + 28;
        sys.staves.forEach(function (staff, staffIndex) {
          staffTop[staffIndex] = cursorY;
          cursorY += 160;
          if (staffIndex === 0 && sys.layout === "grand") cursorY += gap;
        });
        var bottom = cursorY + 12;
        systems.push({
          index: sysIndex,
          y: y,
          bottom: bottom,
          widths: widths,
          x0: marginL,
          staffTop: staffTop,
          gap: gap,
          staves: [],
          measures: []
        });
        y = bottom + 8;
      });

      var userH = Math.max(40, y + 4);
      var headerLogical = 86;
      var scoreLogical = (userH * 1000) / userW;
      var logicalH = Math.max(1414, headerLogical + scoreLogical + 36);

      var wrap = document.createElement("div");
      wrap.className = "score-host";
      host.appendChild(wrap);
      var renderer = new Flow.Renderer(wrap, Flow.Renderer.Backends.SVG);
      renderer.resize(userW, userH);
      var ctx = renderer.getContext();
      ctx.setFillStyle(colors.text);
      ctx.setStrokeStyle(colors.staff);
      wrap.style.width = "100%";
      wrap.style.aspectRatio = userW + " / " + userH;
      var svg = wrap.querySelector("svg");
      if (svg) {
        svg.style.display = "block";
        svg.style.width = "100%";
        svg.style.height = "100%";
        svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
      }

      var layout = {
        svg: svg,
        userW: userW,
        userH: userH,
        headerLogical: headerLogical,
        logicalH: logicalH,
        systems: systems,
        notes: [],
        colors: colors
      };

      page.systems.forEach(function (sys, sysIndex) {
        var info = systems[sysIndex];
        var x = info.x0;
        var measureCount = info.widths.length;
        info.measures = [];
        for (var m = 0; m < measureCount; m++) {
          info.measures.push({ index: m, x: x, w: info.widths[m] });
          x += info.widths[m];
        }
        sys.staves.forEach(function (staff, staffIndex) {
          var staveObjs = [];
          for (var mi = 0; mi < measureCount; mi++) {
            var box = info.measures[mi];
            var measure = staff.measures[mi] || { barEnd: "single", events: [] };
            var prev = mi > 0 ? staff.measures[mi - 1] : null;
            var stave = new Flow.Stave(box.x, info.staffTop[staffIndex], box.w);
            if (mi === 0) {
              stave.addClef(staff.clef === "treble" ? "treble" : "bass");
              var k = keyOf(page, measure);
              if (BN.music.majorName(k) !== "C") stave.addKeySignature(k);
              stave.addTimeSignature(timeOf(page, measure));
            } else {
              var pk = prev ? keyOf(page, prev) : page.key;
              var nk = keyOf(page, measure);
              if (nk !== pk) stave.addKeySignature(nk);
              var pt = prev ? timeOf(page, prev) : page.time;
              var nt = timeOf(page, measure);
              if (nt !== pt) stave.addTimeSignature(nt);
            }
            if (measure.barStart === "repeatStart") stave.setBegBarType(barType("repeatStart"));
            stave.setEndBarType(barType(measure.barEnd || "single"));
            stave.setContext(ctx);
            stave.setStyle({ strokeStyle: colors.staff, fillStyle: colors.staff });
            staveObjs.push(stave);
          }
          info.staves[staffIndex] = { clef: staff.clef, staves: staveObjs };
        });

        if (sys.layout === "grand" && info.staves.length > 1) {
          var top0 = info.staves[0].staves[0];
          var bot0 = info.staves[1].staves[0];
          ctx.openGroup("brace", "brace-" + sysIndex);
          var brace = new Flow.StaveConnector(top0, bot0);
          brace.setType(Flow.StaveConnector.type.BRACE);
          brace.setContext(ctx).draw();
          ctx.closeGroup();
          var left = new Flow.StaveConnector(top0, bot0);
          left.setType("singleLeft");
          left.setContext(ctx).draw();
        }

        for (var mi2 = 0; mi2 < measureCount; mi2++) {
          sys.staves.forEach(function (staff, staffIndex) {
            var stave = info.staves[staffIndex].staves[mi2];
            var measure = staff.measures[mi2] || { events: [] };
            var fill = BN.music.measureFill(measure, page.time);
            if (measure.events.length && (fill === "under" || fill === "over")) {
              ctx.save();
              ctx.setFillStyle(fill === "over" ? colors.over : colors.under);
              var washTop = stave.getYForLine(0) - 6;
              var washBottom = stave.getYForLine(4) + 6;
              ctx.fillRect(stave.getX(), washTop, stave.getWidth(), washBottom - washTop);
              ctx.restore();
            }
            stave.draw();
          });
          if (sys.layout === "grand" && info.staves.length > 1) {
            var measure0 = sys.staves[0].measures[mi2] || {};
            var link = new Flow.StaveConnector(info.staves[0].staves[mi2], info.staves[1].staves[mi2]);
            link.setType(connectorType(measure0.barEnd || "single"));
            link.setContext(ctx).draw();
          }
        }

        sys.staves.forEach(function (staff, staffIndex) {
          for (var mi3 = 0; mi3 < measureCount; mi3++) {
            var measure = staff.measures[mi3];
            if (!measure || !measure.events.length) continue;
            var stave = info.staves[staffIndex].staves[mi3];
            var clef = staff.clef === "treble" ? "treble" : "bass";
            var key = keyOf(page, measure);
            var notes = [];
            measure.events.forEach(function (ev, evIndex) {
              var dur = ev.dur + (ev.kind === "rest" ? "r" : "");
              var keyName = ev.kind === "rest" || !ev.pitch ? restKey(clef) : noteKey(ev.pitch);
              var note;
              try {
                note = new Flow.StaveNote({
                  clef: clef,
                  keys: [keyName],
                  duration: dur,
                  auto_stem: ev.kind !== "rest"
                });
              } catch (err) {
                return;
              }
              if (ev.dots) {
                for (var d = 0; d < ev.dots; d++) note.addModifier(new Flow.Dot(), 0);
              }
              if (ev.kind !== "rest") {
                var glyph = BN.music.displayAccidental(measure, evIndex, key);
                if (glyph) note.addModifier(new Flow.Accidental(glyph), 0);
              }
              var selected =
                selection &&
                selection.system === sysIndex &&
                selection.staff === staffIndex &&
                selection.measure === mi3 &&
                selection.index === evIndex;
              var ink = selected ? colors.accent : colors.text;
              note.setStyle({ fillStyle: ink, strokeStyle: ink });
              notes.push(note);
              var pitchY = stave.getYForLine(2);
              if (ev.kind !== "rest" && ev.pitch) {
                var pos = BN.music.pitchToPos(clef, ev.pitch);
                pitchY = stave.getYForNote(1 + pos / 2);
              }
              layout.notes.push({
                id: ev.id,
                system: sysIndex,
                staff: staffIndex,
                measure: mi3,
                index: evIndex,
                note: note,
                pitchY: pitchY
              });
            });
            if (!notes.length) continue;
            var time = timeOf(page, measure);
            var parts = time.split("/");
            var voice = new Flow.Voice({ num_beats: Number(parts[0]) || 4, beat_value: Number(parts[1]) || 4 });
            voice.setMode(Flow.Voice.Mode.SOFT);
            voice.addTickables(notes);
            var width = Math.max(24, stave.getNoteEndX() - stave.getNoteStartX() - 8);
            try {
              new Flow.Formatter().joinVoices([voice]).format([voice], width);
              voice.draw(ctx, stave);
              var beams = Flow.Beam.generateBeams(notes, {
                groups: Flow.Beam.getDefaultBeamGroups(time)
              });
              beams.forEach(function (beam) {
                beam.setStyle({ fillStyle: colors.text, strokeStyle: colors.text });
                beam.setContext(ctx).draw();
              });
            } catch (err) {
              /* keep the staves even if a voice cannot be formatted */
            }
          }
        });
      });

      layout.notes.forEach(function (entry) {
        try {
          var bb = entry.note.getBoundingBox();
          entry.x = bb.getX();
          entry.w = Math.max(12, bb.getW());
        } catch (err) {
          entry.x = 0;
          entry.w = 16;
        }
      });

      BN.render.layout = layout;
      if (svg) svg.setAttribute("data-logical-h", String(logicalH));
      return layout;
    },

    svgPoint: function (x, y) {
      var svg = BN.render.layout && BN.render.layout.svg;
      if (!svg) return { x: x, y: y };
      var pt = svg.createSVGPoint();
      pt.x = x;
      pt.y = y;
      var ctm = svg.getScreenCTM();
      if (!ctm) return { x: x, y: y };
      var p = pt.matrixTransform(ctm);
      return { x: p.x, y: p.y };
    },

    clientToSvg: function (clientX, clientY) {
      var svg = BN.render.layout && BN.render.layout.svg;
      if (!svg) return { x: 0, y: 0 };
      var pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      var ctm = svg.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      var p = pt.matrixTransform(ctm.inverse());
      return { x: p.x, y: p.y };
    },

    posToY: function (systemIdx, staffIdx, pos) {
      var layout = BN.render.layout;
      var info = layout.systems[systemIdx];
      var stave = info.staves[staffIdx].staves[0];
      var y = stave.getYForNote(1 + pos / 2);
      return BN.render.svgPoint(0, y).y;
    },

    measureX: function (systemIdx, measureIdx, frac) {
      var info = BN.render.layout.systems[systemIdx];
      var box = info.measures[measureIdx] || info.measures[0];
      var x = box.x + box.w * (frac == null ? 0.62 : frac);
      return BN.render.svgPoint(x, 0).x;
    },

    clefPoint: function (systemIdx) {
      var info = BN.render.layout.systems[systemIdx];
      var stave = info.staves[0].staves[0];
      return BN.render.svgPoint(stave.getX() + 10, stave.getYForLine(2));
    },

    screenStep: function () {
      var layout = BN.render.layout;
      if (!layout || !layout.svg) return 12;
      var rect = layout.svg.getBoundingClientRect();
      return (5 * rect.width) / layout.userW;
    },

    logicalToClient: function (x, y) {
      var sheet = document.getElementById("sheet");
      var layout = BN.render.layout;
      if (!sheet || !layout) return { x: x, y: y };
      var rect = sheet.getBoundingClientRect();
      return {
        x: rect.left + (x / 1000) * rect.width,
        y: rect.top + (y / layout.logicalH) * rect.height
      };
    },

    clientToLogical: function (clientX, clientY) {
      var sheet = document.getElementById("sheet");
      var layout = BN.render.layout;
      if (!sheet || !layout) return [0, 0];
      var rect = sheet.getBoundingClientRect();
      var x = ((clientX - rect.left) / rect.width) * 1000;
      var y = ((clientY - rect.top) / rect.height) * layout.logicalH;
      return [x, y];
    },

    hitStaff: function (clientX, clientY) {
      var layout = BN.render.layout;
      if (!layout) return null;
      var p = BN.render.clientToSvg(clientX, clientY);
      var sys = null;
      for (var i = 0; i < layout.systems.length; i++) {
        var info = layout.systems[i];
        var top = info.staffTop[0] - 36;
        var bottom = info.staffTop[info.staffTop.length - 1] + 150;
        if (p.y >= top && p.y <= bottom) {
          sys = info;
          break;
        }
      }
      if (!sys && layout.systems.length) {
        var best = layout.systems[0];
        var bestD = Infinity;
        layout.systems.forEach(function (info) {
          var mid = (info.y + info.bottom) / 2;
          var d = Math.abs(p.y - mid);
          if (d < bestD) {
            bestD = d;
            best = info;
          }
        });
        if (bestD < 30) sys = best;
      }
      if (!sys) return null;
      var staffIdx = 0;
      if (sys.staves.length > 1) {
        var top = sys.staves[0].staves[0];
        var bot = sys.staves[1].staves[0];
        var midY = (top.getBottomLineY() + bot.getYForLine(0)) / 2;
        staffIdx = p.y < midY ? 0 : 1;
      }
      var measureIdx = 0;
      for (var m = 0; m < sys.measures.length; m++) {
        var box = sys.measures[m];
        if (p.x >= box.x && p.x < box.x + box.w) {
          measureIdx = m;
          break;
        }
        if (m === sys.measures.length - 1) measureIdx = m;
      }
      var stave = sys.staves[staffIdx].staves[0];
      var line = (stave.getYForNote(0) - p.y) / stave.getSpacingBetweenLines();
      var pos = Math.round((line - 1) * 2);
      pos = BN.music.clampPos(pos);
      var onClef = measureIdx === 0 && p.x < sys.measures[0].x + 22;
      return {
        system: sys.index,
        staff: staffIdx,
        measure: measureIdx,
        pos: pos,
        clef: onClef,
        svg: p
      };
    },

    hitNote: function (clientX, clientY) {
      var layout = BN.render.layout;
      if (!layout) return null;
      var p = BN.render.clientToSvg(clientX, clientY);
      var found = null;
      var best = 1e9;
      layout.notes.forEach(function (entry) {
        var padX = 4;
        if (
          entry.pitchY != null &&
          Math.abs(p.y - entry.pitchY) <= 3.2 &&
          p.x >= entry.x - padX &&
          p.x <= entry.x + entry.w + padX
        ) {
          var cx = entry.x + entry.w / 2;
          var d = (p.x - cx) * (p.x - cx) + (p.y - entry.pitchY) * (p.y - entry.pitchY);
          if (d < best) {
            best = d;
            found = entry;
          }
        }
      });
      return found;
    }
  };
})();
