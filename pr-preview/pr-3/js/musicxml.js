/* MusicXML 4.0 score-partwise export and a small importer. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c];
    });
  }

  function typeTag(note) {
    var dots = "";
    for (var i = 0; i < (note.dots || 0); i++) dots += "<dot/>";
    return "<type>" + note.type + "</type>" + dots;
  }

  function noteXml(note, voice) {
    var xml = "<note>";
    if (note.rest) xml += "<rest/>";
    else {
      xml += "<pitch><step>" + note.pitch.step + "</step>";
      if (note.pitch.alter) xml += "<alter>" + note.pitch.alter + "</alter>";
      xml += "<octave>" + note.pitch.octave + "</octave></pitch>";
    }
    xml += "<duration>" + note.duration + "</duration>";
    xml += "<voice>" + (voice || 1) + "</voice>";
    xml += typeTag(note);
    if (note.accidental) xml += "<accidental>" + note.accidental + "</accidental>";
    if (note.tie && note.tie.stop) xml += '<tie type="stop"/>';
    if (note.tie && note.tie.start) xml += '<tie type="start"/>';
    if (note.staff) xml += "<staff>" + note.staff + "</staff>";
    if (note.tie && note.tie.stop) xml += '<notations><tied type="stop"/></notations>';
    if (note.tie && note.tie.start) xml += '<notations><tied type="start"/></notations>';
    xml += "</note>";
    return xml;
  }

  function exportScore(score) {
    var part = score.parts[0];
    var staves = BN.model.staffCount(score);
    var xml = '<?xml version="1.0" encoding="UTF-8"?>';
    xml += '<score-partwise version="4.0">';
    xml += "<work><work-title>" + esc(score.title) + "</work-title></work>";
    xml += "<part-list><score-part id=\"P1\"><part-name>" + esc(part.name || "Bass") + "</part-name></score-part></part-list>";
    xml += '<part id="P1">';
    part.measures.forEach(function (measure, mi) {
      xml += '<measure number="' + measure.number + '">';
      if (mi === 0) {
        xml += '<attributes><divisions>' + score.divisions + "</divisions>";
        var key = BN.model.keyOf(part, 0);
        xml += "<key><fifths>" + key.fifths + "</fifths><mode>" + (key.mode || "major") + "</mode></key>";
        var time = BN.model.timeOf(part, 0);
        xml += "<time><beats>" + time.beats + "</beats><beat-type>" + time.beatType + "</beat-type></time>";
        if (staves === 2) xml += "<staves>2</staves>";
        var clefs = BN.model.clefsOf(part, 0, score);
        clefs.forEach(function (clef) {
          xml += "<clef" + (staves === 2 ? ' number="' + clef.staff + '"' : "") + "><sign>" + clef.sign + "</sign><line>" + clef.line + "</line></clef>";
        });
        xml += "</attributes>";
        xml += "<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>" + score.tempo.bpm + "</per-minute></metronome></direction-type>";
        xml += '<sound tempo="' + score.tempo.bpm + '"/></direction>';
      } else if (measure.attributes && (measure.attributes.key || measure.attributes.time)) {
        xml += "<attributes>";
        if (measure.attributes.key) xml += "<key><fifths>" + measure.attributes.key.fifths + "</fifths><mode>" + measure.attributes.key.mode + "</mode></key>";
        if (measure.attributes.time) xml += "<time><beats>" + measure.attributes.time.beats + "</beats><beat-type>" + measure.attributes.time.beatType + "</beat-type></time>";
        xml += "</attributes>";
      }
      var audible = measure.notes.filter(function (n) { return !n.generated; });
      if (staves === 2) {
        var s1 = audible.filter(function (n) { return n.staff === 1; });
        var s2 = audible.filter(function (n) { return n.staff === 2; });
        s1.forEach(function (n) { xml += noteXml(n, 1); });
        xml += "<backup><duration>" + BN.music.measureTicks(BN.model.timeOf(part, mi)) + "</duration></backup>";
        s2.forEach(function (n) { xml += noteXml(n, 2); });
      } else {
        audible.forEach(function (n) { xml += noteXml(n, 1); });
      }
      if (measure.barline && measure.barline.right && measure.barline.right !== "regular") {
        xml += '<barline location="right"><bar-style>' + measure.barline.right + "</bar-style>";
        if (measure.barline.repeat) xml += '<repeat direction="' + measure.barline.repeat + '"/>';
        xml += "</barline>";
      }
      xml += "</measure>";
    });
    xml += "</part></score-partwise>";
    return xml;
  }

  function text(el, tag) {
    var n = el.getElementsByTagName(tag)[0];
    return n ? n.textContent : "";
  }

  function importScore(xml) {
    var doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("הקובץ פגום");
    var title = text(doc, "work-title") || "ייבוא";
    var stavesEl = doc.getElementsByTagName("staves")[0];
    var layout = stavesEl && stavesEl.textContent === "2" ? "grand" : "bass";
    var firstClef = doc.getElementsByTagName("clef")[0];
    if (layout !== "grand" && firstClef && text(firstClef, "sign") === "G") layout = "treble";
    var per = doc.getElementsByTagName("per-minute")[0];
    var score = BN.model.blank({ title: title, staffLayout: layout, bpm: per ? Number(per.textContent) : 100 });
    var part = score.parts[0];
    part.measures = [];
    var measures = doc.getElementsByTagName("measure");
    Array.prototype.forEach.call(measures, function (measureEl, mi) {
      var measure = { number: mi + 1, notes: [] };
      var attrs = measureEl.getElementsByTagName("attributes")[0];
      if (attrs) {
        measure.attributes = {};
        var fifths = attrs.getElementsByTagName("fifths")[0];
        var mode = attrs.getElementsByTagName("mode")[0];
        if (fifths) measure.attributes.key = { fifths: Number(fifths.textContent), mode: mode ? mode.textContent : "major" };
        var beats = attrs.getElementsByTagName("beats")[0];
        var beatType = attrs.getElementsByTagName("beat-type")[0];
        if (beats) measure.attributes.time = { beats: Number(beats.textContent), beatType: Number(beatType.textContent) };
        var clefs = attrs.getElementsByTagName("clef");
        if (clefs.length) {
          measure.attributes.clefs = Array.prototype.map.call(clefs, function (clef) {
            var num = clef.getAttribute("number");
            return { staff: num ? Number(num) : 1, sign: text(clef, "sign"), line: Number(text(clef, "line")) };
          });
        }
      }
      var staffCursor = 1;
      Array.prototype.forEach.call(measureEl.children, function (child) {
        if (child.tagName === "backup") staffCursor = 2;
        if (child.tagName !== "note") return;
        var rest = child.getElementsByTagName("rest").length > 0;
        var type = text(child, "type") || "quarter";
        var dots = child.getElementsByTagName("dot").length;
        var staff = text(child, "staff");
        var note = {
          id: BN.uid("n"),
          staff: staff ? Number(staff) : staffCursor,
          voice: 1,
          rest: rest,
          duration: Number(text(child, "duration")) || BN.music.ticksOf(type, dots),
          type: type,
          dots: dots
        };
        if (!rest) {
          note.pitch = {
            step: text(child, "step") || "C",
            alter: Number(text(child, "alter") || 0),
            octave: Number(text(child, "octave") || 4)
          };
          var acc = text(child, "accidental");
          if (acc) note.accidental = acc;
        }
        var ties = child.getElementsByTagName("tie");
        if (ties.length) {
          note.tie = {};
          Array.prototype.forEach.call(ties, function (tie) {
            if (tie.getAttribute("type") === "start") note.tie.start = true;
            if (tie.getAttribute("type") === "stop") note.tie.stop = true;
          });
        }
        measure.notes.push(note);
      });
      var bar = measureEl.getElementsByTagName("bar-style")[0];
      if (bar) measure.barline = { right: bar.textContent };
      part.measures.push(measure);
    });
    if (!part.measures.length) part.measures = BN.model.blank().parts[0].measures;
    return score;
  }

  function signature(score) {
    var part = score.parts[0];
    return {
      title: score.title,
      bpm: score.tempo.bpm,
      layout: score.staffLayout,
      divisions: score.divisions,
      measures: part.measures.map(function (measure) {
        return {
          key: measure.attributes && measure.attributes.key,
          time: measure.attributes && measure.attributes.time,
          barline: measure.barline || null,
          notes: measure.notes.filter(function (n) { return !n.generated; }).map(function (n) {
            return {
              staff: n.staff,
              rest: !!n.rest,
              pitch: n.pitch || null,
              duration: n.duration,
              type: n.type,
              dots: n.dots || 0,
              accidental: n.accidental || null,
              tie: n.tie || null
            };
          })
        };
      })
    };
  }

  BN.musicxml = {
    export: exportScore,
    import: importScore,
    signature: signature,
    roundTrip: function (score) {
      return BN.model.normalize(importScore(exportScore(score)));
    }
  };
})();
