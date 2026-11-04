/* Original SVG icons. Drawn for this app; stroke/fill follow currentColor. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});

  var S = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var HEAD = '<ellipse cx="9" cy="18" rx="5.4" ry="3.7" transform="rotate(-20 9 18)" fill="currentColor"/>';
  var STEM = '<path d="M13.6 16.8V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>';

  var PATHS = {
    gear: '<circle ' + S + ' cx="12" cy="12" r="3.2"/><path ' + S + ' d="M12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21M5.6 5.6l1.9 1.9M16.5 16.5l1.9 1.9M18.4 5.6l-1.9 1.9M7.5 16.5l-1.9 1.9"/>',
    back: '<path ' + S + ' d="M5 12h14M13 6l6 6-6 6"/>',
    undo: '<path ' + S + ' d="M8 5 3 10l5 5M3 10h11a5.5 5.5 0 0 1 0 11h-4"/>',
    redo: '<path ' + S + ' d="M16 5l5 5-5 5M21 10H10a5.5 5.5 0 0 0 0 11h4"/>',
    play: '<path fill="currentColor" d="M8 4.8v14.4a1 1 0 0 0 1.5.9l11.2-7.2a1 1 0 0 0 0-1.7L9.5 3.9A1 1 0 0 0 8 4.8z"/>',
    pause: '<rect x="6" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2" fill="currentColor"/>',
    more: '<circle cx="12" cy="5.5" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="18.5" r="2" fill="currentColor"/>',
    trash: '<path ' + S + ' d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>',
    close: '<path ' + S + ' d="M6 6l12 12M18 6 6 18"/>',
    chevron: '<path ' + S + ' d="M6 9l6 6 6-6"/>',
    up: '<path fill="currentColor" d="M5.5 16 12 7.5 18.5 16z"/>',
    down: '<path fill="currentColor" d="M5.5 8 12 16.5 18.5 8z"/>',
    updown: '<path ' + S + ' d="M12 3.5v17M7.5 8 12 3.5 16.5 8M7.5 16l4.5 4.5 4.5-4.5"/>',
    plus: '<path ' + S + ' d="M12 5v14M5 12h14"/>',
    minus: '<path ' + S + ' d="M5 12h14"/>',
    copy: '<rect ' + S + ' x="8.5" y="8.5" width="11" height="11" rx="2"/><path ' + S + ' d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"/>',
    paste: '<rect ' + S + ' x="5" y="5.5" width="14" height="15" rx="2"/><rect ' + S + ' x="9" y="3" width="6" height="4" rx="1.2"/>',
    cut: '<circle ' + S + ' cx="6.5" cy="17.5" r="2.7"/><circle ' + S + ' cx="17.5" cy="17.5" r="2.7"/><path ' + S + ' d="M8.2 15.3 17 4M15.8 15.3 7 4"/>',
    duplicate: '<rect ' + S + ' x="3.5" y="7" width="8" height="10" rx="2"/><rect ' + S + ' x="12.5" y="7" width="8" height="10" rx="2"/>',
    whole: '<ellipse ' + S + ' cx="12" cy="12" rx="7.2" ry="4.6"/><path ' + S + ' d="M9.2 14.6c.8-3.2 4.6-6 6.6-5.2"/>',
    half: '<ellipse ' + S + ' cx="9" cy="18" rx="5.4" ry="3.7" transform="rotate(-20 9 18)"/>' + STEM,
    quarter: HEAD + STEM,
    eighth: HEAD + STEM + '<path ' + S + ' d="M13.6 3c0 5.5 6.4 6 5.4 12"/>',
    "16th": HEAD + STEM + '<path ' + S + ' d="M13.6 3c0 5.5 6.4 6 5.4 11"/><path ' + S + ' d="M13.6 8.5c0 5 6.4 5.6 5.4 10.5"/>',
    rest: '<path ' + S + ' stroke-width="2.4" d="M10.5 3.5 15.5 9.5 10 14.5l5 5.5c-3.5-1.6-5.4.6-4 3"/>',
    dot: '<circle cx="12" cy="12" r="3" fill="currentColor"/>',
    dot2: '<circle cx="8" cy="12" r="2.8" fill="currentColor"/><circle cx="16.5" cy="12" r="2.8" fill="currentColor"/>',
    tie: '<path ' + S + ' stroke-width="2.4" d="M3 15.5Q12 5.5 21 15.5"/>',
    slur: '<path ' + S + ' stroke-width="2.4" d="M3 17Q12 4 21 17"/>',
    sharp: '<path ' + S + ' d="M9.3 4.5v15M14.7 3.5v15"/><path ' + S + ' stroke-width="3.2" d="M6.5 9.5l11-2.6M6.5 16.5l11-2.6"/>',
    flat: '<path ' + S + ' d="M8.5 3v17"/><path ' + S + ' stroke-width="2.2" d="M8.5 20c9-3.6 9.6-9.6 2.4-9.8-1.2 0-2 .4-2.4 1"/>',
    natural: '<path ' + S + ' d="M8.5 4v12.6M15.5 7.4V20"/><path ' + S + ' stroke-width="3" d="M8.5 9.6l7-1.8M8.5 17.2l7-1.8"/>',
    ghost: '<path ' + S + ' stroke-width="2.6" d="M7 7l10 10M17 7 7 17"/>',
    staccato: '<ellipse cx="12" cy="17" rx="5" ry="3.4" transform="rotate(-20 12 17)" fill="currentColor"/><circle cx="12" cy="7" r="2.1" fill="currentColor"/>',
    accent: '<path ' + S + ' stroke-width="2.4" d="M4 6.5l16 5.5-16 5.5"/>',
    tenuto: '<path ' + S + ' stroke-width="3" d="M4.5 12h15"/>',
    fermata: '<path ' + S + ' stroke-width="2.4" d="M3.5 17a8.5 8.5 0 0 1 17 0"/><circle cx="12" cy="15" r="2.1" fill="currentColor"/>',
    bar: '<path ' + S + ' d="M12 4v16"/>',
    barDouble: '<path ' + S + ' d="M9 4v16M15 4v16"/>',
    barFinal: '<path ' + S + ' d="M8.5 4v16"/><path ' + S + ' stroke-width="4.6" d="M15.5 4v16"/>',
    repeatStart: '<path ' + S + ' stroke-width="4.4" d="M6.5 4v16"/><path ' + S + ' d="M11.5 4v16"/><circle cx="16.5" cy="9.5" r="1.5" fill="currentColor"/><circle cx="16.5" cy="14.5" r="1.5" fill="currentColor"/>',
    repeatEnd: '<circle cx="7.5" cy="9.5" r="1.5" fill="currentColor"/><circle cx="7.5" cy="14.5" r="1.5" fill="currentColor"/><path ' + S + ' d="M12.5 4v16"/><path ' + S + ' stroke-width="4.4" d="M17.5 4v16"/>',
    octUp: '<path ' + S + ' d="M7 11 12 5l5 6M12 5v8"/><path ' + S + ' d="M7 20h10"/>',
    octDown: '<path ' + S + ' d="M7 13l5 6 5-6M12 19v-8"/><path ' + S + ' d="M7 4h10"/>',
    measureAdd: '<rect ' + S + ' x="3.5" y="6" width="12" height="12" rx="1.5"/><path ' + S + ' d="M19 9v6M16 12h6"/>',
    measureDel: '<rect ' + S + ' x="3.5" y="6" width="12" height="12" rx="1.5"/><path ' + S + ' d="M16.5 12h5"/>',
    selectAll: '<path ' + S + ' stroke-dasharray="3 3" d="M4 4h16v16H4z"/>',
    select: '<path ' + S + ' d="M6 4l11 8-5 1.2L9.5 18z"/>'
  };

  BN.icons = {
    svg: function (name, size, cls) {
      var s = size || 24;
      return '<svg class="ic ' + (cls || "") + '" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true" focusable="false">' + (PATHS[name] || "") + "</svg>";
    },
    has: function (name) { return !!PATHS[name]; }
  };
})();
