/* One popover at a time, placed under (or over) the element that opened it. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var owner = null;
  function host() { return document.getElementById("pop"); }
  BN.pop = {
    open: function (anchor, html, cls) {
      var pop = host();
      pop.className = cls || "";
      pop.innerHTML = html;
      pop.hidden = false;
      owner = anchor || null;
      var r = anchor ? anchor.getBoundingClientRect() : { left: 16, right: 16, top: 64, bottom: 64 };
      var w = pop.offsetWidth;
      var h = pop.offsetHeight;
      var left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
      var top = r.bottom + 6;
      if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
      pop.style.left = left + "px";
      pop.style.top = top + "px";
      return pop;
    },
    close: function () {
      var pop = host();
      if (pop) { pop.hidden = true; pop.innerHTML = ""; }
      owner = null;
    },
    isOpen: function () { var p = host(); return !!(p && !p.hidden); },
    owner: function () { return owner; }
  };
})();
