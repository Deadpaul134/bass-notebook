const { test, expect } = require("@playwright/test");
const { freshApp } = require("./helpers");

function sums(score) {
  return score.parts[0].measures.map((measure) => measure.notes.reduce((sum, note) => sum + note.duration, 0));
}

test("normalize splits ties and follows the time signature", async ({ page }) => {
  await freshApp(page);
  const result = await page.evaluate(() => {
    const score = BN.model.blank();
    BN.model.append(score, 1, BN.model.noteFromPalette({ type: "half", dots: 1, staff: 1 }, { step: "C", alter: 0, octave: 3 }));
    BN.model.append(score, 1, BN.model.noteFromPalette({ type: "half", staff: 1 }, { step: "D", alter: 0, octave: 3 }));
    const four = score.parts[0].measures.map((measure) => measure.notes.reduce((sum, note) => sum + note.duration, 0));
    const tied = score.parts[0].measures.some((measure) => measure.notes.some((note) => note.tie && note.tie.start && note.tie.stop !== true || (note.tie && note.tie.start)));
    const ids = score.parts[0].measures.flatMap((measure) => measure.notes.map((note) => note.id));
    BN.model.setTimeFrom(score, 0, { beats: 3, beatType: 4 });
    const threeCap = BN.music.measureTicks({ beats: 3, beatType: 4 });
    const three = score.parts[0].measures.map((measure) => measure.notes.reduce((sum, note) => sum + note.duration, 0));
    BN.model.setTimeFrom(score, 0, { beats: 6, beatType: 8 });
    const sixCap = BN.music.measureTicks(BN.model.timeOf(score.parts[0], 0));
    const q = BN.model.noteFromPalette({ type: "quarter", staff: 1 }, { step: "E", alter: 0, octave: 2 });
    const fresh = BN.model.blank();
    BN.model.append(fresh, 1, BN.model.noteFromPalette({ type: "quarter", staff: 1 }, { step: "G", alter: 0, octave: 2 }));
    BN.model.append(fresh, 1, BN.model.noteFromPalette({ type: "quarter", staff: 1 }, { step: "A", alter: 0, octave: 2 }));
    const inserted = BN.model.noteFromPalette({ type: "quarter", staff: 1 }, { step: "B", alter: 0, octave: 2 });
    BN.model.insertAt(fresh, 1, 0, 1, inserted);
    const steps = fresh.parts[0].measures[0].notes.filter((note) => !note.generated && note.pitch).map((note) => note.pitch.step);
    const victim = fresh.parts[0].measures[0].notes.filter((note) => !note.generated)[1];
    BN.model.deleteNote(fresh, victim.id, "rest");
    const afterDelete = fresh.parts[0].measures[0].notes.filter((note) => !note.generated).map((note) => !!note.rest);
    return { four, tied, unique: new Set(ids).size === ids.length, three, threeCap, sixCap, steps, afterDelete, q: q.duration };
  });
  expect(result.four[0]).toBe(192);
  expect(result.four[result.four.length - 1]).toBe(0);
  expect(result.tied).toBe(true);
  expect(result.unique).toBe(true);
  expect(result.three[0]).toBe(result.threeCap);
  expect(result.three[result.three.length - 1]).toBe(0);
  expect(result.sixCap).toBe(144);
  expect(result.steps[0]).toBe("G");
  expect(result.steps[1]).toBe("B");
  expect(result.afterDelete[1]).toBe(true);
});
