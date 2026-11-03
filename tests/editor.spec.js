const { test, expect } = require("@playwright/test");
const { freshApp, newScore, tapStaff, getModel, written, dragNote } = require("./helpers");

test("palette places duration, rest, dot, tie, and accidental", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await page.click("[data-type='half']");
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  await page.click("[data-type='quarter']");
  await page.click("[data-action='dots']");
  await tapStaff(page, { staff: 1, measure: 0, pos: 2, slot: "end" });
  await page.click("[data-action='tie']");
  await tapStaff(page, { staff: 1, measure: 0, pos: 4, slot: "end" });
  await page.click("[data-acc='sharp']");
  await tapStaff(page, { staff: 1, measure: 0, pos: 1, slot: "end" });
  await page.click("[data-action='rest']");
  await tapStaff(page, { staff: 1, measure: 0, pos: 3, slot: "end" });
  const notes = written(await getModel(page));
  expect(notes[0].type).toBe("half");
  expect(notes[1].dots).toBe(1);
  expect(notes.some((note) => note.tie && note.tie.start)).toBe(true);
  expect(notes.some((note) => note.accidental === "sharp" && note.pitch.alter === 1)).toBe(true);
  expect(notes.some((note) => note.rest)).toBe(true);
});

test("tap appends, replaces, and inserts", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 2, slot: "end" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 4, slot: "before:1" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 6, slot: 0 });
  const notes = written(await getModel(page)).filter((note) => note.pitch);
  const steps = notes.map((note) => note.pitch.step);
  expect(steps[0]).toBe("F");
  expect(steps[1]).toBe("D");
  expect(steps[2]).toBe("B");
});

test("ghost note, drag, selection, and keyboard", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  const pt = await page.evaluate(() => BN.render.locate({ staff: 1, measure: 0, pos: 2, slot: "end" }));
  await page.mouse.move(pt.x, pt.y);
  await page.mouse.down();
  await expect(page.locator("#ghost")).toBeVisible();
  await expect(page.locator("#ghost")).toContainText("B2");
  await page.mouse.up();
  const first = written(await getModel(page)).filter((note) => note.pitch)[0];
  await dragNote(page, first.id, 2);
  const dragged = written(await getModel(page)).filter((note) => note.pitch)[0];
  expect(dragged.pitch.step).not.toBe(first.pitch.step);
  await page.click("[data-action='undo']");
  expect(written(await getModel(page)).filter((note) => note.pitch)[0].pitch.step).toBe(first.pitch.step);

  await page.click("[data-action='select']");
  await tapStaff(page, { staff: 1, measure: 0, pos: 2, slot: 0 });
  await page.keyboard.press("ArrowUp");
  const raised = written(await getModel(page)).filter((note) => note.pitch)[0];
  expect(BNPitch(raised)).not.toBe(BNPitch(first));
  await page.keyboard.press("2");
  expect(written(await getModel(page))[0].type).toBe("half");
  await page.keyboard.press("Backspace");
  const after = written(await getModel(page));
  expect(after.length === 0 || after[0].rest).toBe(true);
});

function BNPitch(note) {
  return note.pitch.step + note.pitch.octave;
}
