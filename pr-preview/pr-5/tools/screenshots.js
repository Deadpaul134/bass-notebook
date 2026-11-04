/* Regenerates screenshots/v3-light.png and v3-dark.png (1280x800).
   Run with the dev server up: python3 tools/serve.py 4173 & node tools/screenshots.js */
const { chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch();
  for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto("http://127.0.0.1:4173/?nosw=1#list");
    await page.evaluate((t) => localStorage.setItem("bass-notebook-v1-theme", t), theme);
    await page.reload();
    await page.waitForSelector("#screen-list:not([hidden])");
    const id = await page.evaluate(() => {
      const s = BN.model.blank({ title: "גרוב בפה – רעיון 3", composer: "פול סמסון", bpm: 96 });
      BN.model.setKeyFrom(s, 0, { fifths: -1, mode: "major" });
      [["quarter", "F", 2], ["eighth", "F", 2], ["eighth", "C", 3], ["quarter", "F", 3], ["quarter", "E", 3],
        ["quarter", "D", 3], ["eighth", "D", 3], ["eighth", "A", 2], ["half", "B", 2, -1],
        ["quarter", "A", 2], ["quarter", "C", 3], ["quarter", "D", 3], ["quarter", "E", 3]]
        .forEach(([type, step, octave, alter]) => BN.model.append(s, 1, BN.model.noteFromPalette({ type, staff: 1 }, { step, alter: alter || 0, octave })));
      BN.store.schedule(s);
      return BN.store.flush().then(() => s.id);
    });
    await page.evaluate((i) => { location.hash = "#score/" + i; }, id);
    await page.waitForSelector("#score svg");
    await page.evaluate(() => {
      BN.state.cursor = { staff: 1, measure: 2, index: 0 };
      BN.editor.select([BN.model.refs(BN.state.current, 1)[9].note.id]);
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/v3-${theme}.png` });
    await page.close();
  }
  await browser.close();
})();
