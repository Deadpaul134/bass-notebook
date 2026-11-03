const { test, expect } = require("@playwright/test");
const { freshApp, newScore, tapStaff, getModel, written } = require("./helpers");

test("engraves notes, beams, key, time, and tempo", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  for (let i = 0; i < 4; i += 1) {
    await page.click("[data-type='eighth']");
    await tapStaff(page, { staff: 1, measure: 0, pos: i, slot: "end" });
  }
  const engraved = written(await getModel(page)).filter((note) => !note.rest).length;
  expect(engraved).toBe(4);
  await expect(page.locator(".vf-stavenote")).toHaveCount(engraved);
  expect(await page.locator("#score svg").first().locator("path, .vf-beam, g").count()).toBeGreaterThan(0);
  const beams = await page.evaluate(() => document.querySelectorAll("[class*='beam'], .vf-beam").length || document.querySelector("#score svg").innerHTML.includes("beam"));
  expect(beams).toBeTruthy();
  await expect(page.locator(".tempo-label")).toContainText("100");

  await page.click("[data-chip='key']");
  await page.click("[data-keyname='G']");
  await page.click("[data-chip='time']");
  await page.click("[data-time='6/8']");
  await page.click("[data-chip='barline']");
  await page.click("[data-bar='light-heavy']");
  const score = await getModel(page);
  expect(score.parts[0].measures[0].attributes.key.fifths).toBe(1);
  expect(BNTime(score)).toEqual({ beats: 6, beatType: 8 });
  expect(score.parts[0].measures.some((measure) => measure.barline && measure.barline.right === "light-heavy")).toBe(true);
  await page.evaluate(() => BN.store.flush());
  await page.reload();
  await page.waitForSelector("#score svg");
  const again = await getModel(page);
  expect(again.parts[0].measures[0].attributes.key.fifths).toBe(1);
  expect(again.tempo.bpm).toBe(100);
});

function BNTime(score) {
  return score.parts[0].measures[0].attributes.time;
}
