# SPEC — מחברת תווים לטאבלט (Bass Notebook) · שלב 1

> מסמך בנייה לסוכן קוד. שפה: עברית, מונחי קוד באנגלית. ריפו: `Deadpaul134/bass-notebook` (ציבורי, GitHub Pages; פול יוצר את הריפו). רישיון: **MIT © Paul Samson**.
> משתמש: פול, סטודנט לבס ברימון. **המטרה: מחברת דיגיטלית חינמית לטאבלט אנדרואיד שבה רושמים רעיון מוזיקלי מהר**, בכתב יד חופשי על חמשה או בהקשה מדויקת של תווים, ושומרים כל רעיון כדף.

---

## 0. עקרונות-על
1. **מהירות לכתוב רעיון**: מפתיחת האפליקציה עד תו ראשון על הדף ≤ 2 הקשות ("דף חדש" ← כותבים).
2. **טאבלט קודם**: עט (stylus) ומגע, landscape ו-portrait, אצבע גדולה (tap targets ≥ 56px).
3. **Offline מלא**: PWA שאפשר להתקין, עובד בלי רשת אחרי טעינה ראשונה.
4. **אפס חיכוך**: אתר סטטי, בלי build, בלי login, בלי שרת. הנתונים נשמרים במכשיר בלבד, וגיבוי לקובץ JSON.
5. **רישוי נקי**: רק תלויות ברישיון מתירני (MIT/BSD/Apache/ISC/OFL לפונטים). **אסור GPL/LGPL/AGPL/CC BY-SA.**

## 1. טכנולוגיה וקונבנציות (כמו `ear-trainer`)
- HTML/CSS/vanilla JS, ללא build וללא framework. IIFE לכל קובץ עם `"use strict"` ו-namespace גלובלי יחיד `window.BN`.
- `index.html` עם `<html lang="he" dir="rtl">`, סקריפט inline שמחיל theme לפני paint (מפתח `bass-notebook-v1-theme`, ערכים `light|dark|system`), פונט Heebo, `<meta name="theme-color">`.
- **חשוב:** ממשק RTL, אבל **אזור התווים (canvas/SVG של החמשה) תמיד `dir="ltr"`**, כי מוזיקה נקראת משמאל לימין.
- Routing ב-hash: `#list`, `#page/<id>`, `#settings`.
- עזרים ב-`data.js`: `BN.readJSON`, `BN.writeJSON`, `BN.uid()`, `BN.ymd`, `BN.esc`, `BN.KEYS`.
- Playwright (`@playwright/test`): project דסקטופ (Chrome 1440×900) + project טאבלט (Galaxy Tab S4 landscape 1138×712, `hasTouch:true`) + טאבלט portrait.

### 1.1 תלויות (vendored לתיקיית `vendor/`, לא CDN, כדי לעבוד offline)
| ספרייה | שימוש | רישיון |
|---|---|---|
| **VexFlow** (4.x, build `vexflow.js` UMD עם פונט Bravura) | ציור חמשה, מפתחות, תווים, הפסקות, סימנים | MIT (פונט Bravura: SIL OFL 1.1, מתירני) |
| **perfect-freehand** | הפיכת נקודות עט לקו חלק עם עובי לפי לחץ | MIT |
| Heebo (Google Fonts, נשמר מקומית) | פונט ממשק | SIL OFL 1.1 |
- לפני התחלה הסוכן **מוודא את הרישיון בגרסה שנבחרה** (קובץ LICENSE בריפו המקורי) ומעתיק את הטקסט ל-`THIRD_PARTY_NOTICES.md`.
- perfect-freehand מופץ כ-ESM: לשמור עותק מקומי ולטעון ב-`<script type="module">` קטן שחושף `window.BN.getStroke`, או להעתיק את הקוד (קובץ אחד קטן) עם כותרת הרישיון.
- אין ספריות נוספות בלי עדכון הטבלה הזו.

### 1.2 עיצוב "Warm Sand"
העתיקו את משתני ה-CSS מ-`ear-trainer` (§1.1 שם) כמות שהם, כולל `[data-theme="dark"]`. בנוסף:
- **הדף עצמו** (נייר): `--paper:#fffdf9`, `--staff-line:#8a7868` בבהיר; בכהה `--paper:#2f2621`, `--staff-line:#b9a593`. התווים בצבע `--text`.
- צבעי עט: שחור/טקסט (ברירת מחדל), terracotta `--accent`, כחול `#3d6fa8`, ירוק `--good`. במצב כהה צבע "שחור" מוצג כ-`--text` (מומר בעת ציור, נשמר כ-token `ink`, לא כ-hex).
- כפתור toggle לתמה (☀︎/☾/מערכת) בכותרת ובהגדרות. `prefers-reduced-motion` מכובד.

## 2. מבנה קבצים
```
bass-notebook/
├─ index.html · manifest.webmanifest · sw.js
├─ css/app.css
├─ js/
│  ├─ data.js      # BN namespace, KEYS, storage (IndexedDB + fallback), migrate, export/import
│  ├─ music.js     # pure: clefs, pitch↔staff position, key signatures, durations, measure fill
│  ├─ render.js    # VexFlow: ציור staff/system מתוך model; hit-testing (y→position)
│  ├─ pen.js       # Pointer Events, palm rejection, strokes, eraser, perfect-freehand
│  ├─ tap.js       # tap mode: הצבה, בחירה, עריכה של תווים
│  ├─ history.js   # undo/redo (command stack) לשני המצבים
│  ├─ export.js    # PNG export, JSON backup/restore
│  └─ app.js       # routing, screens, toolbar, theme, SW registration
├─ vendor/ (vexflow, perfect-freehand + LICENSE לכל אחד)
├─ assets/icons/ (SVG מקוריים, אייקוני PWA 192/512 + maskable)
├─ tests/*.spec.js · tests/helpers.js · playwright.config.js · package.json
├─ README.md (עברית) · LICENSE (MIT) · THIRD_PARTY_NOTICES.md · CLAUDE.md
└─ .gitignore
```
סדר טעינה: `vendor → data → music → render → history → pen → tap → export → app` (`defer`).

## 3. מודל נתונים
שמירה ב-**IndexedDB** (DB `bass-notebook`, store `pages`, key `id`); אינדקס קל של רשימת הדפים גם ב-localStorage (`bass-notebook-v1-index`) לטעינה מהירה. אם IndexedDB לא זמין → localStorage בלבד + אזהרה עדינה.
```js
Page = {
  id: "p_k3j2...", v: 1,
  title: "גרוב בסול", createdAt: "2026-11-03T10:22:00Z", updatedAt: "...",
  date: "2026-11-03",             // תאריך הרעיון (ניתן לעריכה)
  tempo: 92,                      // BPM, null = לא צוין
  key: "G",                       // מפתח סולם: "C","G","D","A","E","B","F#","C#","F","Bb","Eb","Ab","Db","Gb","Cb" + "Am".. (minor)
  time: "4/4",                    // ברירת מחדל לכל החמשות
  clef: "bass",                   // ברירת מחדל לדף: "bass" | "treble" | "grand"
  tags: [], notes: "",            // הערת טקסט חופשית
  systems: [ System ],            // שורות על הדף, מלמעלה למטה
  strokes: [ Stroke ]             // כתב יד, בקואורדינטות הדף
}
System = { id, layout: "single" | "grand",
  staves: [ Staff ] }             // single: 1 staff; grand: [treble, bass] מחוברים ב-brace
Staff  = { id, clef: "bass" | "treble",
  measures: [ Measure ] }         // ב-grand מספר התיבות זהה בשתי החמשות
Measure = { time?: "3/4", key?: "D",   // רק אם משתנה כאן
  barEnd: "single"|"double"|"end"|"repeatEnd", barStart?: "repeatStart",
  events: [ Event ] }
Event = { id, kind: "note"|"rest",
  dur: "w"|"h"|"q"|"8"|"16", dots: 0|1|2,
  pitch?: { step:"C".."B", oct: 0..8, acc: null|"#"|"b"|"n" } }  // אקורדים: לא ב-v1
Stroke = { id, tool:"pen"|"highlighter", color:"ink"|"accent"|"blue"|"green", size: 2..12,
  points: [[x,y,pressure], ...] } // x,y ביחידות דף לוגיות (רוחב 1000), לא בפיקסלים
```
- **ברירות מחדל**: דף חדש = מפתח פה (bass), 4/4, C, 6 שורות (systems) × 4 תיבות ריקות.
- בחירת מפתח: ברמת הדף (משפיע על שורות חדשות + אפשרות "החל על כל השורות"), ובנוסף **לכל שורה בנפרד** (לחיצה על המפתח בתחילת השורה → תפריט: פה / סול / מערכת כפולה). שינוי מפתח **לא משנה גובה צליל** של תווים קיימים — רק את מיקומם הוויזואלי.
- **Strokes לא קשורים ל-events**: הם שכבת ציור מעל הדף. גובה הדף קבוע (A4 יחסי, 1000×1414 יחידות); אם יש יותר שורות, הדף מתארך והציור נשאר במקומו.
- `v` לכל דף + `BN.migrate(page)` להמשך.

## 4. מוזיקה (`music.js`, pure — נבדק ביחידה)
- **מיפוי tap → גובה צליל** לפי מיקום אנכי על החמשה: `pos` = מספר שלבים (קו/רווח) מהקו התחתון, 0 = קו תחתון, 1 = רווח ראשון, ... 8 = קו עליון; שלילי/מעל 8 = קווי עזר (עד 5 קווי עזר מתחת ומעל, כלומר pos −10..18).
  - **מפתח פה (bass)**: pos 0 = **G2**, 8 = **A3**. (C4 = pos 10, קו עזר ראשון מעל; E1 = pos −9, הרווח שמתחת לקו העזר הרביעי — התו הנמוך בבס 4 מיתרים; B0 = pos −10 לבס 5 מיתרים).
  - **מפתח סול (treble)**: pos 0 = **E4**, 8 = **F5**. (C4 = pos −2, קו עזר ראשון מתחת).
  - פונקציות: `BN.music.posToPitch(clef,pos)`, `pitchToPos(clef,pitch)`; ב-grand מזהים לפי ה-staff שנלחץ (hit-test לפי y; הרווח בין החמשות מחולק באמצע).
- **סימן מפתח (key signature)**: תו חדש מקבל את הסימן מהסולם כ-implicit (אין `acc` נשמר); `acc` נשמר רק כשהמשתמש בוחר במפורש ♯/♭/♮. בתוך תיבה, accidental חל על אותו גובה עד סוף התיבה (לתצוגה בלבד).
- **מילוי תיבה**: `measureFill(measure)` מחזיר `under|full|over`. בהקשה, אם התו לא נכנס בתיבה → מועבר אוטומטית לתיבה הבאה (נוצרת אם צריך). **אין** פיצול אוטומטי לליגטורות ב-v1. תיבה חלקית מסומנת בעדינות (לא חוסם).
- Beaming אוטומטי לשמיניות/שש-עשריות לפי הפעמה (`Beam.generateBeams` של VexFlow). כיוון stem אוטומטי.

## 5. מסכים
| # | מסך | Route | תוכן |
|---|---|---|---|
| 1 | **רשימת מחברת** | `#list` | כותרת "המחברת שלי", חיפוש (כותרת/תגיות/הערות/מפתח, מיידי), מיון (עודכן לאחרונה / תאריך / שם), רשת כרטיסים עם thumbnail (PNG קטן נשמר בעת יציאה מהדף), כותרת, תאריך, ♩=טמפו, מפתח, אייקון מפתח (𝄢/𝄞/כפול). FAB גדול "＋ רעיון חדש". לחיצה ארוכה/⋮: שכפול, מחיקה (עם undo-toast 5 שניות). |
| 2 | **דף (עורך)** | `#page/<id>` | כותרת עליונה: חזרה, שדה כותרת (עריכה inline), chips לתאריך/טמפו/סולם/משקל (לחיצה → פופאפ). Toolbar (§6). אזור דף גלילה אנכית, zoom בצביטה (2 אצבעות) 50–200%. |
| 3 | **הגדרות** | `#settings` | תמה, מפתח ברירת מחדל לדף חדש (פה/סול/כפול), מספר שורות ברירת מחדל, יד דומיננטית (מיקום toolbar), "עט בלבד מצייר" (palm rejection, §6.1), גיבוי ל-JSON, שחזור מ-JSON (מיזוג / החלפה), אודות + רישיונות, גרסה. |

## 6. אינטראקציה בטאבלט
- **Toolbar** צף בצד (לפי יד דומיננטית) או למטה ב-portrait; כפתורים ≥ 56px. מתג מצב גדול: **✎ עט | ♪ הקשה** (קיצור: לחיצה כפולה בכפתור הצדדי של העט אם קיים → לא נדרש). מעבר מצב מיידי, אותו דף, שתי השכבות תמיד מוצגות.
- **Undo/Redo** משותף לשני המצבים (מחסנית פקודות, 100 צעדים, לכל דף, לא נשמר בין סשנים). כפתורים ↶ ↷ תמיד גלויים; מחווה: הקשה בשתי אצבעות = undo.
- שמירה אוטומטית: debounce 500ms אחרי כל שינוי + ב-`visibilitychange`/`pagehide`. אין כפתור "שמור".

### 6.1 מצב עט
- Pointer Events בלבד (`pointerdown/move/up/cancel`), `touch-action: none` על אזור הדף, `setPointerCapture`. שימוש ב-`getCoalescedEvents()` אם קיים לקווים חלקים.
- **Palm rejection**: ברגע שזוהה `pointerType==="pen"` בסשן, ההגדרה "עט בלבד מצייר" נדלקת אוטומטית (ניתנת לכיבוי): אז `touch` לא מצייר אלא גולל/מבצע zoom. אם אין עט (אצבע בלבד) — אצבע אחת מציירת, שתיים גוללות/zoom. מתעלמים מנגיעות עם `width/height` > 40px (כף יד) כשהעט בשימוש.
- לחץ: `event.pressure` (אם 0/0.5 קבוע — לחץ מדומה לפי מהירות דרך perfect-freehand `simulatePressure`).
- כלים: עט (4 צבעים, 3 עוביים), מרקר שקוף (highlighter), **מחק**: מחיקת stroke שלם במגע (hit-test לפי מרחק מהקו). כפתור המחק של עט (אם `buttons & 32`) מפעיל מחק זמנית.
- ציור: stroke בעבודה על `<canvas>` עליון (מהיר), עם סיום מומר ל-`<path>` ב-SVG/canvas שכבתי. יעד: ≥ 60fps, latency נראה < 30ms בטאבלט בינוני.

### 6.2 מצב הקשה
- פלטה (שורה קבועה ב-toolbar): משכים 𝅝 𝅗𝅥 ♩ ♪ 𝅘𝅥𝅯 (w/h/q/8/16), מתג **תו/הפסקה**, נקודה (·, ··), ♯ ♭ ♮, קו תיבה (single/double/end/repeat), משקל (פופאפ: 2/4 3/4 4/4 5/4 6/8 7/8 12/8 + מותאם), סולם (פופאפ עם 15 סולמות מז'וריים + מינוריים מקבילים), מפתח (פה/סול/כפול לשורה).
- **הצבת תו**: הקשה על החמשה → גובה לפי y הקרוב לקו/רווח (snap; אזור hit של כל שלב ≥ 12px במסך ב-zoom 100%; ב-zoom נמוך מוצגת "זכוכית מגדלת" קטנה). המיקום האופקי: התו נוסף **אחרי האירוע האחרון בתיבה שנלחצה** (או בתיבה הראשונה שאינה מלאה). תצוגה מקדימה (ghost note + שם הצליל, למשל "A2") בזמן לחיצה/גרירה, הצבה ב-pointerup. משמש גם בעט.
- **בחירה ועריכה**: הקשה על תו קיים בוחרת אותו (מודגש `--accent`); אז: גרירה למעלה/מטה = שינוי גובה; כפתורי משך/נקודה/accidental חלים על הנבחר; 🗑 מוחק. חיצים ← → בין תווים (מקלדת חיצונית: גם A–G להזנה, 1–5 למשך, `.` נקודה, `+`/`-` accidental, Backspace).
- הפסקה: מוצבת במרכז החמשה ללא תלות ב-y.
- "＋ שורה" בסוף הדף; לחיצה ארוכה על שורה → תפריט (הוסף תיבה, מחק שורה, שנה מפתח/מערכת כפולה).

## 7. ייצוא וגיבוי
- **PNG**: ציור הדף (תווים + strokes) ל-canvas ברזולוציה ×2, רקע נייר בהיר תמיד (גם במצב כהה), כותרת+תאריך+טמפו+סולם בראש. הורדה `bass-notebook_<title>_<date>.png`; ב-Android אם `navigator.canShare({files})` → כפתור "שתף".
- **גיבוי JSON**: `{app:"bass-notebook", v:1, exportedAt, pages:[...]}` → `bass-notebook-backup-YYYY-MM-DD.json`.
- **שחזור**: בחירת קובץ, ולידציה (מבנה + `v`), תצוגה "נמצאו N דפים", מצב **מיזוג** (לפי id, הגרסה עם `updatedAt` חדש יותר מנצחת) או **החלפה** (אישור כפול). קובץ פגום → הודעת שגיאה בעברית, אין שינוי בנתונים.

## 8. PWA ו-offline
- `manifest.webmanifest`: `name:"מחברת בס"`, `short_name:"מחברת"`, `lang:"he"`, `dir:"rtl"`, `display:"standalone"`, `orientation:"any"`, `start_url:"./#list"`, `scope:"./"`, צבעי theme/background מ-Warm Sand, אייקונים 192/512 + maskable.
- `sw.js`: precache לכל קבצי האפליקציה (רשימה עם `CACHE_VERSION`), אסטרטגיית cache-first לנכסים, ניקוי caches ישנים ב-activate. נתיבים יחסיים (GitHub Pages תחת `/bass-notebook/`).
- עדכון: כשיש SW חדש → טוסט "גרסה חדשה זמינה — רענן".
- `navigator.storage.persist()` בפתיחה ראשונה (להקטנת סיכון מחיקה). תזכורת עדינה לגבות אם לא בוצע גיבוי 14 ימים.

## 9. קריטריוני קבלה
1. האתר עולה מ-GitHub Pages, `lang="he" dir="rtl"`, ללא שגיאות console, ללא build.
2. Lighthouse (PWA installability) עובר; ניתן להתקין בכרום אנדרואיד; אחרי טעינה ראשונה, האפליקציה נפתחת ועובדת במצב טיסה.
3. מצב בהיר/כהה/מערכת מתחלף מיידית ונשמר; אין הבהוב theme בטעינה.
4. "רעיון חדש" יוצר דף עם 6 שורות במפתח ברירת המחדל (פה), 4/4, C, תאריך היום.
5. ניתן לבחור לכל דף מפתח פה / סול / מערכת כפולה, ולשנות שורה בודדת; מערכת כפולה מציגה סול מעל פה מחוברים ב-brace וקו תיבה משותף.
6. הקשה במפתח פה: קו תחתון = G2, רווח ראשון = A2, קו עליון = A3, קו עזר ראשון מעל = C4, הרווח מתחת לקו העזר הרביעי = E1 (ניתן להגיע ל-E1 לבס).
7. הקשה במפתח סול: קו תחתון = E4, קו עליון = F5, קו עזר ראשון מתחת = C4.
8. במערכת כפולה, הקשה בחמשה העליונה ממופה לסול והתחתונה לפה; C4 נכתב נכון בשתיהן.
9. כל המשכים w/h/q/8/16, נקודה אחת/שתיים, הפסקות לכל משך, ♯/♭/♮, קווי תיבה (single/double/end/repeat), משקל וסולם — מוצגים נכון (VexFlow) ונשמרים.
10. תו שלא נכנס בתיבה עובר לתיבה הבאה; שמיניות/שש-עשריות מקבלות beams לפי הפעמה.
11. בחירת תו וגרירה משנה גובה; שינוי משך/accidental/מחיקה על תו נבחר עובדים.
12. החלפת מפתח בשורה שומרת את גובה הצלילים (A2 נשאר A2 ומוצג במיקום הנכון בסול עם קווי עזר).
13. מצב עט: ציור חלק עם עובי לפי לחץ, 4 צבעים, 3 עוביים, מרקר, מחק stroke; כשזוהה עט, נגיעת אצבע/כף יד לא מציירת.
14. מעבר עט↔הקשה באותו דף בלי לאבד תוכן; undo/redo עובדים על פעולות משני המצבים בסדר הנכון.
15. כל דף כולל כותרת, תאריך, טמפו, סולם, ניתנים לעריכה ומוצגים ברשימה.
16. חיפוש ברשימה מסנן לפי כותרת/הערות/תגיות/סולם תוך < 100ms ל-200 דפים.
17. שינויים נשמרים אוטומטית ושורדים רענון וסגירת האפליקציה.
18. ייצוא PNG מפיק תמונה עם תווים + כתב יד + כותרת, על רקע בהיר.
19. גיבוי JSON ושחזור (מיזוג והחלפה) מחזירים את כל הדפים זהים; קובץ פגום נדחה בלי לפגוע בנתונים.
20. Tap targets ≥ 56px; עובד ב-landscape וב-portrait בטאבלט 10–11".
21. `LICENSE` (MIT, Paul Samson), `THIRD_PARTY_NOTICES.md` עם טקסט הרישיונות של VexFlow, Bravura, perfect-freehand, Heebo; אין תלות GPL.
22. README בעברית (§11). כל בדיקות Playwright עוברות.

## 10. תוכנית בדיקות Playwright
- `tests/helpers.js`: `freshApp(page)` (ניקוי IndexedDB/localStorage), `newPage()`, `tapStaff(page, systemIdx, staffIdx, pos, measureIdx)` שמחשב קואורדינטות דרך `window.BN.render.posToY` (hook לבדיקות), `drawStroke(page, points, {pointerType})` עם `page.dispatchEvent`/CDP `Input.dispatchTouchEvent` לעט ולמגע.
- **unit (בדפדפן, `page.evaluate`)** `music.spec.js`: `posToPitch`/`pitchToPos` לכל pos −10..18 בשני המפתחות (round-trip), C4 בשני המפתחות, `measureFill` לכל משקל, accidental implicit לפי סולם.
- `list.spec.js`: יצירה, שינוי כותרת, חיפוש, מיון, מחיקה + undo-toast, שכפול.
- `clefs.spec.js`: דף פה/סול/כפול; שינוי מפתח לשורה; הקשות על pos ידועים מפיקות G2/E4/C4/E1 (קריטריונים 5–8, 12); בדיקה ש-SVG מכיל glyph של brace במערכת כפולה.
- `tap.spec.js`: כל משך/נקודה/הפסקה/accidental; overflow לתיבה הבאה; קו תיבה, משקל, סולם; בחירה+גרירה; מקלדת (A–G, 1–5).
- `pen.spec.js`: stroke עם `pointerType:"pen"` נוצר; אחרי עט, `touch` לא יוצר stroke; מחק מוחק; צבעים/עוביים נשמרים במודל.
- `history.spec.js`: רצף מעורב (תו, stroke, תו) → 3× undo → ריק → redo.
- `persist.spec.js`: reload שומר; export JSON → clear → import (מיזוג/החלפה) → deep-equal; קובץ פגום נדחה.
- `export.spec.js`: PNG נוצר (download event), מידות ≥ 2000px רוחב, לא ריק.
- `pwa.spec.js`: manifest תקין, SW רשום; `context.setOffline(true)` + reload → האפליקציה עולה ודף קיים נפתח.
- `theme.spec.js`: toggle, שמירה, ללא FOUC; screenshot בהיר/כהה (רשות, להשוואה ידנית).
- כל הבדיקות רצות על project דסקטופ וטאבלט (`hasTouch`).

## 11. README בעברית (חובה)
מה זה, צילומי מסך (בהיר/כהה), **איך להתקין בטאבלט אנדרואיד** (כרום → ⋮ → "הוסף למסך הבית"/"התקן"), שני המצבים ואיך עוברים, טבלת קיצורים ומחוות, **איך לגבות ולשחזר** (והאזהרה שהנתונים נשמרים רק במכשיר), הרצה מקומית (`npx serve` / `python -m http.server`), הרצת בדיקות, רישיון וקרדיטים.

## 12. שלבי עבודה
| שלב | תוצר | בדיקות |
|---|---|---|
| A | שלד: index, theme, routing, storage, רשימה + דף ריק, LICENSE/NOTICES | list, theme |
| B | `music.js` + render עם VexFlow: חמשות פה/סול/כפול, משקל, סולם | music, clefs (תצוגה) |
| C | מצב הקשה מלא + undo/redo | tap, clefs, history |
| D | מצב עט + palm rejection + מחק | pen, history |
| E | ייצוא PNG, גיבוי/שחזור, thumbnails | export, persist |
| F | PWA (manifest, SW, offline, עדכון), ליטוש טאבלט, README | pwa, הכל |
אחרי כל שלב: commit, כל הבדיקות ירוקות, push ל-`main` (Pages מתעדכן).

## 13. מחוץ לתחום v1 → רעיונות לשלב 2
- השמעה (playback) של התווים ב-Web Audio (סינתזת בס, מטרונום לפי tempo) — מקשר ל-`ear-trainer`.
- זיהוי כתב יד והמרת עט לתווים מודפסים.
- טאבלטורה לבס (TAB) מתחת לחמשה, אקורדים וסימני אקורד (Cmaj7), ליגטורות וטריולות, מילים.
- ייצוא PDF/MusicXML/MIDI, ריבוי דפים בהדפסה.
- סנכרון בין מכשירים (Google Drive/GitHub Gist), הקלטת אודיו מצורפת לרעיון.
