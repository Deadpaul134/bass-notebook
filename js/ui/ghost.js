/* A shadow note with a pitch label, shown while a note is being aimed. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  function el() { return document.getElementById("ghost"); }
  BN.ghost = {
    show: function (spec) {
      var g = el();
      if (!g) return;
      if (!g.firstChild) {
        g.innerHTML = '<span class="g-label"></span><svg class="g-head" viewBox="0 0 30 20" width="30" height="20" aria-hidden="true"><ellipse cx="15" cy="10" rx="9.5" ry="6.5" transform="rotate(-20 15 10)"/></svg>';
      }
      g.hidden = false;
      g.style.left = spec.x + "px";
      g.style.top = spec.y + "px";
      g.classList.toggle("touch", !!spec.touch);
      g.querySelector(".g-label").textContent = spec.label || "";
      g.dataset.label = spec.label || "";
    },
    hide: function () {
      var g = el();
      if (g) { g.hidden = true; g.dataset.label = ""; }
    },
    visible: function () { var g = el(); return !!(g && !g.hidden); }
  };
})();
