const { test, expect } = require("@playwright/test");
const { freshApp } = require("./helpers");

test("playback plan, ties, instruments, cursor, and tempo", async ({ page }) => {
  await freshApp(page);
  const result = await page.evaluate(() => {
    function note(staff, step, octave, extra) {
      const made = BN.model.noteFromPalette(Object.assign({ type: "quarter", staff }, extra || {}), { step, alter: 0, octave });
      return made;
    }
    const bass = BN.model.blank({ staffLayout: "bass", bpm: 120 });
    const first = note(1, "C", 3, { tie: true });
    first.tie = { start: true };
    const second = note(1, "C", 3);
    second.tie = { stop: true };
    BN.model.append(bass, 1, first);
    BN.model.append(bass, 1, second);
    const tied = BN.playback.eventsFor(bass, { bpm: 120 });
    const fast = tied[0].dur;
    const slow = BN.playback.eventsFor(bass, { bpm: 60 })[0].dur;
    const treble = BN.model.blank({ staffLayout: "treble" });
    BN.model.append(treble, 1, note(1, "E", 4));
    const piano = BN.playback.eventsFor(treble)[0].instrument;
    const grand = BN.model.blank({ staffLayout: "grand" });
    BN.model.append(grand, 1, note(1, "C", 4));
    BN.model.append(grand, 2, note(2, "G", 2));
    const both = BN.playback.eventsFor(grand).map((event) => event.instrument).sort();
    BN.playback.clock = { t: 0, now() { return this.t; } };
    BN.state.current = bass;
    BN.playback.play(bass, { bpm: 120 });
    BN.playback.clock.t = tied[0].t + 0.05;
    const sounding = BN.playback.step();
    const firstId = BN.state.playingId;
    BN.playback.clock.t = tied[0].t + tied[0].dur * 0.75;
    BN.playback.step();
    const laterId = BN.state.playingId;
    BN.playback.setTempo(bass, 60);
    const retimed = BN.playback.step();
    BN.playback.stop();
    BN.playback.clock = null;
    return {
      count: tied.length,
      ticks: tied[0].durTicks,
      instrument: tied[0].instrument,
      ratio: slow / fast,
      piano,
      both,
      firstId,
      laterId,
      ids: tied[0].noteIds,
      retimed: !!(retimed || sounding)
    };
  });
  expect(result.count).toBe(1);
  expect(result.ticks).toBe(96);
  expect(result.instrument).toBe("bass");
  expect(result.ratio).toBeCloseTo(2, 1);
  expect(result.piano).toBe("piano");
  expect(result.both).toEqual(["bass", "piano"]);
  expect(result.ids).toContain(result.firstId);
  expect(result.ids).toContain(result.laterId);
  expect(result.firstId).not.toBe(result.laterId);
  expect(result.retimed).toBe(true);
});
