const { test, expect } = require("@playwright/test");
const { freshApp, newScore, tapStaff, getModel, written } = require("./helpers");

function undo(page) {
  return page.locator(".top [data-action='undo']");
}

function pitched(score) {
  return written(score).filter((note) => note.pitch);
}

async function selectFirst(page) {
  await page.click("[data-action='select']");
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: 0 });
}

test("undo button is labeled, at least 44px, and disabled when nothing can be undone", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  const button = undo(page);
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("title", "בטל");
  await expect(button).toHaveAttribute("aria-label", "בטל");
  await expect(button.locator(".undo-label")).toHaveText("בטל");
  await expect(button.locator(".undo-icon")).toBeVisible();
  await expect(button).toBeDisabled();
  await expect(page.locator("[data-hist='undo']")).toBeDisabled();
  const box = await button.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test("undo removes an added note and an added rest", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 2, slot: "end" });
  expect(pitched(await getModel(page))).toHaveLength(2);
  await expect(undo(page)).toBeEnabled();

  await page.keyboard.press("Control+z");
  expect(pitched(await getModel(page))).toHaveLength(1);
  await undo(page).click();
  expect(pitched(await getModel(page))).toHaveLength(0);
  await expect(undo(page)).toBeDisabled();

  await page.click("[data-action='rest']");
  await tapStaff(page, { staff: 1, measure: 0, pos: 3, slot: "end" });
  expect(written(await getModel(page)).some((note) => note.rest)).toBe(true);
  await page.locator("[data-hist='undo']").click();
  expect(written(await getModel(page)).filter((note) => !note.generated)).toHaveLength(0);
  await expect(undo(page)).toBeDisabled();
});

test("undo restores a deleted note", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  const before = pitched(await getModel(page))[0].pitch.step;
  await selectFirst(page);
  await page.click("[data-action='delete']");
  const afterDelete = written(await getModel(page));
  expect(afterDelete.length === 0 || afterDelete[0].rest).toBe(true);
  await undo(page).click();
  expect(pitched(await getModel(page))[0].pitch.step).toBe(before);
});

test("undo restores a pitch change", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  const before = pitched(await getModel(page))[0].pitch;
  await selectFirst(page);
  await page.keyboard.press("ArrowUp");
  const changed = pitched(await getModel(page))[0].pitch;
  expect(changed.step + changed.octave).not.toBe(before.step + before.octave);
  await undo(page).click();
  const restored = pitched(await getModel(page))[0].pitch;
  expect(restored.step).toBe(before.step);
  expect(restored.octave).toBe(before.octave);
  expect(pitched(await getModel(page))).toHaveLength(1);
});

test("undo restores a duration change and another score edit", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  await selectFirst(page);
  await page.click("[data-type='half']");
  expect(written(await getModel(page))[0].type).toBe("half");
  await undo(page).click();
  expect(written(await getModel(page))[0].type).toBe("quarter");
  expect(pitched(await getModel(page))).toHaveLength(1);

  await page.click("[data-chip='key']");
  await page.click("[data-keyname='G']");
  expect((await getModel(page)).parts[0].measures[0].attributes.key.fifths).toBe(1);
  await undo(page).click();
  expect((await getModel(page)).parts[0].measures[0].attributes.key.fifths).toBe(0);
  await expect(page.locator("[data-chip='key']")).toHaveText("C");
});
