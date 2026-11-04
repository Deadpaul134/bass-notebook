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

test("marks, dynamics, slurs, ghost notes, and repeats round-trip", async ({ page }) => {
  await freshApp(page);
  const r = await page.evaluate(() => {
    const s = BN.model.blank({ title: "סימנים", composer: "פול" });
    const mk = (step) => BN.model.noteFromPalette({ type: "quarter", staff: 1 }, { step, alter: 0, octave: 2 });
    const a = mk("G"); a.artic = ["staccato", "fermata"]; a.dyn = "mf"; a.slur = { start: true };
    const b = mk("A"); b.ghost = true; b.slur = { stop: true };
    BN.model.append(s, 1, a); BN.model.append(s, 1, b);
    BN.model.setRepeat(s, 0, "forward");
    BN.model.setRepeat(s, 0, "backward");
    const xml = BN.musicxml.export(s);
    const back = BN.musicxml.roundTrip(s);
    return { xml, same: JSON.stringify(BN.musicxml.signature(s)) === JSON.stringify(BN.musicxml.signature(back)), sig: BN.musicxml.signature(back).measures[0] };
  });
  expect(r.xml).toContain("<staccato/>");
  expect(r.xml).toContain("<notehead>x</notehead>");
  expect(r.xml).toContain("<mf/>");
  expect(r.xml).toContain('<repeat direction="backward"/>');
  expect(r.xml).toContain("<creator");
  expect(r.same).toBe(true);
});
