# Arabic Handwriting Practice — Feature Roadmap

> Last updated: 2026-04-22
>
> A free, open-source PWA for Arabic handwriting practice.  
> All features listed here are free for all users.

---

## Table of Contents

1. [Guiding Principles](#guiding-principles)
2. [Phase 1 — Foundation (Completed)](#phase-1--foundation-completed)
3. [Phase 2 — Content & Customization](#phase-2--content--customization)
4. [Phase 3 — Advanced Tools](#phase-3--advanced-tools)
5. [Phase 4 — Community & Education](#phase-4--community--education)
6. [Phase 5 — Printables & Portability (Last)](#phase-5--printables--portability-last)
7. [Technical Notes](#technical-notes)
8. [Success Metrics](#success-metrics)

---

## Guiding Principles

- **Everything is free.** No paywalls, no subscriptions, no ads.
- **AI feedback is core.** The OpenRouter vision analysis remains unlimited for all users.
- **Privacy first.** All data stays in localStorage unless the user explicitly enables cloud sync.
- **Offline-first.** Every feature must work without an internet connection after initial load.
- **No accounts required.** Users can practice immediately; optional features may ask for minimal auth.

---

## Phase 1 — Foundation (Completed)

**Goal:** Make the app delightful, insightful, and personalized.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1.1 | **Paper Themes** | Completed | 6 canvas backgrounds: Parchment, Aged, Cream, Cool Gray, Notebook (ruled), Graph Paper. |
| 1.2 | **Brush Packs** | Completed | 5 stroke colors: Classic, Crimson, Indigo, Forest, Copper. Light/dark adaptive. |
| 1.3 | **Analytics Dashboard** | Completed | Stats tab with streaks, score distribution, practice heatmap, weakness analysis, 30-day timeline. |

### Phase 1 Deliverables
- [x] `src/styles/themes.js` — theme registry (paper + brush definitions)
- [x] `src/utils/analytics.js` — streaks, score distribution, heatmap, weaknesses
- [x] `src/components/AnalyticsPanel.jsx` — stats tab UI
- [x] `src/components/TipJarBanner.jsx` — support prompt
- [x] `src/components/AffiliateLinks.jsx` — curated resources in Settings

---

## Phase 2 — Content & Customization

**Goal:** Expand what users can practice and how they can express themselves.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 2.1 | **Extended Content Packs** | Planned | Quranic phrases, Surah names, common Arabic names, Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩), advanced ligatures. Bundled into the app; no unlocking required. |
| 2.2 | **Script Styles** | Planned | Naskh, Thuluth, Diwani, Ruqaa — swap ghost-letter font and stroke-order animation data. Each style requires new `strokeOrder.js` entries and curated font files. |
| 2.3 | **Custom Word List Builder** | Planned | Users input their own words/phrases; app generates ghost letter + watermark. Free-form practice beyond bundled content. |

### Phase 2 Deliverables
- [ ] `src/data/extendedWords.js` — additional word groups
- [ ] `src/data/scriptStyles.js` — font mappings + stroke-order overrides per style
- [ ] `src/components/WordBuilder.jsx` — custom word input + preview

---

## Phase 3 — Advanced Tools

**Goal:** Give power users deeper control and richer output.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 3.1 | **Advanced Script Styles** | Planned | Kufic, Maghribi, Nastaʿlīq — more complex stroke data, potentially new animation system. |
| 3.2 | **Progress Export (CSV / JSON)** | Planned | Let users own their data. Export full progress, history, and settings for backup or analysis. |
| 3.3 | **Import / Restore** | Planned | Import a previously exported JSON to restore progress on a new device. |
| 3.4 | **Daily Challenges** | Planned | A random letter or word highlighted each day with a suggested practice goal (e.g., "Practice Jim 3 times"). |

### Phase 3 Deliverables
- [ ] `src/components/ImportExportPanel.jsx` — import/export UI
- [ ] `src/utils/exportProgress.js` — CSV/JSON export of `arabic_progress`
- [ ] `src/utils/challenge.js` — daily challenge picker and completion tracking
- [ ] `src/components/ChallengeBanner.jsx` — daily prompt display

---

## Phase 4 — Community & Education

**Goal:** Support teachers, classrooms, and collaborative learning.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 4.1 | **Classroom Mode** | Planned | Teacher creates a session code; students join. Teacher can see aggregate progress (anonymous) and assign specific letters/words. No student accounts required — just a session PIN. |
| 4.2 | **Shareable Progress Cards** | Planned | Generate a stylized image/card of your streak or completed letters for social sharing. |
| 4.3 | **LMS Integration** | Planned | LTI 1.3 plugin for Moodle, Canvas, Blackboard. Grade passback for practice completion. Target: small classrooms and tutoring centers. |
| 4.4 | **Open Source Release** | Planned | Clean up repo, add contribution guidelines, publish on GitHub for community contributions (new content packs, translations, script styles). |

### Phase 4 Deliverables
- [ ] `src/components/ClassroomPanel.jsx` — teacher/student session UI
- [ ] `src/utils/classroom.js` — session code generation, progress aggregation
- [ ] `src/utils/shareCard.js` — stylized progress card renderer
- [ ] `src/utils/lti.js` — LTI auth + grade passback
- [ ] `CONTRIBUTING.md`, `LICENSE`, clean repo for public release

---

## Phase 5 — Printables & Portability (Last)

**Goal:** Offline exports and optional cross-device sync. These sit last because they require the most backend complexity and are convenience features, not core to daily practice.

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 5.1 | **Printable Practice Sheets** | Planned | PDF generation: grid-lined pages with faint ghost letters, dotted tracing guides, custom word lists. Generated client-side with `jsPDF`. |
| 5.2 | **Bulk PDF Worksheet Generator** | Planned | Select any 5+ letters/words, generate a multi-page PDF practice book. |
| 5.3 | **Progress Backup & Restore** | Planned | Automatic daily backup to a downloadable file. Manual restore from any device via file upload. |
| 5.4 | **Cross-Device QR Sync** | Planned | Encode compressed progress data into a QR code; scan on another device to transfer. No server required. |
| 5.5 | **Cloud Sync (Optional)** | Planned | Sync `arabic_progress`, `arabic_feedback_history`, brush/settings across devices. **Opt-in only.** Backend: lightweight self-hosted option (e.g., Vercel KV, Supabase free tier) or manual file-based sync. |

### Why Last?
PDF generation and cloud sync add significant complexity (client-side libraries or backend infrastructure). They are valuable but not essential to the core learning loop. By placing them last, the app solidifies its content, tools, and community features first.

### Phase 5 Deliverables
- [ ] `src/utils/pdfExport.js` — worksheet PDF generation
- [ ] `src/utils/bulkPdf.js` — multi-page PDF assembly
- [ ] `scripts/build-pdf-templates.js` — pre-render PDF assets at build time
- [ ] `src/utils/qrSync.js` — QR encode/decode for progress data
- [ ] `src/components/SyncPanel.jsx` — sync status, manual push/pull, QR display
- [ ] `src/utils/offlineQueue.js` — queue mutations when offline, flush on reconnect
- [ ] Optional backend: minimal auth (magic-link email, no passwords) + progress CRUD

---

## Technical Notes

### localStorage Keys

| Key | Type | Purpose |
|-----|------|---------|
| `app_theme` | string | Selected paper theme ID |
| `brush_pack` | string | Selected brush pack ID |
| `arabic_practice_dates` | JSON | Daily practice session counts for streak tracking |
| `cloud_sync_token` | string | JWT from sync backend (only if user opts in) |
| `analytics_opt_in` | string | `"true"` / `"false"` — stats tracking consent |

> **Migration rule:** If renaming any existing key (`arabic_progress`, etc.), provide a forward migration in `progress.js` / `history.js` pattern.

### Architecture Decisions

- **All content ships in the main bundle.** No dynamic paywall gates. Extended content may use lazy `import()` only for size reasons, not access control.
- **Script styles may use dynamic `import()`** if font files are large (>100 KB each). Cache aggressively in the service worker.
- **PDF generation happens client-side** for single worksheets; serverless for bulk generation to avoid main-thread jank.
- **Cloud sync backend is optional at build time.** The app must work 100% offline if `VITE_SYNC_API_URL` is unset.
- **Classroom mode uses short-lived session codes**, not persistent accounts. Student privacy is preserved by default.

### PWA / Offline Considerations

- All content packs must be precached by the service worker for offline use.
- Cloud sync should queue writes when offline and flush on `window.online`.
- QR sync works entirely offline (encode → display → scan → decode).

---

## Success Metrics

| Phase | Metric | Target |
|-------|--------|--------|
| 1 | DAU/MAU ratio | > 30% (habit formation) |
| 1 | Settings adoption (themes + brushes) | > 20% of active users |
| 2 | Content pack usage | > 40% of users try extended words |
| 3 | Import/export usage | > 5% of users export data |
| 4 | Classroom sessions | 10+ teachers in first 3 months |
| 4 | GitHub contributors | 3+ external contributors |
| 5 | PDF sheets generated | > 100/month |
| 5 | Sync opt-in rate | > 10% of users with > 7 days progress |

---

## Next Steps

1. **Phase 2.1:** Prepare extended content packs (Quranic phrases, names, numerals).
2. **Phase 2.2:** Commission or curate Naskh/Thuluth stroke data; integrate font files.
3. **Phase 2.3:** Build custom word list builder UI.
4. **Phase 3.2 + 3.3:** Implement CSV/JSON export and import restore.
5. **Phase 3.4:** Build daily challenge system.
6. After Phase 3, evaluate whether classroom demand justifies Phase 4 work.
7. After Phase 4, evaluate whether PDF/cloud demand justifies Phase 5 backend work.

