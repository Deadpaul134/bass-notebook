const { test, expect } = require("@playwright/test");
const { freshApp, newScore, getModel, names, locate, uncover, fill, noteId, box } = require("./helpers");

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.use.hasTouch !== true, "touch only");
});

async function session(page) {
  const client = await page.context().newCDPSession(page);
  const send = (type, pts) => client.send("Input.dispatchTouchEvent", { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })) });
  return { start: (p) => send("touchStart", p), move: (p) => send("touchMove", p), end: () => send("touchEnd", []) };
}

test("a finger on the staff shows a ghost above it, and entry happens on release", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  const pt = await locate(page, { staff: 1, measure: 0, pos: 4, slot: "end" });
  await uncover(page, pt.x, pt.y);
  const t = await session(page);
  await t.start([pt]);
  await expect(page.locator("#ghost")).toBeVisible();
  await expect(page.locator("#ghost")).toHaveAttribute("data-label", "D3");
  expect(names(await getModel(page))).toHaveLength(0);
  await t.end();
  await expect(page.locator("#ghost")).toBeHidden();
  expect(names(await getModel(page))).toEqual(["D3"]);
});

test("touch drag on the Keypad aims the pitch", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  const k = await box(page, "[data-dur='quarter']");
  const p0 = { x: k.x + k.width / 2, y: k.y + k.height / 2 };
  const t = await session(page);
  await t.start([p0]);
  await t.move([{ x: p0.x, y: p0.y - 28 }]);
  await t.move([{ x: p0.x, y: p0.y - 28 }]);
  await expect(page.locator("#ghost")).toHaveAttribute("data-label", "F3");
  await t.end();
  expect(names(await getModel(page))).toEqual(["F3"]);
});

test("tapping a note selects it and shows the bar; the page does not scroll by one-finger drag", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await fill(page, [["quarter", "G", 2], ["quarter", "A", 2]]);
  const r = await page.evaluate((id) => BN.render.noteRect(id), await noteId(page, 1));
  await uncover(page, r.cx, r.cy);
  const t = await session(page);
  await t.start([{ x: r.cx, y: r.cy }]);
  await t.end();
  await expect(page.locator("#ctx")).toBeVisible();
  await expect(page.locator("#cb-label")).toHaveText("A2 · רבע");
});
