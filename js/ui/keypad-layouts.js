/* The six Keypad layouts. Each cell is a duration (can be dragged for pitch) or an operation. */
(function () {
  "use strict";
  var BN = (window.BN = window.BN || {});

  function dur(type, label) { return { kind: "dur", type: type, icon: type, label: label }; }
  function op(id, icon, label, text) { return { kind: "op", op: id, icon: icon, label: label, text: text }; }
  function dyn(d) { return { kind: "op", op: "dyn:" + d, text: d, cls: "dyn", label: "דינמיקה " + d }; }
  var EMPTY = { kind: "empty" };

  BN.keypadLayouts = [
    {
      id: "notes", name: "תווים",
      hint: "גרור מעלה/מטה על משך = גובה · ימינה ♯ שמאלה ♭",
      cells: [
        dur("whole", "שלמה"), dur("half", "חצי"), dur("quarter", "רבע"), dur("eighth", "שמינית"),
        dur("16th", "שש־עשרית"), op("dot", "dot", "נקודה"), op("tie", "tie", "קשת הארכה"), op("rest", "rest", "הפסקה"),
        op("sharp", "sharp", "דיאז"), op("flat", "flat", "במול"), op("natural", "natural", "בקר"), op("pitch", "updown", "גובה", "גובה")
      ]
    },
    {
      id: "more", name: "עוד",
      hint: "פעולות על הבחירה",
      cells: [
        op("dot2", "dot2", "נקודה כפולה"), op("octUp", "octUp", "אוקטבה למעלה"), op("octDown", "octDown", "אוקטבה למטה"), op("duplicate", "duplicate", "שכפול"),
        op("copy", "copy", "העתקה"), op("paste", "paste", "הדבקה"), op("cut", "cut", "גזירה"), op("selectAll", "selectAll", "בחירת הכל"),
        op("measureAdd", "measureAdd", "הוספת תיבה"), op("measureDel", "measureDel", "מחיקת תיבה"), EMPTY, EMPTY
      ]
    },
    {
      id: "marks", name: "סימנים",
      hint: "בחרו תו ואז סימן",
      cells: [
        op("artic:staccato", "staccato", "סטקטו"), op("artic:accent", "accent", "אקצנט"), op("artic:tenuto", "tenuto", "טנוטו"), op("artic:fermata", "fermata", "פרמטה"),
        EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY
      ]
    },
    {
      id: "links", name: "חיבורים",
      hint: "קשת: בחרו שני תווים לפחות",
      cells: [
        op("slur", "slur", "קשת ניגון"), op("tie", "tie", "קשת הארכה"), op("ghost", "ghost", "תו רפאים"), EMPTY,
        EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY
      ]
    },
    {
      id: "dynamics", name: "דינמיקה",
      hint: "בחרו תו ואז עוצמה",
      cells: [
        dyn("pp"), dyn("p"), dyn("mp"), dyn("mf"),
        dyn("f"), dyn("ff"), EMPTY, EMPTY, EMPTY, EMPTY, EMPTY, EMPTY
      ]
    },
    {
      id: "lines", name: "קווים",
      hint: "קו תיבה בתיבה הנבחרת",
      cells: [
        op("bar:regular", "bar", "קו רגיל"), op("bar:light-light", "barDouble", "קו כפול"), op("bar:light-heavy", "barFinal", "קו סיום"), EMPTY,
        op("bar:forward", "repeatStart", "תחילת חזרה"), op("bar:backward", "repeatEnd", "סוף חזרה"), EMPTY, EMPTY,
        EMPTY, EMPTY, EMPTY, EMPTY
      ]
    }
  ];
})();
