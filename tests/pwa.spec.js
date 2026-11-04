const { test, expect } = require("@playwright/test");

test("manifest, service worker, and an offline editor with playback", async ({ page, context }) => {
  await page.goto("/#list");
  const manifest = await page.evaluate(async () => {
    const res = await fetch("./manifest.webmanifest");
    return { type: res.headers.get("content-type"), body: await res.json() };
  });
  expect(manifest.type || "").toContain("manifest");
  expect(manifest.body).toMatchObject({ name: "מחברת בס", lang: "he", dir: "rtl", display: "standalone" });
  expect(manifest.body.start_url).toContain("#list");
  expect(manifest.body.icons.length).toBeGreaterThanOrEqual(4);
  await page.evaluate(() => { const s = BN.model.blank({ title: "אופליין" }); BN.store.schedule(s); return BN.store.flush(); });
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller);
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const cache = await caches.open(keys[0]);
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  });
  for (const f of ["/js/ui/keypad.js", "/js/ui/piano.js", "/js/editor.js", "/css/app.css", "/vendor/vexflow/vexflow-bravura.js"]) expect(cached).toContain(f);
  await context.setOffline(true);
  await page.reload();
  await page.waitForSelector("#screen-list:not([hidden])");
  await expect(page.locator(".idea-title")).toHaveText("אופליין");
  await page.locator(".idea-open").click();
  await page.waitForSelector("#score svg");
  await page.locator('.wk[data-midi="43"]').click();
  const r = await page.evaluate(() => ({ ev: BN.playback.eventsFor(BN.state.current)[0].instrument }));
  expect(r.ev).toBe("bass");
  await page.click("#topbar [data-action='play']");
  await expect.poll(() => page.evaluate(() => BN.playback.isPlaying())).toBe(true);
  await page.click("#topbar [data-action='play']");
  const dl = page.waitForEvent("download");
  await page.click("#topbar [data-action='more']");
  await page.click("#pop [data-menu='musicxml']");
  await dl;
  await context.setOffline(false);
});
