const { test, expect } = require("@playwright/test");
const { freshApp, newScore } = require("./helpers");

test("notebook search, sort, duplicate, delete with undo, and reload", async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => {
    const a = BN.model.blank({ title: "אלפא" });
    a.tags = ["גרוב"]; a.date = "2026-01-02"; a.updatedAt = "2026-01-02T00:00:00.000Z";
    const b = BN.model.blank({ title: "בטא" });
    b.comment = "לירי"; b.date = "2026-03-04"; b.updatedAt = "2026-03-04T00:00:00.000Z";
    BN.store.schedule(a); BN.store.schedule(b);
    return BN.store.flush();
  });
  await page.reload();
  await page.waitForSelector("#search");
  await page.fill("#search", "גרוב");
  await expect(page.locator(".idea-title")).toHaveText(["אלפא"]);
  await page.fill("#search", "");
  await page.selectOption("#sort", "name");
  await expect(page.locator(".idea")).toHaveCount(2);
  await page.locator(".more").first().click();
  await page.locator("[data-more='dup']").click();
  await expect(page.locator(".idea")).toHaveCount(3);
  await page.locator(".more").first().click();
  await page.locator("[data-more='del']").click();
  await expect(page.locator(".idea")).toHaveCount(2);
  await page.locator("[data-action='toast-undo']").click();
  await expect(page.locator(".idea")).toHaveCount(3);
  await newScore(page);
  await page.fill("#score-title", "נשמר");
  await page.evaluate(() => BN.store.flush());
  await page.reload();
  await page.waitForSelector("#score-title");
  await expect(page.locator("#score-title")).toHaveValue("נשמר");
});

test("search over 200 scores answers in under 100ms", async ({ page }) => {
  await freshApp(page);
  const ms = await page.evaluate(() => {
    const rows = [];
    for (let i = 0; i < 200; i += 1) rows.push({ id: "s" + i, title: "רעיון " + i, date: "2026-01-01", updatedAt: "2026-01-01", key: "C", tags: [], comment: "" });
    const t0 = performance.now();
    BN.list.sort(BN.list.filter(rows, "רעיון 19"), "name");
    return performance.now() - t0;
  });
  expect(ms).toBeLessThan(100);
});

test("autosave survives a reload without an explicit flush", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await page.locator('.wk[data-midi="43"]').click();
  await page.waitForTimeout(900);
  await page.reload();
  await page.waitForSelector("#score svg");
  expect(await page.evaluate(() => BN.model.refs(BN.state.current, 1).length)).toBe(1);
});
