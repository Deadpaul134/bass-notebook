const { test, expect } = require("@playwright/test");
const { freshApp, newPage, tapStaff, drawStroke, model } = require("./helpers");

test("mixed undo and redo restores note, stroke, note", async ({ page }) => {
  await freshApp(page);
  await newPage(page);
  await tapStaff(page, 0, 0, 2, 0);
  await page.click("[data-mode='pen']");
  const pts = await page.evaluate(() => {
    return [200, 280, 360].map((x, i) => BN.render.logicalToClient(x, 500 + i * 20));
  });
  await drawStroke(page, pts, { pointerType: "pen" });
  await page.click("[data-mode='tap']");
  await tapStaff(page, 0, 0, 4, 1);
  let data = await model(page);
  const events = () => data.systems[0].staves[0].measures.reduce((n, m) => n + m.events.length, 0);
  expect(events()).toBe(2);
  expect(data.strokes).toHaveLength(1);
  for (let i = 0; i < 3; i++) await page.click("[data-action='undo']");
  data = await model(page);
  expect(data.systems[0].staves[0].measures.reduce((n, m) => n + m.events.length, 0)).toBe(0);
  expect(data.strokes).toHaveLength(0);
  for (let i = 0; i < 3; i++) await page.click("[data-action='redo']");
  data = await model(page);
  expect(data.systems[0].staves[0].measures.reduce((n, m) => n + m.events.length, 0)).toBe(2);
  expect(data.strokes).toHaveLength(1);
});
