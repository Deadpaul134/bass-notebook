const { test, expect } = require("@playwright/test");
const { freshApp, newScore, tapStaff, getModel, written, touchGesture } = require("./helpers");

test("undo and redo restore the same notes", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 2, slot: "end" });
  const pitched = () => getModel(page).then((score) => written(score).filter((note) => note.pitch).map((note) => note.pitch.step));
  expect(await pitched()).toEqual(["G", "B"]);
  await page.click("[data-action='undo']");
  await page.click("[data-action='undo']");
  expect(await pitched()).toEqual([]);
  await expect(page.locator("[data-action='undo']")).toBeDisabled();
  await page.click("[data-action='redo']");
  await page.click("[data-action='redo']");
  expect(await pitched()).toEqual(["G", "B"]);
  const ms = await page.evaluate(() => BN.history.lastMs);
  expect(ms).toBeLessThan(30);
});

test("two fingers undo and three fingers redo", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await tapStaff(page, { staff: 1, measure: 0, pos: 1, slot: "end" });
  const box = await page.locator("#stage").boundingBox();
  const a = { x: box.x + 30, y: box.y + 40 };
  const b = { x: box.x + 90, y: box.y + 48 };
  const c = { x: box.x + 140, y: box.y + 56 };
  await touchGesture(page, [a, b]);
  expect(written(await getModel(page)).filter((note) => note.pitch)).toHaveLength(0);
  await touchGesture(page, [a, b, c]);
  expect(written(await getModel(page)).filter((note) => note.pitch)).toHaveLength(1);
});
