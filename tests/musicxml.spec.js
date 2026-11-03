const { test, expect } = require("@playwright/test");
const { freshApp } = require("./helpers");

test("MusicXML export and round-trip", async ({ page }) => {
  await freshApp(page);
  const result = await page.evaluate(() => {
    const score = BN.model.blank({ title: "גרוב", bpm: 104, staffLayout: "grand" });
    BN.model.append(score, 1, BN.model.noteFromPalette({ type: "quarter", staff: 1 }, { step: "C", alter: 0, octave: 4 }));
    const bass = BN.model.noteFromPalette({ type: "quarter", staff: 2, tie: true }, { step: "G", alter: 0, octave: 2 });
    const held = BN.model.noteFromPalette({ type: "quarter", staff: 2 }, { step: "G", alter: 0, octave: 2 });
    bass.tie = { start: true };
    BN.model.append(score, 2, bass);
    held.tie = { stop: true };
    BN.model.append(score, 2, held);
    const xml = BN.musicxml.export(score);
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    const back = BN.musicxml.roundTrip(score);
    return {
      error: doc.getElementsByTagName("parsererror").length,
      partwise: doc.documentElement.tagName,
      staves: doc.getElementsByTagName("staves")[0] && doc.getElementsByTagName("staves")[0].textContent,
      backup: doc.getElementsByTagName("backup").length,
      tempo: doc.getElementsByTagName("sound")[0] && doc.getElementsByTagName("sound")[0].getAttribute("tempo"),
      tie: doc.getElementsByTagName("tie").length,
      same: JSON.stringify(BN.musicxml.signature(score)) === JSON.stringify(BN.musicxml.signature(back))
    };
  });
  expect(result.error).toBe(0);
  expect(result.partwise).toBe("score-partwise");
  expect(result.staves).toBe("2");
  expect(result.backup).toBeGreaterThan(0);
  expect(result.tempo).toBe("104");
  expect(result.tie).toBeGreaterThan(0);
  expect(result.same).toBe(true);
});
