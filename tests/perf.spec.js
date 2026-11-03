const { test, expect } = require("@playwright/test");
const { freshApp, newScore, tapStaff, getModel, written } = require("./helpers");

test("tap, undo, and a long page stay responsive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "tablet", "measured on the tablet project");
  await freshApp(page);
  await newScore(page);
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const samples = await page.evaluate(() => {
    const times = [];
    for (let i = 0; i < 20; i += 1) {
      const pos = i % 5;
      const pitch = BN.music.posToPitch("bass", pos, BN.model.keyOf(BN.state.current.parts[0], 0));
      const started = performance.now();
      BN.history.exec(BN.state.current, (score) => {
        BN.model.append(score, 1, BN.model.noteFromPalette({ type: "quarter", staff: 1 }, pitch));
      });
      BN.store.schedule(BN.state.current);
      BN.editor.redraw();
      times.push(performance.now() - started);
    }
    return times;
  });
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  expect(average).toBeLessThanOrEqual(100);
  await page.click("[data-action='undo']");
  expect(await page.evaluate(() => BN.history.lastMs)).toBeLessThanOrEqual(30);
  const load = await page.evaluate(() => {
    const score = BN.model.blank();
    for (let i = 0; i < 64 * 4; i += 1) {
      BN.model.append(score, 1, BN.model.noteFromPalette({ type: "quarter", staff: 1 }, { step: "G", alter: 0, octave: 2 }));
    }
    BN.state.current = score;
    const started = performance.now();
    BN.editor.redraw();
    return performance.now() - started;
  });
  expect(load).toBeLessThanOrEqual(1000);
});
