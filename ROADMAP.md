# Arabic Script Practice — Roadmap

## Phase 1: Cleanup & Quick Wins ✅
> Completed — commit `6d6feff`

- [x] Load Arabic web fonts (Amiri + Scheherazade New) via Google Fonts in `index.html`
- [x] Wire up `src/utils/api.js` in PracticeView — remove duplicated inline API fetch logic
- [x] Add Undo button — pops last stroke from `strokesRef` and redraws
- [x] Delete root-level duplicate files (`sw.js`, `manifest.json`, `vercel.json`, icons, stale `assets/`)
- [x] Add offline indicator — amber banner + disabled AI button when `navigator.onLine` is false
- [x] Bump `public/sw.js` to `arabic-v5` with new asset hash

---

## Phase 2: Core Improvements ✅
> Completed — commit `608212b`

- [x] Add `src/styles/global.css` — hover/active/focus states on all buttons, custom scrollbar, focus rings
- [x] Compress canvas before AI send — downscale to 512px max, export as JPEG 0.85 (reduces payload ~60-80%)
- [x] Better error messages — parse OpenRouter 401 (bad key), 402 (no credits), 429 (rate limit), 503 (model down) into plain English
- [x] Progress tracking (`src/utils/progress.js`) — persist practiced letter+form combos; orange dot = started, green dot = all forms complete; "X/28 complete" in header
- [x] Feedback history (`src/utils/history.js`) — store last 5 AI responses per letter+form; expandable "Past feedback" section below feedback box
- [x] Bump `public/sw.js` to `arabic-v6` with new JS + CSS asset hashes

---

## Phase 3: Learning Experience ✅
> Completed

### Approach notes
- **Guided lesson mode** — new `src/data/lessonOrder.js` grouping letters by shape family (ب/ت/ث, ج/ح/خ, etc.). A "Lesson Mode" toggle in the header follows this sequence instead of alphabetical order.
- **Side-by-side comparison** — after drawing, render a split view: reference letter (large, opaque) on the left, user's attempt on the right, at the same scale.
- **Scoring system** — extend the AI prompt to return a 1–5 score in a parseable tag (e.g. `[SCORE:4]`). Display as stars. Feed score into progress tracking in `progress.js`.
- **Stroke order animation** — define stroke order data per letter (start/end points, direction). "Show me how" button animates drawing with `requestAnimationFrame`.
- **Word/ligature practice** — new `src/data/words.js` with common letter combinations and words (بسم, الله, etc.). A "Words" tab alongside individual letter practice.

- [x] Guided lesson mode — `src/data/lessonOrder.js` + toggle in header
- [x] Side-by-side comparison view after drawing
- [x] AI scoring (1–5 stars) parsed from response, stored in progress
- [x] Stroke order animation — "Show me how" button per letter
- [x] Word/ligature practice tab

---

## Phase 4: Polish & Accessibility
> Completed (`777fc1f` extended with Phase 4 work)

### Approach notes
- **Accessibility** — add ARIA labels to all buttons, `role` attributes, arrow-key navigation for the alphabet row, skip-to-content link.
- **Responsive layout** — CSS media queries in `global.css` for phone (<400px), tablet landscape, and desktop (>900px). Adjust canvas size and flex layout.
- **Dark mode** — CSS custom properties for the full color palette in `global.css`. Toggle stored in localStorage. Keep the warm aesthetic but inverted.
- **Localization** — extract all UI strings to `src/locales/`. Add a language toggle (EN/AR). Full RTL layout when Arabic is selected.

- [x] Accessibility pass — ARIA, keyboard nav, focus rings on all interactives
- [x] Responsive layout — breakpoints for phone, tablet landscape, desktop
- [x] Dark mode — CSS custom properties + toggle in settings
- [x] Localization — Arabic UI option with full RTL layout

---

## Phase 5: Advanced Features
> Not started

### Approach notes
- **Spaced repetition** — implement a simplified SM-2 algorithm using score history from Phase 3. Surface letters "due for review" on a home screen dashboard.
- **Export/share** — "Save" button exports the canvas as a downloadable PNG. Use the Web Share API on mobile for native sharing.
- **Automate SW cache busting** — a Vite plugin or post-build Node script that reads `dist/assets/` filenames and patches `public/sw.js` automatically, removing the manual step.
- **Cloud sync** — optional; requires a backend (e.g. Supabase or Firebase). Syncs progress + feedback history across devices. Major scope increase.

- [ ] Spaced repetition — SM-2 algorithm using score history, "due for review" dashboard
- [ ] Export/share — download canvas as PNG, Web Share API on mobile
- [ ] Automate SW cache busting — post-build script patches `public/sw.js` automatically
- [ ] Cloud sync (optional) — Supabase/Firebase backend for cross-device progress
