/* Bass Notebook — pure music helpers. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var STEPS = ["C", "D", "E", "F", "G", "A", "B"];
  var DUR_Q = { w: 4, h: 2, q: 1, "8": 0.5, "16": 0.25 };

  var MAJOR = {
    C: [],
    G: ["F"],
    D: ["F", "C"],
    A: ["F", "C", "G"],
    E: ["F", "C", "G", "D"],
    B: ["F", "C", "G", "D", "A"],
    "F#": ["F", "C", "G", "D", "A", "E"],
    "C#": ["F", "C", "G", "D", "A", "E", "B"],
    F: ["B"],
    Bb: ["B", "E"],
    Eb: ["B", "E", "A"],
    Ab: ["B", "E", "A", "D"],
    Db: ["B", "E", "A", "D", "G"],
    Gb: ["B", "E", "A", "D", "G", "C"],
    Cb: ["B", "E", "A", "D", "G", "C", "F"]
  };
  var FLAT_KEYS = { F: 1, Bb: 1, Eb: 1, Ab: 1, Db: 1, Gb: 1, Cb: 1 };
  var RELATIVE = {
    Am: "C",
    Em: "G",
    Bm: "D",
    "F#m": "A",
    "C#m": "E",
    "G#m": "B",
    "D#m": "F#",
    "A#m": "C#",
    Dm: "F",
    Gm: "Bb",
    Cm: "Eb",
    Fm: "Ab",
    Bbm: "Db",
    Ebm: "Gb",
    Abm: "Cb"
  };

  var ORIGIN = {
    bass: { step: "G", oct: 2 },
    treble: { step: "E", oct: 4 }
  };

  function stepIndex(step) {
    return STEPS.indexOf(String(step || "").toUpperCase());
  }

  function majorName(key) {
    if (!key) return "C";
    if (RELATIVE[key]) return RELATIVE[key];
    if (MAJOR[key]) return key;
    return "C";
  }

  function posToPitch(clef, pos) {
    var origin = clef === "treble" ? ORIGIN.treble : ORIGIN.bass;
    var idx = stepIndex(origin.step) + pos;
    var oct = origin.oct;
    while (idx > 6) {
      idx -= 7;
      oct += 1;
    }
    while (idx < 0) {
      idx += 7;
      oct -= 1;
    }
    return { step: STEPS[idx], oct: oct, acc: null };
  }

  function pitchToPos(clef, pitch) {
    var origin = clef === "treble" ? ORIGIN.treble : ORIGIN.bass;
    return (pitch.oct - origin.oct) * 7 + (stepIndex(pitch.step) - stepIndex(origin.step));
  }

  function keyAccidentals(key) {
    var major = majorName(key);
    var letters = MAJOR[major] || [];
    var acc = FLAT_KEYS[major] ? "b" : "#";
    var map = {};
    if (major === "C") return map;
    letters.forEach(function (step) {
      map[step] = acc;
    });
    return map;
  }

  function dotFactor(dots) {
    if (dots === 2) return 1.75;
    if (dots === 1) return 1.5;
    return 1;
  }

  function eventQuarters(ev) {
    var base = DUR_Q[ev.dur];
    if (!base) return 0;
    return base * dotFactor(ev.dots || 0);
  }

  function timeQuarters(time) {
    var parts = String(time || "4/4").split("/");
    var n = Number(parts[0]);
    var d = Number(parts[1]);
    if (!n || !d) return 4;
    return n * (4 / d);
  }

  function measureFill(measure, pageTime) {
    var time = (measure && measure.time) || pageTime || "4/4";
    var cap = timeQuarters(time);
    var sum = 0;
    var events = (measure && measure.events) || [];
    for (var i = 0; i < events.length; i++) sum += eventQuarters(events[i]);
    var eps = 1e-6;
    if (sum > cap + eps) return "over";
    if (Math.abs(sum - cap) <= eps) return "full";
    return "under";
  }

  function soundingAcc(ev, keyAcc) {
    if (!ev || ev.kind === "rest" || !ev.pitch) return null;
    var acc = ev.pitch.acc;
    if (acc === "#" || acc === "b") return acc;
    if (acc === "n") return null;
    return keyAcc || null;
  }

  function displayAccidental(measure, index, key) {
    var events = (measure && measure.events) || [];
    var sig = keyAccidentals(key);
    var memory = {};
    var shown = null;
    for (var i = 0; i < events.length && i <= index; i++) {
      var ev = events[i];
      if (!ev || ev.kind === "rest" || !ev.pitch) continue;
      var id = ev.pitch.step + "/" + ev.pitch.oct;
      var keyAcc = sig[ev.pitch.step] || null;
      var sound = soundingAcc(ev, keyAcc);
      var inForce = Object.prototype.hasOwnProperty.call(memory, id) ? memory[id] : keyAcc;
      var glyph = null;
      if (sound !== inForce) glyph = sound || "n";
      memory[id] = sound;
      if (i === index) shown = glyph;
    }
    return shown;
  }

  BN.music = {
    STEPS: STEPS,
    DURATIONS: ["w", "h", "q", "8", "16"],
    KEYS: Object.keys(MAJOR),
    MINORS: Object.keys(RELATIVE),
    RELATIVE: RELATIVE,
    posToPitch: posToPitch,
    pitchToPos: pitchToPos,
    keyAccidentals: keyAccidentals,
    majorName: majorName,
    eventQuarters: eventQuarters,
    timeQuarters: timeQuarters,
    measureFill: measureFill,
    displayAccidental: displayAccidental,
    clampPos: function (pos) {
      if (pos < -10) return -10;
      if (pos > 18) return 18;
      return pos;
    }
  };
})();
