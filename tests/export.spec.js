const { test, expect } = require("@playwright/test");
const fs = require("fs");
const { freshApp, newScore, tapStaff } = require("./helpers");

test("downloads MusicXML, PDF, and PNG", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  const xmlDownload = page.waitForEvent("download");
  await page.click("[data-action='export-musicxml']");
  const xml = fs.readFileSync(await (await xmlDownload).path(), "utf8");
  expect(xml).toContain("<score-partwise");
  expect(xml).toContain("<step>G</step>");
  const pdfDownload = page.waitForEvent("download");
  await page.click("[data-action='export-pdf']");
  const pdf = fs.readFileSync(await (await pdfDownload).path());
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdf.length).toBeGreaterThan(100);
  const width = await page.evaluate(async () => {
    const blob = await BN.export.pngBlob(BN.state.current);
    const bitmap = await createImageBitmap(blob);
    return { width: bitmap.width, size: blob.size };
  });
  expect(width.width).toBeGreaterThanOrEqual(2000);
  expect(width.size).toBeGreaterThan(0);
});

test("JSON backup merges, rejects a bad file, and accepts v1", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await page.fill("#score-title", "מקור");
  await page.evaluate(() => BN.store.flush());
  await page.click("[data-action='back']");
  await page.click("a[href='#settings']");
  const download = page.waitForEvent("download");
  await page.click("[data-action='backup']");
  const raw = fs.readFileSync(await (await download).path(), "utf8");
  const backup = JSON.parse(raw);
  expect(backup.app).toBe("bass-notebook");
  expect(backup.v).toBe(2);
  await page.evaluate(() => BN.store.replaceAll([]));
  await page.setInputFiles("#restore-file", {
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(raw)
  });
  await page.waitForFunction(() => BN.store.list().some((row) => row.title === "מקור"));
  await page.setInputFiles("#restore-file", {
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{not json")
  });
  await expect(page.locator("#form-error")).toContainText(/פגום|אינו גיבוי/);
  expect(await page.evaluate(() => BN.store.list().some((row) => row.title === "מקור"))).toBe(true);
  const v1 = {
    app: "bass-notebook",
    v: 1,
    pages: [{
      id: "legacy",
      clef: "bass",
      title: "ישן",
      tempo: 90,
      date: "2026-01-01",
      systems: [{ staves: [{ clef: "bass", measures: [{ events: [{ kind: "note", dur: "q", pitch: { step: "G", oct: 2 } }] }] }] }]
    }]
  };
  await page.setInputFiles("#restore-file", {
    name: "v1.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(v1))
  });
  await page.waitForFunction(() => BN.store.list().some((row) => row.title === "ישן"));
  const legacy = await page.evaluate(() => {
    const score = BN.store.all().find((item) => item.title === "ישן");
    return score.parts[0].measures.some((measure) => measure.notes.some((note) => note.pitch && note.pitch.step === "G" && note.pitch.octave === 2));
  });
  expect(legacy).toBe(true);
});
