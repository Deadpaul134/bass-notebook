const { test, expect } = require("@playwright/test");
const { freshApp, newPage, tapStaff, dragStaff, model } = require("./helpers");

test("durations, rests, accidentals, overflow, bars, time, key, drag, keyboard", async ({ page }) => {
  await freshApp(page);
  await newPage(page);
  await page.click("[data-mode='tap']");
  const durations = ["w", "h", "q", "8", "16"];
  for (let i = 0; i < durations.length; i++) {
    await page.evaluate(() => BN.tap.clearSelection());
    await page.click(`[data-dur='${durations[i]}']`);
    await tapStaff(page, 0, 0, i * 2, i);
  }
  let data = await model(page);
  const durs = data.systems[0].staves[0].measures.flatMap((m) => m.events.map((e) => e.dur));
  expect(durs).toEqual(expect.arrayContaining(durations));

  await page.click("[data-dots]");
  await page.click("[data-dur='q']");
  await tapStaff(page, 1, 0, 4, 0);
  data = await model(page);
  const dotted = data.systems[1].staves[0].measures[0].events.at(-1);
  expect(dotted.dots).toBe(1);
  await page.click("[data-dots]");
  await tapStaff(page, 1, 0, 4, 1);
  data = await model(page);
  expect(data.systems[1].staves[0].measures[1].events.at(-1).dots).toBe(2);

  await page.click("[data-action='toggle-rest']");
  await page.click("[data-dur='h']");
  await tapStaff(page, 2, 0, 0, 0);
  data = await model(page);
  expect(data.systems[2].staves[0].measures[0].events.at(-1).kind).toBe("rest");
  await page.click("[data-action='toggle-rest']");

  await page.evaluate(() => BN.tap.clearSelection());
  await page.click("[data-acc='#']");
  await tapStaff(page, 2, 0, 3, 1);
  data = await model(page);
  expect(data.systems[2].staves[0].measures[1].events.at(-1).pitch.acc).toBe("#");
  await page.evaluate(() => BN.tap.clearSelection());
  await page.click("[data-acc='b']");
  await tapStaff(page, 2, 0, 5, 2);
  await page.evaluate(() => BN.tap.clearSelection());
  await page.click("[data-acc='n']");
  await tapStaff(page, 2, 0, 6, 2);
  data = await model(page);
  const accs = data.systems[2].staves[0].measures.flatMap((m) => m.events.map((e) => e.pitch && e.pitch.acc));
  expect(accs).toContain("b");
  expect(accs).toContain("n");

  await page.evaluate(() => BN.tap.clearSelection());
  await page.click("[data-acc='#']");
  await page.click("[data-dur='q']");
  for (let n = 0; n < 5; n++) await tapStaff(page, 3, 0, 4, 0);
  data = await model(page);
  expect(data.systems[3].staves[0].measures[0].events.length).toBeLessThanOrEqual(4);
  expect(data.systems[3].staves[0].measures[1].events.length).toBeGreaterThan(0);
  const total = data.systems[3].staves[0].measures.reduce((s, m) => s + m.events.length, 0);
  expect(total).toBeGreaterThanOrEqual(5);

  await page.click("[data-bar='double']");
  data = await model(page);
  const cursor = await page.evaluate(() => BN.tap.cursor());
  expect(data.systems[cursor.system].staves[0].measures[cursor.measure].barEnd).toBe("double");
  await page.click("[data-bar='end']");
  await page.click("[data-bar='repeatEnd']");
  await page.click("[data-bar='repeatStart']");
  data = await model(page);
  const bar = data.systems[cursor.system].staves[0].measures[cursor.measure];
  expect(bar.barEnd).toBe("repeatEnd");
  expect(bar.barStart).toBe("repeatStart");

  await page.click("[data-chip='time']");
  await page.click("[data-pop-time='6/8']");
  data = await model(page);
  expect(data.time).toBe("6/8");
  await page.click("[data-chip='key']");
  await page.click("[data-pop-key='G']");
  data = await model(page);
  expect(data.key).toBe("G");

  await page.click("[data-dur='q']");
  await tapStaff(page, 4, 0, 4, 0);
  await dragStaff(page, 4, 0, 4, 6, 0);
  data = await model(page);
  const dragged = data.systems[4].staves[0].measures[0].events.at(-1);
  expect(dragged.pitch.step).not.toBe("D");

  await page.keyboard.press("c");
  data = await model(page);
  const typed = data.systems[4].staves[0].measures.flatMap((m) => m.events).at(-1);
  expect(typed.pitch.step).toBe("C");
  await page.keyboard.press("2");
  data = await model(page);
  expect(data.systems[4].staves[0].measures.flatMap((m) => m.events).at(-1).dur).toBe("h");
  await page.click("[data-dur='8']");
  for (let n = 0; n < 4; n++) await tapStaff(page, 5, 0, 3, 0);
  await expect(page.locator("svg .vf-beam").first()).toBeAttached();
});
