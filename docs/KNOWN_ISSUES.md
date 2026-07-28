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

### KI-001 — Delete-deck confirm dialog is redundant with the undo toast

- **Status:** Open
- **Severity:** Low
- **Area:** `src/components/DeckManager.jsx` (deck list, Delete button)
- **Found:** 2026-07-07 (Playwright verification of the deck-polish plan)

The deck-polish spec (`docs/superpowers/specs/2026-07-04-deck-polish-design.md`)
describes replacing the old `window.confirm("Delete this deck?...")` dialog
with an immediate delete + 6s undo toast, so the toast _is_ the safety net.
The implementation plan's literal code for the Delete button kept the old
`window.confirm(...)` wrapper unchanged, so today a delete requires _both_ a
confirm dialog **and** offers an undo toast afterward — belt-and-suspenders,
not broken, but redundant and inconsistent with the written design intent.

Suggested fix: remove the `window.confirm(t("deckDeleteConfirm"))` guard in
`DeckManager.jsx`'s Delete button `onClick` so delete is truly immediate,
matching the spec. Leaves `deckDeleteConfirm` locale key unused — remove it
from `en`/`ar` too if nothing else references it.

### KI-002 — `border`/`borderColor` shorthand React warning on picker tiles

- **Status:** Open
- **Severity:** Low
- **Area:** `src/components/DeckManager.jsx` (letters/numbers/diacritics/words
  picker tiles), `src/styles/practiceStyles.js` (`reviewTile`,
  `deckPickerWordRow`)
- **Found:** 2026-07-07 (Playwright console during deck-polish verification;
  pre-existing, not a regression from deck-polish)

Selected picker tiles spread `{ ...styles.reviewTile, ...(selected ? {
borderColor: ... } : {}) }`. `reviewTile` sets the shorthand `border: '1.5px
solid var(--color-border)'`, and overriding just `borderColor` on top of a
shorthand triggers React's dev warning: _"Removing a style property during
rerender... don't mix shorthand and non-shorthand properties."_ Cosmetic
(dev-console only, no visual bug), but worth cleaning up.

Suggested fix: in the relevant style objects, split `border` into
`borderWidth`/`borderStyle`/`borderColor` so the selected-state override only
ever touches `borderColor`, never shorthand vs. non-shorthand in the same
property.

### KI-003 — `deleteBtnRef` in `UndoToast` integration is never attached to a real element

- **Status:** Open
- **Severity:** Low (a11y polish)
- **Area:** `src/components/PracticeView.jsx` (`deleteBtnRef`, `<UndoToast
dismissRef={deleteBtnRef} />`)
- **Found:** 2026-07-07 (spec-compliance review of Task 6, deck-polish plan)

`deleteBtnRef` is declared (`useRef(null)`) and passed to `UndoToast` as
`dismissRef`, intended so focus returns to "the deck row's Delete button" on
dismiss/undo per the design spec. It's never actually attached via `ref={...}`
to any button — the row that was deleted is unmounted, so there's no single
stable element to return focus to anyway. Currently `dismissRef?.current?.focus?.()`
is just a no-op; keyboard users don't get focus returned anywhere specific
after the toast closes (it's not lost either — browser default focus
handling applies).

Suggested fix: either remove the unused `deleteBtnRef` plumbing, or repoint
it at a stable anchor (e.g. the "+ New Deck" button, or the deck-list pane
heading) so dismiss/undo has a well-defined focus target.

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
