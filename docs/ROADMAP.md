# Feature Roadmap — Arabic Script Practice (writearabic.app)

A prioritized backlog of features to build out, organized into three buckets.
Tackle across multiple sessions. Check items off as they ship.

Effort key: 🟢 small · 🟡 medium · 🔴 large. Each item notes the value it adds.

---

## Core Learning & Gamification

_Make practicing more engaging and habit-forming._

- [x] **#1 — Review Session flow** 🟡
      Turn the Review tab from a static due-list into a guided one-at-a-time queue:
      present each due item, auto-advance after scoring, show a "5 of 12" progress
      bar and an end-of-session summary. Highest engagement multiplier — gives users
      a clear "do my reviews" ritual on top of the SR data that already exists.

- [x] **#2 — Daily goal + progress indicator** 🟢
      Settable daily target (e.g. 5 letters/day). Header ring/bar fills as the user
      practices. Lays the groundwork for a later local-notification nudge. The
      proven core retention mechanic; all needed data already lives in
      `arabic_practice_dates`.

- [x] **#3 — XP / levels** 🟡
      Award XP per practice (bonus for high AI scores and on-time reviews); surface
      a level number + progress bar. Cheap on top of existing `practiceCount` and
      scores; provides constant forward momentum.

- [x] **#4 — Achievements / badges** 🟡
      _Shipped (2026-08-01): 8 badges (first stroke, first mastered, perfect
      score, 7-day streak, all started, all mastered, 30-day streak, 100
      sessions) via `src/utils/achievements.js` + `useAchievements` hook;
      unlock toast + Stats-tab tile grid; 13 unit tests; en+ar strings; keyed
      into backup + cloud sync._

- [x] **#5 — Streak protection ("freeze")** 🟢
      One free monthly freeze that preserves a streak through a missed day. Reduces
      churn from the discouragement of breaking a long run.

- [ ] **#6 — Word-level progress tracking** 🟡
      Words mode currently tracks nothing. Extend the progress model to words so
      they appear in stats and the review queue — makes the whole Words tab "count"
      instead of being a dead end.

---

## Content Expansion

_Other types of Arabic practice beyond basic letters and words._

- [x] **#7 — Arabic numerals (٠ ١ ٢ …)** 🟢
      Eastern Arabic numerals 0–9. Self-contained, high-value, reuses the existing
      canvas + stroke-order + progress systems. Among the first things learners
      want. _(First content add.)_

- [x] **#8 — Diacritics / harakat (تشكيل)** 🟡
      Fatha, kasra, damma, sukun, shadda, tanwin. Critical for actually reading and
      writing Arabic; currently absent. Could be a dedicated mode or an overlay on
      existing letters.

- [x] **#9 — Connected-writing drills** 🔴
      A dedicated "join these 2–3 letters" mode that grades the connections — the
      exact skill (joining) that learners struggle with most and that isolated-glyph
      practice doesn't build.

- [ ] **#10 — Calligraphy script styles** 🟡
      _Infrastructure shipped (2026-07-29): user preference `calligraphy_style`, centralized `getFontStack()` helper, Settings picker with Amiri/Scheherazade. Multi-script support (#10b) deferred — needs new WOFF2 fonts + per-script stroke-order data + AI prompt update (fix #15 first)._

- [x] **#11 — Themed vocabulary word packs** 🟢
      Expand beyond the current ~18 words into themed sets (greetings, days, food,
      Quranic terms). Cheap content authoring; pairs with #6.

- [ ] **#12 — Audio pronunciation** 🟡
      Web Speech API (`ar` voice) for letter names / words, or recorded native
      audio. Adds a second modality and strengthens the listening↔writing link.

---

## UI/UX Improvements

_Make the learning environment more intuitive and accessible._

- [x] **#13 — Progress export / import (JSON backup)** 🟢
      One-button export/import of all localStorage progress. Everything is
      client-only with no backend, so a cleared browser = total data loss. Cheap
      insurance and far less work than cloud sync. _(High-trust, low-effort.)_

- [ ] **#14 — Onboarding / first-run tour** 🟡
      A 3–4 step coachmark tour (ghost watermark, Show Me, AI Feedback, Review tab).
      Surfaces features new users currently never discover.

- [x] **#15 — Fix Stroke animation for all forms** 🔴→🟢
      ~~"Show Me" is supposed to draw the strokes in real time to help the student learn. Currently, when the button is pressed it only partially animates the strokes so the student does not learn anything.~~
      **Fixed:** root cause was hand-authored `strokeOrder.js` paths written against a wrong glyph metric than the shipped Amiri font (measured 12–88% ink coverage). All 28 isolated paths and all 72 supported positional paths (initial/medial/final for joining letters; final for non-joiners) were hand-authored against measured Amiri ink-run calibration data. The strict resolver now hides Show Me for any unauthored form, and `npm run test:stroke-coverage` verifies all 100 letter-forms at ≥95% coverage. Host-Chrome visual smoke on ر/ص/ع confirms whole letters draw stroke-by-stroke.

- [x] **#16 — Audio/visual feedback on score** 🟢
      Subtle success animation + optional sound on a 4–5★ score. Makes the AI
      feedback moment more rewarding; pairs with the gamification bucket.

- [x] **#17 — Reduced-motion + font-size/contrast options** 🟢
      `prefers-reduced-motion` guard for the Show Me animation, plus a text-size /
      high-contrast toggle. Rounds out the already-strong a11y foundation.

---

## Session log

- **2026-08-17** — Shipped ROADMAP #9 (Connected-writing drills): 31 two/three-letter
  connections with SM-2 progress tracking, deck integration, review queue support,
  and AI grading. Pre-ship review fixed 3 issues: i18n `formConnection` string (B1),
  formKey guard in review routing to prevent future word-collision misrouting (B2),
  and stale comments from the mid-flight re-namespace (B3). Also hardened
  `backup.js` (5 missing pref keys + `WIPE_ONLY_KEYS` for sync metadata) and
  `sound.js` (AudioContext reuse to prevent silent failure after 4–5 tones).

- **2026-08-01** — Completed ROADMAP #15 Part 2: authored all 72 positional
  stroke paths (initial/medial/final for the 22 joining letters ب ت ث ن ي ج ح خ
  س ش ص ض ط ظ ع غ ف ق ك ل م ه ي, final forms for non-joiners ا د ذ ر ز و),
  nested `STROKE_DATA` per-letter under form keys with form-aware animation
  lookup and a strict Show Me gate hiding unauthored forms. `npm run
test:stroke-coverage` now verifies all 100 letter-forms at ≥95% ink coverage
  (0/100 below target). Implemented #4 (Achievements): 8 badges with unlock
  toast + Stats card (13 tests). Branch `feat/calligraphy-style` carries the
  full #15 + #4 + #10-infra work, pending push.

- **2026-07-29** — Implemented #15 (Show Me stroke animation): re-authored all 28
  isolated-letter stroke paths against a measured Amiri ink-run calibration table
  (the root cause of 12–88% coverage — shape drift, not brush size; ink-aware radius
  and snap-to-ink explored and rolled back). Split `DOT_RADIUS` from
  `BRUSH_RADIUS`. Added `npm run test:stroke-coverage` regression gate
  (Python + Store-Python wrapper; jsdom can't rasterize canvas; 28/28 ≥95%).
  Host-Chrome visual smoke via playwright-core on ر (worst case), ص (wide), ع
  (counter) — whole letters draw stroke-by-stroke, zero page errors. Position
  forms (initial/medial/final) deferred as a follow-up.

- **2026-05-28** — Roadmap created. Implemented #7 (Arabic numerals) and #13
  (progress export/import). #2 (daily goal indicator) is next up but not yet
  started.
- **2026-06-15** — Implemented one-session roadmap sprint: #1 guided Review Session flow
  with queue, auto-advance, progress bar, and end-of-session summary; #2 daily goal
  ring and settable target (derived from lastPracticed dates); #11 themed word packs
  (Greetings, Quranic Terms); #16 score celebration animation + optional success
  sound; #17 reduced-motion/high-contrast toggles. Verified with `npm run build`
  and browser smoke test.
- **2026-06-21** — Added "Diacritics" mode (#8), establishing practice support for fatha, kasra, damma, sukun, shadda, and tanwin. Integrated transparently into heatmap, review session, and AI grading pipeline.
- **2026-06-27** — Implemented #5 streak protection ("freeze"): one auto-applied freeze per calendar month (use-it-or-lose-it) that bridges a one-day gap in `getStreaks()`. New `src/utils/freezes.js` storage module (`arabic_freezes` key, added to backup export/import). Stats tab shows "Freeze available/used" indicator and marks frozen days on the 30-day timeline with a "Streak preserved" tooltip. Verified with `npm run build` and Playwright browser tests (freeze bridges single gap, breaks at second same-month gap, Arabic locale + dark mode).
- **2026-06-27** — Implemented #3 (XP / levels): new `src/utils/xp.js` storage
  module (`arabic_xp` key, quadratic level curve `50·(L-1)·L`); XP awarded at
  the draw (+10), AI-score (+0/5/15/25/40 by score), and review (+10 self,
  +15 on-time) call sites in PracticeView; `LevelBadge` in the header and a
  Level/XP card in the Stats tab; floating "+N XP" toast with reduced-motion
  guard; `arabic_xp` added to backup export/import. Also wired the dormant
  `celebrate` state + `playSuccessTone()` on score ≥4 (roadmap #16
  scaffolding was present but never triggered). Verified with `npm run build`
  and Playwright browser tests (XP accrues, stats card, backup, Arabic + dark).
