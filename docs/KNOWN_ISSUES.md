# Known Issues & Findings

A running log of minor bugs, inconsistencies, and polish opportunities found
during development or manual testing that aren't worth blocking a merge for.
Not a replacement for GitHub Issues — use this for small things discovered
mid-task that you want to remember without context-switching.

## How to use this file

- Add a new entry under **Open** using the template below. Copy the block,
  fill it in, increment the ID.
- When fixed, either delete the entry or cut/paste it under **Resolved**
  with a `Fixed:` line (commit SHA or PR).
- Keep entries short — a paragraph or two, plus a code pointer. If it grows
  into something that needs a design decision, promote it to a
  `docs/superpowers/specs/` doc or a GitHub issue instead.
- IDs are never reused, even if an entry is deleted outright instead of
  moved to Resolved.

### Entry template

```
### KI-XXX — Short title

- **Status:** Open
- **Severity:** Low | Medium | High
- **Area:** file/component or feature area
- **Found:** YYYY-MM-DD (context: what you were doing when you found it)

Description of the issue, why it happens, and any suggested fix.
```

---

## Open

---

## Resolved

<!-- Move entries here when fixed. Example:

### KI-000 — Example resolved entry

- **Status:** Resolved
- **Fixed:** 2026-07-07, commit 14fd437
- **Severity:** High
- **Area:** src/components/PracticeView.jsx
- **Found:** 2026-07-07

Description of what was wrong and how it was fixed.

-->

### KI-001 — Delete-deck confirm dialog is redundant with the undo toast

- **Status:** Resolved
- **Fixed:** 2026-07-29, commit 361dd7c
- **Severity:** Low
- **Area:** `src/components/DeckManager.jsx` (deck list, Delete button)
- **Found:** 2026-07-07 (Playwright verification of the deck-polish plan)

Removed the `window.confirm(t("deckDeleteConfirm"))` guard so delete is
immediate, matching the design spec. Also removed the now-unused
`deckDeleteConfirm` key from both `en` and `ar` locale entries.

### KI-002 — `border`/`borderColor` shorthand React warning on picker tiles

- **Status:** Resolved
- **Fixed:** 2026-07-29, commit 361dd7c
- **Severity:** Low
- **Area:** `src/components/DeckManager.jsx` (letters/numbers/diacritics/words
  picker tiles), `src/styles/practiceStyles.js` (`reviewTile`,
  `deckPickerWordRow`)
- **Found:** 2026-07-07 (Playwright console during deck-polish verification;
  pre-existing, not a regression from deck-polish)

Split the `border` shorthand in both `reviewTile` and `deckPickerWordRow` into
`borderWidth`/`borderStyle`/`borderColor` so the selected-state override
(`borderColor` only) no longer mixes shorthand and non-shorthand properties.

### KI-003 — `deleteBtnRef` in `UndoToast` integration is never attached to a real element

- **Status:** Resolved
- **Fixed:** 2026-07-29, commit 361dd7c
- **Severity:** Low (a11y polish)
- **Area:** `src/components/PracticeView.jsx` (`deleteBtnRef`, `<UndoToast
dismissRef={deleteBtnRef} />`)
- **Found:** 2026-07-07 (spec-compliance review of Task 6, deck-polish plan)

`deleteBtnRef` is now passed to `DeckManager` as `restoreFocusRef` and
attached to the "+ New Deck" button — a stable anchor that stays in the DOM.
The existing `dismissRef?.current?.focus?.()` calls in `UndoToast` now
correctly return focus there on dismiss/undo.
