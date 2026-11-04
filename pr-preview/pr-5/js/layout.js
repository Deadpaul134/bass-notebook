/* Line breaking: measures → systems for the screen or for A4. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});

  function measureNotes(measure) {
    return (measure.notes || []).filter(function (n) { return !n.generated; }).length;
  }

  BN.layout = {
    systems: function (score, width) {
      var part = score.parts[0];
      var usable = Math.max(280, width - 24);
      var systems = [];
      var current = [];
      var used = 0;
      var MAX = 4;
      function widthOf(measure, index) {
        var fifths = Math.abs(BN.model.keyOf(part, index).fifths || 0);
        var head = 44 + fifths * 10 + (index === 0 ? 30 : 0);
        var extra = measure.attributes && index > 0 ? 40 + fifths * 10 : 0;
        return Math.max(120, 70 + measureNotes(measure) * 26 + extra) + head * 0.6;
      }
      part.measures.forEach(function (measure, index) {
        var w = widthOf(measure, index);
        var tooWide = current.length && used + w > usable;
        var tooMany = current.length >= MAX;
        if (tooWide || tooMany) {
          systems.push(current);
          current = [];
          used = 0;
        }
        if (current.length >= 2 && w > usable * 0.45) {
          systems.push(current);
          current = [];
          used = 0;
        }
        current.push({ index: index, min: w });
        used += w;
        if (current.length === MAX) {
          systems.push(current);
          current = [];
          used = 0;
        }
      });
      if (current.length) systems.push(current);
      if (!systems.length) systems.push([{ index: 0, min: 160 }]);
      return systems.map(function (row) {
        var sum = row.reduce(function (s, item) { return s + item.min; }, 0) || 1;
        var scale = usable / sum;
        var x = 12;
        return {
          measures: row.map(function (item) {
            var w = Math.max(item.min, item.min * Math.min(scale, 1.8));
            var box = { index: item.index, x: x, w: w };
            x += w;
            return box;
          }),
          width: x + 8
        };
      });
    }
  };
})();
