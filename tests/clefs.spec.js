const { test, expect } = require("@playwright/test");
const { freshApp, newPage, tapStaff, model } = require("./helpers");

async function pitches(page) {
  return page.evaluate(() => {
    const out = [];
    BN.app.getPage().systems.forEach((sys) => {
      sys.staves.forEach((staff) => {
        staff.measures.forEach((measure) => {
          measure.events.forEach((ev) => out.push(ev.pitch || null));
        });
      });
    });
    return out;
  });
}

test("bass, treble, grand map the named positions and keep pitch", async ({ page }) => {
  await freshApp(page);
  await newPage(page);
  await tapStaff(page, 0, 0, 0, 0);
  await tapStaff(page, 0, 0, 1, 0);
  await tapStaff(page, 0, 0, 8, 1);
  await tapStaff(page, 0, 0, 10, 1);
  await tapStaff(page, 0, 0, -9, 2);
  let got = await pitches(page);
  expect(got[0]).toMatchObject({ step: "G", oct: 2 });
  expect(got[1]).toMatchObject({ step: "A", oct: 2 });
  expect(got[2]).toMatchObject({ step: "A", oct: 3 });
  expect(got[3]).toMatchObject({ step: "C", oct: 4 });
  expect(got[4]).toMatchObject({ step: "E", oct: 1 });

  await page.click("[data-chip='clef']");
  await page.click("[data-clef='treble']");
  await page.click("[data-action='apply-clef-all']");
  await expect(page.locator("svg .vf-brace")).toHaveCount(0);
  const kept = await model(page);
  expect(kept.systems[0].staves[0].clef).toBe("treble");
  expect(kept.systems[0].staves[0].measures[0].events[0].pitch).toMatchObject({ step: "G", oct: 2 });
  const pos = await page.evaluate(() => BN.music.pitchToPos("treble", { step: "A", oct: 2 }));
  expect(pos).toBe(-11);

  await page.evaluate(() => BN.store.replaceAll([]));
  await page.evaluate(() => BN.data.saveSettings({ clef: "treble" }));
  await page.click("[data-action='back']");
  await page.waitForSelector("[data-action='new-page']");
  await newPage(page);
  await tapStaff(page, 0, 0, 0, 0);
  await tapStaff(page, 0, 0, 8, 0);
  await tapStaff(page, 0, 0, -2, 1);
  got = await pitches(page);
  expect(got.map((p) => p.step + p.oct)).toEqual(["E4", "F5", "C4"]);

  await page.click("[data-chip='clef']");
  await page.click("[data-clef='grand']");
  await page.click("[data-action='apply-clef-all']");
  await expect(page.locator("svg .vf-brace").first()).toBeVisible();
  await tapStaff(page, 0, 0, -2, 2);
  await tapStaff(page, 0, 1, 10, 2);
  const pageModel = await model(page);
  const top = pageModel.systems[0].staves[0].measures[2].events.at(-1);
  const bottom = pageModel.systems[0].staves[1].measures[2].events.at(-1);
  expect(top.pitch).toMatchObject({ step: "C", oct: 4 });
  expect(bottom.pitch).toMatchObject({ step: "C", oct: 4 });
  expect(pageModel.systems[0].layout).toBe("grand");
});
