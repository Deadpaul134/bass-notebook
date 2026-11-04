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

test("v3 edits: duration fills rests, ties are cleaned, measures add and remove, paste", async ({ page }) => {
  await freshApp(page);
  const r = await page.evaluate(() => {
    const note = (type, step, octave) => BN.model.noteFromPalette({ type, staff: 1 }, { step, alter: 0, octave });
    const s = BN.model.blank();
    ["G", "A", "B", "C"].forEach((st, i) => BN.model.append(s, 1, note("quarter", st, i < 3 ? 2 : 3)));
    const ids = BN.model.refs(s, 1).map((x) => x.note.id);
    BN.model.setDuration(s, [ids[1]], "eighth", 0);
    const m0 = s.parts[0].measures[0].notes;
    const sum0 = m0.reduce((a, n) => a + n.duration, 0);
    const restAfter = m0[2].rest === true && m0[2].duration === 24;
    BN.model.setDuration(s, [ids[1]], "quarter", 0);
    const back = s.parts[0].measures[0].notes.map((n) => n.type + (n.rest ? "r" : ""));
    BN.model.stepNotes(s, [ids[0]], 2);
    const up = s.parts[0].measures[0].notes[0].pitch;
    BN.model.shiftAlter(s, [ids[0]], 1);
    const sharp = s.parts[0].measures[0].notes[0].pitch.alter;
    BN.model.shiftAlter(s, [ids[0]], 1);
    const capped = s.parts[0].measures[0].notes[0].pitch.alter;
    const before = s.parts[0].measures.length;
    BN.model.insertMeasure(s, 0);
    const afterInsert = s.parts[0].measures[1].notes.every((n) => n.rest);
    BN.model.removeMeasure(s, 1);
    const clips = BN.model.copyNotes(s, ids.slice(0, 2));
    BN.model.pasteNotes(s, 1, 0, 4, clips);
    const total = BN.model.refs(s, 1).length;
    const t = BN.model.blank();
    BN.model.append(t, 1, note("quarter", "C", 3));
    BN.model.append(t, 1, note("quarter", "D", 3));
    const tid = BN.model.refs(t, 1).map((x) => x.note.id);
    const tiedFail = BN.model.toggleTie(t, [tid[0]]);
    BN.model.append(t, 1, note("quarter", "D", 3));
    const tid2 = BN.model.refs(t, 1).map((x) => x.note.id);
    const tied = BN.model.toggleTie(t, [tid2[1]]);
    BN.model.stepNotes(t, [tid2[2]], 1);
    const dangling = BN.model.refs(t, 1).some((x) => x.note.tie);
    return { sum0, restAfter, back, up, sharp, capped, before, afterInsert, total, tiedFail, tied, dangling };
  });
  expect(r.sum0).toBe(192);
  expect(r.restAfter).toBe(true);
  expect(r.back).toEqual(["quarter", "quarter", "quarter", "quarter"]);
  expect(r.up).toMatchObject({ step: "B", octave: 2 });
  expect(r.sharp).toBe(1);
  expect(r.capped).toBe(1);
  expect(r.afterInsert).toBe(true);
  expect(r.total).toBe(6);
  expect(r.tiedFail).toBe(false);
  expect(r.tied).toBe(true);
  expect(r.dangling).toBe(false);
});

test("an empty score keeps its key and meter after a change", async ({ page }) => {
  await freshApp(page);
  const r = await page.evaluate(() => {
    const s = BN.model.blank();
    BN.model.setKeyFrom(s, 0, { fifths: 2, mode: "major" });
    BN.model.setTimeFrom(s, 0, { beats: 6, beatType: 8 });
    return s.parts[0].measures[0].attributes;
  });
  expect(r.key.fifths).toBe(2);
  expect(r.time).toEqual({ beats: 6, beatType: 8 });
});
