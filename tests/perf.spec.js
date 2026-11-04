const { test, expect } = require("@playwright/test");
const { freshApp, newScore } = require("./helpers");

test("entry, undo, and a long page stay responsive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "tablet", "measured on the tablet project");
  await freshApp(page);
  await newScore(page);
  const client = await page.context().newCDPSession(page);
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const times = await page.evaluate(() => {
    const out = [];
    for (let i = 0; i < 20; i += 1) {
      const t0 = performance.now();
      BN.editor.enterPitch({ step: "CDEFGAB"[i % 7], alter: 0, octave: 2 }, { staff: 1 });
      out.push(performance.now() - t0);
    }
    return out;
  });
  expect(times.reduce((a, b) => a + b, 0) / times.length).toBeLessThanOrEqual(100);
  await page.click("#topbar [data-action='undo']");
  expect(await page.evaluate(() => BN.history.lastMs)).toBeLessThanOrEqual(30);
  const load = await page.evaluate(() => {
    const s = BN.model.blank();
    for (let i = 0; i < 64 * 4; i += 1) BN.model.append(s, 1, BN.model.noteFromPalette({ type: "quarter", staff: 1 }, { step: "G", alter: 0, octave: 2 }));
    BN.state.current = s;
    const t0 = performance.now();
    BN.editor.redraw();
    return performance.now() - t0;
  });
  expect(load).toBeLessThanOrEqual(1000);
});
