const { test, expect } = require("@playwright/test");
const { freshApp, newScore } = require("./helpers");

test("theme applies before first paint and survives reload", async ({ page }) => {
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => { window.__themeAtDcl = document.documentElement.getAttribute("data-theme"); });
  });
  await page.goto("/?nosw=1#list");
  await page.evaluate(() => localStorage.setItem("bass-notebook-v1-theme", "dark"));
  await page.reload();
  await page.waitForSelector("#screen-list:not([hidden])");
  expect(await page.evaluate(() => window.__themeAtDcl)).toBe("dark");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(58, 61, 67)");
  expect(await page.evaluate(() => document.querySelector("meta[name='theme-color']").content)).toBe("#1b1d21");
});

test("settings switch light, dark, system and keep the page light", async ({ page }) => {
  await freshApp(page);
  await page.evaluate(() => { location.hash = "#settings"; });
  await page.click("[data-seg='theme'] [data-val='dark']");
  expect(await page.evaluate(() => localStorage.getItem("bass-notebook-v1-theme"))).toBe("dark");
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await page.click("[data-seg='theme'] [data-val='system']");
  expect(await page.evaluate(() => localStorage.getItem("bass-notebook-v1-theme"))).toBe("system");
  await page.click("[data-seg='theme'] [data-val='light']");
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
  await page.evaluate(() => { location.hash = "#list"; });
  await newScore(page);
  await page.evaluate(() => BN.app.applyTheme("dark"));
  expect(await page.evaluate(() => getComputedStyle(document.getElementById("paper")).backgroundColor)).toBe("rgb(245, 243, 238)");
});

test("system preference follows the browser", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/?nosw=1#list");
  await page.evaluate(() => localStorage.removeItem("bass-notebook-v1-theme"));
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
});
