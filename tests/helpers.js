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
  await page.waitForSelector("[data-screen='list']");
}

async function newScore(page, opts = {}) {
  const layout = opts.layout || "bass";
  await page.click("[data-action='new-score']");
  await page.click(`[data-layout='${layout}']`);
  await page.waitForSelector("#score svg");
  await page.waitForFunction(() => window.BN && BN.render && BN.render.layout);
}

async function tapStaff(page, spec) {
  const pt = await page.evaluate((wanted) => {
    const stage = document.getElementById("stage");
    const place = () => window.BN.render.locate(wanted);
    let point = place();
    const rect = stage.getBoundingClientRect();
    if (point.y < rect.top + 24 || point.y > rect.bottom - 24) stage.scrollTop += point.y - (rect.top + rect.height / 2);
    if (point.x < rect.left + 16 || point.x > rect.right - 16) stage.scrollLeft += point.x - (rect.left + rect.width / 2);
    point = place();
    return point;
  }, spec);
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

async function dragNote(page, id, steps) {
  const pts = await page.evaluate(({ id, steps }) => {
    const meta = window.BN.render.layout.notes[id];
    const found = window.BN.model.find(window.BN.state.current, id);
    const clef = window.BN.state.current.staffLayout === "grand"
      ? (found.note.staff === 1 ? "treble" : "bass")
      : (window.BN.state.current.staffLayout === "treble" ? "treble" : "bass");
    const pos = window.BN.music.pitchToPos(clef, found.note.pitch);
    const box = window.BN.render.layout.byMeasure[meta.measure];
    const a = window.BN.render.client(meta.svg, meta.x + Math.min(4, meta.w / 2), meta.pitchY);
    const b = window.BN.render.locate({ staff: found.note.staff, measure: meta.measure, pos: pos + steps, slot: 0 });
    b.x = a.x;
    return { a, b, box: !!box };
  }, { id, steps });
  await page.mouse.move(pts.a.x, pts.a.y);
  await page.mouse.down();
  await page.mouse.move(pts.b.x, pts.b.y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(40);
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

module.exports = { freshApp, newScore, tapStaff, getModel, written, dragNote, touchGesture };
