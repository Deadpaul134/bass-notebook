# מחברת בס

מחברת תווים סטטית (בלי build) לטאבלט. `window.BN` הוא ה-namespace היחיד. סדר הסקריפטים: vendor → data → music → render → history → pen → tap → export → app.

- נתונים ב-IndexedDB `bass-notebook` / store `pages`, ואינדקס ב-`localStorage` במפתח `bass-notebook-v1-index`.
- מפתח הצבע `bass-notebook-v1-theme`: `light` | `dark` | `system`. סקריפט ב-`head` מציב אותו לפני הציור.
- אזור התווים תמיד LTR. שאר הממשק RTL.
- תווים: VexFlow 4.2.3 עם Bravura. עט: perfect-freehand. אין להוסיף תלות בלי לעדכן את `THIRD_PARTY_NOTICES.md`. אסור GPL/LGPL/AGPL/CC BY-SA.
- `BN.music` טהור. `BN.render.posToY` / `measureX` מחזירים קואורדינטות מסך לבדיקות.
- משיכות העט בקואורדינטות לוגיות של הדף (רוחב 1000).
- בדיקות: `npm test` (Playwright, שלושה projects). שרת: `python3 tools/serve.py 4173`.
