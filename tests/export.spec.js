const { test, expect } = require("@playwright/test");
const { freshApp, newPage, tapStaff, drawStroke } = require("./helpers");
const fs = require("fs");

test("png download is at least 2000px wide and not empty", async ({ page }) => {
  await freshApp(page);
  await newPage(page);
  await page.fill("#page-title", "ייצוא");
  await tapStaff(page, 0, 0, 2, 0);
  await page.click("[data-mode='pen']");
  const pts = await page.evaluate(() => [220, 300, 380].map((x) => BN.render.logicalToClient(x, 480)));
  await drawStroke(page, pts, { pointerType: "pen" });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("[data-action='export-png']")
  ]);
  const file = await download.path();
  const buf = fs.readFileSync(file);
  expect(buf.readUInt32BE(16)).toBeGreaterThanOrEqual(2000);
  expect(buf.readUInt32BE(20)).toBeGreaterThan(400);
  expect(buf.length).toBeGreaterThan(8000);
});
