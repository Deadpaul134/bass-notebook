/* Bass Notebook v2 — score edits and measure normalize. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});

  function uid(p) { return BN.uid ? BN.uid(p || "n") : "n_" + Math.random().toString(36).slice(2); }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function partOf(score) { return score.parts[0]; }

  function timeOf(part, index) {
    for (var i = index; i >= 0; i--) {
      if (part.measures[i].attributes && part.measures[i].attributes.time) return part.measures[i].attributes.time;
    }
    return { beats: 4, beatType: 4 };
  }

  function keyOf(part, index) {
    for (var i = index; i >= 0; i--) {
      if (part.measures[i].attributes && part.measures[i].attributes.key) return part.measures[i].attributes.key;
    }
    return { fifths: 0, mode: "major" };
  }

  function clefsOf(part, index, score) {
    for (var i = index; i >= 0; i--) {
      if (part.measures[i].attributes && part.measures[i].attributes.clefs) return part.measures[i].attributes.clefs;
    }
    return defaultClefs(score.staffLayout);
  }

  function defaultClefs(layout) {
    if (layout === "treble") return [{ staff: 1, sign: "G", line: 2 }];
    if (layout === "grand") return [{ staff: 1, sign: "G", line: 2 }, { staff: 2, sign: "F", line: 4 }];
    return [{ staff: 1, sign: "F", line: 4 }];
  }

  function staffCount(score) { return score.staffLayout === "grand" ? 2 : 1; }

  function contentEnd(part) {
    var last = part.measures.length - 1;
    while (last > 0 && part.measures[last].notes.every(function (n) { return n.generated; }) && !part.measures[last].attributes) last -= 1;
    if (last > 0 && part.measures[last].notes.filter(function (n) { return !n.generated; }).length === 0 && !part.measures[last].attributes) last -= 1;
    return last;
  }

  function stream(part, staff, untilMeasure) {
    var end = untilMeasure == null ? contentEnd(part) : untilMeasure - 1;
    var notes = [];
    for (var i = 0; i <= end && i < part.measures.length; i++) {
      part.measures[i].notes.forEach(function (n) {
        if (n.staff === staff && !n.generated) notes.push(clone(n));
      });
    }
    return notes;
  }

  function applyFragments(base, pieces, tie) {
    return pieces.map(function (piece, i) {
      var n = clone(base);
      if (i > 0) n.id = uid("n");
      n.duration = piece.duration;
      n.type = piece.type;
      n.dots = piece.dots;
      if (tie && !base.rest) {
        n.tie = {};
        if (i > 0 || (base.tie && base.tie.stop)) n.tie.stop = true;
        if (i < pieces.length - 1 || (base.tie && base.tie.start)) n.tie.start = true;
        if (!n.tie.start && !n.tie.stop) delete n.tie;
      } else {
        delete n.tie;
      }
      return n;
    });
  }

  function pack(notes, capacity) {
    var measures = [];
    var current = [];
    var used = 0;
    function pushPiece(note) {
      current.push(note);
      used += note.duration;
      if (used === capacity) {
        measures.push(current);
        current = [];
        used = 0;
      }
    }
    notes.forEach(function (note) {
      var left = note.duration;
      var first = true;
      while (left > 0) {
        var room = capacity - used;
        if (room <= 0) {
          measures.push(current);
          current = [];
          used = 0;
          room = capacity;
        }
        var take = Math.min(left, room);
        var pieces = BN.music.decompose(take);
        if (!pieces.length) break;
        var made = applyFragments(first ? note : Object.assign(clone(note), { id: uid("n"), tie: { stop: true } }), pieces, true);
        if (!first) {
          made.forEach(function (p) { p.tie = p.tie || {}; p.tie.stop = true; });
        }
        made.forEach(pushPiece);
        left -= take;
        first = false;
      }
    });
    if (current.length) measures.push(current);
    return measures;
  }

  function fillRests(notes, capacity, staff) {
    var sum = notes.reduce(function (s, n) { return s + n.duration; }, 0);
    if (sum >= capacity) return notes;
    var rests = BN.music.decompose(capacity - sum).map(function (piece) {
      return {
        id: uid("r"),
        staff: staff,
        voice: 1,
        rest: true,
        duration: piece.duration,
        type: piece.type,
        dots: piece.dots,
        generated: true
      };
    });
    return notes.concat(rests);
  }

  function anchors(part) {
    var keys = [];
    var times = [];
    var bars = [];
    var tick = 0;
    part.measures.forEach(function (measure, i) {
      if (measure.attributes && measure.attributes.key) keys.push({ tick: tick, key: clone(measure.attributes.key) });
      if (measure.attributes && measure.attributes.time) times.push({ tick: tick, time: clone(measure.attributes.time) });
      if (measure.barline) bars.push({ tick: tick + BN.music.measureTicks(timeOf(part, i), 48) - 1, barline: clone(measure.barline) });
      tick += BN.music.measureTicks(timeOf(part, i), 48);
    });
    return { keys: keys, times: times, bars: bars };
  }

  function atTick(list, tick, fallback) {
    var found = fallback;
    list.forEach(function (item) { if (item.tick <= tick) found = item; });
    return found;
  }


  function refs(score, staff) {
    var out = [];
    partOf(score).measures.forEach(function (m, mi) {
      m.notes.forEach(function (n) { if (n.staff === staff && !n.generated) out.push({ note: n, mi: mi }); });
    });
    return out;
  }

  function samePitch(a, b) {
    return a.pitch && b.pitch && a.pitch.step === b.pitch.step && a.pitch.octave === b.pitch.octave && (a.pitch.alter || 0) === (b.pitch.alter || 0);
  }

  function cleanTies(score) {
    for (var s = 1; s <= staffCount(score); s++) {
      var list = refs(score, s).map(function (r) { return r.note; });
      list.forEach(function (n, i) {
        var nxt = list[i + 1];
        var prev = list[i - 1];
        if (n.tie && n.tie.start && !(nxt && !n.rest && !nxt.rest && samePitch(n, nxt))) delete n.tie.start;
        if (n.tie && n.tie.start && nxt) nxt.tie = Object.assign({}, nxt.tie, { stop: true });
        if (n.tie && n.tie.stop && !(prev && prev.tie && prev.tie.start)) delete n.tie.stop;
        if (n.tie && !n.tie.start && !n.tie.stop) delete n.tie;
      });
    }
  }

  function keyAt(score, mi) { return keyOf(partOf(score), mi); }

  function clefName(score, staff) {
    if (score.staffLayout === "grand") return staff === 1 ? "treble" : "bass";
    return score.staffLayout === "treble" ? "treble" : "bass";
  }

  function applyAlter(score, ref, alter) {
    var n = ref.note;
    var base = BN.music.fifthsAlter(n.pitch.step, keyAt(score, ref.mi).fifths);
    n.pitch.alter = alter;
    if (alter === base) delete n.accidental;
    else n.accidental = alter === 1 ? "sharp" : alter === -1 ? "flat" : "natural";
  }

  function findRef(score, id) {
    var found = null;
    partOf(score).measures.forEach(function (m, mi) {
      m.notes.forEach(function (n, ni) { if (n.id === id) found = { note: n, mi: mi, ni: ni, measure: m }; });
    });
    return found;
  }

  function fullRest(score, staff, ticks) {
    return BN.music.decompose(ticks).map(function (piece) {
      return { id: uid("r"), staff: staff, voice: 1, rest: true, duration: piece.duration, type: piece.type, dots: piece.dots };
    });
  }

  BN.model = {
    defaultClefs: defaultClefs,
    timeOf: timeOf,
    keyOf: keyOf,
    clefsOf: clefsOf,
    staffCount: staffCount,

    blank: function (opts) {
      opts = opts || {};
      var layout = opts.staffLayout || opts.layout || "bass";
      var now = new Date().toISOString();
      var clefs = defaultClefs(layout);
      return {
        id: opts.id || uid("s"),
        v: 2,
        title: opts.title || "רעיון חדש",
        composer: opts.composer || "",
        date: opts.date || (BN.ymd ? BN.ymd() : "2026-11-03"),
        createdAt: opts.createdAt || now,
        updatedAt: now,
        tags: opts.tags || [],
        comment: opts.comment || "",
        tempo: { bpm: opts.bpm || 100, beatUnit: "quarter" },
        divisions: 48,
        staffLayout: layout,
        parts: [{
          id: "P1",
          name: layout === "bass" ? "Bass" : "Piano",
          instrument: layout === "bass" ? "bass" : "piano",
          staves: layout === "grand" ? 2 : 1,
          measures: [{
            number: 1,
            attributes: {
              key: { fifths: 0, mode: "major" },
              time: { beats: 4, beatType: 4 },
              clefs: clefs
            },
            notes: []
          }]
        }]
      };
    },

    noteFromPalette: function (palette, pitch) {
      var type = palette.type || "quarter";
      var dots = palette.dots || 0;
      var note = {
        id: uid("n"),
        staff: palette.staff || 1,
        voice: 1,
        rest: !!palette.rest,
        duration: BN.music.ticksOf(type, dots),
        type: type,
        dots: dots
      };
      if (!note.rest) {
        note.pitch = { step: pitch.step, alter: pitch.alter || 0, octave: pitch.octave };
        if (palette.accidental) {
          note.accidental = palette.accidental;
          note.pitch.alter = palette.accidental === "sharp" ? 1 : palette.accidental === "flat" ? -1 : 0;
        }
        if (palette.tie) note.tie = { start: true };
      }
      return note;
    },

    normalize: function (score) {
      var part = partOf(score);
      var saved = anchors(part);
      var staves = [];
      for (var s = 1; s <= staffCount(score); s++) staves.push(stream(part, s));
      var times = saved.times.length ? saved.times : [{ tick: 0, time: { beats: 4, beatType: 4 } }];
      var keys = saved.keys.length ? saved.keys : [{ tick: 0, key: { fifths: 0, mode: "major" } }];
      var measures = [];
      var cursors = staves.map(function () { return 0; });
      var flat = staves;
      var tick = 0;
      var guard = 0;
      while (guard < 400) {
        guard += 1;
        var anyLeft = flat.some(function (notes, si) { return cursors[si] < notes.length; });
        if (!anyLeft) break;
        var time = atTick(times, tick, times[0]).time;
        var cap = BN.music.measureTicks(time);
        var bucket = [];
        flat.forEach(function (notes, si) {
          var used = 0;
          while (cursors[si] < notes.length && used < cap) {
            var note = notes[cursors[si]];
            var room = cap - used;
            if (note.duration <= room) {
              bucket.push(note);
              used += note.duration;
              cursors[si] += 1;
            } else {
              var pieces = BN.music.decompose(room);
              if (!pieces.length) { used = cap; break; }
              var head = applyFragments(note, pieces, true);
              if (!note.rest && head.length) {
                var lastHead = head[head.length - 1];
                lastHead.tie = Object.assign({}, lastHead.tie, { start: true });
              }
              bucket = bucket.concat(head);
              var restTicks = note.duration - room;
              var tailPieces = BN.music.decompose(restTicks);
              var tailSource = clone(note);
              tailSource.id = uid("n");
              if (!note.rest) tailSource.tie = { stop: true };
              var tail = applyFragments(tailSource, tailPieces, true);
              if (!note.rest) {
                tail.forEach(function (p) { p.tie = Object.assign({}, p.tie, { stop: true }); });
              }
              if (!tail.length) { used = cap; break; }
              notes.splice(cursors[si], 1, tail[0]);
              for (var t = 1; t < tail.length; t++) notes.splice(cursors[si] + t, 0, tail[t]);
              used = cap;
            }
          }
          var staffNotes = bucket.filter(function (n) { return n.staff === si + 1; });
          var sum = staffNotes.reduce(function (a, n) { return a + n.duration; }, 0);
          var more = flat.some(function (ns, idx) { return idx !== si && cursors[idx] < ns.length; }) || cursors[si] < notes.length;
          if (more && sum < cap) {
            fillRests([], cap - sum, si + 1).forEach(function (r) { bucket.push(r); });
          }
        });
        var measure = { number: measures.length + 1, notes: bucket };
        var key = atTick(keys, tick, keys[0]).key;
        var attrs = null;
        if (measures.length === 0 || (times.some(function (t) { return t.tick === tick; }) && tick !== 0) || (keys.some(function (k) { return k.tick === tick; }) && tick !== 0)) {
          attrs = {};
          if (measures.length === 0 || times.some(function (t) { return t.tick === tick; })) attrs.time = clone(time);
          if (measures.length === 0 || keys.some(function (k) { return k.tick === tick; })) attrs.key = clone(key);
          if (measures.length === 0) attrs.clefs = defaultClefs(score.staffLayout);
        }
        if (attrs) measure.attributes = attrs;
        var bar = saved.bars.filter(function (b) { return b.tick >= tick && b.tick < tick + cap; })[0];
        if (bar) measure.barline = bar.barline;
        measures.push(measure);
        tick += cap;
        if (!bucket.length) break;
      }
      if (!measures.length) {
        measures.push({
          number: 1,
          attributes: { key: clone(keys[0].key), time: clone(times[0].time), clefs: defaultClefs(score.staffLayout) },
          notes: []
        });
      }
      var tail = measures[measures.length - 1];
      if (tail.notes.filter(function (n) { return !n.generated; }).length) {
        measures.push({ number: measures.length + 1, notes: [] });
      }
      measures.forEach(function (m, i) { m.number = i + 1; });
      part.measures = measures;
      part.staves = staffCount(score);
      return score;
    },

    append: function (score, staff, note) {
      note.staff = staff;
      var part = partOf(score);
      var end = contentEnd(part);
      if (!part.measures[end]) return;
      part.measures[end].notes.push(note);
      return BN.model.normalize(score);
    },

    insertAt: function (score, staff, measureIndex, noteIndex, note) {
      note.staff = staff;
      var part = partOf(score);
      var measure = part.measures[measureIndex];
      if (!measure) return BN.model.append(score, staff, note);
      /* Earlier gaps on this staff become real rests, so the note lands in the tapped measure. */
      for (var j = 0; j < measureIndex; j++) {
        part.measures[j].notes.forEach(function (n) {
          if (n.staff === staff && n.generated) delete n.generated;
        });
      }
      var own = measure.notes.filter(function (n) { return n.staff === staff && !n.generated; });
      var before = own[noteIndex];
      if (!own.length) {
        measure.notes = measure.notes.filter(function (n) { return !(n.staff === staff && n.generated); });
        measure.notes.push(note);
      } else if (before) {
        measure.notes.splice(measure.notes.indexOf(before), 0, note);
      } else {
        var last = own[own.length - 1];
        measure.notes.splice(measure.notes.indexOf(last) + 1, 0, note);
      }
      cleanTies(score);
      return BN.model.normalize(score);
    },

    replacePitch: function (score, id, pitch) {
      partOf(score).measures.forEach(function (measure) {
        measure.notes.forEach(function (note) {
          if (note.id === id && !note.rest) note.pitch = { step: pitch.step, alter: pitch.alter || 0, octave: pitch.octave };
        });
      });
      return score;
    },

    setAccidental: function (score, id, accidental) {
      partOf(score).measures.forEach(function (measure, mi) {
        measure.notes.forEach(function (note) {
          if (note.id !== id || note.rest) return;
          if (!accidental) {
            delete note.accidental;
            note.pitch.alter = BN.music.fifthsAlter(note.pitch.step, keyOf(partOf(score), mi).fifths);
            return;
          }
          note.accidental = accidental;
          note.pitch.alter = accidental === "sharp" ? 1 : accidental === "flat" ? -1 : 0;
        });
      });
      return score;
    },

    deleteNote: function (score, id, mode) {
      var part = partOf(score);
      part.measures.forEach(function (measure) {
        var idx = measure.notes.findIndex(function (n) { return n.id === id; });
        if (idx < 0) return;
        var note = measure.notes[idx];
        var later = false;
        for (var m = measure.number; m <= part.measures.length; m++) {
          var src = part.measures[m - 1];
          src.notes.forEach(function (other) {
            if (other.staff === note.staff && !other.generated && other.id !== id) later = true;
          });
        }
        var afterInMeasure = measure.notes.slice(idx + 1).some(function (n) { return n.staff === note.staff && !n.generated; });
        var afterLaterMeasure = part.measures.slice(measure.number).some(function (src) {
          return src.notes.some(function (n) { return n.staff === note.staff && !n.generated; });
        });
        var atEnd = !afterInMeasure && !afterLaterMeasure;
        if (mode === "shift" || atEnd) measure.notes.splice(idx, 1);
        else {
          note.rest = true;
          delete note.pitch;
          delete note.accidental;
          delete note.tie;
        }
      });
      return BN.model.normalize(score);
    },

    setTimeFrom: function (score, measureIndex, time) {
      var part = partOf(score);
      var measure = part.measures[measureIndex] || part.measures[0];
      measure.attributes = measure.attributes || {};
      measure.attributes.time = { beats: time.beats, beatType: time.beatType };
      if (measureIndex === 0) {
        part.measures.forEach(function (m, i) {
          if (i > 0 && m.attributes && m.attributes.time) delete m.attributes.time;
        });
      }
      return BN.model.normalize(score);
    },

    setKeyFrom: function (score, measureIndex, key) {
      var measure = partOf(score).measures[measureIndex] || partOf(score).measures[0];
      measure.attributes = measure.attributes || {};
      measure.attributes.key = { fifths: key.fifths, mode: key.mode || "major" };
      return score;
    },

    setBarline: function (score, measureIndex, barline) {
      var measure = partOf(score).measures[measureIndex];
      if (measure) measure.barline = barline;
      return score;
    },

    setLayout: function (score, layout) {
      var prev = score.staffLayout;
      if (prev === "grand" && layout !== "grand") {
        var upper = partOf(score).measures.some(function (m) {
          return m.notes.some(function (n) { return n.staff === 1 && !n.generated && !n.rest; });
        });
        if (upper && layout === "bass") {
          partOf(score).measures.forEach(function (m) {
            m.notes = m.notes.filter(function (n) { return n.staff !== 1; });
          });
        }
        if (upper && layout === "treble") {
          partOf(score).measures.forEach(function (m) {
            m.notes = m.notes.filter(function (n) { return n.staff !== 2; });
            m.notes.forEach(function (n) { if (n.staff === 1) n.staff = 1; });
          });
        }
      }
      if (layout === "grand") {
        /* keep existing staff numbers; bass-only notes stay on staff 1 until the user retargets.
           Move bass notes to staff 2 so the treble staff is the upper one. */
        if (prev === "bass") {
          partOf(score).measures.forEach(function (m) {
            m.notes.forEach(function (n) { if (n.staff === 1) n.staff = 2; });
          });
        }
      }
      if (layout !== "grand" && prev === "grand" && layout === "bass") {
        partOf(score).measures.forEach(function (m) {
          m.notes.forEach(function (n) { if (n.staff === 2) n.staff = 1; });
        });
      }
      score.staffLayout = layout;
      partOf(score).staves = layout === "grand" ? 2 : 1;
      partOf(score).instrument = layout === "bass" ? "bass" : "piano";
      partOf(score).name = layout === "bass" ? "Bass" : "Piano";
      var first = partOf(score).measures[0];
      first.attributes = first.attributes || {};
      first.attributes.clefs = defaultClefs(layout);
      return BN.model.normalize(score);
    },

    find: function (score, id) {
      var found = null;
      partOf(score).measures.forEach(function (measure, mi) {
        measure.notes.forEach(function (note, ni) {
          if (note.id === id) found = { measure: measure, measureIndex: mi, index: ni, note: note };
        });
      });
      return found;
    },

    migrateV1: function (page) {
      var layout = page.clef === "grand" ? "grand" : page.clef === "treble" ? "treble" : "bass";
      var score = BN.model.blank({
        id: page.id,
        staffLayout: layout,
        title: page.title,
        date: page.date,
        bpm: page.tempo || 100,
        createdAt: page.createdAt
      });
      score.tags = page.tags || [];
      score.comment = page.notes || "";
      var typeMap = { w: "whole", h: "half", q: "quarter", "8": "eighth", "16": "16th" };
      var accMap = { "#": "sharp", b: "flat", n: "natural" };
      (page.systems || []).forEach(function (sys) {
        (sys.staves || []).forEach(function (staff, si) {
          var staffNum = layout === "grand" ? (staff.clef === "bass" ? 2 : 1) : 1;
          (staff.measures || []).forEach(function (measure) {
            (measure.events || []).forEach(function (ev) {
              var type = typeMap[ev.dur] || "quarter";
              var note = {
                id: ev.id || uid("n"),
                staff: staffNum,
                voice: 1,
                rest: ev.kind === "rest",
                duration: BN.music.ticksOf(type, ev.dots || 0),
                type: type,
                dots: ev.dots || 0
              };
              if (!note.rest && ev.pitch) {
                var alter = ev.pitch.acc === "#" ? 1 : ev.pitch.acc === "b" ? -1 : ev.pitch.acc === "n" ? 0 : BN.music.fifthsAlter(ev.pitch.step, 0);
                note.pitch = { step: ev.pitch.step, alter: alter, octave: ev.pitch.oct };
                if (ev.pitch.acc) note.accidental = accMap[ev.pitch.acc];
              }
              partOf(score).measures[0].notes.push(note);
            });
          });
        });
      });
      return BN.model.normalize(score);
    }
  };

  Object.assign(BN.model, {
    clefName: clefName,
    refs: refs,
    cleanTies: cleanTies,

    /* Alter that applies to a new note of this pitch: key signature, then earlier notes in the same measure. */
    alterFor: function (score, staff, measureIndex, noteIndex, step, octave) {
      var part = partOf(score);
      var alter = BN.music.fifthsAlter(step, keyOf(part, measureIndex).fifths);
      var m = part.measures[measureIndex];
      if (!m) return alter;
      var own = m.notes.filter(function (n) { return n.staff === staff && !n.generated; });
      own.slice(0, noteIndex == null ? own.length : noteIndex).forEach(function (n) {
        if (n.pitch && n.pitch.step === step && n.pitch.octave === octave) alter = n.pitch.alter || 0;
      });
      return alter;
    },

    /* Cursor position (measure, index) right after a note, following tie pieces. */
    cursorAfter: function (score, staff, id) {
      var list = refs(score, staff);
      var i = list.findIndex(function (r) { return r.note.id === id; });
      if (i < 0) return null;
      while (list[i].note.tie && list[i].note.tie.start && list[i + 1] && list[i + 1].note.tie && list[i + 1].note.tie.stop) i += 1;
      var r = list[i];
      var m = partOf(score).measures[r.mi];
      var own = m.notes.filter(function (n) { return n.staff === staff && !n.generated; });
      var at = own.indexOf(r.note) + 1;
      var used = own.reduce(function (a, n) { return a + n.duration; }, 0);
      var cap = BN.music.measureTicks(timeOf(partOf(score), r.mi));
      if (at >= own.length && used >= cap && r.mi + 1 < partOf(score).measures.length) return { staff: staff, measure: r.mi + 1, index: 0 };
      return { staff: staff, measure: r.mi, index: at };
    },

    clampCursor: function (score, cur) {
      var part = partOf(score);
      var staff = Math.min(cur.staff || 1, staffCount(score));
      var mi = Math.max(0, Math.min(cur.measure || 0, part.measures.length - 1));
      var count = part.measures[mi].notes.filter(function (n) { return n.staff === staff && !n.generated; }).length;
      return { staff: staff, measure: mi, index: Math.max(0, Math.min(cur.index || 0, count)) };
    },

    /* Ticks from the start of the score up to a cursor, for "play from here". */
    tickAt: function (score, cur) {
      var part = partOf(score);
      var tick = 0;
      for (var i = 0; i < cur.measure && i < part.measures.length; i++) tick += BN.music.measureTicks(timeOf(part, i));
      var own = (part.measures[cur.measure] ? part.measures[cur.measure].notes : []).filter(function (n) { return n.staff === cur.staff; });
      for (var k = 0; k < cur.index && k < own.length; k++) tick += own[k].duration;
      return tick;
    },

    noteIdsInMeasures: function (score, from, to, staff) {
      var out = [];
      partOf(score).measures.slice(from, to + 1).forEach(function (m) {
        m.notes.forEach(function (n) { if (!n.generated && (!staff || n.staff === staff)) out.push(n.id); });
      });
      return out;
    },

    /* Notes between two ids in staff order, both included. */
    rangeIds: function (score, staff, a, b) {
      var list = refs(score, staff).map(function (r) { return r.note.id; });
      var i = list.indexOf(a);
      var j = list.indexOf(b);
      if (i < 0 || j < 0) return [];
      return list.slice(Math.min(i, j), Math.max(i, j) + 1);
    },

    setDuration: function (score, ids, type, dots) {
      var part = partOf(score);
      var ticks = BN.music.ticksOf(type, dots);
      ids.forEach(function (id) {
        var r = findRef(score, id);
        if (!r || r.note.generated) return;
        var n = r.note;
        var delta = ticks - n.duration;
        n.type = type;
        n.dots = dots;
        n.duration = ticks;
        var list = refs(score, n.staff);
        var at = list.findIndex(function (x) { return x.note === n; });
        if (delta < 0 && at < list.length - 1) {
          var rests = fullRest(score, n.staff, -delta);
          var arr = r.measure.notes;
          arr.splice.apply(arr, [arr.indexOf(n) + 1, 0].concat(rests));
        } else if (delta > 0) {
          var need = delta;
          while (need > 0) {
            var cur = refs(score, n.staff);
            var idx = cur.findIndex(function (x) { return x.note === n; });
            var nx = cur[idx + 1];
            if (!nx || !nx.note.rest) break;
            var arr2 = part.measures[nx.mi].notes;
            var pos = arr2.indexOf(nx.note);
            if (nx.note.duration <= need) {
              need -= nx.note.duration;
              arr2.splice(pos, 1);
            } else {
              var left = fullRest(score, n.staff, nx.note.duration - need);
              need = 0;
              arr2.splice.apply(arr2, [pos, 1].concat(left));
            }
          }
        }
        if (n.tie && n.rest) delete n.tie;
      });
      cleanTies(score);
      return BN.model.normalize(score);
    },

    toRest: function (score, ids) {
      ids.forEach(function (id) {
        var r = findRef(score, id);
        if (!r) return;
        r.note.rest = true;
        ["pitch", "accidental", "tie", "artic", "dyn", "slur", "ghost"].forEach(function (k) { delete r.note[k]; });
      });
      cleanTies(score);
      return score;
    },

    setPitchOf: function (score, id, pitch) {
      var r = findRef(score, id);
      if (!r) return score;
      if (r.note.rest) { r.note.rest = false; }
      r.note.pitch = { step: pitch.step, alter: pitch.alter || 0, octave: pitch.octave };
      applyAlter(score, r, pitch.alter || 0);
      cleanTies(score);
      return score;
    },

    /* Move notes by diatonic steps; the key signature decides the alter. */
    stepNotes: function (score, ids, steps) {
      ids.forEach(function (id) {
        var r = findRef(score, id);
        if (!r || r.note.rest || !r.note.pitch) return;
        var clef = clefName(score, r.note.staff);
        var pos = BN.music.pitchToPos(clef, r.note.pitch) + steps;
        var p = BN.music.posToPitch(clef, pos, keyAt(score, r.mi));
        r.note.pitch = { step: p.step, alter: p.alter, octave: p.octave };
        delete r.note.accidental;
      });
      cleanTies(score);
      return score;
    },

    shiftOctave: function (score, ids, dir) {
      ids.forEach(function (id) {
        var r = findRef(score, id);
        if (r && !r.note.rest && r.note.pitch) r.note.pitch.octave += dir;
      });
      cleanTies(score);
      return score;
    },

    /* ♯/♭ by one semitone, limited to one sharp or one flat. */
    shiftAlter: function (score, ids, delta) {
      ids.forEach(function (id) {
        var r = findRef(score, id);
        if (!r || r.note.rest || !r.note.pitch) return;
        var next = Math.max(-1, Math.min(1, (r.note.pitch.alter || 0) + delta));
        applyAlter(score, r, next);
      });
      cleanTies(score);
      return score;
    },

    setAlterOf: function (score, ids, alter) {
      ids.forEach(function (id) {
        var r = findRef(score, id);
        if (!r || r.note.rest || !r.note.pitch) return;
        applyAlter(score, r, alter);
      });
      cleanTies(score);
      return score;
    },

    deleteNotes: function (score, ids, mode) {
      ids.forEach(function (id) {
        if (findRef(score, id)) BN.model.deleteNote(score, id, mode);
      });
      return score;
    },

    toggleDot: function (score, ids) {
      var first = ids.map(function (id) { return findRef(score, id); }).filter(Boolean)[0];
      if (!first) return score;
      var dots = ((first.note.dots || 0) + 1) % 3;
      ids.forEach(function (id) {
        var r = findRef(score, id);
        if (r) BN.model.setDuration(score, [id], r.note.type, dots);
      });
      return score;
    },

    /* Tie each note to the next one when it has the same pitch; a second call removes it. */
    toggleTie: function (score, ids) {
      var changed = false;
      ids.forEach(function (id) {
        var r = findRef(score, id);
        if (!r || r.note.rest) return;
        var list = refs(score, r.note.staff);
        var i = list.findIndex(function (x) { return x.note === r.note; });
        var nx = list[i + 1];
        if (r.note.tie && r.note.tie.start) {
          delete r.note.tie.start;
          if (nx && nx.note.tie) delete nx.note.tie.stop;
          changed = true;
        } else if (nx && samePitch(r.note, nx.note)) {
          r.note.tie = Object.assign({}, r.note.tie, { start: true });
          nx.note.tie = Object.assign({}, nx.note.tie, { stop: true });
          changed = true;
        }
        [r.note, nx && nx.note].forEach(function (x) { if (x && x.tie && !x.tie.start && !x.tie.stop) delete x.tie; });
      });
      return changed;
    },

    toggleArticulation: function (score, ids, name) {
      var notes = ids.map(function (id) { return findRef(score, id); }).filter(function (r) { return r && !r.note.rest; });
      var all = notes.length && notes.every(function (r) { return (r.note.artic || []).indexOf(name) >= 0; });
      notes.forEach(function (r) {
        var list = (r.note.artic || []).filter(function (a) { return a !== name; });
        if (!all) list.push(name);
        if (list.length) r.note.artic = list; else delete r.note.artic;
      });
      return notes.length > 0;
    },

    setDynamic: function (score, ids, dyn) {
      var notes = ids.map(function (id) { return findRef(score, id); }).filter(function (r) { return r && !r.note.rest; });
      var all = notes.length && notes.every(function (r) { return r.note.dyn === dyn; });
      notes.forEach(function (r) { if (all) delete r.note.dyn; else r.note.dyn = dyn; });
      return notes.length > 0;
    },

    toggleGhost: function (score, ids) {
      var notes = ids.map(function (id) { return findRef(score, id); }).filter(function (r) { return r && !r.note.rest; });
      var all = notes.length && notes.every(function (r) { return r.note.ghost; });
      notes.forEach(function (r) { if (all) delete r.note.ghost; else r.note.ghost = true; });
      return notes.length > 0;
    },

    /* Slur over the selected notes: from the first to the last. */
    toggleSlur: function (score, ids) {
      var notes = ids.map(function (id) { return findRef(score, id); }).filter(function (r) { return r && !r.note.rest; });
      if (notes.length < 2) return false;
      var first = notes[0].note;
      var last = notes[notes.length - 1].note;
      if (first.slur && first.slur.start) {
        delete first.slur;
        notes.forEach(function (r) { if (r.note.slur && r.note.slur.stop) delete r.note.slur; });
      } else {
        first.slur = { start: true };
        last.slur = { stop: true };
      }
      return true;
    },

    copyNotes: function (score, ids) {
      return ids.map(function (id) { return findRef(score, id); }).filter(Boolean).map(function (r) {
        var c = clone(r.note);
        delete c.id;
        delete c.tie;
        delete c.generated;
        delete c.slur;
        return c;
      });
    },

    pasteNotes: function (score, staff, measureIndex, noteIndex, clips) {
      var lastId = null;
      var mi = measureIndex;
      var ni = noteIndex;
      clips.forEach(function (clip) {
        var n = clone(clip);
        n.id = uid("n");
        n.staff = staff;
        BN.model.insertAt(score, staff, mi, ni, n);
        lastId = n.id;
        var cur = BN.model.cursorAfter(score, staff, n.id);
        if (cur) { mi = cur.measure; ni = cur.index; }
      });
      return lastId;
    },

    insertMeasure: function (score, after) {
      var part = partOf(score);
      var idx = Math.max(-1, Math.min(after, part.measures.length - 1));
      var cap = BN.music.measureTicks(timeOf(part, Math.max(0, idx)));
      var notes = [];
      for (var s = 1; s <= staffCount(score); s++) notes = notes.concat(fullRest(score, s, cap));
      part.measures.splice(idx + 1, 0, { number: idx + 2, notes: notes });
      cleanTies(score);
      return BN.model.normalize(score);
    },

    removeMeasure: function (score, index) {
      var part = partOf(score);
      if (!part.measures[index]) return score;
      var gone = part.measures[index];
      if (index === 0 && part.measures.length > 1) {
        part.measures[1].attributes = Object.assign({}, gone.attributes, part.measures[1].attributes);
      }
      part.measures.splice(index, 1);
      if (!part.measures.length) part.measures.push({ number: 1, attributes: gone.attributes, notes: [] });
      cleanTies(score);
      return BN.model.normalize(score);
    },

    setRepeat: function (score, measureIndex, kind) {
      var m = partOf(score).measures[measureIndex];
      if (!m) return score;
      if (kind === "forward") m.barline = Object.assign({ right: "regular" }, m.barline, { repeat: "forward" });
      else if (kind === "backward") m.barline = { right: "light-heavy", repeat: "backward" };
      return score;
    }
  });
})();
