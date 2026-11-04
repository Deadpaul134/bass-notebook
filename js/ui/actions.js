/* Actions shared by the top bar, ribbon, and menus. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});
  var tapTimes = [];

  function score() { return BN.state.current; }

  function share(blob, name) {
    if (navigator.share && navigator.canShare) {
      var file = new File([blob], name, { type: blob.type || "application/octet-stream" });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: name }).catch(function () { BN.export.download(blob, name); });
        return;
      }
    }
    BN.export.download(blob, name);
  }

  BN.actions = {
    applyLayout: function (layout) {
      var sc = score();
      var prev = sc.staffLayout;
      if (prev === layout) return;
      if (prev === "grand" && layout !== "grand") {
        var staff = layout === "bass" ? 1 : 2;
        var doomed = sc.parts[0].measures.some(function (m) {
          return m.notes.some(function (n) { return n.staff === staff && !n.rest && !n.generated; });
        });
        var message = layout === "bass" ? "התווים בחמשה העליונה יימחקו" : "התווים בחמשה התחתונה יימחקו";
        if (doomed && !window.confirm(message)) return;
      }
      BN.state.cursor = null;
      BN.state.selection = [];
      BN.state.selMeasures = [];
      BN.editor.commit(function (s) { BN.model.setLayout(s, layout); });
    },
    setKey: function (key, measure) {
      BN.editor.commit(function (s) { BN.model.setKeyFrom(s, measure || 0, key); });
    },
    setTime: function (time, measure) {
      BN.editor.commit(function (s) { BN.model.setTimeFrom(s, measure || 0, time); });
    },
    setBpm: function (next) {
      next = Math.max(40, Math.min(240, Math.round(next)));
      BN.editor.commit(function (s) { s.tempo.bpm = next; });
      if (BN.playback.isPlaying()) BN.playback.setTempo(score(), next * BN.state.rate);
    },
    tapTempo: function () {
      var t = Date.now();
      tapTimes.push(t);
      tapTimes = tapTimes.filter(function (n) { return t - n < 2500; });
      if (tapTimes.length >= 2) {
        var gaps = [];
        for (var i = 1; i < tapTimes.length; i++) gaps.push(tapTimes[i] - tapTimes[i - 1]);
        BN.actions.setBpm(60000 / (gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length));
      }
    },
    setRate: function (rate) {
      BN.state.rate = rate;
      if (score() && BN.playback.isPlaying()) BN.playback.setTempo(score(), score().tempo.bpm * rate);
      if (BN.ui.syncAll) BN.ui.syncAll();
    },
    exportMusicXml: function () {
      var sc = score();
      share(new Blob([BN.musicxml.export(sc)], { type: "application/vnd.recordare.musicxml+xml" }), BN.export.filename(sc, "musicxml"));
    },
    exportPdf: function () {
      var sc = score();
      return BN.export.pdfBlob(sc).then(function (blob) { share(blob, BN.export.filename(sc, "pdf")); })
        .catch(function () { BN.toast.show("ייצוא PDF נכשל"); });
    },
    exportPng: function () {
      var sc = score();
      return BN.export.pngBlob(sc).then(function (blob) { share(blob, BN.export.filename(sc, "png")); })
        .catch(function () { BN.toast.show("ייצוא PNG נכשל"); });
    },
    backup: function () {
      var blob = new Blob([JSON.stringify(BN.export.toJSON(), null, 2)], { type: "application/json" });
      BN.export.download(blob, "bass-notebook-backup.json");
      localStorage.setItem(BN.KEYS.backup, String(Date.now()));
    },
    play: function () {
      var sc = score();
      if (!sc) return;
      if (!BN.data.settings().playback) {
        BN.toast.show("ההשמעה כבויה — אפשר להפעיל בהגדרות");
        return;
      }
      if (BN.playback.isPlaying()) {
        BN.playback.pause();
      } else {
        var cur = BN.state.cursor;
        var from = cur && (cur.measure > 0 || cur.index > 0) ? BN.model.tickAt(sc, cur) : 0;
        BN.playback.play(sc, { bpm: sc.tempo.bpm * BN.state.rate, fromTick: from });
      }
      if (BN.ui.syncAll) BN.ui.syncAll();
    }
  };
})();
