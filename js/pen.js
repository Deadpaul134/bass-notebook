/* Bass Notebook — stylus ink, palm rejection, eraser. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var active = null;

  function pathFromOutline(points) {
    if (!points || points.length < 2) return "";
    var d = "";
    for (var i = 0; i < points.length; i++) {
      var x = points[i][0];
      var y = points[i][1];
      d += (i === 0 ? "M" : "L") + x.toFixed(2) + " " + y.toFixed(2) + " ";
    }
    return d + "Z";
  }

  function simulate(points) {
    if (!points.length) return true;
    var first = points[0][2];
    for (var i = 0; i < points.length; i++) {
      var p = points[i][2];
      if (p == null) return true;
      if (Math.abs(p - first) > 0.02 && p !== 0 && p !== 0.5) return false;
    }
    return first === 0 || first === 0.5 || first == null;
  }

  function outline(points, size, sim) {
    var stroke = BN.getStroke(
      points.map(function (p) {
        return [p[0], p[1], p[2] == null ? 0.5 : p[2]];
      }),
      {
        size: size,
        thinning: 0.65,
        smoothing: 0.55,
        streamline: 0.45,
        simulatePressure: sim,
        last: true
      }
    );
    return pathFromOutline(stroke);
  }

  function renderSize(stroke) {
    var base = stroke.size || 6;
    var mul = stroke.tool === "highlighter" ? 2.4 : 1.35;
    return base * mul;
  }

  BN.pen = {
    colorOf: function (token) {
      var s = getComputedStyle(document.documentElement);
      if (token === "accent") return (s.getPropertyValue("--accent") || "#de7a60").trim();
      if (token === "blue") return "#3d6fa8";
      if (token === "green") return (s.getPropertyValue("--good") || "#5f9f7c").trim();
      return (s.getPropertyValue("--text") || "#3b2f28").trim();
    },

    redraw: function (svg, strokes) {
      if (!svg) return;
      var old = svg.querySelectorAll("[data-stroke]");
      old.forEach(function (node) {
        node.remove();
      });
      (strokes || []).forEach(function (stroke) {
        if (!stroke.points || stroke.points.length < 2) return;
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", outline(stroke.points, renderSize(stroke), simulate(stroke.points)));
        path.setAttribute("fill", BN.pen.colorOf(stroke.color));
        path.setAttribute("data-stroke", stroke.id);
        if (stroke.tool === "highlighter") {
          path.setAttribute("opacity", "0.38");
          path.setAttribute("style", "mix-blend-mode:multiply");
        }
        svg.appendChild(path);
      });
    },

    down: function (page, e) {
      var logical = BN.render.clientToLogical(e.clientX, e.clientY);
      var pressure = typeof e.pressure === "number" ? e.pressure : 0.5;
      active = {
        id: BN.uid("k"),
        tool: e.altKey ? "highlighter" : BN.pen.tool || "pen",
        color: BN.pen.color || "ink",
        size: BN.pen.size || 6,
        points: [[round(logical[0]), round(logical[1]), pressure]],
        pointerId: e.pointerId
      };
      BN.pen.paintLive(active);
    },

    move: function (e) {
      if (!active || e.pointerId !== active.pointerId) return;
      var list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      if (!list || !list.length) list = [e];
      list.forEach(function (ev) {
        var logical = BN.render.clientToLogical(ev.clientX, ev.clientY);
        var pressure = typeof ev.pressure === "number" ? ev.pressure : 0.5;
        var last = active.points[active.points.length - 1];
        var x = round(logical[0]);
        var y = round(logical[1]);
        if (Math.abs(last[0] - x) < 0.15 && Math.abs(last[1] - y) < 0.15) return;
        active.points.push([x, y, pressure]);
      });
      BN.pen.paintLive(active);
    },

    up: function (page, e) {
      if (!active) return null;
      if (e && e.pointerId !== active.pointerId) return null;
      var stroke = active;
      active = null;
      BN.pen.clearLive();
      if (stroke.points.length === 1) {
        stroke.points.push([stroke.points[0][0] + 0.6, stroke.points[0][1] + 0.2, stroke.points[0][2]]);
      }
      return stroke;
    },

    cancel: function () {
      active = null;
      BN.pen.clearLive();
    },

    paintLive: function (stroke) {
      var canvas = document.getElementById("live");
      var sheet = document.getElementById("sheet");
      if (!canvas || !sheet || !stroke) return;
      var dpr = window.devicePixelRatio || 1;
      var w = Math.max(1, Math.round(sheet.offsetWidth * dpr));
      var h = Math.max(1, Math.round(sheet.offsetHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      var layout = BN.render.layout;
      if (!layout) return;
      var sx = canvas.width / 1000;
      var sy = canvas.height / layout.logicalH;
      var pts = stroke.points.map(function (p) {
        return [p[0] * sx, p[1] * sy, p[2]];
      });
      var size = renderSize(stroke) * sx;
      var d = outline(pts, size, simulate(stroke.points));
      if (!d) return;
      ctx.fillStyle = BN.pen.colorOf(stroke.color);
      ctx.globalAlpha = stroke.tool === "highlighter" ? 0.38 : 1;
      ctx.fill(new Path2D(d));
      ctx.globalAlpha = 1;
    },

    clearLive: function () {
      var canvas = document.getElementById("live");
      if (!canvas) return;
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },

    hit: function (strokes, logical) {
      var x = logical[0];
      var y = logical[1];
      for (var i = strokes.length - 1; i >= 0; i--) {
        var stroke = strokes[i];
        var pts = stroke.points || [];
        var thresh = (stroke.size || 6) + 10;
        for (var p = 1; p < pts.length; p++) {
          if (distToSeg(x, y, pts[p - 1], pts[p]) <= thresh) return stroke;
        }
        if (pts.length === 1 && Math.hypot(pts[0][0] - x, pts[0][1] - y) <= thresh) return stroke;
      }
      return null;
    },

    tool: "pen",
    color: "ink",
    size: 6
  };

  function round(n) {
    return Math.round(n * 10) / 10;
  }

  function distToSeg(x, y, a, b) {
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var len = dx * dx + dy * dy;
    var t = len === 0 ? 0 : ((x - a[0]) * dx + (y - a[1]) * dy) / len;
    t = Math.max(0, Math.min(1, t));
    var px = a[0] + t * dx;
    var py = a[1] + t * dy;
    return Math.hypot(px - x, py - y);
  }
})();
