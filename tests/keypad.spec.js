const { test, expect } = require("@playwright/test");
const { freshApp, newScore, getModel, written, names, fill, selectNote, box, keypadDrag, noteId } = require("./helpers");

const DY = 14; /* one diatonic step */

async function setLast(page, pos, staff = 1) {
  await page.evaluate(({ pos, staff }) => { BN.state.lastPos = BN.state.lastPos || {}; BN.state.lastPos[staff] = pos; }, { pos, staff });
}

async function ghostLabel(page) {
  return page.evaluate(() => {
    const g = document.getElementById("ghost");
    return g.hidden ? null : g.dataset.label;
  });
}

test.beforeEach(async ({ page }) => {
  await freshApp(page);
  await newScore(page);
});

test("dragging up or down on a duration sets the pitch, with a ghost and label, from E1 to C4", async ({ page }) => {
  const want = [];
  for (let pos = -9; pos <= 10; pos += 1) want.push(pos);
  const pitches = await page.evaluate((list) => list.map((pos) => {
    const p = BN.music.posToPitch("bass", pos, { fifths: 0, mode: "major" });
    return p.step + p.octave;
  }), want);
  expect(pitches[0]).toBe("E1");
  expect(pitches[pitches.length - 1]).toBe("C4");
  const seen = [];
  for (let i = 0; i < want.length; i += 1) {
    const target = want[i];
    const start = target < 4 ? target + 5 : target - 5;
    await setLast(page, start);
    let label = null;
    await keypadDrag(page, "[data-dur='quarter']", 0, -(target - start) * DY, {
      beforeUp: async () => { label = await ghostLabel(page); }
    });
    expect(label, "ghost label while dragging to " + pitches[i]).toBe(pitches[i]);
    seen.push(label);
    await expect(page.locator("#ghost")).toBeHidden();
  }
  expect(names(await getModel(page))).toEqual(pitches);
});

test("sliding right makes a sharp, left a flat, and the label shows it", async ({ page }) => {
  await setLast(page, 4);
  let label = null;
  await keypadDrag(page, "[data-dur='quarter']", 40, 0, { beforeUp: async () => { label = await ghostLabel(page); } });
  expect(label).toBe("D♯3");
  await setLast(page, 4);
  await keypadDrag(page, "[data-dur='quarter']", -40, 0, { beforeUp: async () => { label = await ghostLabel(page); } });
  expect(label).toBe("D♭3");
  expect(names(await getModel(page))).toEqual(["D#3", "Db3"]);
});

test("drag keeps the chosen duration and the cursor advances", async ({ page }) => {
  await keypadDrag(page, "[data-dur='eighth']", 0, -2 * DY);
  await keypadDrag(page, "[data-dur='eighth']", 0, 0, { hold: true, beforeUp: async () => { await page.waitForTimeout(450); } });
  const notes = written(await getModel(page));
  expect(notes.map((n) => n.type)).toEqual(["eighth", "eighth"]);
  expect(notes.map((n) => n.pitch.step + n.pitch.octave)).toEqual(["F3", "F3"]);
  await expect(page.locator("[data-dur='eighth']")).toHaveAttribute("aria-pressed", "true");
});

test("a short tap on a duration only selects it", async ({ page }) => {
  await page.click("[data-dur='half']");
  expect(written(await getModel(page))).toHaveLength(0);
  await expect(page.locator("[data-dur='half']")).toHaveClass(/on/);
  await expect(page.locator("[data-dur='quarter']")).not.toHaveClass(/on/);
});

test("the pitch key moves the selected note by dragging", async ({ page }) => {
  await fill(page, [["quarter", "G", 2], ["quarter", "A", 2]]);
  await selectNote(page, 1);
  await keypadDrag(page, "[data-op='pitch']", 0, -3 * DY);
  expect(names(await getModel(page))).toEqual(["G2", "D3"]);
  await keypadDrag(page, "[data-op='pitch']", 40, 0);
  expect(names(await getModel(page))).toEqual(["G2", "D#3"]);
});

test("a duration dragged with a note selected changes duration and pitch of that note", async ({ page }) => {
  await fill(page, [["quarter", "G", 2], ["quarter", "A", 2]]);
  await selectNote(page, 0);
  await keypadDrag(page, "[data-dur='half']", 0, -2 * DY);
  const model = await getModel(page);
  expect(written(model).map((n) => n.type)).toEqual(["half", "quarter"]);
  expect(names(model)).toEqual(["B2", "A2"]);
});

test("drag entry can be switched off in settings and stays off after reload", async ({ page }) => {
  await page.evaluate(() => { location.hash = "#settings"; });
  await page.waitForSelector("#set-drag");
  await page.uncheck("#set-drag");
  await page.reload();
  await page.waitForSelector("#set-drag");
  await expect(page.locator("#set-drag")).not.toBeChecked();
  await page.evaluate(() => { location.hash = "#list"; });
  await page.click(".idea-open");
  await page.waitForSelector("#score svg");
  await keypadDrag(page, "[data-dur='quarter']", 0, -3 * DY, { beforeUp: async () => { expect(await ghostLabel(page)).toBeNull(); } });
  expect(written(await getModel(page))).toHaveLength(0);
  await page.evaluate(() => { location.hash = "#settings"; });
  await page.check("#set-drag");
  await page.evaluate(() => { location.hash = "#list"; });
  await page.click(".idea-open");
  await page.waitForSelector("#score svg");
  await keypadDrag(page, "[data-dur='quarter']", 0, -3 * DY);
  expect(written(await getModel(page))).toHaveLength(1);
});

test("hide, show, and move the Keypad; the position is saved for each orientation", async ({ page }, testInfo) => {
  await page.click("[data-op='hide']");
  await expect(page.locator("#keypad")).toBeHidden();
  await expect(page.locator("#kp-show")).toBeVisible();
  await page.click("#kp-show");
  await expect(page.locator("#keypad")).toBeVisible();
  const before = await box(page, "#keypad");
  const grip = await box(page, ".kp-grip");
  const vp = page.viewportSize();
  const tx = Math.round(vp.width / 2);
  const ty = Math.round(vp.height / 2);
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 6);
  await page.mouse.down();
  await page.mouse.move(tx, ty, { steps: 6 });
  await page.mouse.up();
  const moved = await box(page, "#keypad");
  expect(Math.abs(moved.x - before.x) + Math.abs(moved.y - before.y)).toBeGreaterThan(40);
  const saved = await page.evaluate(() => BN.ui.get().keypad);
  const key = testInfo.project.name === "tablet-portrait" ? "portrait" : "landscape";
  expect(saved[key]).toBeTruthy();
  expect(saved[key === "portrait" ? "landscape" : "portrait"]).toBeFalsy();
  await page.evaluate(() => BN.store.flush());
  await page.reload();
  await page.waitForSelector("#score svg");
  const after = await box(page, "#keypad");
  expect(Math.abs(after.x - moved.x)).toBeLessThan(2);
  expect(Math.abs(after.y - moved.y)).toBeLessThan(2);
  await page.click("[data-op='hide']");
  await page.reload();
  await page.waitForSelector("#score svg");
  await expect(page.locator("#keypad")).toBeHidden();
  await expect(page.locator("#kp-show")).toBeVisible();
});

test("the Keypad stays inside the screen even when dragged past the edge", async ({ page }) => {
  const grip = await box(page, ".kp-grip");
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 6);
  await page.mouse.down();
  await page.mouse.move(-300, -300, { steps: 5 });
  await page.mouse.up();
  const b = await box(page, "#keypad");
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.y).toBeGreaterThanOrEqual(0);
});

test("layouts: dot, tie, rest, accidentals, delete, undo, and the other five tabs", async ({ page }) => {
  await fill(page, [["quarter", "C", 3], ["quarter", "C", 3]]);
  await selectNote(page, 0);
  await page.click("[data-op='dot']");
  expect(written(await getModel(page))[0].dots).toBe(1);
  await page.click("[data-op='tie']");
  expect(written(await getModel(page))[0].tie).toMatchObject({ start: true });
  await page.click("[data-op='sharp']");
  expect(names(await getModel(page))[0]).toBe("C#3");
  await page.click("[data-op='natural']");
  expect(names(await getModel(page))[0]).toBe("C3");
  await page.click("[data-op='rest']");
  expect(written(await getModel(page))[0].rest).toBe(true);
  await page.click(".kp-actions [data-action='undo']");
  expect(written(await getModel(page))[0].rest).toBeFalsy();
  await page.click("[data-op='delete']");
  expect(written(await getModel(page))[0].rest).toBe(true);
  await page.click("[data-kt='5']");
  await expect(page.locator("[data-op='bar:light-heavy']")).toBeVisible();
  await page.click("[data-op='bar:light-heavy']");
  expect((await getModel(page)).parts[0].measures[0].barline.right).toBe("light-heavy");
  await page.click("[data-kt='4']");
  await expect(page.locator("[data-op='dyn:mf']")).toBeVisible();
  await page.click("[data-kt='0']");
  await selectNote(page, 1);
  await page.click("[data-kt='4']");
  await page.click("[data-op='dyn:mf']");
  expect(written(await getModel(page))[1].dyn).toBe("mf");
  await page.click("[data-kt='2']");
  await page.click("[data-op='artic:staccato']");
  expect(written(await getModel(page))[1].artic).toEqual(["staccato"]);
  await page.click("[data-kt='3']");
  await page.click("[data-op='ghost']");
  expect(written(await getModel(page))[1].ghost).toBe(true);
  await page.click("[data-kt='1']");
  await page.click("[data-op='octUp']");
  expect(names(await getModel(page))).toEqual(["C4"]);
});

test("one-shot accidental applies to the next note entered by dragging", async ({ page }) => {
  await page.click("[data-op='flat']");
  await expect(page.locator("[data-op='flat']")).toHaveAttribute("aria-pressed", "true");
  await setLast(page, 2);
  await keypadDrag(page, "[data-dur='quarter']", 0, 0, { hold: true, beforeUp: async () => { await page.waitForTimeout(450); } });
  expect(names(await getModel(page))).toEqual(["Bb2"]);
  await expect(page.locator("[data-op='flat']")).toHaveAttribute("aria-pressed", "false");
});
