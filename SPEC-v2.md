# SPEC v2 — מחברת תווים לטאבלט (Bass Notebook) · שלב 1: "Notation Pad בלי paywall"

> מסמך בנייה לסוכן קוד. שפה: עברית, מונחי קוד באנגלית. ריפו: `Deadpaul134/bass-notebook` (ציבורי, GitHub Pages). רישיון: **MIT © Paul Samson**.
> משתמש: פול, סטודנט לבס ברימון. **המטרה: אפליקציית כתיבת תווים כמו האפליקציות הקיימות בשוק (Notation Pad וכו'), אבל חינמית לגמרי**: בוחרים משך, מקישים על החמשה, התו מודפס מיד, ושומעים מה שכתבתם.
> **מחליף את v1** (`SPEC.md`, כתב יד חופשי על חמשה), שפול דחה אחרי PR #1.

---

## 0. מה קורה עם PR #1
- **סוגרים את PR #1 בלי merge** (עם הערה: "superseded by SPEC-v2"). בונים על branch חדש `v2-notation-pad` מ-`main` ופותחים PR חדש.
- **שומרים ומעבירים מ-PR #1** (אם תקינים ועוברים בדיקות): מעטפת PWA (`manifest`, `sw.js`, אייקונים), theme + Warm Sand CSS, `data.js` (storage ב-IndexedDB, migrate), מסך רשימת המחברת + חיפוש, גיבוי/שחזור JSON, ייצוא PNG, helpers של Playwright, LICENSE/NOTICES/README.
- **זורקים**: `pen.js`, שכבת strokes, palm rejection, perfect-freehand (התלות יוצאת מ-NOTICES).

## 1. עקרונות-על
1. **מהיר כמו האפליקציות המסחריות**: משך → הקשה → תו מודפס. ≤ 100ms מהקשה לתו על המסך.
2. **הכל חינמי**: השמעה, ייצוא, מספר דפים, ללא הגבלה, בלי חשבון ובלי פרסומות.
3. **טאבלט קודם** (אנדרואיד 10–11", landscape ו-portrait), tap targets ≥ 56px.
4. **Offline מלא** (PWA), נתונים מקומיים בלבד + גיבוי לקובץ.
5. **רישוי נקי**: רק MIT/BSD/Apache-2.0/ISC/OFL. **אין GPL/LGPL/AGPL/CC BY-SA.**

## 2. טכנולוגיה וקונבנציות (כמו `ear-trainer` ו-v1)
- HTML/CSS/vanilla JS, ללא build וללא framework; IIFE לכל קובץ, `"use strict"`, namespace יחיד `window.BN`.
- `<html lang="he" dir="rtl">`, inline script ל-theme לפני paint (מפתח `bass-notebook-v1-theme`: `light|dark|system`), Heebo מקומי, `<meta name="theme-color">`.
- **ממשק RTL; אזור התווים תמיד `dir="ltr"`.** Routing ב-hash: `#list`, `#score/<id>`, `#settings`.
- עיצוב **Warm Sand**: משתני CSS מ-`ear-trainer` §1.1 כמות שהם (בהיר + `[data-theme="dark"]`), toggle ☀︎/☾/מערכת. נייר: `--paper:#fffdf9` / כהה `#2f2621`; תווים ב-`--text`; תו נבחר ותו מנוגן ב-`--accent`. `prefers-reduced-motion` מכובד.
- Playwright: Desktop Chrome 1440×900 + טאבלט landscape 1138×712 + portrait 712×1138, `hasTouch:true`, `--autoplay-policy=no-user-gesture-required`.

### 2.1 תלויות (vendored ב-`vendor/`, לא CDN)
| ספרייה | שימוש | רישיון |
|---|---|---|
| **VexFlow** 4.x (UMD, עם Bravura) | engraving: חמשות, מפתחות, תווים, beams, ties, סימנים | MIT (Bravura: SIL OFL 1.1) |
| **Tone.js** 14.x (UMD) — *או* Web Audio משלנו | תזמון השמעה (Transport), synth | MIT |
| **jsPDF** + **svg2pdf.js** | ייצוא PDF וקטורי | MIT / MIT |
| Heebo | פונט ממשק | SIL OFL 1.1 |
- **לא Verovio** (LGPL-3.0): לא נדרש, VexFlow מספיק לשלב 1. גם לא OSMD/abcjs כרגע (לא נחוצים).
- **צלילים**: ברירת מחדל = **סינתזה** (אפס קבצים, offline): בס = `sawtooth`+sine sub דרך lowpass עם envelope (fingered bass), פסנתר = triangle+sine עם ADSR (כמו `ear-trainer` §5.3). אופציונלי: samples FluidR3_GM מ-`gleitz/midi-js-soundfonts` (**CC BY 3.0**, ייחוס ב-NOTICES; **לא MusyngKite** CC BY-SA), נשמרים ב-cache של ה-SW אחרי הורדה ראשונה. כשל טעינה → fallback לסינתזה.
- המלצה: להתחיל עם **Web Audio משלנו** (קטן, look-ahead scheduler כמו ב-`ear-trainer`); Tone.js רק אם חוסך זמן משמעותי. הסוכן מוודא רישיון בכל גרסה שנבחרה ומעתיק אותו ל-`THIRD_PARTY_NOTICES.md`.

## 3. מבנה קבצים
```
bass-notebook/
├─ index.html · manifest.webmanifest · sw.js
├─ css/app.css
├─ js/
│  ├─ data.js      # BN, KEYS, IndexedDB storage, migrate, backup/restore   (מ-PR #1)
│  ├─ model.js     # pure: Score model, פעולות עריכה (insert/delete/setPitch...), normalize/split measures
│  ├─ music.js     # pure: clefs, pos↔pitch, key sig, durations, ties, beaming groups
│  ├─ layout.js    # Score → systems/measures לפי רוחב מסך (line breaking)
│  ├─ render.js    # VexFlow rendering + hit-testing (x,y → staff/measure/pos/event)
│  ├─ editor.js    # palette, tap/drag/select, cursor, keyboard
│  ├─ history.js   # undo/redo (snapshots מבניים)
│  ├─ playback.js  # scheduler, synth voices, cursor sync, metronome
│  ├─ musicxml.js  # export (ו-import בסיסי לבדיקות round-trip)
│  ├─ export.js    # PNG, PDF, JSON
│  └─ app.js       # routing, screens, theme, SW registration
├─ vendor/ · assets/icons/ · tests/ · playwright.config.js · package.json
├─ README.md (עברית) · LICENSE · THIRD_PARTY_NOTICES.md · CLAUDE.md · SPEC.md (v1) · SPEC-v2.md
```
סדר טעינה: `vendor → data → music → model → layout → render → history → playback → musicxml → export → editor → app`.

## 4. מודל נתונים (תואם MusicXML)
המודל **לוגי** (מוזיקה), לא גרפי. השבירה לשורות מחושבת ב-`layout.js` בכל render. השמות לקוחים מ-MusicXML כדי שהייצוא יהיה מיפוי ישיר.
```js
Score = {
  id, v: 2, title: "גרוב בסול", date: "2026-11-03", createdAt, updatedAt,
  tags: [], comment: "",
  tempo: { bpm: 92, beatUnit: "quarter" },          // <sound tempo>, <metronome>
  divisions: 48,                                     // ticks לרבע (מתחלק ב-16th ובנקודות כפולות; טריולות בשלב 2)
  staffLayout: "bass" | "treble" | "grand",          // ברירת מחדל "bass"
  parts: [ Part ]                                    // שלב 1: Part אחד
}
Part = { id: "P1", name: "Bass", instrument: "bass" | "piano",   // grand/treble → piano ברירת מחדל
  staves: 1 | 2,                                     // <staves>
  measures: [ Measure ] }
Measure = { number: 1,
  attributes?: {                                     // רק בתיבה 1 או כשמשתנה
    key: { fifths: -1..7 | -7, mode: "major"|"minor" },  // <key>
    time: { beats: 4, beatType: 4 },                 // <time>
    clefs: [ { staff: 1, sign: "F", line: 4 } ] },   // F4 = פה, G2 = סול
  barline?: { right: "regular"|"light-light"|"light-heavy", repeat?: "forward"|"backward" },
  notes: [ Note ] }                                  // לפי סדר; staff + voice מפרידים
Note = { id, staff: 1|2, voice: 1,
  rest: false, pitch: { step: "A", alter: 0|1|-1, octave: 2 },   // <pitch>
  duration: 48,                                      // ticks
  type: "whole"|"half"|"quarter"|"eighth"|"16th", dots: 0|1|2,
  accidental?: "sharp"|"flat"|"natural",             // סימן מוצג (מפורש) — alter הוא הצליל האמיתי
  tie?: { start?: true, stop?: true } }
```
- **Grand staff**: `staves:2`, staff 1 = סול (G2), staff 2 = פה (F4). חלוקה אוטומטית של תווים לפי staff שהוקש, לא לפי גובה.
- שינוי מפתח (`staffLayout`) **לא משנה גובה צלילים**. מעבר מ-grand ל-single כשיש תווים בשתי החמשות → אישור ("התווים בחמשה העליונה יימחקו" או ביטול).
- `alter` נקבע מהסולם (implicit) + מ-accidental במפורש + מ-accidental קודם באותה תיבה ובאותו גובה (כללי כתיבה סטנדרטיים).
- **Normalize** (`BN.model.normalize(score)`) אחרי כל פעולה: מאחד את הזרם של כל staff/voice ומחלק לתיבות לפי משקל; תו שחוצה קו תיבה **מפוצל ל-2 תווים עם tie**; תיבה חסרה בסוף מתמלאת בהפסקות (בתצוגה, תיבה אחרונה ריקה למחצה מותרת); תמיד יש תיבה ריקה אחת בסוף לכתיבה.
- תאימות: `v:2`. דף v1 בגיבוי ישן → migrate שמתעלם מ-strokes וממיר events ל-Note (אם קיימים).

## 5. מסכים
| # | מסך | Route | תוכן |
|---|---|---|---|
| 1 | **מחברת** | `#list` | "המחברת שלי", חיפוש מיידי (כותרת/תגיות/הערה/סולם), מיון (עודכן/תאריך/שם), כרטיסים עם thumbnail (SVG של 2 השורות הראשונות), תאריך, ♩=bpm, סולם, אייקון 𝄢/𝄞/כפול. FAB "＋ רעיון חדש" (בחירה מהירה: פה ⟵ ברירת מחדל / סול / כפול). ⋮: שכפול, שינוי שם, מחיקה + undo-toast. |
| 2 | **עורך** | `#score/<id>` | **Top bar**: חזרה, כותרת inline, chips: סולם · משקל · ♩=bpm · מפתח, ▶/⏸ השמעה, ⋮ (ייצוא, הגדרות דף). **אזור תווים** בגלילה אנכית, שורות מתאימות לרוחב, zoom בצביטה 60–200%. **Palette תחתון** (§6). |
| 3 | **הגדרות** | `#settings` | תמה, מפתח ברירת מחדל לרעיון חדש, צליל (סינתזה/samples), עוצמה, מטרונום בהשמעה, count-in, יד דומיננטית, גיבוי/שחזור JSON, אודות + רישיונות. |

## 6. אינטראקציה בטאבלט (עורך)
### 6.1 Palette תחתון (קבוע, ≥ 56px, נגלל אופקית ב-portrait)
`𝅝 𝅗𝅥 ♩ ♪ 𝅘𝅥𝅯` (whole..16th, toggle אחד פעיל) · **𝄽 הפסקה** (toggle: מקשים ומקבלים הפסקה במשך הנבחר) · **· נקודה** (1→2→0) · **⁀ tie** · **♯ ♭ ♮** · 🗑 · **↶ ↷** · מצב **בחירה ↖**.
- כשיש תו נבחר: לחיצה על משך/נקודה/accidental/tie **חלה על הנבחר** (ונשארת "המשך הנוכחי" להקשות הבאות). כשאין: בוחרים מה התו הבא יהיה.
- Accidental לפני הקשה = חל על התו הבא בלבד (one-shot), מודגש עד השימוש.

### 6.2 הקשה = תו
- הקשה על חמשה (כולל עד 5 קווי עזר מעל ומתחת) → snap לקו/רווח הקרוב → גובה לפי המפתח (§7) + סולם → התו **מודפס מיד** ונשמע (preview קצר 300ms בכלי של ה-staff).
- **מיקום אופקי (כמו Notation Pad)**: הקשה בתוך תיבה **אחרי התו האחרון** או בשטח הריק → **הוספה בסוף** (append ב-cursor). הקשה **על עמודה של תו קיים** (±½ רוחב תו) → **החלפת גובה** של אותו תו (או הוספת תו לאקורד = שלב 2; בשלב 1 החלפה). ה-cursor (קו אנכי `--accent`) מראה איפה ייכנס התו הבא; אפשר להזיז אותו בהקשה על רווח בין תווים → **insert** באמצע (התווים אחרי זזים והתיבות מתחלקות מחדש).
- בזמן לחיצה (pointerdown → up): **ghost note** + תווית גובה ("A2") מעל האצבע, כדי שהאצבע לא תסתיר. גרירה אנכית לפני שחרור משנה את הגובה; שחרור = הצבה. pointercancel = ביטול.
- אזור hit לכל שלב ≥ 12px ב-zoom 100%; מתחת לזה מוצגת זכוכית מגדלת.

### 6.3 בחירה, גרירה, מחיקה
- הקשה על ראש תו קיים (במצב ↖ או לחיצה ארוכה 350ms בכל מצב) → נבחר (צבע `--accent` + ידית). **גרירה אנכית** של תו נבחר = שינוי גובה בשלבים דיאטוניים (בתוך הסולם), עם צליל preview בכל שלב; ♯/♭ אחרי זה לכרומטי.
- גרירה אופקית על אזור ריק = בחירת טווח (range) → מחיקה/שינוי משך לכמה תווים.
- 🗑 / Backspace = מחיקה; התו הופך **להפסקה** אם הוא באמצע תיבה (כמו בתוכנות עריכה), ונמחק לגמרי אם הוא בסוף הזרם. (העדפה זו ניתנת להחלפה בהגדרות: "מחיקה מזיזה תווים").
- **Undo/Redo**: ↶ ↷ תמיד בפלטה, הקשה בשתי אצבעות = undo, שלוש = redo, Ctrl+Z / Ctrl+Shift+Z. 200 צעדים לכל דף, ≤ 30ms לפעולה.
- מקלדת חיצונית: A–G הוספת תו, 1–5 משך (1=whole..5=16th), `.` נקודה, `+`/`-`/`=` ♯/♭/♮, ↑↓ גובה (Ctrl = אוקטבה), ←→ cursor, R הפסקה, T tie, Space play/pause.

### 6.4 סולם, משקל, קווי תיבה, טמפו
- chip סולם → פופאפ 15 מז'וריים + מינוריים מקבילים (מוצג כמעגל קוינטות קטן). chip משקל → 2/4 3/4 4/4 5/4 6/8 7/8 9/8 12/8 + מותאם (beats 1–16 / 2,4,8,16).
- שינוי מתיבה מסוימת: לחיצה ארוכה על תיבה → "שנה סולם/משקל מכאן", "קו כפול", "קו סיום", "חזרה", "הוסף/מחק תיבה". שינוי משקל → normalize מחדש (פיצול + ties).
- טמפו: chip ♩=bpm (40–240, +/− ו-tap-tempo), מודפס מעל התיבה הראשונה (`StaveTempo`).

### 6.5 Engraving
- VexFlow: `Stave` עם clef/key/time בתחילת כל שורה (key תמיד, time רק בהתחלה/בשינוי), `StaveConnector` brace + single-left ל-grand, `Beam.generateBeams` לפי קבוצות הפעמה (6/8 = 3 שמיניות), `StaveTie` (גם בין שורות), stems אוטומטיים, accidentals לפי `Accidental.applyAccidentals`, קווי עזר אוטומטיים.
- Line breaking: רוחב תיבה לפי מספר התווים (מינימום), 2–5 תיבות לשורה לפי רוחב מסך; justified. רינדור מחדש רק של השורה שהשתנתה כשאפשר (יעד ≤ 50ms לשינוי בדף של 64 תיבות).

## 7. מיפוי גובה (`music.js`, pure)
`pos` = שלבים מהקו התחתון (0 = קו תחתון, 8 = קו עליון), טווח −10..18.
- **פה (F4)**: pos 0 = **G2**, 8 = **A3**, 10 = C4 (קו עזר ראשון מעל), −9 = **E1** (בס 4 מיתרים), −10 = B0 (בס 5 מיתרים).
- **סול (G2)**: pos 0 = **E4**, 8 = **F5**, −2 = C4 (קו עזר ראשון מתחת), 10 = A5.
- **Grand**: hit-test לפי y: הרווח בין החמשות מחולק באמצע; C4 נכתב נכון בשתיהן.
- `posToPitch(clef,pos,key)`, `pitchToPos(clef,pitch)`, `pitchToMidi`, `midiToFreq`.
- **גובה השמעה בבס**: בשלב 1 מנגנים בגובה הכתוב (concert), בלי הנמכת אוקטבה. הערה על כך ב-README; transposition (8vb) — שלב 2.

## 8. השמעה (`playback.js`)
- ▶ מתחיל מה-cursor (או מתחילת הדף אם אין), ⏸ עוצר, ■ חוזר להתחלה. אופציה: loop על טווח נבחר.
- **Cursor נע**: קו אנכי `--accent` + הדגשת התו המנוגן, מסונכרן ל-`ctx.currentTime` דרך `requestAnimationFrame`; גלילה אוטומטית לשורה המנוגנת.
- כלים: staff בפה → **בס** (synth fingered bass, או sample `electric_bass_finger`); סול → **פסנתר**. ב-grand שתי החמשות יחד. בחירת כלי per-staff בהגדרות הדף.
- תזמון: look-ahead scheduler (25ms tick, 100ms window) לפי `ctx.currentTime`, לא setTimeout לצלילים. ties = צליל אחד מתמשך; הפסקות שקטות; נקודות מאריכות.
- שליטת טמפו בזמן השמעה (slider 40–240 + "×0.5 / ×0.75 / ×1" לתרגול), מטרונום אופציונלי (accent על פעמה 1), count-in בר אחד אופציונלי.
- `AudioContext` נוצר במחווה הראשונה, `resume()` אם suspended. limiter (`DynamicsCompressor`) לפני destination.

## 9. מחברת, שמירה וייצוא
- **Autosave** ל-IndexedDB (DB `bass-notebook`, store `scores`) debounce 400ms + `visibilitychange`/`pagehide`; אינדקס קל ב-localStorage לרשימה. `navigator.storage.persist()`. תזכורת גיבוי אחרי 14 יום.
- **MusicXML** (`.musicxml`, uncompressed, `score-partwise` 4.0): part-list, divisions, key/time/clef(s)/staves, notes עם pitch/duration/type/dot/accidental/tie+tied/staff/voice/beam, barlines, `<direction><metronome>` + `<sound tempo>`, `<backup>` בין staff 1 ל-2 ב-grand. חייב להיפתח ב-MuseScore 4 ללא שגיאות (בדיקה ידנית אחת + ולידציה מול XSD בבדיקות אם קל; אחרת round-trip עם importer בסיסי שלנו).
- **PDF**: SVG של VexFlow → `svg2pdf.js` → jsPDF, A4 portrait, כותרת/תאריך/טמפו בראש, שבירת שורות לפי רוחב A4 (layout נפרד מהמסך), כמה עמודים לפי הצורך. גיבוי חלופי: כפתור "הדפס" עם print CSS.
- **PNG**: canvas ×2, רקע נייר בהיר תמיד. Android: `navigator.share({files})` אם זמין, אחרת download.
- **JSON**: `{app:"bass-notebook", v:2, exportedAt, scores:[...]}`; שחזור במצב מיזוג (לפי id + `updatedAt`) או החלפה (אישור כפול); קובץ פגום → הודעה בעברית בלי שינוי בנתונים. תומך גם בגיבוי v1.
- שם קובץ: `<title>_<date>.<ext>` (מנוקה מתווים אסורים).

## 10. PWA / offline (מ-PR #1, לעדכן רשימת precache)
`manifest` (`name:"מחברת בס"`, `lang:"he"`, `dir:"rtl"`, `display:"standalone"`, `orientation:"any"`, `start_url:"./#list"`, `scope:"./"`, אייקונים 192/512 + maskable), `sw.js` cache-first עם `CACHE_VERSION`, ניקוי caches ישנים, טוסט "גרסה חדשה — רענן". נתיבים יחסיים (Pages תחת `/bass-notebook/`). כל vendor/פונטים ב-precache; samples ב-runtime cache.

## 11. קריטריוני קבלה
1. האתר עולה מ-GitHub Pages, `lang="he" dir="rtl"`, ללא build וללא שגיאות console; PR #1 סגור, העבודה ב-branch/PR חדש.
2. ניתן להתקין כ-PWA בכרום אנדרואיד; אחרי טעינה ראשונה הכל (כולל השמעה בסינתזה וייצוא) עובד במצב טיסה.
3. בהיר/כהה/מערכת מתחלף מיידית, נשמר, ללא הבהוב.
4. רעיון חדש נפתח במפתח **פה**, 4/4, C מז'ור, ♩=100, תאריך היום; ניתן לבחור סול או grand ביצירה ובכל רגע אחר.
5. Grand מציג סול מעל פה עם brace וקווי תיבה משותפים; כל staff מקבל תווים בנפרד.
6. מיפוי: פה — קו תחתון G2, קו עליון A3, קו עזר 1 מעל C4, pos −9 E1; סול — קו תחתון E4, קו עליון F5, קו עזר 1 מתחת C4; grand — C4 נכון בשתי החמשות.
7. בחירת משך (whole..16th) + הקשה → תו במשך ובגובה הנכונים מודפס תוך ≤ 100ms בטאבלט בינוני, ונשמע preview.
8. מצב הפסקה, נקודה (1/2), tie, ♯/♭/♮ עובדים לפני הקשה ועל תו נבחר; הסולם מחיל alter implicit; accidental בתיבה חל עד סוף התיבה, כולל ♮ ביטול.
9. גרירה אנכית של תו משנה גובה דיאטונית עם preview; ghost note + תווית גובה בזמן לחיצה.
10. בחירה (תו/טווח) ומחיקה עובדות; insert באמצע מזיז תווים ומחלק מחדש את התיבות.
11. **פיצול אוטומטי לתיבות**: תו שחוצה קו תיבה מפוצל ל-2 עם tie; שינוי משקל מחלק מחדש את כל התווים נכון (סכום משכים לכל תיבה = משקל).
12. סולם ומשקל בתחילה ובאמצע, קווי תיבה (כפול, סיום, חזרות), טמפו מודפס — כולם מוצגים ונשמרים.
13. Beams לפי הפעמה (4/4 ו-6/8), stems ו-ties נכונים גם בין שורות.
14. Undo/Redo לכל פעולת עריכה (כולל שינוי משקל/סולם/מפתח), ≥ 200 צעדים, ≤ 30ms; מחוות 2/3 אצבעות וקיצורי מקלדת.
15. השמעה: בס לחמשת פה, פסנתר לסול, grand ביחד; cursor נע מסונכרן (סטייה ≤ 50ms), גלילה אוטומטית, ▶ מה-cursor, ⏸/■, loop טווח.
16. שליטת טמפו 40–240 (+ ×0.5/×0.75) משפיעה מיד; מטרונום ו-count-in אופציונליים; ties = צליל רציף.
17. מחברת: רשימה עם חיפוש (< 100ms ל-200 דפים), מיון, שכפול, מחיקה עם undo; autosave שורד reload וסגירת אפליקציה.
18. ייצוא MusicXML נפתח ב-MuseScore 4 עם אותם תווים/משכים/סולם/משקל/מפתחות/ties/טמפו; round-trip (export→import) שלנו שווה למודל.
19. ייצוא PDF (A4, וקטורי, רב-עמודי) ו-PNG עם כותרת, על רקע בהיר.
20. גיבוי/שחזור JSON (מיזוג/החלפה) זהה; קובץ פגום נדחה; גיבוי v1 מתקבל.
21. Tap targets ≥ 56px; עובד ב-landscape וב-portrait; אין זום דפדפן לא רצוי (double-tap).
22. `LICENSE` (MIT, Paul Samson), `THIRD_PARTY_NOTICES.md` (VexFlow, Bravura, jsPDF, svg2pdf.js, Heebo, Tone.js/samples אם בשימוש); אין LGPL/GPL (אין Verovio).
23. README בעברית (§13); כל בדיקות Playwright עוברות בשלושת ה-projects.

## 12. תוכנית בדיקות Playwright
- `helpers.js`: `freshApp`, `newScore(page,{layout})`, `tapStaff(page,{staff,measure,pos,slot:"end"|index})` דרך hook `BN.render.locate()`→קואורדינטות, `getModel(page)` (`BN.state.current`), `dragNote(page,id,steps)`, touch דרך CDP `Input.dispatchTouchEvent`.
- **unit** (`page.evaluate`): `music.spec.js` — pos↔pitch round-trip לכל pos −10..18 בשני המפתחות, alter לפי 15 סולמות, accidental בתיבה; `model.spec.js` — normalize: פיצול+tie, שינוי משקל 4/4→3/4→6/8, insert/delete, סכום משכים; `musicxml.spec.js` — export תקין (XML parse, אלמנטים חובה, `<backup>` ב-grand), round-trip.
- `editor.spec.js`: כל משך/הפסקה/נקודה/tie/accidental, הקשה append/replace/insert, ghost note, גרירה, בחירת טווח, מחיקה; קיצורי מקלדת.
- `clefs.spec.js`: פה/סול/grand, מעבר ביניהם שומר גבהים, אזהרה ב-grand→single, brace ב-SVG; קריטריון 6.
- `engrave.spec.js`: מספר `.vf-stavenote` = מספר תווים, beams ב-4/4 ו-6/8, key/time בשורה הראשונה, tempo מודפס; screenshot בהיר/כהה (רשות).
- `history.spec.js`: רצף מעורב → undo עד ריק → redo עד זהה (deep-equal), מחוות 2/3 אצבעות.
- `playback.spec.js`: עם `BN.playback.clock` מוזרק (fake clock): סדר ומועדי אירועים לפי bpm, ties מאוחדים, כלי לפי staff, cursor מתקדם לתו הנכון, שינוי טמפו בזמן ריצה.
- `notebook.spec.js`: יצירה, חיפוש, מיון, שכפול, מחיקה+undo, reload שומר.
- `export.spec.js`: MusicXML/PDF/PNG download (גודל > 0, PDF מתחיל ב-`%PDF`, PNG רוחב ≥ 2000), JSON backup→clear→restore deep-equal, קובץ פגום, קובץ v1.
- `pwa.spec.js`: manifest, SW רשום, `context.setOffline(true)` + reload → רשימה, עורך והשמעה עובדים.
- `perf.spec.js` (טאבלט): הקשה→תו ≤ 100ms (ממוצע 20 הקשות, CPU throttle ×4), undo ≤ 30ms, דף 64 תיבות נטען ≤ 1s.

## 13. README בעברית (חובה)
מה זה ולמה (חלופה חינמית ל-Notation Pad), צילומי מסך בהיר/כהה, **התקנה בטאבלט אנדרואיד** (כרום → ⋮ → "התקן"/"הוסף למסך הבית"), מדריך מהיר: משך → הקשה → גרירה → השמעה, טבלת מחוות וקיצורי מקלדת, ייצוא (MusicXML לפתיחה ב-MuseScore, PDF, PNG), **גיבוי ושחזור** + אזהרה שהנתונים במכשיר בלבד, הערה על גובה הבס (concert), הרצה מקומית, בדיקות, רישיון וקרדיטים.

## 14. שלבי עבודה (branch `v2-notation-pad`)
| שלב | תוצר | בדיקות |
|---|---|---|
| A | סגירת PR #1; העברת מעטפת PWA, theme, storage, רשימה, JSON מ-PR #1; הסרת קוד עט; מודל v2 + migrate | notebook, pwa |
| B | `music.js` + `model.js` (normalize, פיצול, ties) — pure, בדיקות unit מלאות | music, model |
| C | `layout.js` + `render.js`: engraving בפה/סול/grand, key/time/barlines/tempo, beams | engrave, clefs |
| D | `editor.js` + `history.js`: palette, הקשה, ghost, גרירה, בחירה, מחיקה, undo/redo, מקלדת | editor, history |
| E | `playback.js`: scheduler, בס/פסנתר, cursor, טמפו, מטרונום | playback |
| F | MusicXML, PDF, PNG, ליטוש טאבלט, perf, README | export, perf, הכל |
אחרי כל שלב: commit, כל הבדיקות ירוקות, push; PR אחד לסוף שלב 1 (או PR לכל שלב, לבחירת פול).

## 15. מחוץ לתחום שלב 1
- **שלב 2 — עט**: ציור ראש תו בעט (Pointer Events, `pointerType:"pen"`, palm rejection) שעושה snap לקו/רווח הקרוב ומקבל את המשך הנבחר בפלטה; אקורדים, טריולות, TAB לבס, סימני אקורד, 8vb לבס, ייבוא MusicXML מלא, MIDI.
- **שלב 3 — זיהוי כתב יד**: מודל לזיהוי סמלים מוזיקליים בכתב יד. מועמדים: dataset **HOMUS** (לבדוק רישיון לפני שימוש), **Flova / omr_transformer** (Apache-2.0); הרצה בדפדפן (ONNX Runtime Web, MIT) כדי להישאר offline.
- סנכרון בין מכשירים, הקלטת אודיו מצורפת, שיתוף בקישור.
