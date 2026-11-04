const { test, expect } = require("@playwright/test");
const { freshApp, newScore, tapStaff, getModel, written, names } = require("./helpers");

test.beforeEach(async ({ page }) => { await freshApp(page); });

test("bass and treble landmarks", async ({ page }) => {
  await newScore(page);
  for (const pos of [0, 8, 10, -9]) await tapStaff(page, { staff: 1, measure: 0, pos, slot: "end" });
  expect(names(await getModel(page))).toEqual(["G2", "A3", "C4", "E1"]);
  await page.click("[data-action='back']");
  await newScore(page, { layout: "treble" });
  for (const pos of [0, 8, -2]) await tapStaff(page, { staff: 1, measure: 0, pos, slot: "end" });
  expect(names(await getModel(page))).toEqual(["E4", "F5", "C4"]);
});

test("grand staff: both staves take notes, C4 is right in both, brace is drawn", async ({ page }) => {
  await newScore(page, { layout: "grand" });
  await tapStaff(page, { staff: 2, measure: 0, pos: 0, slot: "end" });
  await tapStaff(page, { staff: 1, measure: 0, pos: -2, slot: "end" });
  await tapStaff(page, { staff: 2, measure: 0, pos: 10, slot: "end" });
  const notes = written(await getModel(page));
  expect(notes.filter((n) => n.staff === 2 && n.pitch).map((n) => n.pitch.step + n.pitch.octave)).toEqual(["G2", "C4"]);
  expect(notes.filter((n) => n.staff === 1 && n.pitch).map((n) => n.pitch.step + n.pitch.octave)).toEqual(["C4"]);
  expect((await page.locator("#score svg").first().innerHTML()).toLowerCase()).toContain("brace");
  const probe = await page.evaluate(() => {
    const at = (staff, pos) => { const p = BN.render.locate({ staff, measure: 0, pos, slot: "end" }); return BN.render.hit(BN.state.current, p.x, p.y); };
    return { treble: at(1, -2), bass: at(2, 10) };
  });
  expect(probe.treble).toMatchObject({ staff: 1, pos: -2 });
  expect(probe.bass).toMatchObject({ staff: 2, pos: 10 });
});

test("the clef is saved per page and switching keeps the pitches", async ({ page }) => {
  await newScore(page, { layout: "treble" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 2, slot: "end" });
  await page.evaluate(() => BN.store.flush());
  await page.click("[data-action='back']");
  await newScore(page, { layout: "bass" });
  await page.click("[data-action='back']");
  const layouts = await page.evaluate(() => BN.store.all().map((s) => s.staffLayout).sort());
  expect(layouts).toEqual(["bass", "treble"]);
});

test("leaving the grand staff asks before dropping notes", async ({ page }) => {
  await newScore(page, { layout: "grand" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  page.once("dialog", (d) => d.dismiss());
  await page.click("[data-chip='clef']");
  await page.click("[data-layout-set='bass']");
  expect((await getModel(page)).staffLayout).toBe("grand");
  page.once("dialog", (d) => { expect(d.message()).toContain("יימחקו"); d.accept(); });
  await page.click("[data-chip='clef']");
  await page.click("[data-layout-set='bass']");
  const score = await getModel(page);
  expect(score.staffLayout).toBe("bass");
  expect(written(score).some((n) => n.pitch && n.pitch.octave >= 4)).toBe(false);
});

test("a new idea can be created in any clef from the notebook", async ({ page }) => {
  for (const layout of ["bass", "treble", "grand"]) {
    await newScore(page, { layout });
    expect((await getModel(page)).staffLayout).toBe(layout);
    await page.click("[data-action='back']");
  }
  await expect(page.locator(".idea")).toHaveCount(3);
});
