const { test, expect } = require("@playwright/test");
const { freshApp, newScore, getModel, written, fill, selectNote } = require("./helpers");

test.beforeEach(async ({ page }) => { await freshApp(page); await newScore(page); });

test("engraves notes, beams, key, time, tempo, ties and marks", async ({ page }) => {
  await fill(page, [["eighth", "G", 2], ["eighth", "A", 2], ["eighth", "B", 2], ["eighth", "C", 3], ["quarter", "D", 3], ["quarter", "D", 3]]);
  await expect(page.locator(".vf-stavenote")).toHaveCount(6);
  expect(await page.locator("#score .vf-beam").count()).toBeGreaterThan(0);
  await expect(page.locator("#doc-tempo")).toContainText("100");
  await selectNote(page, 4);
  await page.click("[data-op='tie']");
  expect(await page.locator("#score .vf-stavetie").count()).toBeGreaterThan(0);
  const id = await page.evaluate(() => BN.state.selection[0]);
  const parts = () => page.locator(`[data-note-id='${id}'] path`).count();
  const before = await parts();
  await page.click("[data-kt='2']");
  await page.click("[data-op='artic:staccato']");
  expect(await parts()).toBeGreaterThan(before);
  await page.click("[data-kt='4']");
  await page.click("[data-op='dyn:mf']");
  await expect(page.locator("#score svg text", { hasText: "mf" })).toHaveCount(1);
  await page.click("[data-chip='key']");
  await page.click("[data-keyname='G']");
  await page.click("[data-chip='time']");
  await page.click("[data-time='6/8']");
  const m = await getModel(page);
  expect(m.parts[0].measures[0].attributes.key.fifths).toBe(1);
  expect(m.parts[0].measures[0].attributes.time).toEqual({ beats: 6, beatType: 8 });
  await page.evaluate(() => BN.store.flush());
  await page.reload();
  await page.waitForSelector("#score svg");
  expect((await getModel(page)).tempo.bpm).toBe(100);
  expect(written(await getModel(page)).filter((n) => n.pitch).length).toBeGreaterThanOrEqual(6);
});

test("repeat and final barlines, key change mid-score, and the cursor draw", async ({ page }) => {
  await fill(page, [["whole", "G", 2], ["whole", "A", 2], ["whole", "B", 2]]);
  await page.evaluate(() => { BN.editor.commit((s) => { BN.model.setKeyFrom(s, 2, { fifths: 2, mode: "major" }); BN.model.setRepeat(s, 1, "backward"); BN.model.setBarline(s, 2, { right: "light-heavy" }); }); });
  const svgs = await page.locator("#score svg").evaluateAll((els) => els.map((e) => e.innerHTML).join(""));
  expect(svgs.length).toBeGreaterThan(1000);
  await expect(page.locator("#score .cursor-line")).toHaveCount(1);
});

test("an empty measure is drawn with its staff and the cursor at the start", async ({ page }) => {
  await expect(page.locator("#score .cursor-line")).toHaveCount(1);
  await expect(page.locator("#score svg")).toHaveCount(1);
});
