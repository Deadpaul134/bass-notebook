const { test, expect } = require("@playwright/test");

test("manifest and offline reload", async ({ page, context }) => {
  await page.goto("/#list");
  const manifest = await page.evaluate(async () => {
    const res = await fetch("./manifest.webmanifest");
    return { type: res.headers.get("content-type"), body: await res.json() };
  });
  expect(manifest.type || "").toContain("manifest");
  expect(manifest.body.name).toBe("מחברת בס");
  expect(manifest.body.short_name).toBe("מחברת");
  expect(manifest.body.lang).toBe("he");
  expect(manifest.body.dir).toBe("rtl");
  expect(manifest.body.display).toBe("standalone");
  expect(manifest.body.start_url).toContain("#list");
  expect(manifest.body.icons.length).toBeGreaterThanOrEqual(3);

  await page.evaluate(() => {
    const pageData = BN.data.blankPage();
    pageData.title = "אופליין";
    BN.store.schedule(pageData);
    return BN.store.flush();
  });
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector("[data-screen='list']");
  await expect(page.locator("body")).toContainText("המחברת שלי");
  await expect(page.locator(".idea-title")).toHaveText("אופליין");
  await context.setOffline(false);
});
