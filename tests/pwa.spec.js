const { test, expect } = require("@playwright/test");

test("manifest, service worker, and offline editor", async ({ page, context }) => {
  await page.goto("/#list");
  const manifest = await page.evaluate(async () => {
    const res = await fetch("./manifest.webmanifest");
    return { type: res.headers.get("content-type"), body: await res.json() };
  });
  expect(manifest.type || "").toContain("manifest");
  expect(manifest.body.name).toBe("מחברת בס");
  expect(manifest.body.lang).toBe("he");
  expect(manifest.body.dir).toBe("rtl");
  expect(manifest.body.display).toBe("standalone");
  expect(manifest.body.start_url).toContain("#list");
  expect(manifest.body.icons.length).toBeGreaterThanOrEqual(3);

  await page.evaluate(() => {
    const score = BN.model.blank({ title: "אופליין" });
    BN.store.schedule(score);
    return BN.store.flush();
  });
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector("[data-screen='list']");
  await expect(page.locator("body")).toContainText("המחברת שלי");
  await expect(page.locator(".idea-title")).toHaveText("אופליין");
  await page.locator(".idea-open").click();
  await page.waitForSelector("#score svg");
  const instrument = await page.evaluate(() => {
    const score = BN.state.current;
    const note = BN.model.noteFromPalette({ type: "quarter", staff: 1 }, { step: "G", alter: 0, octave: 2 });
    BN.model.append(score, 1, note);
    return BN.playback.eventsFor(score)[0].instrument;
  });
  expect(instrument).toBe("bass");
  await context.setOffline(false);
});
