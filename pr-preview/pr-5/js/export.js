/* PNG, PDF, and JSON backup. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});

  function safe(name) {
    return String(name || "score").replace(/[\\/:*?"<>|]+/g, " ").trim() || "score";
  }

  function filename(score, ext) {
    return safe(score.title) + "_" + (score.date || "score") + "." + ext;
  }

  var PRINT = { text: "#16181c", staff: "#16181c", accent: "#16181c", select: "#16181c", selectSoft: "rgba(0,0,0,0)", play: "#16181c", muted: "#555a63" };

  function renderSvg(score, width) {
    var host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-4000px;top:0;width:" + width + "px;background:#ffffff;";
    document.body.appendChild(host);
    BN.render.draw(score, host, { width: width, scale: 1, colors: PRINT });
    return host;
  }

  function restoreScreen() {
    if (BN.state.current && document.body.dataset.screen === "editor") BN.editor.redraw();
  }

  function loadSvg(svg) {
    var box = svg.viewBox && svg.viewBox.baseVal;
    if (box && box.width) {
      svg.setAttribute("width", String(box.width));
      svg.setAttribute("height", String(box.height));
    }
    var xml = new XMLSerializer().serializeToString(svg);
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("png")); };
      img.src = url;
    });
  }

  function fontsReady() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all([document.fonts.load("600 40px Heebo", "אבג"), document.fonts.load("20px Heebo", "abc")]).catch(function () {});
  }

  /* Title block as a canvas: Hebrew text needs a font the PDF library does not ship. */
  function headCanvas(score, width) {
    var canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = Math.round(width * 0.075);
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#16181c";
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    ctx.font = "600 " + Math.round(width * 0.03) + "px Heebo, sans-serif";
    ctx.fillText(score.title || "", width / 2, Math.round(width * 0.036));
    ctx.font = Math.round(width * 0.016) + "px Heebo, sans-serif";
    ctx.fillStyle = "#555a63";
    ctx.textAlign = "right";
    ctx.fillText(score.composer || "", width - 4, Math.round(width * 0.066));
    ctx.textAlign = "left";
    ctx.direction = "ltr";
    ctx.fillText("♩ = " + score.tempo.bpm, 4, Math.round(width * 0.066));
    return canvas;
  }

  function svgToPng(score) {
    var host = renderSvg(score, 1000);
    var svgs = Array.prototype.slice.call(host.querySelectorAll("svg"));
    return fontsReady().then(function () {
      return Promise.all(svgs.map(loadSvg));
    }).then(function (images) {
      var W = 2000;
      var head = headCanvas(score, W);
      var rows = images.map(function (img) {
        return { img: img, h: Math.max(80, Math.round(W * (img.height / Math.max(1, img.width)))) };
      });
      var canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = head.height + 20 + rows.reduce(function (sum, row) { return sum + row.h; }, 0) + 40;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(head, 0, 20);
      var y = head.height + 20;
      rows.forEach(function (row) {
        ctx.drawImage(row.img, 0, y, W, row.h);
        y += row.h;
      });
      host.remove();
      restoreScreen();
      return new Promise(function (resolve) { canvas.toBlob(function (blob) { resolve(blob); }, "image/png"); });
    }).catch(function (err) {
      host.remove();
      restoreScreen();
      throw err;
    });
  }

  function pdfBlob(score) {
    var host = renderSvg(score, 800);
    var svgs = Array.prototype.slice.call(host.querySelectorAll("svg"));
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) { host.remove(); restoreScreen(); return Promise.reject(new Error("pdf")); }
    var doc = new jsPDF({ unit: "mm", format: "a4" });
    var M = 12;
    var W = 210 - 2 * M;
    var pageH = 297;
    var y = M;
    svgs.forEach(function (svg) {
      var box = svg.viewBox && svg.viewBox.baseVal;
      if (box && box.width) {
        svg.setAttribute("width", String(box.width));
        svg.setAttribute("height", String(box.height));
      }
    });
    return fontsReady().then(function () {
      var head = headCanvas(score, 1600);
      var headH = W * (head.height / head.width);
      doc.addImage(head.toDataURL("image/png"), "PNG", M, y, W, headH);
      y += headH + 4;
      var chain = Promise.resolve();
      svgs.forEach(function (svg) {
        chain = chain.then(function () {
          var box = svg.viewBox.baseVal;
          var h = W * (box.height / box.width);
          if (y + h > pageH - M) { doc.addPage(); y = M; }
          var top = y;
          y += h;
          return doc.svg(svg, { x: M, y: top, width: W, height: h });
        });
      });
      return chain;
    }).then(function () {
      host.remove();
      restoreScreen();
      return doc.output("blob");
    }).catch(function () {
      host.remove();
      restoreScreen();
      return doc.output("blob");
    });
  }

  BN.export = {
    filename: filename,
    toJSON: function (scores) {
      return { app: "bass-notebook", v: 2, exportedAt: new Date().toISOString(), scores: JSON.parse(JSON.stringify(scores || BN.store.all())) };
    },
    validate: function (obj) {
      if (!obj || obj.app !== "bass-notebook" || (obj.v !== 1 && obj.v !== 2)) throw new Error("הקובץ אינו גיבוי תקין של מחברת בס");
      if (obj.v === 1 && !Array.isArray(obj.pages)) throw new Error("הקובץ פגום");
      if (obj.v === 2 && !Array.isArray(obj.scores)) throw new Error("הקובץ פגום");
      return obj;
    },
    importData: function (obj, mode) {
      var data = BN.export.validate(obj);
      var incoming = data.v === 1 ? data.pages.map(BN.model.migrateV1) : data.scores.map(function (s) { return JSON.parse(JSON.stringify(s)); });
      if (mode === "replace") return BN.store.replaceAll(incoming);
      var map = new Map();
      BN.store.all().forEach(function (s) { map.set(s.id, s); });
      incoming.forEach(function (s) {
        var prev = map.get(s.id);
        if (!prev || String(s.updatedAt || "") > String(prev.updatedAt || "")) map.set(s.id, s);
      });
      return BN.store.replaceAll(Array.from(map.values()));
    },
    pngBlob: svgToPng,
    pdfBlob: pdfBlob,
    download: function (blob, name) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1500);
    }
  };
})();
