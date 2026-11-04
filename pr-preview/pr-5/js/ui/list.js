/* Notebook: the list of ideas. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var sortMode = "updated";
  var query = "";

  function $(s) { return document.querySelector(s); }

  function keyText(row) { return BN.esc(String(row.key || "").replace("b", "♭").replace("#", "♯")); }

  function card(row) {
    var clef = row.layout === "grand" ? "כפול" : row.layout === "treble" ? "סול" : "פה";
    return '<article class="idea" data-id="' + BN.esc(row.id) + '"><button type="button" class="idea-open" data-action="open" data-id="' + BN.esc(row.id) + '">' +
      '<span class="idea-title">' + BN.esc(row.title || "") + "</span>" +
      '<span class="idea-meta">' + BN.esc(row.date || "") + " · " + BN.icons.svg("quarter", 14, "ic-inline") + "=" + BN.esc(row.bpm || "") + " · " + keyText(row) + " · " + clef + "</span></button>" +
      '<button type="button" class="more" data-action="more" data-id="' + BN.esc(row.id) + '" aria-label="פעולות">' + BN.icons.svg("more", 22) + "</button></article>";
  }

  function rows() { return BN.list.sort(BN.list.filter(BN.store.list(), query), sortMode); }

  function maybeBackup(host) {
    var opened = Number(localStorage.getItem(BN.KEYS.opened) || Date.now());
    localStorage.setItem(BN.KEYS.opened, String(opened));
    var last = Number(localStorage.getItem(BN.KEYS.backup) || 0);
    if (BN.store.list().length && Date.now() - opened > 14 * 86400000 && Date.now() - last > 14 * 86400000) {
      var banner = document.createElement("p");
      banner.className = "banner";
      banner.textContent = "עברו שבועיים בלי גיבוי. שווה לייצא JSON מההגדרות — הנתונים נשארים רק במכשיר.";
      host.insertBefore(banner, host.children[2]);
    }
  }

  BN.ui = BN.ui || {};
  BN.ui.list = {
    render: function (host) {
      BN.state.current = null;
      var list = rows();
      host.innerHTML =
        '<header class="topbar"><h1>המחברת שלי</h1><span class="grow"></span>' +
        '<a class="tb-btn" href="#settings" aria-label="הגדרות">' + BN.icons.svg("gear", 24) + "</a></header>" +
        '<div class="filters"><input id="search" class="field" placeholder="חיפוש לפי שם, תגית, הערה או סולם" value="' + BN.esc(query) + '" aria-label="חיפוש">' +
        '<select id="sort" class="field" aria-label="מיון"><option value="updated">עודכן לאחרונה</option><option value="date">תאריך</option><option value="name">שם</option></select></div>' +
        '<section class="ideas">' + (list.map(card).join("") || '<p class="empty">עוד אין רעיונות. הראשון מחכה לכפתור למטה.</p>') + "</section>" +
        '<button type="button" class="fab" data-action="new-score">' + BN.icons.svg("plus", 22) + " רעיון חדש</button>" +
        '<div id="new-menu" class="new-menu" hidden><button type="button" data-layout="bass">פה</button><button type="button" data-layout="treble">סול</button><button type="button" data-layout="grand">כפול</button></div>';
      $("#sort").value = sortMode;
      $("#search").oninput = function (e) {
        query = e.target.value;
        $(".ideas").innerHTML = rows().map(card).join("") || '<p class="empty">אין תוצאות.</p>';
      };
      $("#sort").onchange = function (e) { sortMode = e.target.value; BN.ui.list.render(host); };
      maybeBackup(host);
    },
    create: function (layout) {
      var score = BN.model.blank({ staffLayout: layout || BN.data.settings().clef || "bass", composer: BN.data.settings().composer || "" });
      BN.history.reset(score.id);
      BN.store.schedule(score);
      BN.store.flush().then(function () { BN.app.go("#score/" + encodeURIComponent(score.id)); });
    },
    duplicate: function (id) {
      var score = BN.store.get(id);
      if (!score) return;
      var copy = JSON.parse(JSON.stringify(score));
      copy.id = BN.uid("s");
      copy.title = (score.title || "רעיון") + " (עותק)";
      copy.createdAt = new Date().toISOString();
      copy.updatedAt = copy.createdAt;
      BN.store.schedule(copy);
      BN.store.flush().then(function () { BN.app.render(); });
    },
    rename: function (id) {
      var current = BN.store.get(id);
      var name = window.prompt("שם חדש", current ? current.title : "");
      if (name && current) {
        current.title = name;
        current.updatedAt = new Date().toISOString();
        BN.store.schedule(current);
        BN.store.flush().then(function () { BN.app.render(); });
      }
    },
    remove: function (id) {
      var score = BN.store.get(id);
      if (!score) return;
      var snapshot = JSON.parse(JSON.stringify(score));
      BN.store.remove(id).then(function () {
        BN.app.render();
        BN.toast.show("נמחק", {
          undo: function () {
            BN.store.schedule(snapshot);
            BN.store.flush().then(function () { BN.app.render(); });
          }
        });
      });
    }
  };

  document.addEventListener("click", function (e) {
    if (document.body.dataset.screen !== "list") return;
    var layout = e.target.closest("[data-layout]");
    if (layout) { BN.ui.list.create(layout.dataset.layout); return; }
    var more = e.target.closest("[data-more]");
    if (more) {
      var id = more.dataset.id;
      BN.pop.close();
      if (more.dataset.more === "dup") BN.ui.list.duplicate(id);
      if (more.dataset.more === "rename") BN.ui.list.rename(id);
      if (more.dataset.more === "del") BN.ui.list.remove(id);
      return;
    }
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var action = btn.dataset.action;
    if (action === "new-score") {
      var menu = $("#new-menu");
      if (menu) menu.hidden = !menu.hidden;
    }
    if (action === "open") BN.app.go("#score/" + encodeURIComponent(btn.dataset.id));
    if (action === "more") {
      var id2 = btn.dataset.id;
      BN.pop.open(btn,
        '<button type="button" data-more="dup" data-id="' + id2 + '">שכפול</button><button type="button" data-more="rename" data-id="' + id2 + '">שינוי שם</button><button type="button" data-more="del" data-id="' + id2 + '">מחיקה</button>',
        "menu");
    }
  });
})();
