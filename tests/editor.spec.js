const { test, expect } = require("@playwright/test");
const { freshApp, newScore, tapStaff, getModel, written, names, fill, selectNote, locate, noteId } = require("./helpers");

test.beforeEach(async ({ page }) => {
  await freshApp(page);
  await newScore(page);
});

test("a new idea opens in bass, 4/4, C major, 100 bpm, with today's date", async ({ page }) => {
  const s = await getModel(page);
  const d = new Date();
  const ymd = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  expect(s.staffLayout).toBe("bass");
  expect(s.tempo.bpm).toBe(100);
  expect(s.date).toBe(ymd);
  expect(s.parts[0].measures[0].attributes.time).toEqual({ beats: 4, beatType: 4 });
  expect(s.parts[0].measures[0].attributes.key).toMatchObject({ fifths: 0, mode: "major" });
});

test("tapping the staff enters the pitch under the tap, ≤100ms", async ({ page }) => {
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 8, slot: "end" });
  await tapStaff(page, { staff: 1, measure: 0, pos: -9, slot: "end" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 10, slot: "end" });
  expect(names(await getModel(page))).toEqual(["G2", "A3", "E1", "C4"]);
  const pt = await locate(page, { staff: 1, measure: 1, pos: 3, slot: "end" });
  const ms = await page.evaluate(async ({ x, y }) => {
    const t0 = performance.now();
    const el = document.elementFromPoint(x, y);
    const opt = { clientX: x, clientY: y, pointerId: 41, pointerType: "mouse", button: 0, bubbles: true, isPrimary: true };
    el.dispatchEvent(new PointerEvent("pointerdown", opt));
    el.dispatchEvent(new PointerEvent("pointerup", opt));
    return performance.now() - t0;
  }, pt);
  expect(ms).toBeLessThan(100);
  expect(names(await getModel(page))).toHaveLength(5);
});

test("the ghost with a label shows while the finger is down on the staff", async ({ page }) => {
  const pt = await locate(page, { staff: 1, measure: 0, pos: 1, slot: "end" });
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await expect(page.locator("#ghost")).toBeVisible();
  await expect(page.locator("#ghost")).toHaveAttribute("data-label", "A2");
  await page.mouse.up();
  await expect(page.locator("#ghost")).toBeHidden();
});

test("tapping between notes inserts; tap mode off places the cursor instead", async ({ page }) => {
  await fill(page, [["quarter", "G", 2], ["quarter", "A", 2], ["quarter", "B", 2]]);
  await tapStaff(page, { staff: 1, measure: 0, pos: 4, slot: "before:1" });
  expect(names(await getModel(page))).toEqual(["G2", "D3", "A2", "B2"]);
  await page.evaluate(() => BN.data.saveSettings({ tapInput: false }));
  await tapStaff(page, { staff: 1, measure: 0, pos: 4, slot: "before:2" });
  expect(names(await getModel(page))).toHaveLength(4);
  expect(await page.evaluate(() => BN.state.cursor)).toMatchObject({ measure: 0, index: 2 });
  await page.locator('.wk[data-midi="43"]').click();
  expect(names(await getModel(page))).toEqual(["G2", "D3", "G2", "A2", "B2"]);
});

test("a note crossing the barline is split and tied; measure sums stay whole", async ({ page }) => {
  await fill(page, [["half", "G", 2], ["quarter", "A", 2]]);
  await page.click("[data-dur='half']");
  await page.click("[data-op='dot']");
  await page.locator('.wk[data-midi="47"]').click();
  const m = await getModel(page);
  const first = m.parts[0].measures[0];
  expect(first.notes.reduce((s, n) => s + n.duration, 0)).toBe(192);
  expect(m.parts[0].measures[1].notes[0].tie).toMatchObject({ stop: true });
  expect(first.notes[first.notes.length - 1].tie).toMatchObject({ start: true });
  await expect(page.locator(".vf-stavenote")).toHaveCount(written(m).length);
});

test("rests, dots, ties and accidentals through the Keypad", async ({ page }) => {
  await page.locator('.wk[data-midi="43"]').click();
  await page.click("[data-dur='eighth']");
  await page.click("[data-op='rest']");
  await page.click("[data-op='dot']");
  await page.click("[data-dur='quarter']");
  await page.click("[data-op='tie']");
  await page.locator('.wk[data-midi="43"]').click();
  const w = written(await getModel(page));
  expect(w[1]).toMatchObject({ rest: true, type: "eighth" });
  expect(w[2]).toMatchObject({ type: "quarter", dots: 1 });
});

test("two notes at the same pitch can be tied from the selection", async ({ page }) => {
  await fill(page, [["quarter", "G", 2], ["quarter", "G", 2]]);
  await selectNote(page, 0);
  await page.click("[data-op='tie']");
  let w = written(await getModel(page));
  expect(w[0].tie).toMatchObject({ start: true });
  expect(w[1].tie).toMatchObject({ stop: true });
  await expect(page.locator("#score svg path.vf-stavetie, #score svg .vf-stavetie").first()).toBeAttached();
  await page.click("[data-op='tie']");
  w = written(await getModel(page));
  expect(w[0].tie).toBeUndefined();
});

test("keyboard: letters, durations, arrows, undo, copy and paste", async ({ page }) => {
  await page.keyboard.press("4");
  await page.keyboard.press("g");
  await page.keyboard.press("a");
  expect(written(await getModel(page)).map((n) => n.type)).toEqual(["eighth", "eighth"]);
  await selectNote(page, 1);
  await page.keyboard.press("ArrowUp");
  expect(names(await getModel(page))[1]).toBe("B3");
  await page.keyboard.press("Control+c");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+v");
  expect(names(await getModel(page))).toHaveLength(3);
  await page.keyboard.press("Control+z");
  expect(names(await getModel(page))).toHaveLength(2);
  await page.keyboard.press("Control+Shift+z");
  expect(names(await getModel(page))).toHaveLength(3);
});

test("ribbon: measures tab adds and removes a measure, key and meter from here, barlines", async ({ page }) => {
  await fill(page, [["whole", "G", 2], ["whole", "A", 2], ["whole", "B", 2]]);
  await page.click("[data-tab='measures']");
  await page.evaluate(() => BN.editor.selectMeasures(1, 1));
  await page.click("[data-rb='add-measure']");
  let m = await getModel(page);
  expect(m.parts[0].measures.filter((x) => x.notes.some((n) => !n.generated)).length).toBe(4);
  expect(m.parts[0].measures[2].notes[0].rest).toBe(true);
  await page.evaluate(() => BN.editor.selectMeasures(2, 2));
  await page.click("[data-rb='del-measure']");
  m = await getModel(page);
  expect(names(m)).toEqual(["G2", "A2", "B2"]);
  await page.click("[data-chip='key-from']");
  await page.click("[data-keyname='G']");
  m = await getModel(page);
  expect(m.parts[0].measures[2].attributes.key.fifths).toBe(1);
  await page.evaluate(() => BN.editor.selectMeasures(0, 0));
  await page.click("[data-bar='light-light']");
  await page.click("[data-bar='forward']");
  m = await getModel(page);
  expect(m.parts[0].measures[0].barline).toMatchObject({ right: "light-light", repeat: "forward" });
});

test("ribbon: clef, key, meter, tempo, zoom, and the input mode chip", async ({ page }) => {
  await page.click("[data-chip='key']");
  await page.click("[data-keyname='G']");
  await page.click("[data-chip='time']");
  await page.click("[data-time='6/8']");
  await page.click("[data-chip='tempo']");
  await page.fill("#bpm-input", "120");
  await page.click("[data-action='bpm-set']");
  let m = await getModel(page);
  expect(m.parts[0].measures[0].attributes.key.fifths).toBe(1);
  expect(m.parts[0].measures[0].attributes.time).toEqual({ beats: 6, beatType: 8 });
  expect(m.tempo.bpm).toBe(120);
  await expect(page.locator("[data-chip='key']")).toContainText("G מז'ור");
  await page.click("[data-chip='zoom']");
  await page.click("[data-zoom='0.1']");
  await expect(page.locator("[data-chip='zoom']")).toContainText("110%");
  await page.keyboard.press("Escape");
  await page.mouse.click(5, 5);
  await page.click("[data-chip='input']");
  await page.click("[data-input='pad']");
  expect(await page.evaluate(() => BN.data.settings().tapInput)).toBe(false);
  await expect(page.locator("[data-chip='input']")).toContainText("לוח בלבד");
  await page.evaluate(() => BN.store.flush());
  await page.reload();
  await page.waitForSelector("#score svg");
  m = await getModel(page);
  expect(m.parts[0].measures[0].attributes.key.fifths).toBe(1);
});

test("text tab edits the title and composer on the page; marks tab applies marks", async ({ page }) => {
  await page.click("[data-tab='text']");
  await page.fill("#rb-title", "כותרת חדשה");
  await page.fill("#rb-composer", "מלחין");
  await expect(page.locator("#doc-title")).toHaveText("כותרת חדשה");
  await expect(page.locator("#doc-composer")).toHaveText("מלחין");
  await fill(page, [["quarter", "G", 2]]);
  await selectNote(page, 0);
  await page.click("[data-tab='marks']");
  await page.click("[data-mark='artic:accent']");
  await page.click("[data-mark='dyn:ff']");
  const n = written(await getModel(page))[0];
  expect(n.artic).toEqual(["accent"]);
  expect(n.dyn).toBe("ff");
});

test("slur needs two notes; both slur and ghost note render", async ({ page }) => {
  await fill(page, [["quarter", "G", 2], ["quarter", "A", 2], ["quarter", "B", 2]]);
  await page.evaluate(async () => {
    const ids = BN.model.refs(BN.state.current, 1).map((r) => r.note.id);
    BN.editor.select(ids.slice(0, 2));
  });
  await page.click("[data-kt='3']");
  await page.click("[data-op='slur']");
  const w = written(await getModel(page));
  expect(w[0].slur).toEqual({ start: true });
  expect(w[1].slur).toEqual({ stop: true });
  await page.click("[data-op='ghost']");
  expect(written(await getModel(page))[0].ghost).toBe(true);
});

test("pinch-free zoom keeps notes; zoom changes the staff size", async ({ page }) => {
  await fill(page, [["quarter", "G", 2]]);
  const before = await page.evaluate(() => BN.render.stepPx(0, 1));
  await page.evaluate(() => BN.editor.setZoom(1.5));
  const after = await page.evaluate(() => BN.render.stepPx(0, 1));
  expect(after / before).toBeGreaterThan(1.3);
});

test("a measure is selected in pad mode, then a double tap selects the row", async ({ page }) => {
  await page.evaluate(() => BN.data.saveSettings({ tapInput: false }));
  await fill(page, [["quarter", "G", 2]]);
  const pt = await locate(page, { staff: 1, measure: 1, pos: 4, slot: 0 });
  await page.mouse.dblclick(pt.x, pt.y);
  const sel = await page.evaluate(() => BN.state.selMeasures);
  expect(sel.length).toBeGreaterThan(1);
});
