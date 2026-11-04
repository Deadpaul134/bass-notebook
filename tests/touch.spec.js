const { test, expect } = require("@playwright/test");
const { freshApp, newScore, tapStaff, getModel, written } = require("./helpers");

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.use.hasTouch !== true, "tablet touch only");
});

function pitched(score) {
  return written(score).filter((note) => note.pitch);
}

async function fingersFor(page, specs) {
  const points = await page.evaluate((wanted) => {
    const stage = document.getElementById("stage");
    let targets = wanted.map((spec) => BN.render.locate(spec));
    const rect = stage.getBoundingClientRect();
    const lowest = Math.max.apply(null, targets.map((point) => point.y));
    const highest = Math.min.apply(null, targets.map((point) => point.y));
    if (highest < rect.top + 36 || lowest + 130 > rect.bottom) {
      stage.scrollTop += lowest - (rect.bottom - 170);
      targets = wanted.map((spec) => BN.render.locate(spec));
    }
    return targets.map((target, index) => {
      const spec = wanted[index];
      for (let dy = 0; dy <= 120; dy += 1) {
        const y = target.y + dy;
        const hit = BN.render.hit(BN.state.current, target.x, y);
        if (!hit || hit.staff !== (spec.staff || 1)) continue;
        if (BN.editor.aimPos(hit, "touch") === spec.pos) return { x: target.x, y: y, pitchY: target.y };
      }
      return null;
    });
  }, specs);
  points.forEach((point, index) => {
    expect(point, "finger position for " + JSON.stringify(specs[index])).toBeTruthy();
  });
  return points;
}

async function fingerFor(page, spec) {
  const [point] = await fingersFor(page, [spec]);
  return point;
}

async function notePoint(page, id) {
  return page.evaluate((noteId) => {
    const meta = BN.render.layout.notes[noteId];
    const stage = document.getElementById("stage");
    const place = () => BN.render.client(meta.svg, meta.x + Math.min(meta.w / 2, 8), meta.pitchY);
    let point = place();
    const rect = stage.getBoundingClientRect();
    if (point.y < rect.top + 40 || point.y > rect.bottom - 40) stage.scrollTop += point.y - (rect.top + rect.height / 2);
    return place();
  }, id);
}

async function touchSession(page, run) {
  const client = await page.context().newCDPSession(page);
  const api = {
    start: (point) => client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: point.x, y: point.y, id: 1 }]
    }),
    move: (point) => client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: point.x, y: point.y, id: 1 }]
    }),
    end: () => client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  };
  try {
    await run(api);
  } finally {
    await client.detach();
  }
}

test("touch drag previews a clef-aware pitch and commits on release", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  expect(await page.evaluate(() => BN.render.stepPx(0, 1))).toBeGreaterThanOrEqual(16);

  const [start, end] = await fingersFor(page, [
    { staff: 1, measure: 0, pos: 4, slot: "end" },
    { staff: 1, measure: 0, pos: -2, slot: "end" }
  ]);
  expect(start.y).toBeGreaterThan(start.pitchY + 24);

  await touchSession(page, async (touch) => {
    await touch.start(start);
    await expect(page.locator("#ghost")).toBeVisible();
    await expect(page.locator("#ghost")).toHaveText("D3");
    await expect(page.locator("#ghost-head")).toBeVisible();
    const ghost = await page.locator("#ghost").boundingBox();
    expect(ghost.y + ghost.height).toBeLessThan(start.y - 16);
    expect(pitched(await getModel(page))).toHaveLength(0);

    await touch.move(end);
    await expect(page.locator("#ghost")).toHaveText("E2");
    expect(pitched(await getModel(page))).toHaveLength(0);
    const lifted = await page.locator("#ghost-head").boundingBox();
    expect(lifted.y + lifted.height).toBeLessThan(end.y - 16);

    await touch.end();
  });

  const notes = pitched(await getModel(page));
  expect(notes).toHaveLength(1);
  expect(notes[0].pitch.step + notes[0].pitch.octave).toBe("E2");
  await page.click(".top [data-action='undo']");
  expect(pitched(await getModel(page))).toHaveLength(0);
});

test("touch tap places, selects without adding, and empty staff places again", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  const first = await fingerFor(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  await touchSession(page, async (touch) => {
    await touch.start(first);
    await touch.end();
  });
  let notes = pitched(await getModel(page));
  expect(notes).toHaveLength(1);
  expect(notes[0].pitch.step + notes[0].pitch.octave).toBe("G2");

  const onNote = await notePoint(page, notes[0].id);
  await touchSession(page, async (touch) => {
    await touch.start(onNote);
    await touch.end();
  });
  notes = pitched(await getModel(page));
  expect(notes).toHaveLength(1);
  expect(notes[0].pitch.step).toBe("G");
  await expect(page.locator(".vf-stavenote.is-selected")).toHaveCount(1);
  const fill = await page.locator(".vf-stavenote.is-selected path").first().evaluate((el) => getComputedStyle(el).fill);
  expect(fill.replace(/\s/g, "")).toMatch(/222,122,96/);
  await expect(page.locator("#selection-bar")).toBeVisible();
  await expect(page.locator("#selection-bar [data-action='delete']")).toBeVisible();
  await expect(page.locator("#selection-bar [data-action='step-up']")).toBeVisible();
  await expect(page.locator("#selection-bar [data-action='step-down']")).toBeVisible();

  const second = await fingerFor(page, { staff: 1, measure: 0, pos: 2, slot: "end" });
  await touchSession(page, async (touch) => {
    await touch.start(second);
    await touch.end();
  });
  notes = pitched(await getModel(page));
  expect(notes.map((note) => note.pitch.step)).toEqual(["G", "B"]);
  await expect(page.locator("#selection-bar")).toBeHidden();
  expect(await page.evaluate(() => (BN.state.selection || []).length)).toBe(0);
});

test("arrows, duration, delete, and long-press edit the selected note through undo", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  let notes = pitched(await getModel(page));
  const onNote = await notePoint(page, notes[0].id);
  await touchSession(page, async (touch) => {
    await touch.start(onNote);
    await touch.end();
  });

  await page.click("#selection-bar [data-action='step-up']");
  notes = pitched(await getModel(page));
  expect(notes[0].pitch.step + notes[0].pitch.octave).toBe("A2");
  await page.click("#selection-bar [data-action='step-down']");
  notes = pitched(await getModel(page));
  expect(notes[0].pitch.step + notes[0].pitch.octave).toBe("G2");
  await page.click(".top [data-action='undo']");
  expect(pitched(await getModel(page))[0].pitch.step).toBe("A");
  await page.click(".top [data-action='undo']");
  expect(pitched(await getModel(page))[0].pitch.step).toBe("G");

  await page.click("[data-type='half']");
  expect(written(await getModel(page))[0].type).toBe("half");
  await page.click(".top [data-action='undo']");
  expect(written(await getModel(page))[0].type).toBe("quarter");

  await page.click("#selection-bar [data-action='delete']");
  expect(pitched(await getModel(page))).toHaveLength(0);
  await page.click(".top [data-action='undo']");
  notes = pitched(await getModel(page));
  expect(notes[0].pitch.step).toBe("G");

  const again = await notePoint(page, notes[0].id);
  await touchSession(page, async (touch) => {
    await touch.start(again);
    await page.waitForTimeout(650);
    expect(pitched(await getModel(page))).toHaveLength(0);
    await touch.end();
  });
  expect(pitched(await getModel(page))).toHaveLength(0);
  await page.click(".top [data-action='undo']");
  expect(pitched(await getModel(page))[0].pitch.step).toBe("G");
});

test("editor controls are at least 48px and the toolbar stays fixed while the score scrolls", async ({ page }) => {
  await freshApp(page);
  await newScore(page);
  await tapStaff(page, { staff: 1, measure: 0, pos: 0, slot: "end" });
  const id = pitched(await getModel(page))[0].id;
  const onNote = await notePoint(page, id);
  await touchSession(page, async (touch) => {
    await touch.start(onNote);
    await touch.end();
  });
  await expect(page.locator("#selection-bar")).toBeVisible();

  const small = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("[data-screen='editor'] button, [data-screen='editor'] input, #selection-bar button"));
    return nodes.filter((el) => {
      const box = el.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) return false;
      return box.width < 48 || box.height < 48;
    }).map((el) => ({
      label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24),
      w: Math.round(el.getBoundingClientRect().width),
      h: Math.round(el.getBoundingClientRect().height)
    }));
  });
  expect(small).toEqual([]);

  const palette = page.locator("#palette");
  const top = page.locator(".editor .top");
  const beforePalette = await palette.boundingBox();
  const beforeTop = await top.boundingBox();
  const undo = await page.locator("#palette [data-hist='undo']").boundingBox();
  const quarter = await page.locator("#palette [data-type='quarter']").boundingBox();
  const viewport = page.viewportSize();
  expect(undo.y).toBeGreaterThan(viewport.height * 0.6);
  expect(quarter.y).toBeGreaterThan(viewport.height * 0.6);
  expect(beforePalette.y + beforePalette.height).toBeLessThanOrEqual(viewport.height + 1);

  await page.evaluate(() => {
    const stage = document.getElementById("stage");
    const score = document.getElementById("score");
    const spacer = document.createElement("div");
    spacer.style.height = "1400px";
    score.appendChild(spacer);
    stage.scrollTop = 900;
    window.scrollTo(0, 600);
  });
  const afterPalette = await palette.boundingBox();
  const afterTop = await top.boundingBox();
  expect(Math.abs(afterPalette.y - beforePalette.y)).toBeLessThan(2);
  expect(Math.abs(afterTop.y - beforeTop.y)).toBeLessThan(2);
  expect(afterTop.y).toBeGreaterThanOrEqual(0);
  expect(afterTop.y + afterTop.height).toBeLessThanOrEqual(viewport.height);
  expect(afterPalette.y).toBeGreaterThan(viewport.height * 0.6);
  await expect(page.locator("#palette [data-zoom='in']")).toBeVisible();
});
