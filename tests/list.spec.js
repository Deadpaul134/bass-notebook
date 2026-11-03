const { test, expect } = require("@playwright/test");
const { freshApp, newPage, model } = require("./helpers");

test("create, title, search, sort, duplicate, delete undo", async ({ page }) => {
  await freshApp(page);
  await newPage(page);
  const today = await page.evaluate(() => BN.ymd());
  let data = await model(page);
  expect(data.systems).toHaveLength(6);
  expect(data.clef).toBe("bass");
  expect(data.time).toBe("4/4");
  expect(data.key).toBe("C");
  expect(data.date).toBe(today);
  expect(data.systems[0].staves[0].measures).toHaveLength(4);
  await page.fill("#page-title", "גרוב בסול");
  await page.evaluate(() => BN.store.flush());
  await page.click("[data-action='back']");
  await page.waitForSelector("[data-screen='list']");
  await expect(page.locator(".idea-title")).toHaveText("גרוב בסול");

  await page.click("[data-action='new-page']");
  await page.waitForSelector("#page-title");
  await page.fill("#page-title", "אלפא");
  await page.evaluate(() => BN.store.flush());
  await page.click("[data-action='back']");
  await page.waitForSelector("#search");
  await page.fill("#search", "גרוב");
  await expect(page.locator(".idea")).toHaveCount(1);
  await page.fill("#search", "");
  await page.selectOption("#sort", "name");
  const titles = await page.locator(".idea-title").allTextContents();
  const sorted = titles.slice().sort((a, b) => a.localeCompare(b, "he"));
  expect(titles).toEqual(sorted);

  const before = await page.locator(".idea").count();
  await page.locator(".idea").first().locator("[data-action='more']").click();
  await page.click("[data-action='duplicate']");
  await expect(page.locator(".idea")).toHaveCount(before + 1);

  const id = await page.locator(".idea").first().getAttribute("data-id");
  await page.locator(`.idea[data-id="${id}"] [data-action='more']`).click();
  await page.click("[data-action='delete']");
  await expect(page.locator(".toast")).toContainText("נמחק");
  await page.click("[data-action='toast-undo']");
  await expect(page.locator(`.idea[data-id="${id}"]`)).toHaveCount(1);
});

test("search stays under 100ms for 200 pages", async ({ page }) => {
  await freshApp(page);
  const timing = await page.evaluate(() => {
    const pages = Array.from({ length: 200 }, (_, i) => ({
      id: "p" + i,
      title: i === 137 ? "גרוב מיוחד" : "רעיון " + i,
      notes: i === 50 ? "הערה נדירה" : "",
      tags: i === 20 ? ["לילה"] : [],
      key: i % 2 ? "G" : "C",
      updatedAt: "",
      date: "",
      tempo: null,
      clef: "bass"
    }));
    const t0 = performance.now();
    const found = BN.list.filter(pages, "מיוחד");
    const notes = BN.list.filter(pages, "נדירה");
    const tags = BN.list.filter(pages, "לילה");
    const key = BN.list.filter(pages, "g");
    return { dt: performance.now() - t0, n: found.length, notes: notes.length, tags: tags.length, key: key.length };
  });
  expect(timing.dt).toBeLessThan(100);
  expect(timing.n).toBe(1);
  expect(timing.notes).toBe(1);
  expect(timing.tags).toBe(1);
  expect(timing.key).toBe(100);
});
