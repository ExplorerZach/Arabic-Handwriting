# Deck Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the deck feature across five areas — session completeness (two modes + restart + confirm-exit), deck-building efficiency (bulk-add, search, duplicate, undo-delete, reorder), per-deck progress insight (last-session stats), a11y & keyboard (roving tabindex, focus management, screen-reader labels), and visual refinement (score chips, checkmark badges, session header).

**Architecture:** Additive schema change to `arabic_decks` (new `order` + `lastSession` fields with migration). New `UndoToast.jsx` component. `decks.js` gains 5 new exports. `DeckManager.jsx` gains bulk-add bar, words search, duplicate/reorder/low-score buttons, checkmark badges, roving tabindex, focus management. `PracticeView.jsx` gains two session modes, `formKey`-constrained queue entries, restart, confirm-exit, session header, richer summary, undo-delete state, `setLastSession` write on finish. Subagent-friendly grouping by file ownership (groups 1-4 parallel, 5 after 1-3, 6 after 4+5, 7 last).

**Tech Stack:** React 19, Vite 8, plain JSX (no TypeScript), inline JS style objects, CSS vars from `global.css`, localStorage for persistence. No test suite — verification is `npm run build` (must exit zero) + manual Playwright browser testing per AGENTS.md.

**Spec:** `docs/superpowers/specs/2026-07-04-deck-polish-design.md`

**Resolved open questions (from spec):**

1. "Common words" = `WORD_GROUPS[1]` (name: `"Common Words"`, the existing group at index 1).
2. `deckCopySuffix` = locale key: en `" copy"`, ar `" نسخة"`.
3. Date format: `new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" })` — already used at PracticeView.jsx:2938, respects browser locale.
4. Roving tabindex: per-tile `tabIndex` roving (matches existing `handleAlphaKeyDown` pattern at PracticeView.jsx:2994).

---

## File Structure

### New files (1)

- `src/components/UndoToast.jsx` — accessible interactive undo toast (presentational, reusable).

### Modified files (6)

- `src/utils/decks.js` — migration + 5 new exports (`duplicateDeck`, `reorderDecks`, `setLastSession`, `bulkAddItems`, `restoreDeck`); `getDecks()` sorts by `order`.
- `src/utils/progress.js` — export `todayLocal` (one keyword change, line 62).
- `src/locales/index.js` — ~20 new keys in both `en` and `ar`.
- `src/styles/practiceStyles.js` — ~20 new style entries.
- `src/components/DeckManager.jsx` — bulk-add bar, words search, duplicate/reorder/low-score buttons, checkmark badges, roving tabindex, focus management, new props.
- `src/components/PracticeView.jsx` — two session modes, `formKey` constraint, restart, confirm-exit, session header, richer summary, undo-delete state, `setLastSession` write, new handlers, new imports, `<UndoToast>` render.
- `AGENTS.md` — document new exports, UndoToast, two session modes, `lastSession` schema, `order` field.

---

## Task 1: `decks.js` — migration + 5 new exports + `progress.js` export

**Files:**

- Modify: `src/utils/decks.js`
- Modify: `src/utils/progress.js:62`

- [ ] **Step 1: Export `todayLocal` from `progress.js`**

In `src/utils/progress.js`, line 62, change:

```js
function todayLocal() {
```

to:

```js
export function todayLocal() {
```

This is a single keyword addition — no behavior change. PracticeView will import it for `setLastSession` date strings.

- [ ] **Step 2: Add migration + `order` sorting to `decks.js`**

In `src/utils/decks.js`, replace the `load()` function (lines 37-46) with:

```js
function migrate(data) {
  if (!data.decks || !Array.isArray(data.decks)) data = { decks: [] };
  data.decks.forEach((d, i) => {
    if (d.order === undefined) d.order = i;
    if (!d.lastSession) d.lastSession = null;
  });
  return data;
}

function load() {
  if (cache !== null) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"decks":[]}');
    cache = migrate(cache);
  } catch {
    cache = migrate({ decks: [] });
  }
  return cache;
}
```

Then update `getDecks()` (line 68) to sort by `order`:

```js
export function getDecks() {
  return load()
    .decks.slice()
    .sort((a, b) => a.order - b.order);
}
```

- [ ] **Step 3: Add `duplicateDeck` export**

Append to `src/utils/decks.js` (after `reorderDeckItem`, before EOF):

```js
/** Create a copy of a deck with new ids and a fresh lastSession. */
export function duplicateDeck(id) {
  const data = load();
  const original = data.decks.find(d => d.id === id);
  if (!original) return null;
  const copy = {
    id: uniqueId('deck'),
    name: original.name + ' copy',
    createdAt: new Date().toISOString(),
    order: data.decks.length,
    items: original.items.map(it => ({
      id: uniqueId('item'),
      type: it.type,
      ref: it.ref,
    })),
    lastSession: null,
  };
  data.decks.push(copy);
  save(data);
  return copy;
}
```

- [ ] **Step 4: Add `reorderDecks` export**

```js
/** Reorder the deck list by swapping `order` values at two indices. */
export function reorderDecks(fromIdx, toIdx) {
  const data = load();
  const decks = data.decks.slice().sort((a, b) => a.order - b.order);
  if (fromIdx < 0 || fromIdx >= decks.length) return;
  if (toIdx < 0 || toIdx >= decks.length) return;
  // Swap order values
  const tmp = decks[fromIdx].order;
  decks[fromIdx].order = decks[toIdx].order;
  decks[toIdx].order = tmp;
  save(data);
}
```

- [ ] **Step 5: Add `setLastSession` export**

```js
/** Write the last completed session result onto a deck. */
export function setLastSession(deckId, session) {
  const data = load();
  const deck = data.decks.find(d => d.id === deckId);
  if (!deck) return;
  deck.lastSession = session;
  save(data);
}
```

- [ ] **Step 6: Add `bulkAddItems` export**

```js
/** Add multiple items at once, skipping duplicates. Returns count added. */
export function bulkAddItems(deckId, items) {
  const data = load();
  const deck = data.decks.find(d => d.id === deckId);
  if (!deck) return 0;
  let added = 0;
  for (const item of items) {
    if (!item || !item.type || !item.ref) continue;
    const exists = deck.items.some(it => it.type === item.type && it.ref === item.ref);
    if (exists) continue;
    deck.items.push({ id: uniqueId('item'), type: item.type, ref: item.ref });
    added++;
  }
  if (added > 0) save(data);
  return added;
}
```

- [ ] **Step 7: Add `restoreDeck` export**

```js
/** Restore a previously deleted deck (used by undo-delete).
 *  Inserts at the deck's original `order` position, shifting subsequent
 *  `order` values to avoid collisions. */
export function restoreDeck(deck) {
  const data = load();
  // Insert the deck back and re-sort by order
  data.decks.push(deck);
  data.decks.sort((a, b) => a.order - b.order);
  // Re-index order values to remove any collisions
  data.decks.forEach((d, i) => {
    d.order = i;
  });
  save(data);
}
```

- [ ] **Step 8: Run build to verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 9: Commit**

```bash
git add src/utils/decks.js src/utils/progress.js
git commit -m "Add deck migration, duplicate/reorder/lastSession/bulkAdd/restore utils"
```

---

## Task 2: Locale keys (en + ar)

**Files:**

- Modify: `src/locales/index.js`

- [ ] **Step 1: Add English keys**

In `src/locales/index.js`, after line 236 (`deckMoveDown: "Move down",`), insert (before the `// Paper themes` comment):

```js
    // Deck polish — session modes, stats, bulk, search, undo
    deckModeFull: "Full",
    deckModeLowScore: "Low-score",
    deckSessionAvg: "avg",
    deckRunAgain: "Run again",
    deckRerunLow: "Re-run low scores",
    deckRerunLowCount: "Re-run low scores ({n})",
    deckExitConfirm: "Exit this session? Your progress won't be saved.",
    deckSkipped: "skipped",
    deckLastPractice: "last",
    deckLowScoreStart: "Low",
    deckCopy: "Copy",
    deckCopySuffix: " copy",
    deckEmptyHint: "Add letters, words, numbers, or diacritics, then start a session.",
    deckBulkAllLetters: "+ All letters",
    deckBulkNumbers: "+ Numbers 1–10",
    deckBulkCommonWords: "+ Common words",
    deckBulkAllDiacritics: "+ All diacritics",
    deckSearchWords: "Search words…",
    undo: "Undo",
    undoDeleteMessage: "Deck \"{name}\" deleted.",
```

- [ ] **Step 2: Add Arabic keys**

In the `ar:` block, after line 556 (`deckMoveDown: "تحريك لأسفل",`), insert (before the `// Paper themes` comment):

```js
    // Deck polish — session modes, stats, bulk, search, undo
    deckModeFull: "كامل",
    deckModeLowScore: "الدرجات المنخفضة",
    deckSessionAvg: "المتوسط",
    deckRunAgain: "إعادة التشغيل",
    deckRerunLow: "إعادة الدرجات المنخفضة",
    deckRerunLowCount: "إعادة الدرجات المنخفضة ({n})",
    deckExitConfirm: "إنهاء الجلسة؟ لن يتم حفظ تقدمك.",
    deckSkipped: "تم تخطيه",
    deckLastPractice: "آخر",
    deckLowScoreStart: "منخفض",
    deckCopy: "نسخ",
    deckCopySuffix: " نسخة",
    deckEmptyHint: "أضف حروفًا أو كلمات أو أرقامًا أو تشكيلًا، ثم ابدأ الجلسة.",
    deckBulkAllLetters: "+ كل الحروف",
    deckBulkNumbers: "+ الأرقام ١-١٠",
    deckBulkCommonWords: "+ كلمات شائعة",
    deckBulkAllDiacritics: "+ كل التشكيل",
    deckSearchWords: "ابحث عن كلمة…",
    undo: "تراجع",
    undoDeleteMessage: "تم حذف المجموعة \"{name}\".",
```

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: Build succeeds. Keys are not referenced yet but syntax must be valid.

- [ ] **Step 4: Commit**

```bash
git add src/locales/index.js
git commit -m "Add deck polish locale keys (en + ar)"
```

---

## Task 3: Styles

**Files:**

- Modify: `src/styles/practiceStyles.js` (insert before `export default styles;` at line 1225)

- [ ] **Step 1: Add new style entries**

Insert this block immediately before the `export default styles;` line (after `deckPickerWordMeta` at line 1218-1224):

```js
  /* ─── Deck polish ─────────────────────────────────────── */
  deckSessionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  deckSessionName: {
    fontSize: 14,
    fontWeight: '600',
    color: 'var(--color-text)',
  },
  deckSessionModeChip: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: '.06em',
    textTransform: 'uppercase',
    padding: '2px 8px',
    borderRadius: 99,
    marginLeft: 8,
  },
  deckModeChipFull: {
    background: 'rgba(var(--color-accent-rgb, 192,112,58),0.15)',
    color: 'var(--color-accent)',
  },
  deckModeChipLowScore: {
    background: 'rgba(90,158,78,0.15)',
    color: 'rgb(90,158,78)',
  },
  deckSummarySubtitle: {
    fontSize: 13,
    color: 'var(--color-text-soft)',
    marginBottom: 12,
  },
  deckSummaryButtons: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  deckSummaryChipForm: {
    fontSize: 9,
    opacity: 0.6,
    display: 'block',
    lineHeight: 1.1,
  },
  deckRowMeta: {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    marginTop: 2,
  },
  deckRowActions: {
    display: 'flex',
    gap: 4,
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    maxWidth: '60%',
  },
  deckRowActionSmall: {
    fontSize: 11,
    padding: '3px 7px',
    borderRadius: 6,
  },
  deckBulkBar: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  deckBulkBtn: {
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    cursor: 'pointer',
    transition: 'all .15s',
  },
  deckSearchInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 14,
    boxSizing: 'border-box',
    marginBottom: 12,
  },
  deckPickerCheckmark: {
    position: 'absolute',
    top: 2,
    right: 2,
    fontSize: 12,
    color: 'var(--color-accent)',
    fontWeight: '700',
  },
  deckPickerTileWrap: {
    position: 'relative',
  },
  undoToast: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    maxWidth: 520,
    width: 'calc(100% - 32px)',
    padding: '12px 16px',
    background: 'var(--color-card-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    zIndex: 1000,
  },
  undoToastMessage: {
    flex: 1,
    fontSize: 14,
    color: 'var(--color-text)',
  },
  undoToastAction: {
    fontSize: 13,
    fontWeight: '600',
    padding: '6px 14px',
  },
  undoToastDismiss: {
    fontSize: 14,
    padding: '4px 8px',
    color: 'var(--color-text-muted)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds. Styles are not referenced yet but syntax must be valid.

- [ ] **Step 3: Commit**

```bash
git add src/styles/practiceStyles.js
git commit -m "Add deck polish style entries"
```

---

## Task 4: `UndoToast.jsx` component

**Files:**

- Create: `src/components/UndoToast.jsx`

- [ ] **Step 1: Create `src/components/UndoToast.jsx`**

```jsx
import { useEffect, useRef } from 'react';
import styles from '../styles/practiceStyles';

/**
 * Transient undo toast — accessible, interactive. Rendered by a parent
 * that owns the timeout and the undo action.
 *
 * Props:
 *   message     — string (already translated)
 *   actionLabel — string (e.g. t("undo"))
 *   onUndo      — () => void  (parent clears the toast + restores state)
 *   onDismiss   — () => void (parent clears the toast; called on timer or X)
 *   duration    — number ms, default 6000
 *   dismissRef  — ref to the element to return focus to on dismiss (optional)
 */
export default function UndoToast({
  message,
  actionLabel,
  onUndo,
  onDismiss,
  duration = 6000,
  dismissRef,
}) {
  const undoBtnRef = useRef(null);

  useEffect(() => {
    // Move focus to the Undo button so keyboard users can act immediately.
    undoBtnRef.current?.focus();
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [onDismiss, duration]);

  const handleUndo = () => {
    dismissRef?.current?.focus?.();
    onUndo();
  };

  const handleDismiss = () => {
    dismissRef?.current?.focus?.();
    onDismiss();
  };

  return (
    <div className="undo-toast" role="status" aria-live="polite" style={styles.undoToast}>
      <span style={styles.undoToastMessage}>{message}</span>
      <button
        ref={undoBtnRef}
        className="btn-nav"
        style={{ ...styles.btn, ...styles.undoToastAction }}
        onClick={handleUndo}
        aria-label={actionLabel}
      >
        {actionLabel}
      </button>
      <button
        className="btn-clear"
        style={styles.undoToastDismiss}
        onClick={handleDismiss}
        aria-label="✕"
      >
        ✕
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds. `UndoToast` is not imported yet but syntax must be valid.

- [ ] **Step 3: Commit**

```bash
git add src/components/UndoToast.jsx
git commit -m "Add UndoToast accessible interactive toast component"
```

---

## Task 5: `DeckManager.jsx` — bulk-add, search, duplicate, reorder, stats, low-score, a11y

**Files:**

- Modify: `src/components/DeckManager.jsx`

This task adds: bulk-add bar (pane 2), words search (pane 3), checkmark badges (pane 3), roving tabindex + focus management (pane 3), deck row meta line with stats + action cluster (pane 1), low-score start button, duplicate button, deck reorder buttons, empty-state hint, and two new props (`onCopyDeck`, `onReorderDecks`). `onStartSession` signature changes to `(deck, mode)`.

- [ ] **Step 1: Add imports and new props**

At the top of `src/components/DeckManager.jsx`, add `useRef` to the React import (line 1):

```jsx
import { useState, useEffect, useRef } from 'react';
```

Update the component signature (line 22) to accept `onCopyDeck` and `onReorderDecks`:

```jsx
export default function DeckManager({
  t,
  locale,
  darkMode,
  decks,
  onCreateDeck,
  onRenameDeck,
  onDeleteDeck,
  onAddItem,
  onRemoveItem,
  onReorderItem,
  onReorderDecks,
  onCopyDeck,
  onStartSession,
}) {
```

- [ ] **Step 2: Add helper — count low-score entries from lastSession**

After the `editingDeck` declaration (line 39), add:

```jsx
const countLowScore = deck => {
  if (!deck.lastSession || !deck.lastSession.items) return 0;
  return deck.lastSession.items.filter(e => e.score == null || e.score <= 3).length;
};

const formatDate = dateStr => {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
};
```

- [ ] **Step 3: Add focus management ref + useEffect**

After the `pickerTab` state (line 37), add:

```jsx
const paneHeaderRef = useRef(null);

useEffect(() => {
  // Move focus to the pane heading on view change for a11y.
  paneHeaderRef.current?.focus?.();
}, [deckView]);
```

- [ ] **Step 4: Add roving-tabindex state + keyboard handler for picker grids**

After the `paneHeaderRef` line, add:

```jsx
const [gridFocusIdx, setGridFocusIdx] = useState(0);

const handleGridKeyDown = (e, items, idx) => {
  let next = idx;
  if (e.key === 'ArrowRight') next = (idx + 1) % items.length;
  else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length;
  else if (e.key === 'ArrowDown') next = Math.min(idx + 1, items.length - 1);
  else if (e.key === 'ArrowUp') next = Math.max(idx - 1, 0);
  else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    return; // let the button onClick fire
  } else return;
  e.preventDefault();
  setGridFocusIdx(next);
};
```

- [ ] **Step 5: Rewrite Pane 1 — deck list with meta line + action cluster**

Replace the entire Pane 1 block (from `if (deckView === "list") {` through its closing `}` — lines 106-164) with:

```jsx
// ═══ Pane 1: Deck list ═════════════════════════════════
if (deckView === 'list') {
  return (
    <div style={styles.reviewDash}>
      <div style={{ ...styles.reviewHeader, justifyContent: 'space-between' }}>
        <span ref={paneHeaderRef} tabIndex={-1}>
          {t('deckListTitle')}
        </span>
        <button
          className="btn-ai"
          style={{ ...styles.btn, ...styles.btnAI, fontSize: 12, padding: '4px 10px' }}
          onClick={handleNewDeck}
        >
          ＋ {t('deckNew')}
        </button>
      </div>
      {decks.length === 0 ? (
        <div style={styles.reviewEmpty}>
          <p style={{ marginBottom: 8 }}>{t('deckEmpty')}</p>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            {t('deckEmptyHint')}
          </p>
          <button
            className="btn-ai"
            style={{ ...styles.btn, ...styles.btnAI }}
            onClick={handleNewDeck}
          >
            {t('deckEmptyCta')}
          </button>
        </div>
      ) : (
        decks.map((deck, deckIdx) => {
          const lowCount = countLowScore(deck);
          const lastDate = deck.lastSession ? formatDate(deck.lastSession.date) : null;
          const avgScore =
            deck.lastSession && deck.lastSession.avgScore != null
              ? `★${deck.lastSession.avgScore.toFixed(1)}`
              : null;
          return (
            <div key={deck.id} style={styles.deckRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.deckRowName}>{deck.name}</div>
                <div style={styles.deckRowMeta}>
                  {deck.items.length} {t('deckItemCount')}
                  {lastDate && ` · ${t('deckLastPractice')} ${lastDate}`}
                  {avgScore && ` · ${t('deckSessionAvg')} ${avgScore}`}
                </div>
              </div>
              <div style={styles.deckRowActions}>
                {lowCount > 0 && (
                  <button
                    className="btn-ai"
                    style={{ ...styles.btn, ...styles.btnAI, ...styles.deckRowActionSmall }}
                    onClick={() => onStartSession(deck, 'lowScore')}
                    aria-label={t('deckRerunLow')}
                    title={t('deckRerunLow')}
                  >
                    ↻ {t('deckLowScoreStart')}
                  </button>
                )}
                <button
                  className="btn-ai"
                  style={{ ...styles.btn, ...styles.btnAI, ...styles.deckRowActionSmall }}
                  onClick={() => onStartSession(deck, 'full')}
                  disabled={deck.items.length === 0}
                >
                  ▶ {t('deckStart')}
                </button>
                <button
                  className="btn-panel"
                  style={{ ...styles.btn, ...styles.deckRowActionSmall }}
                  onClick={() => onCopyDeck(deck.id)}
                  aria-label={t('deckCopy')}
                  title={t('deckCopy')}
                >
                  ⎘
                </button>
                <button
                  className="btn-panel"
                  style={{ ...styles.btn, ...styles.deckRowActionSmall }}
                  onClick={() => {
                    setEditingId(deck.id);
                    setDeckView('edit');
                  }}
                >
                  {t('deckEdit')}
                </button>
                <button
                  className="btn-clear"
                  style={{ ...styles.btn, ...styles.deckRowActionSmall }}
                  onClick={() => onReorderDecks(deckIdx, Math.max(0, deckIdx - 1))}
                  disabled={deckIdx === 0}
                  aria-label={t('deckMoveUp')}
                >
                  ↑
                </button>
                <button
                  className="btn-clear"
                  style={{ ...styles.btn, ...styles.deckRowActionSmall }}
                  onClick={() => onReorderDecks(deckIdx, Math.min(decks.length - 1, deckIdx + 1))}
                  disabled={deckIdx === decks.length - 1}
                  aria-label={t('deckMoveDown')}
                >
                  ↓
                </button>
                <button
                  className="btn-clear"
                  style={{ ...styles.btn, ...styles.deckRowActionSmall }}
                  onClick={() => {
                    if (window.confirm(t('deckDeleteConfirm'))) onDeleteDeck(deck.id);
                  }}
                >
                  {t('deckDelete')}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
```

- [ ] **Step 6: Add bulk-add bar to Pane 2**

In the editor pane (the `if (deckView === "edit" && editingDeck)` block), after the deck name `<label>` and before the `＋ {t("deckAddItems")}` button, insert the bulk-add bar. Find this line:

```jsx
<button
  className="btn-ai"
  style={{ ...styles.btn, ...styles.btnAI, marginBottom: 12 }}
  onClick={() => setDeckView('picker')}
>
  ＋ {t('deckAddItems')}
</button>
```

Insert **before** it:

```jsx
<div style={styles.deckBulkBar}>
  <button
    className="btn-panel"
    style={styles.deckBulkBtn}
    onClick={() => {
      const items = LETTERS.map(l => ({ type: 'letter', ref: l.name }));
      onAddItem(editingDeck.id, { type: '_bulk', ref: '_bulk', _bulk: items });
    }}
  >
    {t('deckBulkAllLetters')}
  </button>
  <button
    className="btn-panel"
    style={styles.deckBulkBtn}
    onClick={() => {
      const items = NUMBERS.map(n => ({ type: 'number', ref: n.name }));
      onAddItem(editingDeck.id, { type: '_bulk', ref: '_bulk', _bulk: items });
    }}
  >
    {t('deckBulkNumbers')}
  </button>
  <button
    className="btn-panel"
    style={styles.deckBulkBtn}
    onClick={() => {
      const items = WORD_GROUPS[1].words.map(w => ({ type: 'word', ref: w.word }));
      onAddItem(editingDeck.id, { type: '_bulk', ref: '_bulk', _bulk: items });
    }}
  >
    {t('deckBulkCommonWords')}
  </button>
  <button
    className="btn-panel"
    style={styles.deckBulkBtn}
    onClick={() => {
      const items = DIACRITICS.map(d => ({ type: 'diacritic', ref: d.name }));
      onAddItem(editingDeck.id, { type: '_bulk', ref: '_bulk', _bulk: items });
    }}
  >
    {t('deckBulkAllDiacritics')}
  </button>
</div>
```

**Note:** The bulk-add uses a special `_bulk` item shape with a `_bulk` array. The PracticeView handler `handleAddDeckItem` (Task 6, Step 3) will detect this and call `bulkAddItems` instead of `addDeckItem`.

- [ ] **Step 7: Add words search to Pane 3**

At the top of the picker pane (the `if (deckView === "picker" && editingDeck)` block), after the `subTabs` array, add a search state and filter. First, add `wordSearch` to the component state (near the other `useState` calls at the top):

```jsx
const [wordSearch, setWordSearch] = useState('');
```

Then, in the picker pane, before the `{pickerTab === "words" && (` block, add the search input:

```jsx
{
  pickerTab === 'words' && (
    <input
      type="text"
      value={wordSearch}
      onChange={e => setWordSearch(e.target.value)}
      placeholder={t('deckSearchWords')}
      style={styles.deckSearchInput}
      aria-label={t('deckSearchWords')}
    />
  );
}
```

Then replace the words list block. Find this block (the `{pickerTab === "words" && (` that contains `WORD_GROUPS.map`):

```jsx
        {pickerTab === "words" && (
          <div>
            {WORD_GROUPS.map((g, gIdx) => (
```

Replace the entire words block with (adds search filtering + collapses empty groups):

```jsx
{
  pickerTab === 'words' && (
    <div>
      {WORD_GROUPS.map((g, gIdx) => {
        const filtered = g.words.filter(w => {
          if (!wordSearch.trim()) return true;
          const q = wordSearch.toLowerCase().trim();
          return (
            w.word.includes(q) ||
            (w.roman && w.roman.toLowerCase().includes(q)) ||
            (w.meaning && w.meaning.toLowerCase().includes(q))
          );
        });
        if (filtered.length === 0) return null;
        return (
          <div key={gIdx} style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '.15em',
                marginBottom: 6,
              }}
            >
              {g.name}
            </div>
            {filtered.map((w, wIdx) => {
              const selected = isInDeck('word', w.word);
              return (
                <button
                  key={`${gIdx}-${wIdx}`}
                  className="btn-alpha"
                  style={{
                    ...styles.deckPickerWordRow,
                    width: '100%',
                    ...(selected
                      ? {
                          borderColor: 'var(--color-accent)',
                          background: 'rgba(var(--color-accent-rgb, 192,112,58),0.12)',
                        }
                      : {}),
                  }}
                  onClick={() => toggleItem('word', w.word)}
                  aria-pressed={selected}
                >
                  <span style={styles.deckPickerWordChar} lang="ar">
                    {w.word}
                  </span>
                  <span style={styles.deckPickerWordMeta}>
                    {w.roman} — {w.meaning}
                  </span>
                  <span
                    style={{
                      fontSize: 16,
                      color: selected ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    }}
                  >
                    {selected ? '✓' : '+'}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 8: Add checkmark badges + roving tabindex to letters/numbers/diacritics grids**

For the letters grid, replace the block:

```jsx
{
  pickerTab === 'letters' && (
    <div style={styles.deckPickerGrid}>
      {LETTERS.map(l => {
        const selected = isInDeck('letter', l.name);
        return (
          <button
            key={l.name}
            className="btn-alpha"
            style={{
              ...styles.reviewTile,
              ...(selected
                ? {
                    borderColor: 'var(--color-accent)',
                    background: 'rgba(var(--color-accent-rgb, 192,112,58),0.12)',
                  }
                : {}),
            }}
            onClick={() => toggleItem('letter', l.name)}
            aria-pressed={selected}
          >
            <span style={styles.reviewTileChar} lang="ar">
              {l.letter}
            </span>
            <span style={styles.reviewTileName}>{l.name}</span>
          </button>
        );
      })}
    </div>
  );
}
```

with (adds `deckPickerTileWrap`, checkmark badge, roving tabindex + arrow-key nav):

```jsx
{
  pickerTab === 'letters' && (
    <div style={styles.deckPickerGrid} role="grid" aria-label={t('deckPickerLetters')}>
      {LETTERS.map((l, idx) => {
        const selected = isInDeck('letter', l.name);
        return (
          <div key={l.name} style={styles.deckPickerTileWrap}>
            <button
              className="btn-alpha"
              style={{
                ...styles.reviewTile,
                ...(selected
                  ? {
                      borderColor: 'var(--color-accent)',
                      background: 'rgba(var(--color-accent-rgb, 192,112,58),0.12)',
                    }
                  : {}),
              }}
              onClick={() => toggleItem('letter', l.name)}
              onKeyDown={e => handleGridKeyDown(e, LETTERS, idx)}
              tabIndex={idx === gridFocusIdx ? 0 : -1}
              aria-pressed={selected}
              role="gridcell"
            >
              <span style={styles.reviewTileChar} lang="ar">
                {l.letter}
              </span>
              <span style={styles.reviewTileName}>{l.name}</span>
            </button>
            {selected && <span style={styles.deckPickerCheckmark}>✓</span>}
          </div>
        );
      })}
    </div>
  );
}
```

Apply the same pattern to the **numbers** grid (replace the `pickerTab === "numbers"` block):

```jsx
{
  pickerTab === 'numbers' && (
    <div style={styles.deckPickerGrid} role="grid" aria-label={t('deckPickerNumbers')}>
      {NUMBERS.map((n, idx) => {
        const selected = isInDeck('number', n.name);
        return (
          <div key={n.name} style={styles.deckPickerTileWrap}>
            <button
              className="btn-alpha"
              style={{
                ...styles.reviewTile,
                ...(selected
                  ? {
                      borderColor: 'var(--color-accent)',
                      background: 'rgba(var(--color-accent-rgb, 192,112,58),0.12)',
                    }
                  : {}),
              }}
              onClick={() => toggleItem('number', n.name)}
              onKeyDown={e => handleGridKeyDown(e, NUMBERS, idx)}
              tabIndex={idx === gridFocusIdx ? 0 : -1}
              aria-pressed={selected}
              role="gridcell"
            >
              <span style={styles.reviewTileChar} lang="ar">
                {n.letter}
              </span>
              <span style={styles.reviewTileName}>{n.name}</span>
            </button>
            {selected && <span style={styles.deckPickerCheckmark}>✓</span>}
          </div>
        );
      })}
    </div>
  );
}
```

And the **diacritics** grid:

```jsx
{
  pickerTab === 'diacritics' && (
    <div style={styles.deckPickerGrid} role="grid" aria-label={t('deckPickerDiacritics')}>
      {DIACRITICS.map((d, idx) => {
        const selected = isInDeck('diacritic', d.name);
        return (
          <div key={d.name} style={styles.deckPickerTileWrap}>
            <button
              className="btn-alpha"
              style={{
                ...styles.reviewTile,
                ...(selected
                  ? {
                      borderColor: 'var(--color-accent)',
                      background: 'rgba(var(--color-accent-rgb, 192,112,58),0.12)',
                    }
                  : {}),
              }}
              onClick={() => toggleItem('diacritic', d.name)}
              onKeyDown={e => handleGridKeyDown(e, DIACRITICS, idx)}
              tabIndex={idx === gridFocusIdx ? 0 : -1}
              aria-pressed={selected}
              role="gridcell"
            >
              <span style={styles.reviewTileChar} lang="ar">
                {d.letter}
              </span>
              <span style={styles.reviewTileName}>{d.name}</span>
            </button>
            {selected && <span style={styles.deckPickerCheckmark}>✓</span>}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 9: Add focus heading to editor + picker panes**

In the editor pane (pane 2), add `ref={paneHeaderRef} tabIndex={-1}` to the `← {t("deckBack")}` back button (so focus lands on the primary action on view change). Find:

```jsx
<button
  className="btn-clear"
  style={{ ...styles.btn, fontSize: 12, padding: '4px 10px' }}
  onClick={backToList}
>
  ← {t('deckBack')}
</button>
```

Change to:

```jsx
<button
  ref={paneHeaderRef}
  tabIndex={-1}
  className="btn-clear"
  style={{ ...styles.btn, fontSize: 12, padding: '4px 10px' }}
  onClick={backToList}
>
  ← {t('deckBack')}
</button>
```

In the picker pane (pane 3), do the same for its back button. Find:

```jsx
<button
  className="btn-clear"
  style={{ ...styles.btn, fontSize: 12, padding: '4px 10px' }}
  onClick={() => setDeckView('edit')}
>
  ← {t('deckBack')}
</button>
```

Change to:

```jsx
<button
  ref={paneHeaderRef}
  tabIndex={-1}
  className="btn-clear"
  style={{ ...styles.btn, fontSize: 12, padding: '4px 10px' }}
  onClick={() => setDeckView('edit')}
>
  ← {t('deckBack')}
</button>
```

- [ ] **Step 10: Reset `gridFocusIdx` + `wordSearch` when switching panes/tabs**

Add a `useEffect` to reset `gridFocusIdx` when `pickerTab` changes (after the existing `useEffect` for deleted-deck guard):

```jsx
useEffect(() => {
  setGridFocusIdx(0);
}, [pickerTab]);

useEffect(() => {
  setWordSearch('');
}, [deckView]);
```

- [ ] **Step 11: Run build to verify**

Run: `npm run build`
Expected: Build succeeds. `DeckManager` now references new props and locale keys.

- [ ] **Step 12: Commit**

```bash
git add src/components/DeckManager.jsx
git commit -m "Add bulk-add, word search, stats, duplicate, reorder, a11y to DeckManager"
```

---

## Task 6: `PracticeView.jsx` — session modes, restart, summary, undo, integration

**Files:**

- Modify: `src/components/PracticeView.jsx`

This is the integration hub. It wires everything from tasks 1-5 together.

- [ ] **Step 1: Add new imports**

At the top of `src/components/PracticeView.jsx`, update the `progress` import (line 8-17) to include `todayLocal`:

```js
import {
  markPracticed,
  countCompleted,
  setScore,
  updateSR,
  getDueLetters,
  getProgressSummary,
  getProgress,
  isReviewOnTime,
  todayLocal,
} from '../utils/progress';
```

Update the `decks` import (line 47-55) to include the new exports:

```js
import {
  getDecks,
  getDeck,
  createDeck,
  renameDeck,
  deleteDeck,
  addDeckItem,
  removeDeckItem,
  reorderDeckItem,
  reorderDecks,
  duplicateDeck,
  setLastSession,
  bulkAddItems,
  restoreDeck,
} from '../utils/decks';
```

Add the `UndoToast` import (after `XpGainToast` import, line 45):

```js
import UndoToast from './UndoToast';
```

- [ ] **Step 2: Add `undoDelete` state + delete button ref**

After the `decks` memo (line 224), add:

```jsx
const [undoDelete, setUndoDelete] = useState(null);
const deleteBtnRef = useRef(null);
```

- [ ] **Step 3: Update `handleDeleteDeck` + add undo/copy/reorder handlers**

Replace the existing `handleDeleteDeck` (line 497-500):

```jsx
const handleDeleteDeck = useCallback(
  id => {
    deleteDeck(id);
    refreshDecks();
  },
  [refreshDecks],
);
```

with:

```jsx
const handleDeleteDeck = useCallback(
  id => {
    const deck = getDeck(id);
    if (!deck) return;
    const snapshot = JSON.parse(JSON.stringify(deck));
    deleteDeck(id);
    refreshDecks();
    setUndoDelete({ deletedDeck: snapshot });
  },
  [refreshDecks],
);

const handleUndoDelete = useCallback(() => {
  if (!undoDelete) return;
  restoreDeck(undoDelete.deletedDeck);
  refreshDecks();
  setUndoDelete(null);
}, [undoDelete, refreshDecks]);

const handleDismissUndo = useCallback(() => {
  setUndoDelete(null);
}, []);

const handleCopyDeck = useCallback(
  id => {
    duplicateDeck(id);
    refreshDecks();
  },
  [refreshDecks],
);

const handleReorderDecks = useCallback(
  (fromIdx, toIdx) => {
    reorderDecks(fromIdx, toIdx);
    refreshDecks();
  },
  [refreshDecks],
);
```

- [ ] **Step 4: Update `handleAddDeckItem` to support bulk-add**

Replace the existing `handleAddDeckItem` (line 502-505):

```jsx
const handleAddDeckItem = useCallback(
  (deckId, item) => {
    addDeckItem(deckId, item);
    refreshDecks();
  },
  [refreshDecks],
);
```

with:

```jsx
const handleAddDeckItem = useCallback(
  (deckId, item) => {
    if (item._bulk) {
      bulkAddItems(deckId, item._bulk);
    } else {
      addDeckItem(deckId, item);
    }
    refreshDecks();
  },
  [refreshDecks],
);
```

- [ ] **Step 5: Update `resolveDeckItem` to honor `formKey` constraint**

In `resolveDeckItem` (line 1336), for the `letter` branch, add `formKey` override. Replace the letter branch:

```jsx
if (item.type === 'letter') {
  const l = LETTERS.find(x => x.name === item.ref);
  if (!l) return null;
  return {
    glyph: l.letter,
    name: l.name,
    roman: l.roman,
    formKeys: Object.keys(l.forms),
    practiceMode: 'letters',
    obj: l,
  };
}
```

with:

```jsx
if (item.type === 'letter') {
  const l = LETTERS.find(x => x.name === item.ref);
  if (!l) return null;
  const allForms = Object.keys(l.forms);
  const formKeys = item.formKey && allForms.includes(item.formKey) ? [item.formKey] : allForms;
  return {
    glyph: l.letter,
    name: l.name,
    roman: l.roman,
    formKeys,
    practiceMode: 'letters',
    obj: l,
  };
}
```

- [ ] **Step 6: Add `buildLowScoreQueue` helper**

After `exitDeckSession` (line 1478), add:

```jsx
const buildLowScoreQueue = useCallback(deckId => {
  const deck = getDeck(deckId);
  if (!deck || !deck.lastSession || !deck.lastSession.items) return [];
  return deck.lastSession.items
    .filter(e => e.score == null || e.score <= 3)
    .map(e => ({ type: e.type, ref: e.ref, formKey: e.formKey }));
}, []);
```

- [ ] **Step 7: Update `startDeckSession` to accept `mode`**

Replace the existing `startDeckSession` (line 1410-1423):

```jsx
const startDeckSession = useCallback(
  deck => {
    if (reviewSessionRef.current) return;
    if (!deck || !deck.items || deck.items.length === 0) return;
    setReviewSubTab('decks');
    setDeckSession({
      deckId: deck.id,
      deckName: deck.name,
      queue: deck.items.slice(),
      index: 0,
      summary: [],
      finished: false,
    });
    enterDeckItem(0, deck.items[0]);
  },
  [enterDeckItem],
);
```

with:

```jsx
const startDeckSession = useCallback(
  (deck, mode = 'full') => {
    if (reviewSessionRef.current) return;
    if (!deck || !deck.items || deck.items.length === 0) return;
    setUndoDelete(null);
    setReviewSubTab('decks');
    let queue;
    if (mode === 'lowScore') {
      queue = buildLowScoreQueue(deck.id);
      if (queue.length === 0) return;
    } else {
      queue = deck.items.slice();
    }
    setDeckSession({
      deckId: deck.id,
      deckName: deck.name,
      queue,
      index: 0,
      summary: [],
      finished: false,
      mode,
    });
    enterDeckItem(0, queue[0]);
  },
  [enterDeckItem, buildLowScoreQueue],
);
```

- [ ] **Step 8: Update `advanceDeck` to write `lastSession` on finish**

In `advanceDeck` (line 1428), the terminal branch (line 1461-1462) writes `finished: true`. Replace:

```jsx
      const nextIndex = sess.index + 1;
      if (nextIndex >= sess.queue.length) {
        setDeckSession({ ...sess, summary, finished: true });
      } else {
```

with:

```jsx
      const nextIndex = sess.index + 1;
      if (nextIndex >= sess.queue.length) {
        // Session finished — write lastSession before marking finished.
        const scored = summary.filter((s) => s.score != null);
        const avgScore = scored.length > 0
          ? scored.reduce((sum, s) => sum + s.score, 0) / scored.length
          : null;
        setLastSession(sess.deckId, {
          date: todayLocal(),
          mode: sess.mode || "full",
          avgScore,
          items: summary.map((s) => ({
            ref: s.item.ref,
            type: s.item.type,
            formKey: s.formKey,
            score: s.score,
          })),
        });
        refreshDecks();
        setDeckSession({ ...sess, summary, finished: true });
      } else {
```

Update the `advanceDeck` dependency array (line 1468) — add `refreshDecks`:

```jsx
  }, [activeForm, resolveDeckItem, enterDeckItem, clearCanvas, refreshDecks]);
```

- [ ] **Step 9: Add `restartDeckSession` helper**

After `buildLowScoreQueue` (added in Step 6), add:

```jsx
const restartDeckSession = useCallback(
  mode => {
    const sess = deckSessionRef.current;
    if (!sess) return;
    if (mode === 'full') {
      const deck = getDeck(sess.deckId);
      if (!deck || !deck.items.length) return;
      setDeckSession({
        ...sess,
        queue: deck.items.slice(),
        index: 0,
        summary: [],
        finished: false,
        mode: 'full',
      });
      enterDeckItem(0, deck.items[0]);
    } else {
      const queue = buildLowScoreQueue(sess.deckId);
      if (!queue.length) return;
      setDeckSession({
        ...sess,
        queue,
        index: 0,
        summary: [],
        finished: false,
        mode: 'lowScore',
      });
      enterDeckItem(0, queue[0]);
    }
  },
  [enterDeckItem, buildLowScoreQueue],
);
```

- [ ] **Step 10: Update `exitDeckSession` to clear `undoDelete` + add confirm**

Replace the existing `exitDeckSession` (line 1472-1478):

```jsx
const exitDeckSession = useCallback(() => {
  setDeckSession(null);
  setFeedback(null);
  setShowComparison(false);
  setShowHistory(false);
  clearCanvas();
}, [clearCanvas]);
```

with:

```jsx
const exitDeckSession = useCallback(() => {
  const sess = deckSessionRef.current;
  if (sess && !sess.finished) {
    if (!window.confirm(t('deckExitConfirm'))) return;
  }
  setDeckSession(null);
  setUndoDelete(null);
  setFeedback(null);
  setShowComparison(false);
  setShowHistory(false);
  clearCanvas();
}, [clearCanvas, t]);
```

- [ ] **Step 11: Update the DeckManager render site**

Find the DeckManager render (line 2104-2118):

```jsx
{
  reviewSubTab === 'decks' && (
    <DeckManager
      t={t}
      locale={locale}
      darkMode={darkMode}
      decks={decks}
      onCreateDeck={handleCreateDeck}
      onRenameDeck={handleRenameDeck}
      onDeleteDeck={handleDeleteDeck}
      onAddItem={handleAddDeckItem}
      onRemoveItem={handleRemoveDeckItem}
      onReorderItem={handleReorderDeckItem}
      onStartSession={startDeckSession}
    />
  );
}
```

Replace with (adds `onCopyDeck` + `onReorderDecks` props, `onStartSession` passes mode):

```jsx
{
  reviewSubTab === 'decks' && (
    <DeckManager
      t={t}
      locale={locale}
      darkMode={darkMode}
      decks={decks}
      onCreateDeck={handleCreateDeck}
      onRenameDeck={handleRenameDeck}
      onDeleteDeck={handleDeleteDeck}
      onAddItem={handleAddDeckItem}
      onRemoveItem={handleRemoveDeckItem}
      onReorderItem={handleReorderDeckItem}
      onReorderDecks={handleReorderDecks}
      onCopyDeck={handleCopyDeck}
      onStartSession={(deck, mode) => startDeckSession(deck, mode)}
    />
  );
}
```

- [ ] **Step 12: Update the deck session progress bar — add header row with deck name + mode chip + confirm-exit**

Find the deck session progress bar block (line 2181-2229). Replace the entire block with:

```jsx
{
  deckSession && !deckSession.finished && (
    <div style={{ width: '100%', maxWidth: 520, padding: '8px 12px' }}>
      <div style={styles.deckSessionHeader}>
        <span style={styles.deckSessionName}>
          {deckSession.deckName}
          <span
            style={{
              ...styles.deckSessionModeChip,
              ...(deckSession.mode === 'lowScore'
                ? styles.deckModeChipLowScore
                : styles.deckModeChipFull),
            }}
          >
            {deckSession.mode === 'lowScore' ? t('deckModeLowScore') : t('deckModeFull')}
          </span>
        </span>
        <button
          className="btn-clear"
          onClick={exitDeckSession}
          style={{ fontSize: 12, padding: '4px 10px' }}
        >
          {t('deckBack')}
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 13, color: 'var(--color-text-soft)' }}>
          {t('deckSessionProgress')} {deckSession.index + 1} {t('deckSessionOf')}{' '}
          {deckSession.queue.length}
          {(() => {
            const item = deckSession.queue[deckSession.index];
            const resolved = resolveDeckItem(item);
            if (!resolved || resolved.formKeys.length <= 1) return null;
            const fIdx = resolved.formKeys.indexOf(activeForm);
            return ` · ${resolved.name} · ${t('deckSessionForm')} ${fIdx + 1}/${resolved.formKeys.length}`;
          })()}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: 'var(--color-progress-badge-bg)',
          borderRadius: 99,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${(deckSession.index / deckSession.queue.length) * 100}%`,
            height: '100%',
            background: 'var(--color-accent)',
            borderRadius: 99,
            transition: 'width 0.25s ease',
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 13: Update the deck session summary screen — add subtitle, form-name chips, restart buttons**

Find the deck session summary block (line 2305-2377). Replace the entire block with:

```jsx
{
  deckSession?.finished && (
    <div
      style={{
        width: '100%',
        maxWidth: 520,
        padding: 16,
        background: 'var(--color-card-bg)',
        borderRadius: 12,
        border: '1px solid var(--color-border)',
        marginTop: 8,
      }}
    >
      <h3 style={{ marginBottom: 8, color: 'var(--color-text)' }}>{t('deckSessionComplete')}</h3>
      {(() => {
        const scored = deckSession.summary.filter(s => s.score != null);
        const avg =
          scored.length > 0
            ? (scored.reduce((sum, s) => sum + s.score, 0) / scored.length).toFixed(1)
            : null;
        const lowCount = deckSession.summary.filter(s => s.score == null || s.score <= 3).length;
        return (
          <>
            <p style={styles.deckSummarySubtitle}>
              {deckSession.deckName} · {deckSession.summary.length} {t('deckSessionItems')}
              {avg && ` · ${t('deckSessionAvg')} ★${avg}`}
            </p>
            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              {deckSession.summary.map((entry, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: entry.skipped
                      ? 'var(--color-progress-badge-bg)'
                      : entry.score >= 4
                        ? 'rgba(90,158,78,0.15)'
                        : 'rgba(192,112,58,0.15)',
                    color: 'var(--color-text)',
                    fontSize: 13,
                    opacity: entry.skipped ? 0.55 : 1,
                  }}
                  lang="ar"
                  aria-label={
                    entry.skipped
                      ? `${entry.letterChar} ${t('deckSkipped')}`
                      : `${entry.letterChar} ★${entry.score}`
                  }
                >
                  {entry.letterChar}
                  {entry.skipped ? (
                    <span style={{ fontSize: 10, opacity: 0.6 }}>—</span>
                  ) : (
                    <span style={{ fontSize: 11, opacity: 0.8 }}>★{entry.score}</span>
                  )}
                  {(() => {
                    const resolved = resolveDeckItem(entry.item);
                    if (!resolved || resolved.formKeys.length <= 1) return null;
                    return (
                      <span style={styles.deckSummaryChipForm}>
                        {t(FORM_SHORT[entry.formKey]) || entry.formKey}
                      </span>
                    );
                  })()}
                </span>
              ))}
            </div>
            <div style={styles.deckSummaryButtons}>
              <button
                className="btn-nav"
                onClick={() => restartDeckSession('full')}
                style={styles.btn}
              >
                {t('deckRunAgain')}
              </button>
              {lowCount > 0 && (
                <button
                  className="btn-ai"
                  onClick={() => restartDeckSession('lowScore')}
                  style={{ ...styles.btn, ...styles.btnAI }}
                >
                  {t('deckRerunLowCount').replace('{n}', String(lowCount))}
                </button>
              )}
              <button className="btn-clear" onClick={exitDeckSession} style={styles.btn}>
                {t('deckDone')}
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}
```

- [ ] **Step 14: Add `<UndoToast>` render**

Find the closing `</div>` at the end of the component return (line 3049). Insert **before** it:

```jsx
{
  undoDelete && (
    <UndoToast
      message={t('undoDeleteMessage').replace('{name}', undoDelete.deletedDeck.name)}
      actionLabel={t('undo')}
      onUndo={handleUndoDelete}
      onDismiss={handleDismissUndo}
      dismissRef={deleteBtnRef}
    />
  );
}
```

- [ ] **Step 15: Clear `undoDelete` on session start**

In `startDeckSession` (already done in Step 7 — `setUndoDelete(null)` is included there). Verify it's present.

- [ ] **Step 16: Run build to verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 17: Commit**

```bash
git add src/components/PracticeView.jsx
git commit -m "Wire two session modes, restart, summary, undo-delete, session header"
```

---

## Task 7: Update `AGENTS.md`

**Files:**

- Modify: `AGENTS.md`

- [ ] **Step 1: Document the new `decks.js` exports**

In the "Architecture & Data Flow" section, find the `src/utils/` line (line 35) and update the `decks.js` description. Change:

```
- `src/utils/`: `api.js` (OpenRouter vision), `drawing.js` (pressure/brush), `progress.js` (SM-2), `history.js` (feedback history), `decks.js` (study deck CRUD).
```

to:

```
- `src/utils/`: `api.js` (OpenRouter vision), `drawing.js` (pressure/brush), `progress.js` (SM-2; also exports `todayLocal`), `history.js` (feedback history), `decks.js` (study deck CRUD + `duplicateDeck`/`reorderDecks`/`setLastSession`/`bulkAddItems`/`restoreDeck`).
```

- [ ] **Step 2: Document UndoToast + DeckManager changes**

In the `src/components/` line (line 32), add `UndoToast.jsx`. Change:

```
- `src/components/`: `LoginScreen.jsx` (API key/skip), `PracticeView.jsx` (main UI, canvas, drawing, nav, AI feedback), `DeckManager.jsx` (presentational deck list/editor/picker, Review sub-tab).
```

to:

```
- `src/components/`: `LoginScreen.jsx` (API key/skip), `PracticeView.jsx` (main UI, canvas, drawing, nav, AI feedback), `DeckManager.jsx` (presentational deck list/editor/picker, Review sub-tab; bulk-add, word search, checkmark badges, roving tabindex), `UndoToast.jsx` (accessible interactive undo toast).
```

- [ ] **Step 3: Document two session modes + `lastSession` schema**

In the "AI Integration & Spaced Repetition (SM-2)" section, after the existing deck-session bullet (the one about "Words are first-class progress entries"), add a new bullet:

```
- **Deck session modes:** Full-pass (default) and low-score re-run
  (`mode: "lowScore"`). Low-score re-runs filter `deck.lastSession.items`
  to `score == null || score <= 3` and constrain each queue entry to the
  specific `formKey` that scored low. Both modes skip `updateSR`.
  `setLastSession(deckId, session)` is called only on `finished: true` in
  `advanceDeck` — the single write site. `deck.lastSession` stores
  `{ date, mode, avgScore, items: [{ref, type, formKey, score}] }`.
  `deck.order` is a stable integer for list reordering.
```

- [ ] **Step 4: Run build to verify**

Run: `npm run build`
Expected: Build succeeds (AGENTS.md is not built, but confirms no accidental file changes).

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "Document deck polish: new utils, UndoToast, session modes, lastSession schema"
```

---

## Verification (post-implementation)

- [ ] **Final build check:** `npm run build` exits zero.
- [ ] **Playwright manual testing** (per spec verification table):
  - Data layer: migration, sorting, new utils, cross-tab sync.
  - Session modes: full pass (unchanged), low-score start + form constraint, restart both modes.
  - Session UI: header with deck name + mode chip, confirm-exit, summary with avg + form-name chips + 3 buttons.
  - Deck-building: bulk-add buttons, words search, duplicate deck, deck reorder.
  - Undo delete: toast appears, Undo restores, auto-dismiss, session clears toast.
  - A11y: roving tabindex, focus management, Undo button focus, aria-labels.
  - Visual: score chips, checkmark badges, dark mode, RTL.
  - Regression: Auto Review unchanged, existing deck CRUD unchanged, conflict guards.
