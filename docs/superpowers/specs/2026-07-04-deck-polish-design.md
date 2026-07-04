# Deck Polish — Design Spec

**Date:** 2026-07-04
**Status:** Approved (pending spec review)
**Approach:** B — Subagent-friendly by file ownership
**Builds on:** `docs/superpowers/specs/2026-06-28-decks-and-review-curation-design.md`
(assumes Tasks 1-9 of the deck curation plan are complete and merged via PR #3)

## Goal

Polish the existing deck feature across five areas: session completeness,
deck-building efficiency, per-deck progress insight, a11y & keyboard support,
and visual refinement. The feature ships as a single cohesive spec executed via
a subagent-friendly plan grouped by file ownership (Approach B).

## Non-goals (out of scope)

- Cloud sync (still pending on roadmap).
- Custom user-defined items (only the existing static letters / numbers /
  diacritics / words are addable).
- Deck import/export (Settings backup/restore already covers `arabic_decks`).
- Deck sharing.
- Resume prompt for deck sessions (sessions are short, full-pass, and trivial
  to re-run; the new restart-from-summary covers the "run again" case).
- Per-item scheduling automation / mastery flags (deck sessions stay
  manual; low-score re-run is a user-initiated filtered full-pass, not SM-2).
- Rolling session history per deck (only the last completed session is stored).

## User decisions captured

| Decision | Choice |
|---|---|
| Polish focus areas | All five: session completeness, deck-building efficiency, progress insight, a11y & keyboard, visual refinement |
| Session modes | Full-pass (default) + low-score re-run (items that scored ≤3 or were skipped in the last completed session) |
| Low-score threshold | `score == null || score <= 3` (out of 5) |
| Per-deck stats depth | Last completed session only (one session deep, no history) |
| Stats storage location | On the deck object (`arabic_decks`), not derived from `arabic_progress` (progress is keyed by item ref, not by deck) |
| Mid-session exit | Confirm dialog before exiting (session has unfinished progress) |
| Restart location | On the summary screen (not mid-session) |
| Implementation approach | B — Subagent-friendly by file ownership (groups 1-4 parallel, 5 after 1-3, 6 after 4+5, 7 last) |
| Undo delete | Immediate delete + transient accessible toast with 6s undo window; one undo slot |
| Deck-building wins | Bulk-add presets, duplicate deck, undo delete, reorder decks in list, search/filter words |

## Architecture

### Schema change to `arabic_decks`

Each deck gains two optional fields (additive — old data migrates):

```js
{
  id: "deck_…",
  name: "My tricky letters",
  createdAt: "…",
  order: 0,                       // NEW — stable integer for list reordering
  items: [ … ],                   // unchanged
  lastSession: {                  // NEW — null until first finished session
    date: "2026-07-04",           // local date string (todayLocal), NOT UTC
    mode: "full",                 // "full" | "lowScore"
    avgScore: 3.4,                // mean of non-skipped scores; null if all skipped
    items: [                      // one entry per reviewed form/item
      { ref: "Ba", type: "letter", formKey: "isolated", score: 4 },
      { ref: "Ba", type: "letter", formKey: "initial", score: 2 },  // low-score
      { ref: "سلام", type: "word", formKey: "word", score: null }   // skipped
    ]
  }
}
```

- `lastSession.items` is the raw material for the low-score re-run filter:
  entries with `score == null || score <= 3` get re-queued. This is why "last
  session only" is the right depth — it doubles as the filter source.
- Dates are **local** (`todayLocal` from `progress.js`), consistent with
  AGENTS.md's "never UTC for scheduling."
- `order` is a stable integer; `reorderDecks` swaps values. On migrate, decks
  default `order = currentArrayIndex` so existing data stays in place.

### New `decks.js` exports (additive — no existing signatures change)

- `duplicateDeck(id)` — creates a new deck with the same items (deep-copied,
  new item ids) and name `"<original> copy"`. `lastSession` is NOT copied (the
  duplicate starts fresh). Returns the new deck.
- `reorderDecks(fromIdx, toIdx)` — reorders `data.decks` via index swap using
  the `order` field. Stable across reloads.
- `setLastSession(deckId, session)` — writes `lastSession` onto a deck. Called
  only on session finish (the single write site).
- `bulkAddItems(deckId, items)` — adds an array of `{type, ref}` at once.
  Skips duplicates (same `type+ref` already in deck). Returns count added.
- `restoreDeck(deck)` — inserts a complete deck object (with its original `id`)
  back into `data.decks` at the right `order` position, shifting subsequent
  `order` values to avoid collisions. Used only by undo-delete.
- `getDecks()` signature unchanged but now returns decks **sorted by `order`
  then `createdAt`**.

### Migration

`load()` gains a one-time `migrate()`: any deck missing `order` gets
`order = currentArrayIndex`; any deck missing `lastSession` gets
`lastSession: null`. Idempotent — safe to run on every load. Mirrors the
`progress.js` / `history.js` migrate pattern.

### Backup

`arabic_decks` is already in `BACKUP_KEYS` — no change. The schema additions
are additive, so old backups restore cleanly (missing fields default on
migrate).

### Session modes & state machine

The existing `deckSession` gains a `mode` field:

```js
setDeckSession({
  deckId, deckName,
  queue,            // derived from mode (see below)
  index: 0,
  summary: [],
  finished: false,
  mode: "full",     // NEW — "full" | "lowScore"
});
```

- **`"full"`** (default): `queue = deck.items.slice()` (unchanged behavior).
- **`"lowScore"`**: `queue` is built from `deck.lastSession.items` filtered to
  `score == null || score <= 3`, then each filtered entry maps back to its
  deck item via `{type, ref}`. If `lastSession` is null/empty or nothing
  qualifies, the Start button is disabled with an inline note.

#### Letter form handling in `"lowScore"` mode

`lastSession.items` records one entry per form. A low-score re-run practices
only the *forms* that scored low — not all four forms of the letter. Each
low-score `lastSession` entry expands into its own queue item carrying an
optional `formKey` constraint:

```js
queue = lowScoreEntries.map(e => ({
  type: e.type,
  ref: e.ref,
  formKey: e.formKey,   // optional — constrains forms to just this one
}))
```

`resolveDeckItem` + `enterDeckItem` + `advanceDeck` honor `formKey` when
present (single-form queue entry → `formKeys = [formKey]`, advance immediately
after that form). When `formKey` is absent (full mode), letters cycle all
forms as today. This keeps it **one state machine** — `advanceDeck` already
does form-cycling via `formKeys.indexOf(activeForm)`; we just constrain
`formKeys` for low-score entries.

#### No SM-2 change

Both modes still skip `updateSR` — low-score re-run is not SM-2 review, it's a
manual full-pass over a filtered subset. AGENTS.md's "deck sessions do NOT
call `updateSR`" stays true.

### Session UI

#### Session header (mid-session)

Today the progress bar shows `Item 3/12 · Ba · form 2/4` + an `Exit` button.
Add a deck-name + mode-chip row so the user always knows which deck and which
mode:

- **Line 1:** deck name (left, `fontWeight: 600`) + mode chip (small pill:
  "Full" / "Low-score") + `Exit` (right, with confirm dialog).
- **Line 2:** the existing `Item N/M · name · form k/n` text (unchanged).
- **Line 3:** the existing progress bar (unchanged).

#### Summary screen (finished)

Restructure the summary to a clearer hierarchy with restart actions:

- **Title:** `Deck complete` (existing).
- **Subtitle:** deck name + item count + average score (mean of non-skipped;
  `—` if all skipped).
  - **Score chips:** keep the existing color tiers (green ≥4, orange <4, gray
  skipped). Tighten spacing, add a subtle border per color tier, and show the
  **form name** under letters that have multiple forms (e.g. `ب isolated ★4`)
  so low-score re-run context is visible. Form names reuse the existing
  `FORM_SHORT` locale keys via `t(FORM_SHORT[formKey])` — no new locale key
  needed for form names. Skipped chips get `aria-label` ("skipped") and a
  `title=` tooltip.
- **Three buttons** (was one):
  - `Run again` — full pass, rebuilds queue from `deck.items`.
  - `Re-run low scores (N)` — low-score mode, N = count of qualifying entries
    from the just-finished `summary`. Hidden if N === 0.
  - `Done` — exits to deck list (no confirm; session is finished).

#### Restart implementation

Both restart buttons call a single `restartDeckSession(mode)` helper in
PracticeView:

```js
const restartDeckSession = useCallback((mode) => {
  const sess = deckSessionRef.current;
  if (!sess) return;
  if (mode === "full") {
    const deck = getDeck(sess.deckId);
    if (!deck || !deck.items.length) return;
    setDeckSession({ ...sess, queue: deck.items.slice(), index: 0, summary: [], finished: false, mode: "full" });
    enterDeckItem(0, deck.items[0]);
  } else { // "lowScore"
    const queue = buildLowScoreQueue(sess.deckId);
    if (!queue.length) return;
    setDeckSession({ ...sess, queue, index: 0, summary: [], finished: false, mode: "lowScore" });
    enterDeckItem(0, queue[0]);
  }
}, [enterDeckItem]);
```

`buildLowScoreQueue(deckId)` reads `getDeck(deckId).lastSession.items`, filters
`score == null || score <= 3`, and maps to `{type, ref, formKey}` queue entries.

#### When `lastSession` is written

On `finished: true` (in `advanceDeck`'s terminal branch), PracticeView calls
`setLastSession(sess.deckId, { date: todayLocal(), mode: sess.mode, avgScore,
items: sess.summary.map(...) })` **before** the summary screen renders. This
is the single write site — restart doesn't write, mid-session exit doesn't
write, only a completed run persists.

### DeckManager UI improvements

#### Deck list pane (pane 1) — row redesign

- **Row 1:** deck name (`fontWeight: 600`).
- **Row 2 (meta line):** `N items` (always) + ` · last <date>` (if
  `lastSession`) + ` · avg ★<x>` (if `lastSession` and avgScore !== null).
  Muted color (`var(--color-text-muted)`).
- **Action cluster (right, wraps on narrow widths):**
  - `↻ Low` — low-score start (only renders when `lastSession` has qualifying
    entries; `aria-label` = "Re-run low-score items").
  - `▶ Start` — full pass (existing).
  - `⎘ Copy` — `duplicateDeck` (new).
  - `✎ Edit` — existing.
  - `↑` / `↓` — deck reorder (disabled at top/bottom).
  - `🗑 Delete` — existing, but now triggers the Undo toast instead of a bare
    `confirm`. Delete is immediate, toast offers 6s undo.
- **A11y:** the row is a `<div>` (not a button — multiple actions). Each
  button has `aria-label`. Deck name is the primary text.

**Empty state** gets a one-line hint (`deckEmptyHint`): "Add letters, words,
numbers, or diacritics, then start a session." (en/ar).

#### Deck editor pane (pane 2)

- **Bulk-add bar** above the items list (only when picker is closed). A row of
  small buttons:
  - `+ All letters` — `bulkAddItems` with all `LETTERS` refs.
  - `+ Numbers 1–10` — `bulkAddItems` with all `NUMBERS` refs.
  - `+ Common words` — `bulkAddItems` with the common-words subset (see Open
    questions).
  - `+ All diacritics` — `bulkAddItems` with all `DIACRITICS` refs.
  - Duplicates skipped silently. Buttons disable + reduce opacity when
    everything they'd add is already in the deck.
- **Item count** at the top of the list: `N items` (small, muted).

#### Item picker pane (pane 3)

- **Words search/filter:** a controlled text `<input>` (placeholder
  `deckSearchWords`) appears above the word groups **only on the Words
  sub-tab**. Filters by `word.roman`, `word.meaning`, or `word.word`
  (case-insensitive). Empty groups collapse out of view.
- **Selected-state clarity:** checkmark badge in the corner of selected tiles
  (letters/numbers/diacritics) so the state is readable without relying on
  color alone. Words already show ✓/+.
- **Keyboard nav (a11y):** picker grids get roving tabindex. Tab enters the
  grid once, arrow keys move between tiles, Enter/Space toggles. Mirrors the
  existing alphabet-row keyboard nav (`handleAlphaKeyDown`) in PracticeView.
  Numbers/diacritics grids get the same treatment. Words are a vertical list —
  standard Tab order is fine.
- **Focus management on pane change:** when `deckView` switches, focus moves
  to the pane's heading or primary action via a `useEffect` on `deckView` + a
  ref to the target element.

#### Stats display — where it lives

Per-deck stats (last date, avg score) render on the **deck row** (pane 1 meta
line) and the **summary screen**. There's no separate "deck stats" view — the
insight is inline where the user already looks. This avoids a new pane and
keeps `DeckManager` at three panes.

### Undo delete (interactive toast)

#### Why a new component

`XpGainToast` is `aria-hidden` and non-interactive — it can't host a button.
An undo toast needs a clickable "Undo" within the transient notification,
which requires a proper, focusable, screen-reader-announced component.

#### New: `src/components/UndoToast.jsx`

Small presentational component, reusable (props, no deck-specific logic):

```jsx
/**
 * Transient undo toast. Rendered by a parent that owns the timeout
 * and the undo action.
 *
 * Props:
 *   message     — string (already translated)
 *   actionLabel — string (e.g. t("undo"))
 *   onUndo      — () => void  (parent clears the toast + restores state)
 *   onDismiss   — () => void (parent clears the toast; called on timer or X)
 *   duration    — number ms, default 6000
 */
```

- **Markup:** fixed-position bar (bottom-center, `maxWidth: 520`, card
  styling: `var(--color-card-bg)`, border, `borderRadius: 12`, subtle shadow).
  Contains `message` (left), `Undo` button (right, `className="btn-nav"`), and
  a small `✕` to dismiss early.
- **A11y:** `role="status"`, `aria-live="polite"`. The `Undo` button has
  `aria-label={actionLabel}`. On mount, focus moves to the Undo button; on
  dismiss/undo, focus returns to the deck row's Delete button (managed by the
  parent via a ref).
- **Timer:** `useEffect` in the component starts a `setTimeout(onDismiss,
  duration)`. Cleared on unmount. No pause-on-hover (keeps it simple; 6s is
  enough and hover is unreliable on touch).
- **Styling:** lives in `practiceStyles.js` as `undoToast`, `undoToastMessage`,
  `undoToastAction`, `undoToastDismiss` entries.

#### PracticeView integration

`DeckManager` doesn't own deletion undo — it calls `onDeleteDeck`. The undo
logic lives in **PracticeView**:

1. `handleDeleteDeck(id)` snapshots the deck object (deep copy), calls
   `deleteDeck(id)`, then `setUndoDelete({ deletedDeck, timestamp: Date.now() })`.
2. `handleUndoDelete()` calls `restoreDeck(snapshot)`, `setUndoDelete(null)`,
   `refreshDecks()`.
3. Toast auto-dismiss (6s or `✕`): `setUndoDelete(null)` — deck stays deleted.
4. Only **one** undo slot — deleting a second deck while a toast is up
   replaces the toast (the first delete becomes permanent).
5. `startDeckSession` / `exitDeckSession` clear `undoDelete` (session intent
   implies the delete stands).

## File-by-file change list

### New (1)

- **`src/components/UndoToast.jsx`** — accessible interactive undo toast.
  Presentational, reusable. ~40-60 lines.

### Modified (5)

- **`src/utils/decks.js`** — `load()` gains `migrate()`; `getDecks()` sorts by
  `order`; new exports `duplicateDeck`, `reorderDecks`, `setLastSession`,
  `bulkAddItems`, `restoreDeck`. No existing signatures change.

- **`src/locales/index.js`** — ~18-22 new keys in **both** `en` and `ar`:
  - Session: `deckModeFull`, `deckModeLowScore`, `deckSessionAvg`,
    `deckRunAgain`, `deckRerunLow`, `deckRerunLowCount` (with `{n}`),
    `deckExitConfirm`, `deckSkipped`.
  - Deck list: `deckLastPractice`, `deckLowScoreStart`, `deckCopy`,
    `deckCopySuffix`, `deckEmptyHint`.
  - Bulk add: `deckBulkAllLetters`, `deckBulkNumbers`, `deckBulkCommonWords`,
    `deckBulkAllDiacritics`.
  - Search: `deckSearchWords`.
  - Undo: `undo`, `undoDeleteMessage` (with `{name}`).
  - All through `t()`, none hardcoded.

- **`src/styles/practiceStyles.js`** — new style entries:
  - `deckSessionHeader`, `deckSessionModeChip`, `deckModeChipFull`,
    `deckModeChipLowScore`.
  - `deckSummarySubtitle`, `deckSummaryButtons`, `deckSummaryChipForm`,
    `deckSummaryChipSkipped`.
  - `deckRowMeta`, `deckRowActions`, `deckRowActionSmall`, `deckBulkBar`,
    `deckBulkBtn`.
  - `deckSearchInput`.
  - `deckPickerCheckmark`.
  - `undoToast`, `undoToastMessage`, `undoToastAction`, `undoToastDismiss`.
  - All use CSS vars, no hex, dark-mode-safe.

- **`src/components/DeckManager.jsx`** — significant additions:
  - **Pane 1:** row redesign (meta line with stats, action cluster with
    Low/Start/Copy/Edit/↑/↓/Delete, empty-state hint).
  - **Pane 2:** bulk-add bar above items list, item count.
  - **Pane 3:** words search input + filter logic, checkmark badges on
    selected tiles, roving-tabindex keyboard nav on letters/numbers/diacritics
    grids, focus management `useEffect` on `deckView` change.
  - **New props:** `onCopyDeck(id)`, `onReorderDecks(fromIdx, toIdx)`.
  - **`onStartSession`** signature changes to `(deck, mode)` where `mode` is
    `"full"` (default) or `"lowScore"`.

- **`src/components/PracticeView.jsx`** — the integration hub:
  - **New state:** `undoDelete`.
  - **New handlers:** `handleDeleteDeck`, `handleUndoDelete`, `handleCopyDeck`,
    `handleReorderDecks`, `restartDeckSession(mode)`, `buildLowScoreQueue`.
  - **`startDeckSession`** gains `mode` param; builds queue per mode.
  - **`resolveDeckItem` + `enterDeckItem` + `advanceDeck`** honor optional
    `formKey` on queue entries.
  - **`advanceDeck` terminal branch** writes `setLastSession` before
    `finished: true`.
  - **Session header block:** adds deck-name + mode-chip row; Exit confirms.
  - **Summary block:** adds subtitle, form-name chips, three buttons.
  - **`<UndoToast>`** render site: one line near the bottom of the return,
    outside sub-tab conditional. Wired to `undoDelete` state + handlers.
  - **`startDeckSession`/`exitDeckSession`** clear `undoDelete`.
  - **`<DeckManager>`** render passes new props; `onStartSession={(deck, mode)
    => startDeckSession(deck, mode)}`.
  - **Imports:** `UndoToast`, new `decks.js` exports, `todayLocal` from
    `progress.js`.

### Also updated (1)

- **`AGENTS.md`** — document new `decks.js` exports, `UndoToast`, two session
  modes, `lastSession` schema, `order` field. Final task (group 7) so docs
  reflect the final state.

### Files NOT touched

- `src/data/words.js`, `letters.js`, `numbers.js`, `diacritics.js` — static.
- `src/utils/progress.js`, `history.js` — deck sessions still don't touch SM-2;
  `todayLocal` imported but no new writes.
- `src/utils/backup.js` — `arabic_decks` already in `BACKUP_KEYS`.
- `public/sw.js`, `sw.js` — only updated by the build script.

### Parallelization (Approach B)

| Group | Files | Depends on |
|---|---|---|
| 1 | `decks.js` | nothing |
| 2 | `locales/index.js` | nothing |
| 3 | `practiceStyles.js` | nothing |
| 4 | `UndoToast.jsx` | nothing — can start immediately with inline styles; switch to `practiceStyles.js` entries once Group 3 lands |
| 5 | `DeckManager.jsx` | 1 (new utils + schema), 2 (locale keys), 3 (styles) |
| 6 | `PracticeView.jsx` | 1, 2, 3, 4, 5 (integrates everything) |
| 7 | `AGENTS.md` | all (docs reflect final state) |

Groups 1, 2, 3, 4 run in parallel. 5 after 1+2+3. 6 after 4+5. 7 last.

## Edge cases & data integrity

1. **Low-score re-run with no `lastSession`:** `↻ Low` button doesn't render.
   `buildLowScoreQueue` returns `[]` → guard in `startDeckSession` no-ops.
2. **Low-score re-run where everything was skipped:** All entries qualify
   (skipped = re-run). Correct — skipped items should be re-practiced.
   `avgScore` shows `—`, re-run still works.
3. **Low-score re-run where everything scored ≥4:** Zero qualifying entries.
   `↻ Low` hidden on row; `Re-run low scores (0)` hidden on summary.
4. **Deck edited after a `lastSession`:** `buildLowScoreQueue` filters out
   entries whose `{type, ref}` no longer matches a current deck item. No stale
   refs in the queue.
5. **Deck duplicated:** `lastSession` is NOT copied — the new deck starts
   fresh. A duplicate is a new deck; its stats are its own.
6. **Deck reordered while being edited:** Editor stays on deck A (matched by
   `id`, not index). List order updates on return via `storage` event.
7. **Undo delete of a deck with a `lastSession`:** Full snapshot (including
   `lastSession`) is restored. Stats reappear on the row.
8. **Undo delete after `bulkAddItems`:** Not possible — delete + undo is
   atomic from the user's view; no edits happen between delete and undo.
9. **Two session modes, one conflict guard:** The existing conflict guard
   checks `deckSessionRef.current`, not `deckSession.mode`. Covers both modes.
   No new guard needed.
10. **Restart from summary preserves `deckId`:** `restartDeckSession` re-reads
    the deck from storage via `getDeck`. If deleted in another tab mid-session,
    `getDeck` returns null → restart no-ops, user exits. Graceful.
11. **`order` field collisions after restore:** `restoreDeck` inserts at the
    snapshot's `order` value, shifting subsequent `order` values to make room.
    No duplicate `order` values.
12. **`setLastSession` write timing:** Only on `finished: true` in
    `advanceDeck`. Mid-session exit (even with confirm) writes nothing — the
    session didn't complete, stats shouldn't update. Matches "last session
    only" = last *completed* session.

## Verification

- **`npm run build`** must exit zero (the automated gate per AGENTS.md — no
  test suite).
- **Manual Playwright browser testing** (per AGENTS.md MCP guidance):

| Area | Checks |
|---|---|
| Data layer | `migrate()` adds `order`+`lastSession:null`; `getDecks()` sorts by `order`; `duplicateDeck`/`reorderDecks`/`setLastSession`/`bulkAddItems`/`restoreDeck` work; cross-tab `storage` invalidates cache. |
| Session modes | Full pass (unchanged); low-score start disabled when no `lastSession`; low-score re-run queues only ≤3/skipped forms; letter form constraint; restart both modes from summary. |
| Session UI | Header shows deck name + mode chip; Exit confirms mid-session; summary shows avg + form-name chips + 3 buttons; `lastSession` written on finish only. |
| Deck-building | Bulk-add buttons populate correct items; "all added" disabled state; words search filters by roman/meaning/word; empty groups collapse; duplicate deck creates " copy"; deck reorder updates list + persists. |
| Undo delete | Delete → toast appears → Undo restores (stats + items); toast auto-dismisses at 6s; ✕ dismisses; second delete replaces toast; starting a session clears toast. |
| A11y | Roving tabindex on letter grid (arrow keys, Enter/Space toggle); focus moves to pane heading on view change; Undo button receives focus on toast appear; score chips have `aria-label`s; `role="status"`+`aria-live` on toast. |
| Visual | Score chips color tiers + borders; checkmark badges on selected picker tiles; deck row meta line; dark mode rendering; RTL flip (Arabic locale) for all new UI. |
| Regression | Existing Auto Review unchanged; existing deck CRUD unchanged; existing full-pass sessions unchanged; `arabic_progress` writes still happen; conflict guards still fire. |

- **Verification command:** `npm run build` after each task group; full
  Playwright pass after group 6 (integration); final `npm run build` +
  Playwright smoke after group 7.

## Open questions (resolved at plan time, none blocking)

1. **"Common words" definition:** Check `words.js` for an existing "common"
   group flag. If none, use the first `WORD_GROUPS` entry as the canonical
   common set and name the button after that group's name.
2. **`deckCopySuffix` localization:** `" copy"` is English. Arabic convention
   for duplicates may differ — use a locale key with the Arabic translation
   reviewed at plan time.
3. **Date format for "last practiced":** Short local date format. `Intl.DateTime
   Format(locale, {dateStyle:"short"})` is cleanest, but the codebase doesn't
   currently use `Intl` — check availability/bundling at plan time. Fallback:
   manual `M/D` format with locale-aware separators.
4. **Roving tabindex implementation detail:** Per-tile `tabIndex` roving
   (matches the existing alphabet-row pattern in PracticeView) vs
   `aria-activedescendant` + single tab stop. Go with per-tile roving unless
   the plan reveals a conflict.
