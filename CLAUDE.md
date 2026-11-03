# מחברת בס

מחברת תווים סטטית (בלי build). `window.BN` הוא ה-namespace היחיד.

סדר הסקריפטים: vendor (VexFlow, jsPDF, svg2pdf) → data → music → model → layout → render → history → playback → musicxml → export → editor → app.

- נתונים ב-IndexedDB `bass-notebook` גרסה 2, store `scores`. אינדקס ב-`bass-notebook-v2-index`.
- מפתח הצבע `bass-notebook-v1-theme`: `light` | `dark` | `system`, לפני הציור.
- ממשק RTL. אזור התווים (`#score`) תמיד LTR.
- תווים: VexFlow 4.2.3 עם Bravura. PDF: jsPDF + svg2pdf.js. השמעה: Web Audio (בלי Tone.js ובלי דגימות).
- `BN.music` ו-`BN.model` טהורים. `BN.render.locate()` מחזיר קואורדינטות מסך לבדיקות.
- אין עט ואין perfect-freehand. אין להוסיף תלות בלי לעדכן את `THIRD_PARTY_NOTICES.md`. אסור GPL/LGPL/AGPL/CC BY-SA.
- בדיקות: `npm test`. שרת: `python3 tools/serve.py 4173`.
