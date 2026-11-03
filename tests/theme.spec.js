const { test, expect } = require("@playwright/test");

test("theme applies before paint and survives reload", async ({ page }) => {
  await page.goto("/?nosw=1#list");
  await page.evaluate(() => localStorage.setItem("bass-notebook-v1-theme", "dark"));
  await page.reload();
  await page.waitForSelector("[data-screen='list']");
  const first = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute("data-theme"),
    pref: document.documentElement.getAttribute("data-theme-pref"),
    bg: getComputedStyle(document.body).backgroundColor
  }));
  expect(first.theme).toBe("dark");
  expect(first.pref).toBe("dark");
  expect(first.bg).toBe("rgb(42, 34, 29)");
  const html = await page.content();
  expect(html).toContain("bass-notebook-v1-theme");

  await page.click("[data-action='theme']");
  await expect.poll(async () => page.evaluate(() => localStorage.getItem("bass-notebook-v1-theme"))).toBe("system");
  await page.click("[data-action='theme']");
  await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("light");
  await page.reload();
  await expect.poll(async () => page.evaluate(() => document.documentElement.getAttribute("data-theme"))).toBe("light");
});
