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

async function newPage(page) {
  await page.click("[data-action='new-page']");
  await page.waitForSelector("#score svg");
  await page.waitForFunction(() => window.BN && BN.render && BN.render.layout);
}

async function ensureTap(page) {
  const mode = page.locator("[data-mode='tap']");
  if ((await mode.getAttribute("aria-pressed")) !== "true") await mode.click();
}

async function pointFor(page, systemIdx, staffIdx, pos, measureIdx) {
  return page.evaluate(({ systemIdx, staffIdx, pos, measureIdx }) => {
    const stage = document.getElementById("stage");
    const place = () => ({
      x: window.BN.render.measureX(systemIdx, measureIdx),
      y: window.BN.render.posToY(systemIdx, staffIdx, pos)
    });
    let pt = place();
    const rect = stage.getBoundingClientRect();
    if (pt.y < rect.top + 40 || pt.y > rect.bottom - 40) {
      stage.scrollTop += pt.y - (rect.top + rect.height / 2);
    }
    if (pt.x < rect.left + 24 || pt.x > rect.right - 24) {
      stage.scrollLeft += pt.x - (rect.left + rect.width / 2);
    }
    pt = place();
    if (pt.y < 48 || pt.y > window.innerHeight - 48) {
      window.scrollBy(0, pt.y - window.innerHeight / 2);
      pt = place();
    }
    return pt;
  }, { systemIdx, staffIdx, pos, measureIdx });
}

async function tapStaff(page, systemIdx, staffIdx, pos, measureIdx = 0) {
  await ensureTap(page);
  const pt = await pointFor(page, systemIdx, staffIdx, pos, measureIdx);
  await page.mouse.click(pt.x, pt.y);
  await page.waitForTimeout(40);
}

async function dragStaff(page, systemIdx, staffIdx, fromPos, toPos, measureIdx = 0) {
  await ensureTap(page);
  const pts = await page.evaluate(({ systemIdx, staffIdx, toPos, measureIdx }) => {
    const stage = document.getElementById("stage");
    const notes = window.BN.render.layout.notes.filter((n) => n.system === systemIdx && n.staff === staffIdx && n.measure === measureIdx);
    const note = notes[notes.length - 1];
    const center = window.BN.render.svgPoint(note.x + note.w / 2, note.pitchY);
    const destY = window.BN.render.posToY(systemIdx, staffIdx, toPos);
    const rect = stage.getBoundingClientRect();
    const mid = (center.y + destY) / 2;
    if (mid < rect.top + 50 || mid > rect.bottom - 50) {
      stage.scrollTop += mid - (rect.top + rect.height / 2);
    }
    const again = window.BN.render.svgPoint(note.x + Math.min(note.w / 2, 8), note.pitchY);
    return { a: again, b: { x: again.x, y: window.BN.render.posToY(systemIdx, staffIdx, toPos) } };
  }, { systemIdx, staffIdx, fromPos, toPos, measureIdx });
  await page.mouse.move(pts.a.x, pts.a.y);
  await page.mouse.down();
  await page.mouse.move(pts.b.x, pts.b.y, { steps: 8 });
  await page.mouse.up();
}

async function drawStroke(page, points, options = {}) {
  const pointerType = options.pointerType || "pen";
  const pressure = options.pressure;
  const width = options.width || 2;
  await page.evaluate(({ points, pointerType, pressure, width }) => {
    const el = document.getElementById("sheet");
    const fire = (type, pt, buttons) => {
      const ev = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType,
        clientX: pt.x,
        clientY: pt.y,
        pressure: pressure == null ? (pt.p == null ? 0.5 : pt.p) : pressure,
        buttons,
        button: 0,
        isPrimary: true,
        width,
        height: width
      });
      el.dispatchEvent(ev);
    };
    fire("pointerdown", points[0], 1);
    points.slice(1).forEach((pt) => fire("pointermove", pt, 1));
    fire("pointerup", points[points.length - 1], 0);
  }, { points, pointerType, pressure, width });
}

async function model(page) {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.BN.app.getPage())));
}

module.exports = { freshApp, newPage, ensureTap, tapStaff, dragStaff, drawStroke, model, pointFor };
