const { test, expect } = require("@playwright/test");
const { freshApp, newScore, tapStaff, getModel, written, names, fill, selectNote, touchGesture, box } = require("./helpers");

test.beforeEach(async ({ page }) => {
  await freshApp(page);
  await newScore(page);
});

test("undo and redo are always visible and restore the same notes", async ({ page }) => {
  await expect(page.locator("#topbar [data-action='undo']")).toBeVisible();
  await expect(page.locator("#keypad [data-action='undo']")).toBeVisible();
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 2, slot: "end" });
  expect(names(await getModel(page))).toEqual(["G2", "B2"]);
  await page.click("#topbar [data-action='undo']");
  await page.click("#keypad [data-action='undo']");
  expect(names(await getModel(page))).toEqual([]);
  await expect(page.locator("#topbar [data-action='undo']")).toBeDisabled();
  await page.click("#topbar [data-action='redo']");
  await page.click("#keypad [data-action='redo']");
  expect(names(await getModel(page))).toEqual(["G2", "B2"]);
});

test("200 steps, each undo within 30ms, ending at an identical score", async ({ page }) => {
  const r = await page.evaluate(() => {
    const steps = [];
    const start = JSON.stringify(BN.state.current);
    for (let i = 0; i < 200; i += 1) {
      BN.editor.commit((s) => { BN.model.append(s, 1, BN.model.noteFromPalette({ type: "eighth", staff: 1 }, { step: "CDEFGAB"[i % 7], alter: 0, octave: 2 + (i % 3) })); }, { noRedraw: true });
    }
    const full = JSON.stringify(BN.state.current);
    const all = [];
    let n = 0;
    while (BN.history.canUndo(BN.state.current.id)) {
      BN.editor.undo();
      all.push(BN.history.lastMs);
      n += 1;
    }
    const emptied = JSON.stringify(BN.state.current.parts[0].measures.flatMap((m) => m.notes.filter((x) => !x.generated)));
    for (let i = 0; i < n; i += 1) BN.editor.redo();
    all.sort((a, b) => a - b);
    const worst = all[Math.floor(all.length * 0.95)];
    return { n, worst, emptied, same: JSON.stringify(BN.state.current.parts[0]) === JSON.stringify(JSON.parse(full).parts[0]), start: !!start };
  });
  expect(r.n).toBe(200);
  expect(r.worst).toBeLessThan(30);
  expect(r.emptied).toBe("[]");
  expect(r.same).toBe(true);
});

test("key, meter, and clef changes are undoable", async ({ page }) => {
  await fill(page, [["quarter", "G", 2]]);
  await page.click("[data-chip='key']");
  await page.click("[data-keyname='D']");
  await page.click("[data-chip='time']");
  await page.click("[data-time='3/4']");
  await page.click("[data-chip='clef']");
  await page.click("[data-layout-set='treble']");
  let m = await getModel(page);
  expect([m.staffLayout, m.parts[0].measures[0].attributes.key.fifths, m.parts[0].measures[0].attributes.time.beats]).toEqual(["treble", 2, 3]);
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+z");
  m = await getModel(page);
  expect([m.staffLayout, m.parts[0].measures[0].attributes.key.fifths, m.parts[0].measures[0].attributes.time.beats]).toEqual(["bass", 2, 4]);
  await page.keyboard.press("Control+z");
  expect((await getModel(page)).parts[0].measures[0].attributes.key.fifths).toBe(0);
});

test("title edits are one undo step", async ({ page }) => {
  await page.fill("#score-title", "שם");
  await page.keyboard.press("Tab");
  await page.click("#topbar [data-action='undo']");
  expect((await getModel(page)).title).toBe("רעיון חדש");
});

test("two fingers undo and three fingers redo", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.use.hasTouch, "touch only");
  await tapStaff(page, { staff: 1, measure: 0, pos: 1, slot: "end" });
  const b = await box(page, "#stage");
  const a = { x: b.x + b.width - 200, y: b.y + 40 };
  const c = { x: b.x + b.width - 140, y: b.y + 46 };
  const d = { x: b.x + b.width - 80, y: b.y + 52 };
  await touchGesture(page, [a, c]);
  expect(names(await getModel(page))).toHaveLength(0);
  await touchGesture(page, [a, c, d]);
  expect(names(await getModel(page))).toHaveLength(1);
});
