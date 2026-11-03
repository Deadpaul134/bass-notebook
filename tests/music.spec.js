const { test, expect } = require("@playwright/test");
const { freshApp } = require("./helpers");

test("pitch round-trip, C4, measure fill, key accidentals", async ({ page }) => {
  await freshApp(page);
  const result = await page.evaluate(() => {
    const m = BN.music;
    const problems = [];
    ["bass", "treble"].forEach((clef) => {
      for (let pos = -10; pos <= 18; pos++) {
        const pitch = m.posToPitch(clef, pos);
        const back = m.pitchToPos(clef, pitch);
        if (back !== pos) problems.push(clef + " " + pos + " -> " + JSON.stringify(pitch) + " -> " + back);
      }
    });
    return {
      problems,
      bassBottom: m.posToPitch("bass", 0),
      bassA2: m.posToPitch("bass", 1),
      bassTop: m.posToPitch("bass", 8),
      bassC4: m.posToPitch("bass", 10),
      bassE1: m.posToPitch("bass", -9),
      trebleBottom: m.posToPitch("treble", 0),
      trebleTop: m.posToPitch("treble", 8),
      trebleC4: m.posToPitch("treble", -2),
      g: m.keyAccidentals("G"),
      em: m.keyAccidentals("Em"),
      c: m.keyAccidentals("C"),
      am: m.keyAccidentals("Am"),
      bb: m.keyAccidentals("Bb"),
      under: m.measureFill({ events: [{ dur: "q", dots: 0 }] }, "4/4"),
      full: m.measureFill({ events: [{ dur: "q" }, { dur: "q" }, { dur: "q" }, { dur: "q" }] }, "4/4"),
      over: m.measureFill({ events: [{ dur: "q" }, { dur: "q" }, { dur: "q" }, { dur: "q" }, { dur: "q" }] }, "4/4"),
      six: m.measureFill({ events: [{ dur: "q" }, { dur: "q" }, { dur: "q" }] }, "6/8"),
      dotted: m.measureFill({ events: [{ dur: "h", dots: 1 }, { dur: "q", dots: 0 }] }, "4/4"),
      three: m.measureFill({ events: [{ dur: "q" }, { dur: "q" }, { dur: "q" }] }, "3/4"),
      five: m.measureFill({ events: [{ dur: "q" }, { dur: "q" }, { dur: "q" }, { dur: "q" }, { dur: "q" }] }, "5/4"),
      implicit: m.displayAccidental({ events: [{ kind: "note", pitch: { step: "F", oct: 3, acc: null } }] }, 0, "G"),
      explicit: m.displayAccidental({ events: [{ kind: "note", pitch: { step: "F", oct: 3, acc: "n" } }] }, 0, "G")
    };
  });
  expect(result.problems).toEqual([]);
  expect(result.bassBottom).toMatchObject({ step: "G", oct: 2 });
  expect(result.bassA2).toMatchObject({ step: "A", oct: 2 });
  expect(result.bassTop).toMatchObject({ step: "A", oct: 3 });
  expect(result.bassC4).toMatchObject({ step: "C", oct: 4 });
  expect(result.bassE1).toMatchObject({ step: "E", oct: 1 });
  expect(result.trebleBottom).toMatchObject({ step: "E", oct: 4 });
  expect(result.trebleTop).toMatchObject({ step: "F", oct: 5 });
  expect(result.trebleC4).toMatchObject({ step: "C", oct: 4 });
  expect(result.g).toEqual({ F: "#" });
  expect(result.em).toEqual({ F: "#" });
  expect(result.c).toEqual({});
  expect(result.am).toEqual({});
  expect(result.bb.B).toBe("b");
  expect(result.bb.E).toBe("b");
  expect(result.under).toBe("under");
  expect(result.full).toBe("full");
  expect(result.over).toBe("over");
  expect(result.six).toBe("full");
  expect(result.dotted).toBe("full");
  expect(result.three).toBe("full");
  expect(result.five).toBe("full");
  expect(result.implicit).toBe(null);
  expect(result.explicit).toBe("n");
});
