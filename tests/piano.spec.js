const { test, expect } = require("@playwright/test");
const { freshApp, newScore, getModel, written, names, fill, selectNote } = require("./helpers");

test.beforeEach(async ({ page }) => {
  await freshApp(page);
  await newScore(page);
});

test("a key enters exactly that pitch, white and black", async ({ page }) => {
  const keys = [43, 45, 46, 48, 49];
  for (const midi of keys) await page.locator(`.wk[data-midi="${midi}"], .bk[data-midi="${midi}"]`).first().click();
  expect(names(await getModel(page))).toEqual(["G2", "A2", "A#2", "C3", "C#3"]);
});

test("black keys follow the key signature", async ({ page }) => {
  await page.evaluate(() => { BN.editor.commit((s) => BN.model.setKeyFrom(s, 0, { fifths: -1, mode: "major" })); });
  await page.locator('.bk[data-midi="46"]').click();
  expect(names(await getModel(page))).toEqual(["Bb2"]);
});

test("with a note selected a key replaces its pitch", async ({ page }) => {
  await fill(page, [["quarter", "G", 2], ["quarter", "A", 2]]);
  await selectNote(page, 1);
  await page.locator('.wk[data-midi="50"]').click();
  expect(names(await getModel(page))).toEqual(["G2", "D3"]);
  await expect(page.locator('.wk[data-midi="50"]')).toHaveClass(/hit/);
});

test("the piano collapses, remembers it, and shows the range", async ({ page }) => {
  await expect(page.locator("#piano-handle")).toContainText("C1–C4");
  await page.click("#piano-handle");
  await expect(page.locator("#piano-keys")).toBeHidden();
  await page.reload();
  await page.waitForSelector("#score svg");
  await expect(page.locator("#piano-keys")).toBeHidden();
  await page.click("#piano-handle");
  await expect(page.locator("#piano-keys")).toBeVisible();
});

test("treble staff shows C4–C6", async ({ page }) => {
  await page.click("[data-action='back']");
  await newScore(page, { layout: "treble" });
  await expect(page.locator("#piano-handle")).toContainText("C4–C6");
  await page.locator('.wk[data-midi="64"]').click();
  expect(names(await getModel(page))).toEqual(["E4"]);
});
