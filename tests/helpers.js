async function freshApp(page) {
  await page.goto("/?nosw=1#list");
  await page.evaluate(async () => {
    localStorage.clear();
    if (window.BN && BN.store && BN.store.close) await BN.store.close();
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase("bass-notebook");
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  });
  await page.reload();
  await page.waitForSelector("#screen-list:not([hidden]) .fab");
}

async function newScore(page, opts = {}) {
  const layout = opts.layout || "bass";
  await page.click("[data-action='new-score']");
  await page.click(`[data-layout='${layout}']`);
  await page.waitForSelector("#score svg");
  await page.waitForFunction(() => window.BN && BN.render && BN.render.layout && BN.state.current);
}

/* Bring a point into the scroll area and return its client coordinates. */
async function locate(page, spec) {
  return page.evaluate((wanted) => {
    const stage = document.getElementById("stage");
    let point = window.BN.render.locate(wanted);
    const rect = stage.getBoundingClientRect();
    if (point.y < rect.top + 40 || point.y > rect.bottom - 40) stage.scrollTop += point.y - (rect.top + rect.height / 3);
    point = window.BN.render.locate(wanted);
    return point;
  }, spec);
}

/* The floating Keypad may sit over the staff; hide it when a test needs to touch what is under it. */
async function uncover(page, x, y) {
  const covered = await page.evaluate(({ x, y }) => {
    /* touch hit-testing is fuzzy, so look around the point as well */
    return [[0, 0], [14, 0], [-14, 0], [0, 14], [0, -14]].some(([dx, dy]) => {
      const el = document.elementFromPoint(x + dx, y + dy);
      return !!(el && el.closest("#keypad, #ctx"));
    });
  }, { x, y });
  if (covered) {
    await page.evaluate((px) => {
      const k = document.getElementById("keypad");
      const ui = BN.ui.get().keypad;
      const key = innerHeight > innerWidth ? "portrait" : "landscape";
      ui[key] = { x: px < innerWidth / 2 ? innerWidth - k.offsetWidth - 4 : 4, y: innerHeight - k.offsetHeight - 4 };
      BN.ui.set({ keypad: ui });
      BN.ui.keypad.place();
    }, x);
  }
}

async function tapStaff(page, spec) {
  const pt = await locate(page, spec);
  await uncover(page, pt.x, pt.y);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(20);
}

async function getModel(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.BN.state.current)));
}

function written(model, staff) {
  const notes = [];
  model.parts[0].measures.forEach((measure) => {
    measure.notes.forEach((note) => {
      if (note.generated) return;
      if (staff && note.staff !== staff) return;
      notes.push(note);
    });
  });
  return notes;
}

function names(model, staff) {
  return written(model, staff).filter((n) => n.pitch).map((n) => n.pitch.step + (n.pitch.alter === 1 ? "#" : n.pitch.alter === -1 ? "b" : "") + n.pitch.octave);
}

/* Fill the current score from [type, step, octave, alter?] rows without going through the UI. */
async function fill(page, rows, staff = 1) {
  await page.evaluate(({ rows, staff }) => {
    const score = BN.state.current;
    rows.forEach(([type, step, octave, alter]) => {
      BN.model.append(score, staff, BN.model.noteFromPalette({ type, staff }, { step, alter: alter || 0, octave }));
    });
    BN.store.schedule(score);
    BN.editor.redraw();
  }, { rows, staff });
}

async function noteId(page, index, staff = 1) {
  return page.evaluate(({ index, staff }) => BN.model.refs(BN.state.current, staff)[index].note.id, { index, staff });
}

async function clickNote(page, id) {
  const pt = await page.evaluate((nid) => {
    const stage = document.getElementById("stage");
    let r = BN.render.noteRect(nid);
    const box = stage.getBoundingClientRect();
    if (r.cy < box.top + 40 || r.cy > box.bottom - 40) stage.scrollTop += r.cy - (box.top + box.height / 3);
    r = BN.render.noteRect(nid);
    return { x: r.cx, y: r.cy };
  }, id);
  await uncover(page, pt.x, pt.y);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(30);
}

async function selectNote(page, index, staff = 1) {
  await clickNote(page, await noteId(page, index, staff));
}

async function box(page, selector) {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error("no box for " + selector);
  return b;
}

/* Hold on a Keypad key, slide by (dx, dy), release. */
async function keypadDrag(page, selector, dx, dy, opts = {}) {
  const b = await box(page, selector);
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: opts.steps || 8 });
  if (opts.beforeUp) await opts.beforeUp();
  if (!opts.hold) await page.waitForTimeout(10);
  if (!opts.keepDown) await page.mouse.up();
  await page.waitForTimeout(30);
}

async function touchGesture(page, points) {
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points.map((point, index) => ({ x: point.x, y: point.y, id: index + 1 }))
  });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await client.detach();
}

function isPortrait(testInfo) { return testInfo.project.name === "tablet-portrait"; }

module.exports = { uncover, freshApp, newScore, locate, tapStaff, getModel, written, names, fill, noteId, clickNote, selectNote, box, keypadDrag, touchGesture, isPortrait };
