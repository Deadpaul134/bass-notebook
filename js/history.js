/* Bass Notebook — undo / redo command stack (per page, in memory). */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var stacks = {};
  var LIMIT = 100;

  function slot(id) {
    if (!stacks[id]) stacks[id] = { undo: [], redo: [] };
    return stacks[id];
  }

  function clone(page) {
    return JSON.parse(JSON.stringify(page));
  }

  BN.history = {
    reset: function (id) {
      stacks[id] = { undo: [], redo: [] };
    },
    clear: function () {
      stacks = {};
    },
    canUndo: function (id) {
      return slot(id).undo.length > 0;
    },
    canRedo: function (id) {
      return slot(id).redo.length > 0;
    },
    exec: function (page, mutate) {
      var before = clone(page);
      mutate(page);
      page.updatedAt = new Date().toISOString();
      var book = slot(page.id);
      book.undo.push(before);
      if (book.undo.length > LIMIT) book.undo.shift();
      book.redo = [];
      return page;
    },
    undo: function (page) {
      var book = slot(page.id);
      if (!book.undo.length) return page;
      var before = book.undo.pop();
      book.redo.push(clone(page));
      var restored = before;
      restored.updatedAt = new Date().toISOString();
      return restored;
    },
    redo: function (page) {
      var book = slot(page.id);
      if (!book.redo.length) return page;
      var next = book.redo.pop();
      book.undo.push(clone(page));
      next.updatedAt = new Date().toISOString();
      return next;
    }
  };
})();
