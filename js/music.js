/* Pitch, keys, durations. Pure. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var STEPS = ["C", "D", "E", "F", "G", "A", "B"];
  var SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var SHARPS = ["F", "C", "G", "D", "A", "E", "B"];
  var FLATS = ["B", "E", "A", "D", "G", "C", "F"];
  var DIV = 48;
  var TYPE_TICKS = { whole: 192, half: 96, quarter: 48, eighth: 24, "16th": 12 };
  var ATOMS = [
    ["whole", 2, 336], ["whole", 1, 288], ["whole", 0, 192],
    ["half", 2, 168], ["half", 1, 144], ["half", 0, 96],
    ["quarter", 2, 84], ["quarter", 1, 72], ["quarter", 0, 48],
    ["eighth", 2, 42], ["eighth", 1, 36], ["eighth", 0, 24],
    ["16th", 2, 21], ["16th", 1, 18], ["16th", 0, 12]
  ];
  var MAJOR = [
    [-7, "Cb"], [-6, "Gb"], [-5, "Db"], [-4, "Ab"], [-3, "Eb"], [-2, "Bb"], [-1, "F"],
    [0, "C"], [1, "G"], [2, "D"], [3, "A"], [4, "E"], [5, "B"], [6, "F#"], [7, "C#"]
  ];
  var MINOR_OF = {
    Cb: "Abm", Gb: "Ebm", Db: "Bbm", Ab: "Fm", Eb: "Cm", Bb: "Gm", F: "Dm",
    C: "Am", G: "Em", D: "Bm", A: "F#m", E: "C#m", B: "G#m", "F#": "D#m", "C#": "A#m"
  };

  function stepIndex(step) {
    return STEPS.indexOf(step);
  }

  function diatonic(clef, pos) {
    var origin = clef === "treble" || clef === "G" ? { step: "E", oct: 4 } : { step: "G", oct: 2 };
    var idx = stepIndex(origin.step) + pos;
    var oct = origin.oct;
    while (idx > 6) { idx -= 7; oct += 1; }
    while (idx < 0) { idx += 7; oct -= 1; }
    return { step: STEPS[idx], octave: oct };
  }

  function fifthsAlter(step, fifths) {
    var n = fifths || 0;
    if (n > 0 && SHARPS.slice(0, n).indexOf(step) >= 0) return 1;
    if (n < 0 && FLATS.slice(0, -n).indexOf(step) >= 0) return -1;
    return 0;
  }

  function posToPitch(clef, pos, key) {
    var name = clef === "treble" || clef === "G" ? "treble" : "bass";
    var d = diatonic(name, pos);
    var alter = key ? fifthsAlter(d.step, key.fifths) : 0;
    return { step: d.step, alter: alter, octave: d.octave };
  }

  function pitchToPos(clef, pitch) {
    var name = clef === "treble" || clef === "G" ? "treble" : "bass";
    var origin = name === "treble" ? { step: "E", oct: 4 } : { step: "G", oct: 2 };
    return (pitch.octave - origin.oct) * 7 + (stepIndex(pitch.step) - stepIndex(origin.step));
  }

  function pitchToMidi(pitch) {
    return (pitch.octave + 1) * 12 + SEMI[pitch.step] + (pitch.alter || 0);
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function ticksOf(type, dots) {
    var t = TYPE_TICKS[type] || 48;
    if (dots === 1) return Math.round(t * 1.5);
    if (dots === 2) return Math.round(t * 1.75);
    return t;
  }

  function decompose(ticks) {
    var left = Math.round(ticks);
    var out = [];
    while (left > 0) {
      var found = null;
      for (var i = 0; i < ATOMS.length; i++) {
        if (ATOMS[i][2] <= left) { found = ATOMS[i]; break; }
      }
      if (!found) break;
      out.push({ type: found[0], dots: found[1], duration: found[2] });
      left -= found[2];
    }
    if (left > 0) {
      if (out.length) out[out.length - 1].duration += left;
      else out.push({ type: "16th", dots: 0, duration: left });
    }
    return out;
  }

  function measureTicks(time, divisions) {
    var div = divisions || DIV;
    return time.beats * div * 4 / time.beatType;
  }

  function vfKey(key) {
    var fifths = key.fifths || 0;
    var major = "C";
    MAJOR.forEach(function (row) { if (row[0] === fifths) major = row[1]; });
    if (key.mode === "minor") return MINOR_OF[major] || "Am";
    return major;
  }

  function keyFromName(name) {
    var minor = name.slice(-1) === "m";
    var base = minor ? name.slice(0, -1) : name;
    var fifths = 0;
    Object.keys(MINOR_OF).forEach(function (maj) {
      if (minor && MINOR_OF[maj] === name) {
        MAJOR.forEach(function (row) { if (row[1] === maj) fifths = row[0]; });
      }
    });
    if (!minor) MAJOR.forEach(function (row) { if (row[1] === base) fifths = row[0]; });
    return { fifths: fifths, mode: minor ? "minor" : "major" };
  }

  function inForceAlter(notes, index, key) {
    var note = notes[index];
    if (!note || note.rest || !note.pitch) return 0;
    var prev = fifthsAlter(note.pitch.step, key.fifths);
    for (var i = 0; i < index; i++) {
      var other = notes[i];
      if (!other || other.rest || !other.pitch) continue;
      if (other.pitch.step === note.pitch.step && other.pitch.octave === note.pitch.octave) {
        prev = other.pitch.alter || 0;
      }
    }
    return prev;
  }

  function displayAccidental(notes, index, key) {
    var note = notes[index];
    if (!note || note.rest || !note.pitch) return null;
    var sounding = note.pitch.alter || 0;
    var force = inForceAlter(notes, index, key);
    if (sounding === force && !note.accidental) return null;
    if (sounding === force && note.accidental) {
      /* courtesy only when the stored accidental differs from what is already in force */
      return null;
    }
    if (sounding === 1) return "sharp";
    if (sounding === -1) return "flat";
    return "natural";
  }


  var DUR_NAMES = { whole: "שלמה", half: "חצי", quarter: "רבע", eighth: "שמינית", "16th": "שש־עשרית" };
  var DUR_ORDER = ["whole", "half", "quarter", "eighth", "16th"];
  var SHARP_NAMES = [["C", 0], ["C", 1], ["D", 0], ["D", 1], ["E", 0], ["F", 0], ["F", 1], ["G", 0], ["G", 1], ["A", 0], ["A", 1], ["B", 0]];
  var FLAT_NAMES = [["C", 0], ["D", -1], ["D", 0], ["E", -1], ["E", 0], ["F", 0], ["G", -1], ["G", 0], ["A", -1], ["A", 0], ["B", -1], ["B", 0]];

  /* Spell a MIDI number; black keys follow the key signature (flats in flat keys). */
  function midiToPitch(midi, key) {
    var names = key && key.fifths < 0 ? FLAT_NAMES : SHARP_NAMES;
    var row = names[((midi % 12) + 12) % 12];
    return { step: row[0], alter: row[1], octave: Math.floor(midi / 12) - 1 };
  }

  function pitchName(pitch) {
    if (!pitch) return "";
    return pitch.step + (pitch.alter === 1 ? "♯" : pitch.alter === -1 ? "♭" : "") + pitch.octave;
  }

  function durationLabel(type, dots) {
    return (DUR_NAMES[type] || "") + (dots === 1 ? " מנוקד" : dots === 2 ? " כפול־נקודה" : "");
  }

  BN.music = {
    DIV: DIV,
    DUR_ORDER: DUR_ORDER,
    midiToPitch: midiToPitch,
    pitchName: pitchName,
    durationLabel: durationLabel,
    STEPS: STEPS,
    MAJOR: MAJOR,
    MINOR_OF: MINOR_OF,
    posToPitch: posToPitch,
    pitchToPos: pitchToPos,
    pitchToMidi: pitchToMidi,
    midiToFreq: midiToFreq,
    fifthsAlter: fifthsAlter,
    ticksOf: ticksOf,
    decompose: decompose,
    measureTicks: measureTicks,
    vfKey: vfKey,
    keyFromName: keyFromName,
    displayAccidental: displayAccidental,
    inForceAlter: inForceAlter,
    clampPos: function (pos) { return Math.max(-10, Math.min(18, pos)); }
  };
})();
