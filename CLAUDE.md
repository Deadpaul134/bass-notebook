# מחברת בס

מחברת תווים סטטית (בלי build). `window.BN` הוא ה-namespace היחיד.

סדר הסקריפטים: vendor (VexFlow, jsPDF, svg2pdf) → data → music → model → layout → render → history → playback → musicxml → export → ui/* (icons, toast, ghost, pop, actions, topbar, ribbon, keypad-layouts, keypad, contextbar, piano, list, settings) → editor → app.

- v3: עיצוב בסגנון כלי מקצועי (מעטפת כהה, דף לבן, Keypad צף, פסנתר מתקפל); המפרט ב-`docs/v3/SPEC-v3.md`. אייקונים מקוריים בלבד (`js/ui/icons.js`).
- נתונים ב-IndexedDB `bass-notebook` גרסה 2, store `scores`. אינדקס ב-`bass-notebook-v2-index`.
- מפתח הצבע `bass-notebook-v1-theme`: `light` | `dark` | `system`, לפני הציור.
- ממשק RTL. אזור התווים (`#score`) תמיד LTR.
- תווים: VexFlow 4.2.3 עם Bravura. PDF: jsPDF + svg2pdf.js. השמעה: Web Audio (בלי Tone.js ובלי דגימות).
- `BN.music` ו-`BN.model` טהורים. `BN.render.locate()` מחזיר קואורדינטות מסך לבדיקות.
- אין עט ואין perfect-freehand. אין להוסיף תלות בלי לעדכן את `THIRD_PARTY_NOTICES.md`. אסור GPL/LGPL/AGPL/CC BY-SA.
- בדיקות: `npm test` (desktop 1440x900, tablet 1280x800, tablet-portrait 800x1280). שרת: `python3 tools/serve.py 4173`.
