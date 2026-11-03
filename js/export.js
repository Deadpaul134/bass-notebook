/* Bass Notebook — JSON backup and PNG export. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});

  function stamp() {
    return BN.ymd();
  }

  function safeName(title) {
    var name = String(title || "page").replace(/[\\/:*?"<>|]+/g, " ").trim();
    return name || "page";
  }

  BN.export = {
    toJSON: function (pages) {
      var list = pages || BN.store.all();
      return {
        app: "bass-notebook",
        v: 1,
        exportedAt: new Date().toISOString(),
        pages: JSON.parse(JSON.stringify(list))
      };
    },

    validate: function (obj) {
      if (!obj || typeof obj !== "object" || obj.app !== "bass-notebook" || obj.v !== 1 || !Array.isArray(obj.pages)) {
        var err = new Error("הקובץ אינו גיבוי תקין של מחברת בס");
        err.hebrew = true;
        throw err;
      }
      obj.pages.forEach(function (page) {
        if (!page || !page.id || !Array.isArray(page.systems)) {
          throw new Error("הקובץ פגום: נמצא דף בלי מבנה");
        }
      });
      return obj;
    },

    mergePages: function (current, incoming) {
      var map = new Map();
      current.forEach(function (page) {
        map.set(page.id, page);
      });
      incoming.forEach(function (page) {
        var prev = map.get(page.id);
        var next = BN.migrate(JSON.parse(JSON.stringify(page)));
        if (!prev || String(next.updatedAt || "") > String(prev.updatedAt || "")) map.set(next.id, next);
      });
      return Array.from(map.values());
    },

    importData: function (obj, mode) {
      var data = BN.export.validate(obj);
      var pages = data.pages.map(function (page) {
        return BN.migrate(JSON.parse(JSON.stringify(page)));
      });
      if (mode === "replace") return BN.store.replaceAll(pages).then(function () { return pages.length; });
      var merged = BN.export.mergePages(BN.store.all(), pages);
      return BN.store.replaceAll(merged).then(function () { return pages.length; });
    },

    filename: function (page) {
      return "bass-notebook_" + safeName(page.title) + "_" + (page.date || stamp()) + ".png";
    },

    backupName: function () {
      return "bass-notebook-backup-" + stamp() + ".json";
    },

    pngBlob: function (page) {
      return new Promise(function (resolve, reject) {
        var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
        fontsReady.then(function () {
        var host = document.createElement("div");
        host.className = "export-host";
        host.style.cssText = "position:fixed;left:-4000px;top:0;width:1000px;background:#fffdf9;";
        document.body.appendChild(host);
        var score = document.createElement("div");
        host.appendChild(score);
        var layout;
        try {
          layout = BN.render.draw(page, score, { light: true });
        } catch (err) {
          host.remove();
          reject(err);
          return;
        }
        var svg = score.querySelector("svg");
        var width = 2000;
        var logicalH = layout.logicalH;
        var height = Math.round((logicalH / 1000) * width);
        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fffdf9";
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = "#3b2f28";
        ctx.font = "600 54px Heebo, sans-serif";
        ctx.direction = "rtl";
        ctx.textAlign = "right";
        ctx.fillText(page.title || "רעיון", width - 48, 78);
        ctx.font = "400 32px Heebo, sans-serif";
        ctx.fillStyle = "#5c4b40";
        var tempo = page.tempo ? "  ·  ♩=" + page.tempo : "";
        ctx.fillText((page.date || "") + "   " + (page.key || "C") + "   " + (page.time || "4/4") + tempo, width - 48, 124);

        var xml = new XMLSerializer().serializeToString(svg);
        var blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function () {
          var headerPx = Math.round((layout.headerLogical / 1000) * width);
          var scoreH = Math.round((layout.userH / layout.userW) * width);
          ctx.drawImage(img, 0, headerPx, width, scoreH);
          (page.strokes || []).forEach(function (stroke) {
            if (!stroke.points || stroke.points.length < 2 || !BN.getStroke) return;
            var sx = width / 1000;
            var sy = height / logicalH;
            var sim = stroke.points.every(function (p) {
              return p[2] == null || p[2] === 0 || p[2] === 0.5;
            });
            var size = (stroke.size || 6) * (stroke.tool === "highlighter" ? 2.4 : 1.35) * sx;
            var outline = BN.getStroke(
              stroke.points.map(function (p) {
                return [p[0] * sx, p[1] * sy, p[2] == null ? 0.5 : p[2]];
              }),
              { size: size, thinning: 0.65, smoothing: 0.5, streamline: 0.45, simulatePressure: sim, last: true }
            );
            if (!outline.length) return;
            ctx.beginPath();
            outline.forEach(function (pt, i) {
              if (i === 0) ctx.moveTo(pt[0], pt[1]);
              else ctx.lineTo(pt[0], pt[1]);
            });
            ctx.closePath();
            var color = stroke.color === "accent" ? "#de7a60" : stroke.color === "blue" ? "#3d6fa8" : stroke.color === "green" ? "#5f9f7c" : "#3b2f28";
            ctx.globalAlpha = stroke.tool === "highlighter" ? 0.38 : 1;
            ctx.fillStyle = color;
            ctx.fill();
            ctx.globalAlpha = 1;
          });
          URL.revokeObjectURL(url);
          host.remove();
          if (BN.render && document.getElementById("score")) {
            /* caller redraws the live page */
          }
          canvas.toBlob(function (out) {
            resolve(out);
          }, "image/png");
        };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          host.remove();
          reject(new Error("png"));
        };
        img.src = url;
        }).catch(reject);
      });
    },

    thumb: function (page) {
      return BN.export.pngBlob(page).then(function (blob) {
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function () {
            var img = new Image();
            img.onload = function () {
              var c = document.createElement("canvas");
              c.width = 480;
              c.height = Math.round((img.height / img.width) * 480);
              var ctx = c.getContext("2d");
              ctx.drawImage(img, 0, 0, c.width, c.height);
              resolve(c.toDataURL("image/png", 0.7));
            };
            img.src = reader.result;
          };
          reader.readAsDataURL(blob);
        });
      });
    }
  };
})();
