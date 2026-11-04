const { test, expect } = require("@playwright/test");
const fs = require("fs");
const { freshApp, newScore, tapStaff, getModel, fill } = require("./helpers");

async function menu(page, item) {
  await page.click("#topbar [data-action='more']");
  await page.click(`#pop [data-menu='${item}']`);
}

test("downloads MusicXML, PDF (multi-page vector), and PNG from the menu", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  let dl = page.waitForEvent("download");
  await menu(page, "musicxml");
  const xml = fs.readFileSync(await (await dl).path(), "utf8");
  expect(xml).toContain("<score-partwise");
  expect(xml).toContain("<step>G</step>");
  expect((await dl).suggestedFilename()).toMatch(/\.musicxml$/);
  dl = page.waitForEvent("download");
  await menu(page, "pdf");
  const pdf = fs.readFileSync(await (await dl).path());
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  expect(pdf.length).toBeGreaterThan(3000);
  dl = page.waitForEvent("download");
  await menu(page, "png");
  const pngPath = await (await dl).path();
  const png = fs.readFileSync(pngPath);
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBeGreaterThanOrEqual(2000);
  await expect(page.locator("#score svg").first()).toBeVisible();
});

test("a long score exports to a PDF with several pages", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await page.evaluate(() => {
    for (let i = 0; i < 4 * 40; i += 1) BN.model.append(BN.state.current, 1, BN.model.noteFromPalette({ type: "quarter", staff: 1 }, { step: "G", alter: 0, octave: 2 }));
  });
  const pages = await page.evaluate(async () => {
    const blob = await BN.export.pdfBlob(BN.state.current);
    const text = await blob.text();
    return (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
  });
  expect(pages).toBeGreaterThan(1);
});

test("JSON backup merges, rejects a bad file, and accepts v1", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await page.fill("#score-title", "מקור");
  await page.evaluate(() => BN.store.flush());
  const dl = page.waitForEvent("download");
  await menu(page, "json");
  const raw = fs.readFileSync(await (await dl).path(), "utf8");
  const backup = JSON.parse(raw);
  expect(backup.app).toBe("bass-notebook");
  expect(backup.v).toBe(2);
  await page.evaluate(() => { location.hash = "#settings"; });
  await page.waitForSelector("#restore-file");
  await page.evaluate(() => BN.store.replaceAll([]));
  await page.setInputFiles("#restore-file", { name: "backup.json", mimeType: "application/json", buffer: Buffer.from(raw) });
  await page.waitForFunction(() => BN.store.list().some((r) => r.title === "מקור"));
  await page.setInputFiles("#restore-file", { name: "bad.json", mimeType: "application/json", buffer: Buffer.from("{not json") });
  await expect(page.locator("#form-error")).toContainText(/פגום|אינו גיבוי/);
  expect(await page.evaluate(() => BN.store.list().some((r) => r.title === "מקור"))).toBe(true);
  const v1 = { app: "bass-notebook", v: 1, pages: [{ id: "legacy", clef: "bass", title: "ישן", tempo: 90, date: "2026-01-01", systems: [{ staves: [{ clef: "bass", measures: [{ events: [{ kind: "note", dur: "q", pitch: { step: "G", oct: 2 } }] }] }] }] }] };
  await page.setInputFiles("#restore-file", { name: "v1.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(v1)) });
  await page.waitForFunction(() => BN.store.list().some((r) => r.title === "ישן"));
});

test("backup then clear then restore gives the same scores (deep equal)", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await fill(page, [["quarter", "G", 2], ["half", "A", 2]]);
  await page.evaluate(() => BN.store.flush());
  const before = await page.evaluate(() => JSON.stringify(BN.store.all()));
  const json = await page.evaluate(() => JSON.stringify(BN.export.toJSON()));
  await page.evaluate(() => BN.store.replaceAll([]));
  await page.evaluate((j) => BN.export.importData(JSON.parse(j), "replace"), json);
  expect(await page.evaluate(() => JSON.stringify(BN.store.all()))).toBe(before);
});
