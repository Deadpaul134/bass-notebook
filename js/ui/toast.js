/* Short messages, with an optional "undo" action. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  BN.toast = {
    show: function (text, opts) {
      opts = opts || {};
      var host = document.getElementById("toasts");
      if (!host) return null;
      var node = document.createElement("div");
      node.className = "toast";
      node.setAttribute("role", "status");
      var span = document.createElement("span");
      span.textContent = text;
      node.appendChild(span);
      if (opts.undo) {
        var b = document.createElement("button");
        b.type = "button";
        b.dataset.action = "toast-undo";
        b.textContent = "בטל";
        b.onclick = function () { opts.undo(); node.remove(); };
        node.appendChild(b);
      }
      host.appendChild(node);
      setTimeout(function () { node.remove(); }, opts.ms || 4000);
      return node;
    }
  };
})();
