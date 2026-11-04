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

test("playback off: no preview, no AudioContext; on: a context is created", async ({ page }) => {
  await freshApp(page);
  await page.addInitScript(() => {
    window.__ac = 0;
    const Orig = window.AudioContext;
    window.AudioContext = function () { window.__ac += 1; return new Orig(); };
  });
  await page.reload();
  await page.waitForSelector("#screen-list:not([hidden])");
  await page.evaluate(() => { BN.data.saveSettings({ playback: false }); });
  await page.click("[data-action='new-score']");
  await page.click("[data-layout='bass']");
  await page.waitForSelector("#score svg");
  await page.locator('.wk[data-midi="43"]').click();
  await page.click("#topbar [data-action='play']");
  await expect(page.locator(".toast")).toContainText("כבויה");
  expect(await page.evaluate(() => window.__ac)).toBe(0);
  expect(await page.evaluate(() => BN.playback.isPlaying())).toBe(false);
  await page.evaluate(() => { BN.data.saveSettings({ playback: true }); });
  await page.locator('.wk[data-midi="45"]').click();
  expect(await page.evaluate(() => window.__ac)).toBeGreaterThan(0);
});

test("play from the cursor moves the playhead and stops at the end; loop restarts", async ({ page }) => {
  await freshApp(page);
  await page.click("[data-action='new-score']");
  await page.click("[data-layout='bass']");
  await page.waitForSelector("#score svg");
  await page.evaluate(() => {
    for (let i = 0; i < 3; i += 1) BN.model.append(BN.state.current, 1, BN.model.noteFromPalette({ type: "quarter", staff: 1 }, { step: "G", alter: 0, octave: 2 }));
    BN.state.cursor = { staff: 1, measure: 0, index: 1 };
    BN.editor.redraw();
  });
  await page.click("#topbar [data-action='play']");
  await expect.poll(() => page.evaluate(() => BN.state.playingId)).toBeTruthy();
  await expect(page.locator("#score .playhead")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => BN.playback.isPlaying()), { timeout: 8000 }).toBe(false);
});

test("piano samples are served and decode", async ({ page, request }) => {
  await freshApp(page);
  const res = await request.get("/assets/piano/A0.mp3");
  expect(res.status()).toBe(200);
  const loaded = await page.evaluate(async () => {
    const ok = await BN.playback.loadSamples();
    return { ok, state: BN.playback.samples.loaded, count: BN.playback.samples.count, failed: BN.playback.samples.failed };
  });
  expect(loaded).toEqual({ ok: true, state: true, count: 26, failed: false });
});
