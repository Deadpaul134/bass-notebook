const { test, expect } = require("@playwright/test");
const { uncover, freshApp, newScore, getModel, written, names, fill, selectNote, clickNote, noteId, box } = require("./helpers");

test.beforeEach(async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await fill(page, [["quarter", "G", 2], ["quarter", "A", 2], ["quarter", "B", 2], ["quarter", "C", 3], ["quarter", "D", 3], ["quarter", "E", 3]]);
});

test("selecting a note shows the bar within 100ms, inside the screen", async ({ page }) => {
  await expect(page.locator("#ctx")).toBeHidden();
  const id = await noteId(page, 1);
  const ms = await page.evaluate((nid) => {
    const t0 = performance.now();
    BN.editor.select([nid]);
    return performance.now() - t0 + (document.getElementById("ctx").hidden ? 9999 : 0);
  }, id);
  expect(ms).toBeLessThan(100);
  await expect(page.locator("#cb-label")).toHaveText("A2 · רבע");
  const b = await box(page, "#ctx");
  const vp = page.viewportSize();
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(vp.width);
  expect(b.y).toBeGreaterThanOrEqual(0);
});

test("arrows and accidentals change the pitch and the label", async ({ page }) => {
  await selectNote(page, 1);
  await page.click("[data-cb='up']");
  await expect(page.locator("#cb-label")).toHaveText("B2 · רבע");
  await page.click("[data-cb='down']");
  await page.click("[data-cb='down']");
  expect(names(await getModel(page))[1]).toBe("G2");
  await page.click("[data-cb='sharp']");
  await expect(page.locator("#cb-label")).toContainText("G♯2");
  await page.click("[data-cb='flat']");
  await page.click("[data-cb='flat']");
  expect(names(await getModel(page))[1]).toBe("Gb2");
});

test("duration and dot change the length and keep the measure whole", async ({ page }) => {
  await selectNote(page, 1);
  await page.click("[data-cb='dur']");
  let m = await getModel(page);
  expect(written(m)[1].type).toBe("eighth");
  await page.click("[data-cb='dot']");
  m = await getModel(page);
  expect(written(m)[1]).toMatchObject({ type: "eighth", dots: 1 });
  m.parts[0].measures.slice(0, 1).forEach((measure) => {
    expect(measure.notes.reduce((s, n) => s + n.duration, 0)).toBe(192);
  });
});

test("delete leaves a rest, shows a toast, and undo brings the note back", async ({ page }) => {
  await selectNote(page, 1);
  await page.click("[data-cb='del']");
  expect(written(await getModel(page))[1].rest).toBe(true);
  await expect(page.locator(".toast")).toContainText("נמחק");
  await expect(page.locator("#ctx")).toBeHidden();
  await page.click("[data-action='toast-undo']");
  expect(names(await getModel(page))).toContain("A2");
  expect(written(await getModel(page))[1].rest).toBeFalsy();
});

test("Backspace deletes the selection", async ({ page }) => {
  await selectNote(page, 2);
  await page.keyboard.press("Backspace");
  expect(written(await getModel(page))[2].rest).toBe(true);
});

test("a measure can be selected, then the whole row, with actions on the range", async ({ page }) => {
  await page.evaluate(() => { BN.data.saveSettings({ tapInput: false }); });
  const pt = await page.evaluate(() => BN.render.locate({ measure: 0, staff: 1, pos: 4, slot: 0 }));
  await page.mouse.click(pt.x + 40, pt.y);
  expect((await page.evaluate(() => BN.state.selMeasures))).toEqual([0]);
  await expect(page.locator("#cb-label")).toContainText("4 תווים");
  await page.click("[data-cb='up']");
  expect(names(await getModel(page)).slice(0, 4)).toEqual(["A2", "B2", "C3", "D3"]);
  await page.click("[data-cb='dur']");
  expect(written(await getModel(page)).slice(0, 4).every((n) => n.type === "eighth")).toBe(true);
  await page.mouse.click(pt.x + 40, pt.y);
  await page.evaluate(() => BN.editor.selectRow(0));
  expect((await page.evaluate(() => BN.state.selMeasures)).length).toBeGreaterThanOrEqual(1);
  await page.click("[data-cb='del']");
  expect(written(await getModel(page)).every((n) => n.rest)).toBe(true);
});

test("long press and drag selects a range (lasso)", async ({ page }) => {
  const a = await page.evaluate((id) => BN.render.noteRect(id), await noteId(page, 0));
  const b = await page.evaluate((id) => BN.render.noteRect(id), await noteId(page, 2));
  await uncover(page, a.cx, a.cy);
  await page.mouse.move(a.cx, a.cy);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.move(b.cx, b.cy, { steps: 6 });
  await page.mouse.up();
  expect((await page.evaluate(() => BN.state.selection)).length).toBe(3);
  await expect(page.locator("#cb-label")).toHaveText("3 תווים");
});

test("long press on a second note extends the selection", async ({ page }) => {
  await selectNote(page, 0);
  const b = await page.evaluate((id) => BN.render.noteRect(id), await noteId(page, 3));
  await uncover(page, b.cx, b.cy);
  await page.mouse.move(b.cx, b.cy);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.up();
  expect((await page.evaluate(() => BN.state.selection)).length).toBe(4);
});

test("Escape and a tap on empty paper clear the selection", async ({ page }) => {
  await selectNote(page, 1);
  await page.keyboard.press("Escape");
  await expect(page.locator("#ctx")).toBeHidden();
  await selectNote(page, 1);
  const p = await box(page, "#doc-title");
  await page.mouse.click(p.x - 120 < 0 ? 40 : p.x - 120, p.y + 4);
  await expect(page.locator("#ctx")).toBeHidden();
});
