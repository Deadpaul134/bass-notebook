const { test, expect } = require("@playwright/test");
const { freshApp, newPage } = require("./helpers");

test("reload, merge, replace, and corrupt backup", async ({ page }) => {
  await freshApp(page);
  await newPage(page);
  await page.fill("#page-title", "נשמר");
  await page.evaluate(() => {
    const pageData = BN.app.getPage();
    pageData.notes = "הערה לשמירה";
    BN.store.schedule(pageData);
  });
  await page.evaluate(() => BN.store.flush());
  const id = await page.evaluate(() => BN.app.getPage().id);
  await page.reload();
  await page.waitForSelector("#page-title");
  await expect(page.locator("#page-title")).toHaveValue("נשמר");

  const exported = await page.evaluate(() => BN.export.toJSON());
  await page.fill("#page-title", "חדש יותר");
  await page.evaluate(() => BN.store.flush());
  await page.evaluate(async (pack) => {
    const older = JSON.parse(JSON.stringify(pack));
    older.pages[0].title = "ישן";
    older.pages[0].updatedAt = "2000-01-01T00:00:00.000Z";
    older.pages.push({
      id: "p_extra",
      v: 1,
      title: "מהגיבוי",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      date: "2026-01-01",
      tempo: null,
      key: "C",
      time: "4/4",
      clef: "bass",
      tags: [],
      notes: "",
      systems: BN.data.blankPage().systems,
      strokes: []
    });
    await BN.export.importData(older, "merge");
  }, exported);
  let titles = await page.evaluate(() => BN.store.all().map((p) => p.title).sort());
  expect(titles).toContain("חדש יותר");
  expect(titles).toContain("מהגיבוי");
  expect(titles).not.toContain("ישן");

  await page.evaluate(async (pack) => {
    await BN.export.importData(pack, "replace");
  }, exported);
  const after = await page.evaluate(() => BN.export.toJSON());
  expect(after.pages).toEqual(exported.pages);

  await page.click("[data-action='back']");
  await page.waitForSelector("[data-screen='list']");
  await page.goto("/?nosw=1#settings");
  await page.waitForSelector("#restore-file");
  const before = await page.evaluate(() => BN.store.all().map((p) => p.id));
  await page.setInputFiles("#restore-file", {
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{ not json")
  });
  await expect(page.locator("#restore-msg")).toContainText("פגום");
  const still = await page.evaluate(() => BN.store.all().map((p) => p.id));
  expect(still).toEqual(before);

  await page.setInputFiles("#restore-file", {
    name: "ok.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported))
  });
  await expect(page.locator("#restore-msg")).toContainText("נמצאו");
  await page.click("[data-restore='replace']");
  await page.click("[data-action='confirm-replace']");
  await expect.poll(async () => page.evaluate(() => BN.store.all().length)).toBe(exported.pages.length);
  const ids = await page.evaluate(() => BN.store.all().map((p) => p.id));
  expect(ids).toContain(id);
});
