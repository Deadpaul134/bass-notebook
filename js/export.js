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

  function renderSvg(score, width) {
    var host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-4000px;top:0;width:" + width + "px;background:#fffdf9;";
    document.body.appendChild(host);
    BN.render.draw(score, host, { width: width, colors: { text: "#3b2f28", staff: "#8a7868", accent: "#de7a60" } });
    return host;
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

  function svgToPng(score) {
    var host = renderSvg(score, 1000);
    var svgs = Array.prototype.slice.call(host.querySelectorAll("svg"));
    return Promise.all(svgs.map(loadSvg)).then(function (images) {
      var canvas = document.createElement("canvas");
      canvas.width = 2000;
      var head = 150;
      var rows = images.map(function (img) {
        var h = Math.max(80, Math.round(2000 * (img.height / Math.max(1, img.width))));
        return { img: img, h: h };
      });
      canvas.height = head + rows.reduce(function (sum, row) { return sum + row.h; }, 0) + 40;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fffdf9";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#3b2f28";
      ctx.font = "600 54px Heebo, sans-serif";
      ctx.direction = "rtl";
      ctx.textAlign = "right";
      ctx.fillText(score.title || "", canvas.width - 40, 70);
      ctx.font = "32px Heebo, sans-serif";
      ctx.fillText((score.date || "") + "   quarter=" + score.tempo.bpm, canvas.width - 40, 120);
      var y = head;
      rows.forEach(function (row) {
        ctx.drawImage(row.img, 0, y, canvas.width, row.h);
        y += row.h;
      });
      host.remove();
      if (document.getElementById("score")) BN.editor.redraw();
      return new Promise(function (resolve) { canvas.toBlob(function (blob) { resolve(blob); }, "image/png"); });
    }).catch(function (err) {
      host.remove();
      throw err;
    });
  }

  function pdfBlob(score) {
    var host = renderSvg(score, 700);
    var svg = host.querySelector("svg");
    var box = svg && svg.viewBox && svg.viewBox.baseVal;
    if (svg && box && box.width) {
      svg.setAttribute("width", String(box.width));
      svg.setAttribute("height", String(box.height));
    }
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) { host.remove(); return Promise.reject(new Error("pdf")); }
    var doc = new jsPDF({ unit: "mm", format: "a4" });
    doc.setFontSize(16);
    doc.text(score.title || "", 200, 16, { align: "right" });
    doc.setFontSize(11);
    doc.text((score.date || "") + "  quarter = " + score.tempo.bpm, 200, 24, { align: "right" });
    var draw = doc.svg ? doc.svg(svg, { x: 10, y: 32, width: 190 }) : Promise.resolve();
    return Promise.resolve(draw).then(function () {
      host.remove();
      if (document.getElementById("score")) BN.editor.redraw();
      return doc.output("blob");
    }).catch(function () {
      host.remove();
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
