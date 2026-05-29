# Feature Roadmap — Arabic Script Practice (writearabic.app)

A prioritized backlog of features to build out, organized into three buckets.
Tackle across multiple sessions. Check items off as they ship.

Effort key: 🟢 small · 🟡 medium · 🔴 large. Each item notes the value it adds.

---

## Core Learning & Gamification
*Make practicing more engaging and habit-forming.*

- [ ] **#1 — Review Session flow** 🟡
  Turn the Review tab from a static due-list into a guided one-at-a-time queue:
  present each due item, auto-advance after scoring, show a "5 of 12" progress
  bar and an end-of-session summary. Highest engagement multiplier — gives users
  a clear "do my reviews" ritual on top of the SR data that already exists.

- [ ] **#2 — Daily goal + progress indicator** 🟢
  Settable daily target (e.g. 5 letters/day). Header ring/bar fills as the user
  practices. Lays the groundwork for a later local-notification nudge. The
  proven core retention mechanic; all needed data already lives in
  `arabic_practice_dates`.

- [ ] **#3 — XP / levels** 🟡
  Award XP per practice (bonus for high AI scores and on-time reviews); surface
  a level number + progress bar. Cheap on top of existing `practiceCount` and
  scores; provides constant forward momentum.

- [ ] **#4 — Achievements / badges** 🟡
  "First letter mastered," "7-day streak," "All 28 started," "Perfect score."
  Most states are already detectable (`isLetterComplete`, `getStreaks`,
  `score===5`). Converts silent milestones into visible, shareable wins.

- [ ] **#5 — Streak protection ("freeze")** 🟢
  One free monthly freeze that preserves a streak through a missed day. Reduces
  churn from the discouragement of breaking a long run.

- [ ] **#6 — Word-level progress tracking** 🟡
  Words mode currently tracks nothing. Extend the progress model to words so
  they appear in stats and the review queue — makes the whole Words tab "count"
  instead of being a dead end.

---

## Content Expansion
*Other types of Arabic practice beyond basic letters and words.*

- [x] **#7 — Arabic numerals (٠ ١ ٢ …)** 🟢
  Eastern Arabic numerals 0–9. Self-contained, high-value, reuses the existing
  canvas + stroke-order + progress systems. Among the first things learners
  want. *(First content add.)*

- [ ] **#8 — Diacritics / harakat (تشكيل)** 🟡
  Fatha, kasra, damma, sukun, shadda, tanwin. Critical for actually reading and
  writing Arabic; currently absent. Could be a dedicated mode or an overlay on
  existing letters.

- [ ] **#9 — Connected-writing drills** 🔴
  A dedicated "join these 2–3 letters" mode that grades the connections — the
  exact skill (joining) that learners struggle with most and that isolated-glyph
  practice doesn't build.

- [ ] **#10 — Calligraphy script styles** 🟡
  Practice the same letter in different scripts (Naskh vs. others). Amiri and
  Scheherazade New are already loaded. Differentiates from generic tracing apps;
  gives advanced learners a reason to stay.

- [ ] **#11 — Themed vocabulary word packs** 🟢
  Expand beyond the current ~18 words into themed sets (greetings, days, food,
  Quranic terms). Cheap content authoring; pairs with #6.

- [ ] **#12 — Audio pronunciation** 🟡
  Web Speech API (`ar` voice) for letter names / words, or recorded native
  audio. Adds a second modality and strengthens the listening↔writing link.

---

## UI/UX Improvements
*Make the learning environment more intuitive and accessible.*

- [x] **#13 — Progress export / import (JSON backup)** 🟢
  One-button export/import of all localStorage progress. Everything is
  client-only with no backend, so a cleared browser = total data loss. Cheap
  insurance and far less work than cloud sync. *(High-trust, low-effort.)*

- [ ] **#14 — Onboarding / first-run tour** 🟡
  A 3–4 step coachmark tour (ghost watermark, Show Me, AI Feedback, Review tab).
  Surfaces features new users currently never discover.

- [ ] **#15 — Stroke animation for all forms** 🟡
  "Show Me" only works for the isolated form despite stroke data existing.
  Extend to initial/medial/final so the feature feels complete.

- [ ] **#16 — Audio/visual feedback on score** 🟢
  Subtle success animation + optional sound on a 4–5★ score. Makes the AI
  feedback moment more rewarding; pairs with the gamification bucket.

- [ ] **#17 — Reduced-motion + font-size/contrast options** 🟢
  `prefers-reduced-motion` guard for the Show Me animation, plus a text-size /
  high-contrast toggle. Rounds out the already-strong a11y foundation.

---

## Recommended sequencing

Fast, high-impact first wave (each closes an obvious gap):
1. #1 Review Session flow — turns existing SR data into a daily ritual
2. #7 Arabic numerals — easiest high-value content add ✅
3. #13 Progress export/import — protects against data loss ✅
4. #2 Daily goal indicator — the retention hook everything else hangs off

Then: gamification layer (#3 XP, #4 badges, #5 freeze) and word progress (#6).

---

## Session log

- **2026-05-28** — Roadmap created. Implemented #7 (Arabic numerals) and #13
  (progress export/import). #2 (daily goal indicator) is next up but not yet
  started.
