const { test, expect } = require("@playwright/test");
const { freshApp, newPage, drawStroke, model } = require("./helpers");

async function strokePoints(page) {
  return page.evaluate(() => {
    const layout = BN.render.layout;
    const a = BN.render.logicalToClient(200, 400);
    const b = BN.render.logicalToClient(360, 460);
    const c = BN.render.logicalToClient(520, 420);
    return [a, b, c].map((p, i) => ({ x: p.x, y: p.y, p: 0.2 + i * 0.3 }));
  });
}

test("pen stroke, palm rejection, eraser, color and size", async ({ page }) => {
  await freshApp(page);
  await newPage(page);
  await page.click("[data-mode='pen']");
  await page.click("[data-color='accent']");
  await page.click("[data-size='8']");
  let pts = await strokePoints(page);
  await drawStroke(page, pts, { pointerType: "pen" });
  let data = await model(page);
  expect(data.strokes).toHaveLength(1);
  expect(data.strokes[0].tool).toBe("pen");
  expect(data.strokes[0].color).toBe("accent");
  expect(data.strokes[0].size).toBe(8);
  expect(data.strokes[0].points.length).toBeGreaterThan(1);
  const penOnly = await page.evaluate(() => BN.data.settings().penOnly);
  expect(penOnly).toBe(true);

  const touch = await strokePoints(page);
  touch.forEach((p) => { p.x += 30; p.y += 40; });
  await drawStroke(page, touch, { pointerType: "touch" });
  data = await model(page);
  expect(data.strokes).toHaveLength(1);

  await page.click("[data-tool='eraser']");
  pts = await strokePoints(page);
  await drawStroke(page, pts, { pointerType: "pen" });
  data = await model(page);
  expect(data.strokes).toHaveLength(0);

  await page.click("[data-tool='highlighter']");
  await page.click("[data-color='green']");
  await page.click("[data-size='12']");
  const hi = (await strokePoints(page)).map((p) => ({ x: p.x + 24, y: p.y + 36, p: 0.4 }));
  await drawStroke(page, hi, { pointerType: "pen" });
  data = await model(page);
  expect(data.strokes).toHaveLength(1);
  expect(data.strokes[0].tool).toBe("highlighter");
  expect(data.strokes[0].color).toBe("green");
  expect(data.strokes[0].size).toBe(12);
});
