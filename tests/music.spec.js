const { test, expect } = require("@playwright/test");
const { freshApp } = require("./helpers");

test("pitch round-trip, keys, and accidentals", async ({ page }) => {
  await freshApp(page);
  const result = await page.evaluate(() => {
    const bad = [];
    for (let pos = -10; pos <= 18; pos += 1) {
      ["bass", "treble"].forEach((clef) => {
        const pitch = BN.music.posToPitch(clef, pos, { fifths: 0, mode: "major" });
        if (BN.music.pitchToPos(clef, pitch) !== pos) bad.push(clef + ":" + pos);
      });
    }
    const marks = {
      g2: BN.music.posToPitch("bass", 0, { fifths: 0, mode: "major" }),
      a3: BN.music.posToPitch("bass", 8, { fifths: 0, mode: "major" }),
      c4bass: BN.music.posToPitch("bass", 10, { fifths: 0, mode: "major" }),
      e1: BN.music.posToPitch("bass", -9, { fifths: 0, mode: "major" }),
      e4: BN.music.posToPitch("treble", 0, { fifths: 0, mode: "major" }),
      f5: BN.music.posToPitch("treble", 8, { fifths: 0, mode: "major" }),
      c4treble: BN.music.posToPitch("treble", -2, { fifths: 0, mode: "major" })
    };
    const sharpF = BN.music.posToPitch("bass", -1, { fifths: 1, mode: "major" });
    const notes = [
      { rest: false, pitch: { step: "F", alter: 0, octave: 2 } }
    ];
    const natural = BN.music.displayAccidental(notes, 0, { fifths: 1, mode: "major" });
    const names = BN.music.MAJOR.map((row) => BN.music.vfKey({ fifths: row[0], mode: "major" }));
    return { bad, marks, sharpF, natural, names, c4: BN.music.pitchToMidi(marks.c4bass) };
  });
  expect(result.bad).toEqual([]);
  expect(result.marks.g2).toMatchObject({ step: "G", octave: 2 });
  expect(result.marks.a3).toMatchObject({ step: "A", octave: 3 });
  expect(result.marks.c4bass).toMatchObject({ step: "C", octave: 4 });
  expect(result.marks.e1).toMatchObject({ step: "E", octave: 1 });
  expect(result.marks.e4).toMatchObject({ step: "E", octave: 4 });
  expect(result.marks.f5).toMatchObject({ step: "F", octave: 5 });
  expect(result.marks.c4treble).toMatchObject({ step: "C", octave: 4 });
  expect(result.c4).toBe(60);
  expect(result.sharpF.alter).toBe(1);
  expect(result.natural).toBe("natural");
  expect(result.names).toContain("C");
  expect(result.names).toContain("F#");
  expect(result.names).toHaveLength(15);
});
