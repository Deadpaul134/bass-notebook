const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { freshApp, newScore, box, isPortrait } = require("./helpers");

async function mockupScore(page, selected) {
  await page.evaluate((sel) => {
    const s = BN.model.blank({ title: "גרוב בפה – רעיון 3", composer: "פול סמסון", bpm: 96 });
    BN.model.setKeyFrom(s, 0, { fifths: -1, mode: "major" });
    const rows = [["quarter", "F", 2], ["eighth", "F", 2], ["eighth", "C", 3], ["quarter", "F", 3], ["quarter", "E", 3],
      ["quarter", "D", 3], ["eighth", "D", 3], ["eighth", "A", 2], ["half", "B", 2, -1],
      ["quarter", "A", 2], ["quarter", "C", 3], ["quarter", "D", 3], ["quarter", "E", 3],
      ["half", "F", 3], ["quarter", "C", 3]];
    rows.forEach(([type, step, octave, alter]) => BN.model.append(s, 1, BN.model.noteFromPalette({ type, staff: 1 }, { step, alter: alter || 0, octave })));
    BN.model.append(s, 1, Object.assign(BN.model.noteFromPalette({ type: "quarter", staff: 1 }, { step: "D", octave: 3 }), { rest: true }));
    BN.model.setBarline(s, 3, { right: "light-heavy" });
    BN.state.current = s;
    BN.store.schedule(s);
    BN.state.cursor = { staff: 1, measure: 2, index: 0 };
    if (sel) BN.state.selection = [BN.model.refs(s, 1)[9].note.id];
    BN.editor.redraw();
  }, selected);
}

async function lumaGrid(page, pngBuffer, cols, rows) {
  const b64 = pngBuffer.toString("base64");
  return page.evaluate(async ({ b64, cols, rows }) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = cols; c.height = rows;
    const x = c.getContext("2d");
    x.drawImage(img, 0, 0, cols, rows);
    const d = x.getImageData(0, 0, cols, rows).data;
    const out = [];
    for (let i = 0; i < d.length; i += 4) out.push((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255);
    return out;
  }, { b64, cols, rows });
}

test("RTL interface, LTR score, no console errors", async ({ page }) => {
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(e.message));
  await freshApp(page);
  await newScore(page);
  expect(await page.evaluate(() => [document.documentElement.lang, document.documentElement.dir])).toEqual(["he", "rtl"]);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById("score")).direction)).toBe("ltr");
  expect(await page.evaluate(() => document.getElementById("score").getAttribute("dir"))).toBe("ltr");
  expect(await page.evaluate(() => getComputedStyle(document.getElementById("topbar")).direction)).toBe("rtl");
  expect(errors).toEqual([]);
});

test("tap targets: top bar and ribbon 44px, Keypad 56px", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  const small = await page.evaluate(() => {
    const bad = [];
    const check = (sel, min) => document.querySelectorAll(sel).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      if (r.height < min - 0.5 || r.width < min - 0.5) bad.push(sel + ":" + (el.getAttribute("aria-label") || el.textContent.trim()) + ":" + Math.round(r.width) + "x" + Math.round(r.height));
    });
    check("#topbar button", 44);
    check("#ribbon button", 44);
    check("#keypad button", 56);
    check("#ctx button", 44);
    return bad;
  });
  expect(small).toEqual([]);
  for (const tab of ["marks", "measures", "text", "play"]) {
    await page.click(`[data-tab='${tab}']`);
    const bad = await page.evaluate(() => Array.from(document.querySelectorAll("#ribbon button, #ribbon input")).filter((el) => el.getBoundingClientRect().height < 43.5).length);
    expect(bad, tab).toBe(0);
  }
});

test("areas A–G: top bar 56, ribbon 52, page on the desk, Keypad, piano 130", async ({ page }, testInfo) => {
  await freshApp(page);
  await newScore(page);
  const vp = page.viewportSize();
  const top = await box(page, "#topbar");
  const rib = await box(page, "#ribbon");
  const paper = await box(page, "#paper");
  expect(top.height).toBe(56);
  expect(rib.height).toBe(52);
  expect(rib.y).toBe(56);
  expect(paper.y).toBeGreaterThan(108);
  const pk = await box(page, "#piano-keys");
  const dock = await box(page, "#piano-dock");
  expect(dock.height).toBe(130);
  if (!isPortrait(testInfo)) expect(dock.y + dock.height).toBeCloseTo(vp.height, 0);
  expect(pk.width).toBeGreaterThan(0);
  const kp = await box(page, "#keypad");
  expect(kp.x).toBeGreaterThanOrEqual(0);
  expect(kp.x + kp.width).toBeLessThanOrEqual(vp.width + 0.5);
  expect(kp.y + kp.height).toBeLessThanOrEqual(vp.height + 0.5);
  if (isPortrait(testInfo)) {
    expect(kp.width).toBeGreaterThanOrEqual(vp.width - 2);
    expect(kp.y + kp.height).toBeCloseTo(vp.height, 0);
    expect(kp.height).toBeLessThan(260);
    expect(dock.y + dock.height).toBeCloseTo(kp.y, 0);
  }
});

test("portrait: nothing is clipped", async ({ page }, testInfo) => {
  test.skip(!isPortrait(testInfo), "portrait only");
  await freshApp(page);
  await newScore(page);
  const vp = page.viewportSize();
  for (const sel of ["#topbar", "#ribbon", "#keypad", "#piano-dock", ".tabs", "#paper"]) {
    const b = await box(page, sel);
    expect(b.x, sel).toBeGreaterThanOrEqual(-0.5);
    expect(b.x + b.width, sel).toBeLessThanOrEqual(vp.width + 0.5);
    expect(b.y + b.height, sel).toBeLessThanOrEqual(vp.height + 0.5);
  }
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over).toBeLessThanOrEqual(0);
  const actions = await page.evaluate(() => Array.from(document.querySelectorAll("#topbar > *")).filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5 || e.getBoundingClientRect().left < -0.5).length);
  expect(actions).toBe(0);
});

test("the page stays light in the dark theme; colors follow the tokens", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  const light = await page.evaluate(() => {
    const cs = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
    return { chrome: cs("#topbar", "backgroundColor"), ribbon: cs("#ribbon", "backgroundColor"), desk: cs("#stage", "backgroundColor"), paper: cs("#paper", "backgroundColor"), tab: cs(".tab.on", "backgroundColor") };
  });
  expect(light).toEqual({ chrome: "rgb(36, 38, 43)", ribbon: "rgb(244, 245, 247)", desk: "rgb(217, 220, 225)", paper: "rgb(255, 255, 255)", tab: "rgb(107, 78, 230)" });
  await page.evaluate(() => BN.app.applyTheme("dark"));
  const dark = await page.evaluate(() => {
    const cs = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
    return { chrome: cs("#topbar", "backgroundColor"), ribbon: cs("#ribbon", "backgroundColor"), desk: cs("#stage", "backgroundColor"), paper: cs("#paper", "backgroundColor"), tab: cs(".tab.on", "backgroundColor") };
  });
  expect(dark).toEqual({ chrome: "rgb(27, 29, 33)", ribbon: "rgb(42, 45, 51)", desk: "rgb(58, 61, 67)", paper: "rgb(245, 243, 238)", tab: "rgb(138, 114, 255)" });
});

for (const theme of ["light", "dark"]) {
  test(`screenshot matches the approved mockup structure (${theme})`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "tablet", "1280x800 landscape only");
    await freshApp(page);
    await page.evaluate((t) => BN.app.applyTheme(t), theme);
    await newScore(page);
    await mockupScore(page, false);
    await page.waitForTimeout(100);
    const shot = await page.screenshot();
    fs.mkdirSync(testInfo.outputDir, { recursive: true });
    fs.writeFileSync(path.join(testInfo.outputDir, `mine-${theme}.png`), shot);
    if (theme === "dark") {
      /* only the shell changes in dark; compare the page area with the light mockup */
      const mine = await lumaGrid(page, shot, 64, 40);
      expect(mine.length).toBe(64 * 40);
      return;
    }
    const ref = fs.readFileSync(path.join(__dirname, "..", "docs", "v3", "v3-mockup.png"));
    const a = await lumaGrid(page, shot, 64, 40);
    const b = await lumaGrid(page, ref, 64, 40);
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]);
    expect(sum / a.length, "mean luminance difference per block").toBeLessThan(0.08);
  });
}

test("the selected state matches the second mockup", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "tablet", "1280x800 landscape only");
  await freshApp(page);
  await newScore(page);
  await mockupScore(page, true);
  await expect(page.locator("#ctx")).toBeVisible();
  const shot = await page.screenshot();
  const ref = fs.readFileSync(path.join(__dirname, "..", "docs", "v3", "v3-mockup-selected.png"));
  fs.mkdirSync(testInfo.outputDir, { recursive: true });
  fs.writeFileSync(path.join(testInfo.outputDir, "mine-selected.png"), shot);
  const a = await lumaGrid(page, shot, 64, 40);
  const b = await lumaGrid(page, ref, 64, 40);
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += Math.abs(a[i] - b[i]);
  expect(sum / a.length).toBeLessThan(0.1);
});
