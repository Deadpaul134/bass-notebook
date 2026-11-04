/* Undo stack of structural snapshots. Up to 200 steps, kept in memory. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var stacks = {};
  function slot(id) {
    if (!stacks[id]) stacks[id] = { undo: [], redo: [] };
    return stacks[id];
  }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  BN.history = {
    reset: function (id) { stacks[id] = { undo: [], redo: [] }; },
    canUndo: function (id) { return slot(id).undo.length > 0; },
    canRedo: function (id) { return slot(id).redo.length > 0; },
    exec: function (score, mutate) {
      var before = clone(score);
      var t0 = performance.now();
      mutate(score);
      score.updatedAt = new Date().toISOString();
      BN.history.lastMs = performance.now() - t0;
      var book = slot(score.id);
      book.undo.push(before);
      if (book.undo.length > 200) book.undo.shift();
      book.redo = [];
      return score;
    },
    undo: function (score) {
      var book = slot(score.id);
      if (!book.undo.length) return score;
      var t0 = performance.now();
      var prev = book.undo.pop();
      book.redo.push(clone(score));
      BN.history.lastMs = performance.now() - t0;
      prev.updatedAt = new Date().toISOString();
      return prev;
    },
    redo: function (score) {
      var book = slot(score.id);
      if (!book.redo.length) return score;
      var next = book.redo.pop();
      book.undo.push(clone(score));
      next.updatedAt = new Date().toISOString();
      return next;
    },
    push: function (score, before) {
      var book = slot(score.id);
      book.undo.push(before);
      if (book.undo.length > 200) book.undo.shift();
      book.redo = [];
      score.updatedAt = new Date().toISOString();
      return score;
    }
  };
})();
