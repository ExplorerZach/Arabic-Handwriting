# Decks & Review Curation — Design Spec

**Date:** 2026-06-28
**Status:** Approved (pending spec review)
**Approach:** B — Clean separation

## Goal

Let users create named study decks (collections of letters, numbers, words, and
diacritics) and run full-pass review sessions over them. The existing automatic
SM-2 review is preserved unchanged and lives side-by-side inside the same
Review tab. Deck practice writes to the unified `arabic_progress` so the
alphabet-row dots, heatmap, Stats, and Auto Review queue all reflect deck
activity. Words — currently practice-only with no progress tracking — become
first-class progress entries.

## Non-goals (out of scope)

- Cloud sync (already pending on roadmap).
- Custom user-defined items (only the existing static letters / numbers /
  diacritics / words are addable).
- Deck import/export (the existing Settings backup/restore already covers the
  whole localStorage including the new `arabic_decks` key).
- Deck sharing.
- Resume prompt for deck sessions (sessions are short, full-pass, and trivial
  to re-run).
- Mastery flags, "tricky" pinning, or any per-item scheduling automation. Per
  the user's decisions, deck sessions are always a full pass over the deck.

## User decisions captured

| Decision | Choice |
|---|---|
| Manual curation vs. auto SM-2 | Named decks, all user-created, **no automation** inside decks |
| Session semantics | Full pass over the deck, every time |
| Item granularity | Per-letter (all 4 positional forms cycle within a letter item); numbers / diacritics / words are single-form items |
| Existing SM-2 / Auto Review | Keep both side-by-side; do not remove SM-2 |
| Decks UI placement | Sub-section inside the existing Review tab |
| Items across decks | An item may appear in multiple decks (many-to-many) |
| Mastery flag | None — drop mastery-skip; every session is a full pass |
| Letter forms in session | Cycle all forms per letter, in order |
| Deck progress linkage | Unified — deck practice writes to `arabic_progress` |
| Implementation approach | B — Clean separation (dedicated deck-session state; words join `arabic_progress` as first-class; extract `DeckManager`) |

## Architecture

### New files

- **`src/utils/decks.js`** — CRUD utility for decks. Mirrors the
  `progress.js` / `history.js` patterns: in-memory `cache`, `save()`
  invalidates, `window.addEventListener('storage')` clears cache on cross-tab
  edits. Exports:
  - `getDecks()` — returns the `decks` array.
  - `createDeck(name)` — returns the new deck object; id is
    `deck_<Date.now()>` (a counter disambiguates same-ms creates).
  - `renameDeck(id, name)`
  - `deleteDeck(id)`
  - `getDeck(id)`
  - `addDeckItem(deckId, item)` — `item = { id, type, ref }`; `id` is
    `item_<Date.now()>`.
  - `removeDeckItem(deckId, itemId)`
  - `reorderDeckItem(deckId, fromIdx, toIdx)`
- **`src/components/DeckManager.jsx`** — extracted React component that owns
  the three-pane Decks UI (list / editor / picker). Props:
  - `locale`, `darkMode`
  - `decks` (from the memo in PracticeView), `decksVersion`
  - `onStartSession(deck)` — called when the user clicks "Start Session".
  - CRUD handlers thin-wrap the `decks.js` exports.

### Storage — new localStorage key `arabic_decks`

```js
{
  decks: [
    {
      id: "deck_1700000000000",
      name: "My tricky letters",
      createdAt: "2026-06-28T00:00:00.000Z",
      items: [
        { id: "item_1", type: "letter",    ref: "Ba" },            // ref = letter.name
        { id: "item_2", type: "number",    ref: "Num3" },          // ref = number.name
        { id: "item_3", type: "diacritic", ref: "DiacriticFatha" },// ref = diacritic.name
        { id: "item_4", type: "word",      ref: "سلام" }            // ref = word string
      ]
    }
  ]
}
```

- `ref` is the stable lookup key into the existing static data arrays
  (`letter.name` / `number.name` / `diacritic.name` / the word string).
- For words, `ref` is the Arabic word string; duplicates across
  `WORD_GROUPS` (e.g. "الله" appears in Common Words and Quranic Terms)
  collapse to a single progress entry — practicing the word anywhere counts
  everywhere.
- Items may appear in multiple decks (many-to-many). Each deck's `items[]`
  entry is independent.

### Words joining `arabic_progress`

Words currently have no progress tracking. They become first-class entries:

```js
// arabic_progress
{
  "سلام": {                       // key = the word string (Arabic)
    "word": {                     // formKey is the literal "word"
      practiced: true,
      practiceCount: 3,
      lastPracticed: "2026-06-28",
      score: 4,
      // SM-2 fields present in schema but only touched by Auto Review,
      // never by deck sessions
      interval: 1, easeFactor: 2.5, lastReview: null
    }
  }
}
```

- Word strings are Arabic; letter / number / diacritic names are romanized
  ("Ba", "Num3", "DiacriticFatha"). No key collision is possible.
- `formKey` for words is the literal string `"word"` — a new pseudo-form.
- PracticeView builds a word-lookup map from `ALL_WORDS` (already exported
  by `words.js`, currently unused) so a `ref` string resolves to the full
  word object `{ word, roman, meaning, hint, group }`.
- This is an additive schema change — no migration needed. Old
  `arabic_progress` data without word entries is fine; `getProgress()`
  already returns whatever is stored.

### PracticeView additions

- **New state:**
  - `deckSession` — `{ deckId, deckName, queue, index, summary }` or `null`.
  - `reviewSubTab` — `"auto" | "decks"` (default `"auto"`).
  - `decksVersion` — integer bumped on every deck CRUD write so the `decks`
    memo recomputes.
- **New refs:**
  - `deckSessionRef` — mirror of `deckSession` for stable callbacks (same
    pattern as `reviewSessionRef`).
- **New memos:**
  - `decks` — `useMemo(() => getDecks(), [decksVersion])`.
- **`deckSession` is a separate state machine from `reviewSession`** — no
  SM-2 fields, full-pass semantics, no `failedSinceLastPass`, no
  `sessionStorage` stashing.

## UI — DeckManager (three panes, single `deckView` state)

The Review tab gains a top sub-nav: two pill buttons, `Auto Review` and
`My Decks`. `Auto Review` renders the current dashboard (dueItems grid +
Start button) **unchanged**. `My Decks` renders `<DeckManager>`. The
existing due-badge on the Review tab stays, reflecting `dueItems.length`
from Auto Review only.

### Pane 1 — Deck list (`deckView = "list"`, default)

- Header: `My Decks` + `＋ New Deck` button.
- Empty state: friendly message + `Create your first deck` button.
- Each deck row: name, item count, `▶ Start Session`, `✎ Edit`, `🗑 Delete`
  (with confirm).
- `Start Session` calls `onStartSession(deck)` → PracticeView sets
  `deckSession` and the session takes over the canvas area.

### Pane 2 — Deck editor (`deckView = "edit"`)

- Editable deck name field (controlled — `value=`, never `defaultValue=`,
  per AGENTS.md conventions).
- `＋ Add Items` button → opens the item picker (pane 3).
- List of current items, each showing the glyph + label + `✕ Remove`.
- Reorder: ↑/↓ buttons (drag is fiddly on touch; buttons are reliable and
  keyboard-accessible).
- `Done` → back to deck list.

### Pane 3 — Item picker (`deckView = "picker"`)

- Sub-tabs: `Letters | Numbers | Diacritics | Words`.
- **Letters:** 28 buttons (alphabet row). Respects lesson-order when
  lesson mode is on. Each toggles inclusion (highlight = added). Reuses
  the `handleAlphaKeyDown` pattern for keyboard nav.
- **Numbers:** 10-button row.
- **Diacritics:** 8-button row.
- **Words:** list grouped by `WORD_GROUPS` with checkboxes.
- Already-included items pre-highlighted.
- `Done` → back to editor. Add/remove is immediate via
  `addDeckItem` / `removeDeckItem` (singular, matching the `decks.js`
  exports).

### Styling & a11y

- `DeckManager` inherits `locale` + `darkMode` props.
- Uses CSS vars from `global.css` and `practiceStyles.js` spreads; composed
  with spread (`{...styles.btn, ...styles.btnClear}`) like the rest of the
  app.
- Arabic glyphs render `lang="ar" dir="rtl"` with the Amiri / Scheherazade
  New font stack.
- All buttons get a `className` (interactive states) AND inline `style`
  (layout/colors), kept in sync per AGENTS.md.
- New UI strings flow through `t()`; nothing hardcoded.

## Deck session flow

### Starting a session

`onStartSession(deck)` in PracticeView:

```js
if (!deck.items.length) { /* show "deck empty" inline; don't enter */ return; }
const first = resolveDeckItem(deck.items[0]);
setDeckSession({
  deckId: deck.id, deckName: deck.name,
  queue: deck.items.slice(),      // preserve deck order — no shuffle
  index: 0, summary: [],
});
setPracticeMode(first.practiceMode);
enterDeckItem(0);
```

The session takes over the main canvas area (alphabet / word rows hide; a
session-progress bar shows), parallel to how `reviewSession` behaves today.

### Item resolution

Each `queue[index]` resolves to `{ glyph, name, roman, formKeys, practiceMode }`:

| `type` | lookup | `formKeys` | `practiceMode` |
|---|---|---|---|
| `letter` | `LETTERS.find(l => l.name === ref)` | `Object.keys(letter.forms)` | `"letters"` |
| `number` | `NUMBERS.find(n => n.name === ref)` | `["isolated"]` | `"numbers"` |
| `diacritic` | `DIACRITICS.find(d => d.name === ref)` | `["isolated"]` | `"diacritics"` |
| `word` | word-lookup map by `ref` | `["word"]` | `"words"` |

Null lookups (shouldn't happen with static data) are skipped with a console
warning.

### Form cycling (letters)

A letter item shows the existing form switcher (isolated / initial / medial /
final). "Next Form" advances within the letter; on the last form, "Next"
advances to the next queue item. Session-progress indicator reads
`Item 3/12 · Ba · medial (form 2/4)`.

### AI feedback path

`requestFeedback` already dispatches by `practiceMode` (words / numbers /
diacritics / letters). The progress-write guard (currently
`practiceMode === "letters" || isNumbersMode || isDiacriticsMode || reviewSessionRef.current`)
gains `|| deckSessionRef.current` so deck practice writes to
`arabic_progress`. For word items, `markPracticed(wordString, "word")`,
`setScore(wordString, "word", score)`, and
`addFeedbackEntry(wordString, "word", cleanText)` fire — words are
first-class.

**No SM-2 writes from deck sessions.** `updateSR` is NOT called. SM-2
fields (`interval`, `easeFactor`, `lastReview`, `failedSinceLastPass`) are
only touched by Auto Review.

### Advancing

- After AI feedback with a score, `setTimeout(1400)` auto-advances (same
  pattern as Auto Review).
- "Next" button also advances (skipped item — no score).
- Form cycling is accounted for in the "next" logic: advance form first,
  then item.
- When `index + 1 >= queue.length` (after the last form of the last item),
  the session finishes → summary screen (per-item ★/— chips + `Done` →
  `exitDeckSession()`).

### Exit

`exitDeckSession()` clears `deckSession` and returns to the Decks
sub-tab. No resume prompt — sessions are short and trivial to re-run.

## Edge cases & data integrity

- **Empty deck session:** guard in `onStartSession` — show inline "deck is
  empty" message, don't enter.
- **Deleted-while-active deck (cross-tab):** session continues with the
  already-snapshot `queue`; on exit the Decks list reflects the deletion.
  No crash.
- **Item ref pointing at removed data:** all current data arrays are
  static code, not user-editable — refs can't dangle. Lookup uses `?? null`
  and skips nulls with a console warning (forward-compatible for future
  custom items).
- **Words progress migration:** additive — first word practice creates a
  new top-level key. No migration needed.
- **Word dedup across `WORD_GROUPS`:** the word-lookup map keyed by word
  string collapses duplicates to one progress entry. Practicing "الله" in
  any deck / group updates the same entry.
- **Progress-version bumping:** every deck-session AI write calls
  `setProgressVersion((v) => v + 1)` so alphabet-row dots, heatmap, and
  Auto Review queue update live. Deck CRUD bumps `decksVersion` (a
  separate counter) so `DeckManager` re-renders without disturbing
  progress memos.
- **Storage listeners:** `decks.js` mirrors `progress.js` / `history.js`
  — in-memory `cache`, `save()` invalidates, `storage` event clears
  cache. No cross-tab session sync (same as Auto Review).
- **Concurrency with Auto Review session:**
  - If a user starts a deck session while an Auto Review session is
    stashed, the stash is preserved (deck sessions don't touch
    `sessionStorage["arabic_review_session"]`).
  - `startReviewSession` / `enterReviewItem` no-op if `deckSession` is
    active (toast: "Finish or exit the current deck session first").
  - Vice versa for starting a deck session mid-Auto-Review.

### Pre-existing bug fix (in scope)

`enterReviewItem` and `goToReviewItem` (PracticeView ~lines 1091, 1159)
currently special-case `letterName.startsWith("Num")` to route into
`NUMBERS` but don't handle `Diacritic*` names — clicking a due diacritic
tile silently no-ops. Add a `Diacritic`-prefix branch mirroring the `Num`
branch. Small, in-scope fix that unblocks diacritics in both Auto Review
and deck sessions. (`goToAnalyticsItem` already handles all three — it's
the reference implementation.)

## File-by-file change list

### New (2)

- `src/utils/decks.js`
- `src/components/DeckManager.jsx`

### Modified (5)

- **`src/components/PracticeView.jsx`** — new state / refs / memos
  (`deckSession`, `reviewSubTab`, `decksVersion`, `deckSessionRef`,
  `decks` memo); Review tab sub-nav + `<DeckManager>` render; new handlers
  (`startDeckSession`, `enterDeckItem`, `advanceDeck`, `exitDeckSession`);
  `requestFeedback` progress-write guard gains `|| deckSessionRef.current`
  + words branch writes progress when in a deck session; session-progress
  bar + summary screen for `deckSession`; guard
  `startReviewSession` / `enterReviewItem` to no-op when `deckSession`
  active; fix diacritics routing in `enterReviewItem` / `goToReviewItem`.
- **`src/locales/index.js`** — ~20 new UI keys added to **both** `en` and
  `ar`: `tabDecks`, `subAutoReview`, `subMyDecks`, `deckListTitle`,
  `deckNew`, `deckEmpty`, `deckStart`, `deckEdit`, `deckDelete`,
  `deckDeleteConfirm`, `deckName`, `deckAddItems`, `deckItemRemove`,
  `deckDone`, `deckPickerLetters`, `deckPickerNumbers`,
  `deckPickerDiacritics`, `deckPickerWords`, `deckSessionProgress`,
  `deckSessionComplete`, `deckSessionEmpty`, `deckConflictAuto`,
  `deckConflictDeck`.
- **`src/data/words.js`** — no change to `WORD_GROUPS`. `ALL_WORDS` is
  already exported (currently unused); PracticeView now imports it for the
  word-lookup map and `DeckManager` imports it for the picker.
- **`AGENTS.md`** — add `arabic_decks` to the localStorage keys list; note
  the `DeckManager` component + `decks.js` util; note words are now
  first-class progress entries with `formKey: "word"`.

### Out of scope

Cloud sync, custom user items, deck import/export, deck sharing, deck
session resume prompt, mastery flags.

## Verification

- `npm run build` must exit zero.
- Manual Playwright browser testing (per AGENTS.md MCP guidance) for:
  - Deck CRUD (create / rename / delete / edit).
  - Item picker across all 4 types (letters / numbers / diacritics /
    words).
  - Session start / advance / finish.
  - Form cycling for letters (4 forms cycled before advancing).
  - Words writing to `arabic_progress` and surfacing in Auto Review +
    heatmap.
  - Cross-tab `storage` invalidation.
  - RTL + dark mode rendering.
  - Conflict guards (deck-while-auto and auto-while-deck).
  - Diacritics routing fix (due diacritic tile in Auto Review now
    navigates correctly).
