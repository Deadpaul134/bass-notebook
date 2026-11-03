const { test, expect } = require("@playwright/test");
const { freshApp, newScore, tapStaff, getModel, written } = require("./helpers");

test("a new idea opens in bass, 4/4, C, tempo 100", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  const score = await getModel(page);
  const today = new Date();
  const ymd = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  expect(score.staffLayout).toBe("bass");
  expect(score.tempo.bpm).toBe(100);
  expect(score.date).toBe(ymd);
  expect(score.parts[0].measures[0].attributes.time).toEqual({ beats: 4, beatType: 4 });
  expect(score.parts[0].measures[0].attributes.key).toMatchObject({ fifths: 0, mode: "major" });
  expect(await page.evaluate(() => BN.render.stepPx(0, 1))).toBeGreaterThanOrEqual(12);
});

test("bass and treble landmarks, and grand keeps both staves", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 8, slot: "end" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 10, slot: "end" });
  await tapStaff(page, { staff: 1, measure: 0, pos: -9, slot: "end" });
  let pitches = written(await getModel(page)).map((note) => note.pitch.step + note.pitch.octave);
  expect(pitches).toEqual(["G2", "A3", "C4", "E1"]);

  await page.click("[data-action='back']");
  await newScore(page, { layout: "treble" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  await tapStaff(page, { staff: 1, measure: 0, pos: -2, slot: "end" });
  pitches = written(await getModel(page)).map((note) => note.pitch.step + note.pitch.octave);
  expect(pitches).toEqual(["E4", "C4"]);

  await page.click("[data-action='back']");
  await newScore(page, { layout: "grand" });
  await tapStaff(page, { staff: 2, measure: 0, pos: 0, slot: "end" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 4, slot: "end" });
  const notes = written(await getModel(page));
  expect(notes.some((note) => note.staff === 2 && note.pitch.step === "G" && note.pitch.octave === 2)).toBe(true);
  expect(notes.some((note) => note.staff === 1 && note.pitch.octave >= 4)).toBe(true);
  const mapped = await page.evaluate(() => {
    function probe(staff, pos) {
      const point = BN.render.locate({ staff: staff, measure: 0, pos: pos, slot: "end" });
      return BN.render.hit(BN.state.current, point.x, point.y);
    }
    return { treble: probe(1, -2), bass: probe(2, 10) };
  });
  expect(mapped.treble).toMatchObject({ staff: 1, pos: -2 });
  expect(mapped.bass).toMatchObject({ staff: 2, pos: 10 });
  const svg = await page.locator("#score svg").first().innerHTML();
  expect(svg.toLowerCase()).toContain("brace");
});

test("leaving the grand staff asks before dropping notes", async ({ page }) => {
  await freshApp(page);
  await newScore(page, { layout: "grand" });
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.click("[data-chip='clef']");
  await page.click("[data-set-layout='bass']");
  expect((await getModel(page)).staffLayout).toBe("grand");
  page.once("dialog", (dialog) => {
    expect(dialog.message()).toContain("יימחקו");
    dialog.accept();
  });
  await page.click("[data-chip='clef']");
  await page.click("[data-set-layout='bass']");
  const score = await getModel(page);
  expect(score.staffLayout).toBe("bass");
  expect(written(score).some((note) => note.staff === 1 && note.pitch && note.pitch.octave >= 4)).toBe(false);
});
