/* Look-ahead playback. Sampled piano (Salamander Grand, CC BY 3.0); synth fallback if samples fail. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var timer = 0;
  var playing = false;
  var audio = null;
  var limiter = null;
  var startedAt = 0;
  var bpm = 100;
  var planCache = [];
  var cursorId = null;
  var lastArgs = null;
  var DYN = { pp: 0.45, p: 0.65, mp: 0.85, mf: 1, f: 1.25, ff: 1.5 };

  function now() {
    if (BN.playback && BN.playback.clock) return BN.playback.clock.now();
    return audio ? audio.currentTime : performance.now() / 1000;
  }

  function ensure() {
    if (BN.playback && BN.playback.clock) return null;
    if (BN.data && BN.data.settings && !BN.data.settings().playback) return null;
    if (audio) return audio;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audio = new AC();
    limiter = audio.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    limiter.connect(audio.destination);
    loadSamples();
    return audio;
  }

  var NAMES = ["A0", "C1", "Ds1", "Fs1", "A1", "C2", "Ds2", "Fs2", "A2", "C3", "Ds3", "Fs3", "A3", "C4", "Ds4", "Fs4", "A4", "C5", "Ds5", "Fs5", "A5", "C6", "Ds6", "Fs6", "A6", "C7"];
  var SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var samples = [];
  var sampleState = { loaded: false, failed: false, count: 0, promise: null };

  function nameToMidi(name) {
    var m = /^([A-G])(s?)(\d)$/.exec(name);
    return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] ? 1 : 0);
  }

  function loadSamples() {
    if (sampleState.promise) return sampleState.promise;
    var ctx = audio;
    if (!ctx || !window.fetch) return Promise.resolve(false);
    sampleState.promise = Promise.all(NAMES.map(function (name) {
      return fetch("assets/piano/" + name + ".mp3").then(function (res) {
        if (!res.ok) throw new Error(name + " " + res.status);
        return res.arrayBuffer();
      }).then(function (data) {
        return new Promise(function (ok, bad) {
          var p = ctx.decodeAudioData(data, ok, bad);
          if (p && p.catch) p.catch(bad);
        });
      }).then(function (buffer) {
        return { midi: nameToMidi(name), buffer: buffer };
      });
    })).then(function (list) {
      samples = list.sort(function (a, b) { return a.midi - b.midi; });
      sampleState.count = samples.length;
      sampleState.loaded = true;
      return true;
    }).catch(function () {
      samples = [];
      sampleState.failed = true;
      return false;
    });
    return sampleState.promise;
  }

  function nearest(midi) {
    var best = null;
    samples.forEach(function (s) {
      if (!best || Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
    });
    return best;
  }

  function sampled(ctx, when, midi, dur, gain) {
    var s = nearest(midi);
    var src = ctx.createBufferSource();
    src.buffer = s.buffer;
    src.playbackRate.value = Math.pow(2, (midi - s.midi) / 12);
    var vol = BN.data && BN.data.settings ? BN.data.settings().volume : 0.8;
    var loud = Math.max(0.0001, 0.9 * (gain || 1) * (vol == null ? 0.8 : vol));
    var end = when + Math.max(0.08, dur);
    var release = 0.4;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(loud, when + 0.005);
    g.gain.setTargetAtTime(loud * 0.55, when + 0.02, 1.5);
    g.gain.setValueAtTime(loud * (0.55 + 0.45 * Math.exp(-(end - when - 0.02) / 1.5)), end);
    g.gain.setTargetAtTime(0, end, release / 4);
    src.connect(g);
    g.connect(limiter || ctx.destination);
    src.start(when);
    src.stop(end + release + 0.1);
  }

  function secPerTick(score, rate) {
    return (60 / rate) / score.divisions;
  }

  function clefSign(score, staff) {
    var part = score.parts[0];
    var clefs = BN.model.clefsOf(part, 0, score);
    var found = clefs.filter(function (c) { return c.staff === staff; })[0] || clefs[0];
    return found && found.sign === "G" ? "G" : "F";
  }

  function instrument(score, staff) {
    if (score.staffSounds && score.staffSounds[staff]) return score.staffSounds[staff];
    return clefSign(score, staff) === "G" ? "piano" : "bass";
  }

  function eventsFor(score, opts) {
    opts = opts || {};
    var rate = opts.bpm || (score.tempo && score.tempo.bpm) || 100;
    var from = opts.fromTick || 0;
    var spt = secPerTick(score, rate);
    var part = score.parts[0];
    var out = [];
    for (var staff = 1; staff <= BN.model.staffCount(score); staff++) {
      var tick = 0;
      var pending = null;
      part.measures.forEach(function (measure) {
        measure.notes.forEach(function (note) {
          if (note.staff !== staff) return;
          var start = tick;
          var durTicks = note.duration;
          tick += note.duration;
          if (note.rest || note.generated) {
            pending = null;
            return;
          }
          if (note.tie && note.tie.stop && pending) {
            pending.durTicks += durTicks;
            pending.noteIds.push(note.id);
            pending.spans.push({ id: note.id, ticks: durTicks });
            pending.untilTick = start + durTicks;
            if (!(note.tie && note.tie.start)) pending = null;
            return;
          }
          var ev = {
            t: Math.max(0, (start - from) * spt),
            tick: start,
            durTicks: durTicks,
            untilTick: start + durTicks,
            midi: BN.music.pitchToMidi(note.pitch),
            staff: staff,
            instrument: instrument(score, staff),
            gain: DYN[note.dyn] || 1,
            shorten: note.ghost ? 0.25 : (note.artic || []).indexOf("staccato") >= 0 ? 0.5 : (note.artic || []).indexOf("tenuto") >= 0 ? 1 : 0.92,
            noteIds: [note.id],
            spans: [{ id: note.id, ticks: durTicks }]
          };
          if (start + durTicks > from) out.push(ev);
          pending = note.tie && note.tie.start ? ev : null;
        });
      });
    }
    out.forEach(function (ev) { ev.dur = ev.durTicks * spt; });
    out.sort(function (a, b) { return a.t - b.t || a.staff - b.staff; });
    return out;
  }

  function cursorFor(ev, elapsed) {
    if (!ev) return null;
    var into = Math.max(0, elapsed - ev.t);
    var ticks = ev.dur ? (into / ev.dur) * ev.durTicks : 0;
    var acc = 0;
    var id = ev.noteIds[0];
    (ev.spans || []).forEach(function (span) {
      if (ticks + 0.001 >= acc) id = span.id;
      acc += span.ticks;
    });
    return id;
  }

  function envGain(ctx, time, dur, peak, gain) {
    var g = ctx.createGain();
    var vol = BN.data && BN.data.settings ? BN.data.settings().volume : 0.8;
    var loud = Math.max(0.0001, peak * (gain || 1) * (vol == null ? 0.8 : vol));
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(loud, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.08, dur));
    return g;
  }

  function voice(ctx, when, midi, dur, kind, gain) {
    if (samples.length) return sampled(ctx, when, midi, dur, gain);
    synth(ctx, when, midi, dur, kind, gain);
  }

  function synth(ctx, when, midi, dur, kind, gain) {
    var freq = BN.music.midiToFreq(midi);
    var filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(kind === "bass" ? 700 : 1800, when);
    var env = envGain(ctx, when, dur, kind === "bass" ? 0.22 : 0.16, gain);
    filter.connect(env);
    env.connect(limiter || ctx.destination);
    var osc = ctx.createOscillator();
    osc.type = kind === "bass" ? "sawtooth" : "triangle";
    osc.frequency.value = freq;
    osc.connect(filter);
    var sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = kind === "bass" ? freq / 2 : freq;
    sub.connect(filter);
    osc.start(when);
    sub.start(when);
    var stop = when + dur + 0.06;
    osc.stop(stop);
    sub.stop(stop);
  }

  function click(ctx, when, accent) {
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = accent ? 1400 : 900;
    g.gain.setValueAtTime(accent ? 0.08 : 0.04, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.04);
    osc.connect(g);
    g.connect(limiter || ctx.destination);
    osc.start(when);
    osc.stop(when + 0.05);
  }

  function noteAt(events, elapsed) {
    var current = null;
    events.forEach(function (ev) {
      if (elapsed + 0.02 >= ev.t && elapsed < ev.t + ev.dur) current = ev;
    });
    return current;
  }

  function endTime() {
    var end = 0;
    planCache.forEach(function (ev) { end = Math.max(end, ev.t + ev.dur); });
    return end;
  }

  function follow() {
    if (!playing) return;
    var elapsed = now() - startedAt;
    var ev = noteAt(planCache, elapsed);
    var id = cursorFor(ev, elapsed);
    if (id !== cursorId) {
      cursorId = id;
      BN.state.playingId = id;
      if (BN.editor && BN.editor.onPlayhead) BN.editor.onPlayhead(id);
    }
    if (planCache.length && elapsed > endTime() + 0.2) {
      var again = BN.state.loop && lastArgs;
      BN.playback.stop();
      if (again) BN.playback.play(lastArgs.score, lastArgs.opts);
      return;
    }
    if (!(BN.playback && BN.playback.clock)) timer = requestAnimationFrame(follow);
  }

  function schedule(fromTime) {
    var ctx = audio;
    if (!ctx) return;
    var horizon = ctx.currentTime + 0.12;
    planCache.forEach(function (ev) {
      var when = startedAt + ev.t;
      if (ev._done) return;
      if (when < fromTime) return;
      if (when > horizon) return;
      ev._done = true;
      voice(ctx, when, ev.midi, ev.dur * (ev.shorten || 1), ev.instrument, ev.gain);
    });
    var set = BN.data && BN.data.settings ? BN.data.settings() : {};
    var beatSec = BN.playback._beatSec || 0.6;
    var perBar = BN.playback._beats || 4;
    var count = BN.playback._bar || 0;
    var end = endTime();
    if (beatSec && (set.metronome || count > 0)) {
      for (var i = 0; i * beatSec <= end + 0.001; i++) {
        var tBeat = startedAt + i * beatSec;
        if (tBeat < fromTime || tBeat > horizon) continue;
        if (BN.playback._clicked[i]) continue;
        if (!set.metronome && i * beatSec >= count - 0.001) continue;
        BN.playback._clicked[i] = true;
        click(ctx, tBeat, i % perBar === 0);
      }
    }
  }

  BN.playback = {
    clock: null,
    eventsFor: eventsFor,
    samples: sampleState,
    loadSamples: function () {
      ensure();
      return loadSamples();
    },
    instrument: instrument,
    noteAt: noteAt,
    cursorFor: cursorFor,
    preview: function (midi, staff, score) {
      var ctx = ensure();
      if (!ctx || midi == null) return;
      if (ctx.state === "suspended") ctx.resume();
      var kind = score ? instrument(score, staff || 1) : "bass";
      voice(ctx, ctx.currentTime + 0.02, midi, 0.3, kind);
    },
    play: function (score, opts) {
      opts = opts || {};
      bpm = opts.bpm || (score.tempo.bpm || 100) * (BN.state.rate || 1);
      planCache = eventsFor(score, { bpm: bpm, fromTick: opts.fromTick || 0 });
      var count = 0;
      var beats = 4;
      if (!opts.fromTick && BN.data && BN.data.settings && BN.data.settings().countIn) {
        var time = BN.model.timeOf(score.parts[0], 0);
        beats = time.beats;
        count = BN.music.measureTicks(time) * secPerTick(score, bpm);
        planCache.forEach(function (ev) { ev.t += count; });
      }
      BN.playback._bar = count;
      BN.playback._beats = beats;
      BN.playback._beatSec = 60 / bpm;
      lastArgs = { score: score, opts: { bpm: opts.bpm, fromTick: opts.fromTick } };
      BN.playback._clicked = {};
      planCache.forEach(function (ev) { ev._done = false; });
      playing = true;
      BN.state.playing = true;
      if (BN.playback.clock) {
        startedAt = BN.playback.clock.now();
        return;
      }
      var ctx = ensure();
      startedAt = ctx ? ctx.currentTime + 0.05 : performance.now() / 1000;
      if (ctx && ctx.state === "suspended") ctx.resume();
      schedule(0);
      var pump = function () {
        if (!playing || !audio) return;
        schedule(audio.currentTime);
        setTimeout(pump, 25);
      };
      if (ctx) pump();
      follow();
    },
    step: function () {
      if (!playing) return null;
      var elapsed = now() - startedAt;
      var ev = noteAt(planCache, elapsed);
      var id = cursorFor(ev, elapsed);
      cursorId = id;
      BN.state.playingId = id;
      if (BN.editor && BN.editor.onPlayhead && !BN.playback.clock) BN.editor.onPlayhead(id);
      return ev;
    },
    pause: function () {
      playing = false;
      BN.state.playing = false;
      cancelAnimationFrame(timer);
    },
    stop: function () {
      BN.playback.pause();
      cursorId = null;
      BN.state.playingId = null;
      if (BN.editor && BN.editor.onPlayhead) BN.editor.onPlayhead(null);
    },
    setTempo: function (score, next) {
      var elapsed = now() - startedAt;
      var doneTick = elapsed / secPerTick(score, bpm);
      bpm = next;
      var spt = secPerTick(score, next);
      var future = eventsFor(score, { bpm: next, fromTick: 0 }).filter(function (ev) {
        return ev.tick + ev.durTicks > doneTick - 0.01;
      });
      future.forEach(function (ev) {
        ev.t = ev.tick * spt - doneTick * spt + elapsed;
        ev._done = false;
      });
      planCache = future;
      if (audio) schedule(audio.currentTime);
    },
    isPlaying: function () { return playing; }
  };
})();
