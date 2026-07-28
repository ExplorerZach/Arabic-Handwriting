# Decks & Review Curation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create named study decks of letters/numbers/diacritics/words and run full-pass review sessions over them, side-by-side with the existing automatic SM-2 review inside the Review tab.

**Architecture:** New `src/utils/decks.js` (CRUD util mirroring `progress.js`'s cache + storage-listener pattern) + new `src/components/DeckManager.jsx` (three-pane presentational component). PracticeView gains a separate `deckSession` state machine (no SM-2 fields, full-pass semantics) parallel to the existing `reviewSession`. Words join `arabic_progress` as first-class entries (`name` = word string, `formKey` = `"word"`). The existing Auto Review is preserved unchanged.

**Tech Stack:** React 19, Vite 8, plain JSX (no TypeScript), inline JS style objects, CSS vars from `global.css`, localStorage for persistence. No test suite — verification is `npm run build` (must exit zero) + manual Playwright browser testing per AGENTS.md.

**Spec:** `docs/superpowers/specs/2026-06-28-decks-and-review-curation-design.md`

---

## File Structure

### New files

- **`src/utils/decks.js`** — CRUD util for the `arabic_decks` localStorage key. In-memory cache + `storage` listener (mirrors `progress.js`/`history.js`). Exports: `getDecks`, `createDeck`, `renameDeck`, `deleteDeck`, `getDeck`, `addDeckItem`, `removeDeckItem`, `reorderDeckItem`.
- **`src/components/DeckManager.jsx`** — extracted presentational component (three panes: list / editor / picker). Receives `t`, `locale`, `darkMode`, `decks`, and CRUD + `onStartSession` handlers as props.

### Modified files

- **`src/utils/backup.js`** — add `arabic_decks` to `BACKUP_KEYS` so decks survive export/import.
- **`src/locales/index.js`** — ~24 new UI keys added to **both** `en` and `ar`.
- **`src/styles/practiceStyles.js`** — new deck-related style entries (mirroring the existing `review*` styles).
- **`src/components/PracticeView.jsx`** — imports, state/refs/memos, deck session state machine, Review tab sub-nav + `<DeckManager>` render, `requestFeedback` + Next button wiring, session UI, diacritics routing fix, conflict guards, cross-tab storage listener.
- **`AGENTS.md`** — document the new `arabic_decks` key, `DeckManager` component, `decks.js` util, and words-as-first-class-progress.

---

## Task 1: `decks.js` util + backup key

**Files:**

- Create: `src/utils/decks.js`
- Modify: `src/utils/backup.js:16-30` (the `BACKUP_KEYS` array)

- [ ] **Step 1: Create `src/utils/decks.js`**

```js
/**
 * Study decks — persisted in localStorage under 'arabic_decks'.
 *
 * Shape:
 * {
 *   decks: [
 *     {
 *       id: "deck_1700000000000",
 *       name: "My tricky letters",
 *       createdAt: "2026-06-28T00:00:00.000Z",
 *       items: [
 *         { id: "item_1", type: "letter",    ref: "Ba" },
 *         { id: "item_2", type: "number",    ref: "Num3" },
 *         { id: "item_3", type: "diacritic", ref: "DiacriticFatha" },
 *         { id: "item_4", type: "word",      ref: "سلام" }
 *       ]
 *     }
 *   ]
 * }
 *
 * `ref` is the stable lookup key into the static data arrays:
 *   letter/number/diacritic `.name`, or the Arabic word string.
 * Items may appear in multiple decks (many-to-many).
 *
 * Follows the same in-memory cache + storage-event pattern as
 * progress.js / history.js: localStorage.getItem + JSON.parse is cheap
 * individually but called many times per render, so cache the parsed
 * object and invalidate on write; re-sync via the `storage` event for
 * other-tab edits.
 */

const STORAGE_KEY = 'arabic_decks';

let cache = null;
let idCounter = 0;

function load() {
  if (cache !== null) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"decks":[]}');
    if (!cache.decks || !Array.isArray(cache.decks)) cache = { decks: [] };
  } catch {
    cache = { decks: [] };
  }
  return cache;
}

function save(data) {
  cache = data;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY) cache = null;
  });
}

function uniqueId(prefix) {
  // Date.now() + counter disambiguates same-ms creates.
  idCounter = (idCounter + 1) % 1000000;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

// ─── Public API ──────────────────────────────────────────

/** Return the decks array (fresh from cache/storage). */
export function getDecks() {
  return load().decks;
}

/** Create a new empty deck and return it. */
export function createDeck(name) {
  const data = load();
  const deck = {
    id: uniqueId('deck'),
    name: name || 'Untitled',
    createdAt: new Date().toISOString(),
    items: [],
  };
  data.decks.push(deck);
  save(data);
  return deck;
}

/** Rename a deck by id. */
export function renameDeck(id, name) {
  const data = load();
  const deck = data.decks.find(d => d.id === id);
  if (deck) {
    deck.name = name;
    save(data);
  }
  return deck;
}

/** Delete a deck by id. */
export function deleteDeck(id) {
  const data = load();
  data.decks = data.decks.filter(d => d.id !== id);
  save(data);
}

/** Get a single deck by id (or null). */
export function getDeck(id) {
  return load().decks.find(d => d.id === id) || null;
}

/** Add an item `{ type, ref }` to a deck; returns the added item. */
export function addDeckItem(deckId, item) {
  const data = load();
  const deck = data.decks.find(d => d.id === deckId);
  if (!deck) return null;
  const full = { id: uniqueId('item'), type: item.type, ref: item.ref };
  deck.items.push(full);
  save(data);
  return full;
}

/** Remove an item from a deck by item id. */
export function removeDeckItem(deckId, itemId) {
  const data = load();
  const deck = data.decks.find(d => d.id === deckId);
  if (!deck) return;
  deck.items = deck.items.filter(it => it.id !== itemId);
  save(data);
}

/** Move an item within a deck from fromIdx to toIdx. */
export function reorderDeckItem(deckId, fromIdx, toIdx) {
  const data = load();
  const deck = data.decks.find(d => d.id === deckId);
  if (!deck) return;
  const items = deck.items;
  if (fromIdx < 0 || fromIdx >= items.length) return;
  if (toIdx < 0 || toIdx >= items.length) return;
  const [moved] = items.splice(fromIdx, 1);
  items.splice(toIdx, 0, moved);
  save(data);
}
```

- [ ] **Step 2: Add `arabic_decks` to `BACKUP_KEYS` in `src/utils/backup.js`**

In the `BACKUP_KEYS` array (line 16-30), add `'arabic_decks'` after `'arabic_xp'`:

```js
const BACKUP_KEYS = [
  'arabic_progress',
  'arabic_feedback_history',
  'arabic_practice_dates',
  'arabic_freezes',
  'arabic_xp',
  'arabic_decks',
  'openrouter_model',
  'brushScale',
  'lessonMode',
  'app_locale',
  'app_darkMode',
  'app_theme',
  'brush_pack',
  'daily_goal',
];
```

- [ ] **Step 3: Run build to verify it exits zero**

Run: `npm run build`
Expected: Build succeeds with no errors. The new `decks.js` is not imported yet (tree-shaking will exclude it), but the syntax must be valid.

- [ ] **Step 4: Commit**

```bash
git add src/utils/decks.js src/utils/backup.js
git commit -m "Add decks util and include arabic_decks in backups"
```

---

## Task 2: Locale keys

**Files:**

- Modify: `src/locales/index.js` (add keys to both `en` and `ar` blocks)

- [ ] **Step 1: Add English keys**

In the `en:` block, after the existing "Spaced repetition" section (around line 202, after `ariaLetterTab`), insert a new "Decks" section:

```js
    // Decks (Review sub-tab)
    subAutoReview: "Auto Review",
    subMyDecks: "My Decks",
    deckListTitle: "My Decks",
    deckNew: "New Deck",
    deckEmpty: "You haven't created any decks yet.",
    deckEmptyCta: "Create your first deck",
    deckStart: "Start Session",
    deckEdit: "Edit",
    deckDelete: "Delete",
    deckDeleteConfirm: "Delete this deck? This cannot be undone.",
    deckNameLabel: "Deck name",
    deckAddItems: "Add Items",
    deckItemRemove: "Remove",
    deckDone: "Done",
    deckBack: "Back",
    deckPickerLetters: "Letters",
    deckPickerNumbers: "Numbers",
    deckPickerDiacritics: "Diacritics",
    deckPickerWords: "Words",
    deckItemCount: "items",
    deckSessionProgress: "Item",
    deckSessionOf: "of",
    deckSessionForm: "form",
    deckSessionComplete: "Deck complete",
    deckSessionReviewed: "You reviewed",
    deckSessionItems: "items",
    deckSessionEmpty: "This deck is empty — add items before starting a session.",
    deckConflictAuto: "Finish or exit the current deck session first.",
    deckConflictDeck: "Finish or exit the current review session first.",
    deckMoveUp: "Move up",
    deckMoveDown: "Move down",
```

- [ ] **Step 2: Add Arabic keys**

In the `ar:` block, find the matching "Spaced repetition" section (around line 486-488) and insert the same keys after it, with Arabic translations:

```js
    // Decks (Review sub-tab)
    subAutoReview: "المراجعة التلقائية",
    subMyDecks: "مجموعاتي",
    deckListTitle: "مجموعاتي",
    deckNew: "مجموعة جديدة",
    deckEmpty: "لم تنشئ أي مجموعة بعد.",
    deckEmptyCta: "أنشئ مجموعتك الأولى",
    deckStart: "ابدأ الجلسة",
    deckEdit: "تحرير",
    deckDelete: "حذف",
    deckDeleteConfirm: "حذف هذه المجموعة؟ لا يمكن التراجع.",
    deckNameLabel: "اسم المجموعة",
    deckAddItems: "إضافة عناصر",
    deckItemRemove: "إزالة",
    deckDone: "تم",
    deckBack: "رجوع",
    deckPickerLetters: "حروف",
    deckPickerNumbers: "أرقام",
    deckPickerDiacritics: "تشكيل",
    deckPickerWords: "كلمات",
    deckItemCount: "عناصر",
    deckSessionProgress: "عنصر",
    deckSessionOf: "من",
    deckSessionForm: "شكل",
    deckSessionComplete: "اكتملت المجموعة",
    deckSessionReviewed: "راجعت",
    deckSessionItems: "عناصر",
    deckSessionEmpty: "هذه المجموعة فارغة — أضف عناصر قبل بدء الجلسة.",
    deckConflictAuto: "أكمل أو أنهِ جلسة المجموعة الحالية أولاً.",
    deckConflictDeck: "أكمل أو أنهِ جلسة المراجعة الحالية أولاً.",
    deckMoveUp: "تحريك لأعلى",
    deckMoveDown: "تحريك لأسفل",
```

- [ ] **Step 3: Run build to verify**

Run: `npm run build`
Expected: Build succeeds. No unused-variable errors (the keys are referenced later when DeckManager is wired).

- [ ] **Step 4: Commit**

```bash
git add src/locales/index.js
git commit -m "Add deck UI locale keys (en + ar)"
```

---

## Task 3: Deck styles

**Files:**

- Modify: `src/styles/practiceStyles.js` (add new entries before `export default styles` at line 1125)

- [ ] **Step 1: Add deck style entries**

Insert this block immediately before the final `export default styles;` line (line 1125), after the last existing style entry:

```js
  /* ─── Decks (Review sub-tab) ─────────────────────────── */
  deckSubNav: {
    display: 'flex',
    gap: '6px',
    marginBottom: '12px',
    maxWidth: '520px',
    width: '100%',
  },
  deckSubNavBtn: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: '12px',
    fontWeight: '600',
    letterSpacing: '.04em',
    cursor: 'pointer',
    transition: 'all .15s',
  },
  deckSubNavBtnActive: {
    background: 'var(--color-accent)',
    color: '#fff',
    borderColor: 'var(--color-accent)',
  },
  deckRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 14px',
    borderRadius: '10px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    marginBottom: '8px',
  },
  deckRowName: {
    flex: 1,
    fontSize: '15px',
    fontWeight: '600',
    color: 'var(--color-text)',
  },
  deckRowCount: {
    fontSize: '11px',
    color: 'var(--color-text-muted)',
  },
  deckEditorItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    marginBottom: '6px',
  },
  deckEditorItemChar: {
    fontSize: '28px',
    fontFamily: "'Amiri','Scheherazade New',serif",
    color: 'var(--color-primary)',
    lineHeight: 1.2,
    direction: 'rtl',
    minWidth: '32px',
    textAlign: 'center',
  },
  deckEditorItemLabel: {
    flex: 1,
    fontSize: '13px',
    color: 'var(--color-text)',
  },
  deckPickerGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
    marginTop: '12px',
  },
  deckPickerWordRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    marginBottom: '6px',
  },
  deckPickerWordChar: {
    fontSize: '24px',
    fontFamily: "'Amiri','Scheherazade New',serif",
    color: 'var(--color-primary)',
    direction: 'rtl',
    minWidth: '120px',
  },
  deckPickerWordMeta: {
    flex: 1,
    fontSize: '12px',
    color: 'var(--color-text-muted)',
  },

```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds. Styles are not referenced yet but syntax must be valid.

- [ ] **Step 3: Commit**

```bash
git add src/styles/practiceStyles.js
git commit -m "Add deck style entries"
```

---

## Task 4: `DeckManager.jsx` component

**Files:**

- Create: `src/components/DeckManager.jsx`

This is a presentational component with three panes controlled by a local `deckView` state: `"list"` (default), `"edit"`, `"picker"`.

- [ ] **Step 1: Create `src/components/DeckManager.jsx`**

```jsx
import { useState } from 'react';
import styles from '../styles/practiceStyles';
import { LETTERS } from '../data/letters';
import { NUMBERS } from '../data/numbers';
import { DIACRITICS } from '../data/diacritics';
import { WORD_GROUPS } from '../data/words';

/**
 * Deck manager — presentational component for the "My Decks" sub-tab
 * inside the Review tab. Three panes (list / editor / picker) controlled
 * by local `deckView` state. Receives CRUD handlers + onStartSession as
 * props; all mutation flows through PracticeView which bumps decksVersion.
 *
 * Props:
 *   t, locale, darkMode
 *   decks — array of deck objects
 *   onCreateDeck(name), onRenameDeck(id, name), onDeleteDeck(id)
 *   onAddItem(deckId, item), onRemoveItem(deckId, itemId)
 *   onReorderItem(deckId, fromIdx, toIdx)
 *   onStartSession(deck)
 */
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
  onStartSession,
}) {
  const [deckView, setDeckView] = useState('list');
  const [editingId, setEditingId] = useState(null);
  const [pickerTab, setPickerTab] = useState('letters');

  const editingDeck = editingId ? decks.find(d => d.id === editingId) : null;

  const backToList = () => {
    setDeckView('list');
    setEditingId(null);
  };

  const handleNewDeck = () => {
    const deck = onCreateDeck('Untitled');
    if (deck) {
      setEditingId(deck.id);
      setDeckView('edit');
    }
  };

  // ─── Resolve an item ref to a display glyph + label ────
  const resolveDisplay = item => {
    if (item.type === 'letter') {
      const l = LETTERS.find(x => x.name === item.ref);
      return l ? { char: l.letter, label: `${l.name} — ${l.roman}` } : null;
    }
    if (item.type === 'number') {
      const n = NUMBERS.find(x => x.name === item.ref);
      return n ? { char: n.letter, label: `${n.name} — ${n.roman}` } : null;
    }
    if (item.type === 'diacritic') {
      const d = DIACRITICS.find(x => x.name === item.ref);
      return d ? { char: d.letter, label: `${d.name} — ${d.roman}` } : null;
    }
    if (item.type === 'word') {
      let found = null;
      for (const g of WORD_GROUPS) {
        const w = g.words.find(x => x.word === item.ref);
        if (w) {
          found = { char: w.word, label: `${w.roman} — ${w.meaning}` };
          break;
        }
      }
      return found;
    }
    return null;
  };

  const isInDeck = (type, ref) => {
    if (!editingDeck) return false;
    return editingDeck.items.some(it => it.type === type && it.ref === ref);
  };

  const toggleItem = (type, ref) => {
    if (!editingDeck) return;
    if (isInDeck(type, ref)) {
      const item = editingDeck.items.find(it => it.type === type && it.ref === ref);
      if (item) onRemoveItem(editingDeck.id, item.id);
    } else {
      onAddItem(editingDeck.id, { type, ref });
    }
  };

  // ═══ Pane 1: Deck list ═════════════════════════════════
  if (deckView === 'list') {
    return (
      <div style={styles.reviewDash}>
        <div style={{ ...styles.reviewHeader, justifyContent: 'space-between' }}>
          <span>{t('deckListTitle')}</span>
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
            <p style={{ marginBottom: 12 }}>{t('deckEmpty')}</p>
            <button
              className="btn-ai"
              style={{ ...styles.btn, ...styles.btnAI }}
              onClick={handleNewDeck}
            >
              {t('deckEmptyCta')}
            </button>
          </div>
        ) : (
          decks.map(deck => (
            <div key={deck.id} style={styles.deckRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.deckRowName}>{deck.name}</div>
                <div style={styles.deckRowCount}>
                  {deck.items.length} {t('deckItemCount')}
                </div>
              </div>
              <button
                className="btn-ai"
                style={{ ...styles.btn, ...styles.btnAI, fontSize: 12, padding: '4px 10px' }}
                onClick={() => onStartSession(deck)}
                disabled={deck.items.length === 0}
              >
                ▶ {t('deckStart')}
              </button>
              <button
                className="btn-panel"
                style={{ ...styles.btn, fontSize: 12, padding: '4px 10px' }}
                onClick={() => {
                  setEditingId(deck.id);
                  setDeckView('edit');
                }}
              >
                {t('deckEdit')}
              </button>
              <button
                className="btn-clear"
                style={{ ...styles.btn, fontSize: 12, padding: '4px 10px' }}
                onClick={() => {
                  if (window.confirm(t('deckDeleteConfirm'))) onDeleteDeck(deck.id);
                }}
              >
                {t('deckDelete')}
              </button>
            </div>
          ))
        )}
      </div>
    );
  }

  // ═══ Pane 2: Deck editor ═══════════════════════════════
  if (deckView === 'edit' && editingDeck) {
    return (
      <div style={styles.reviewDash}>
        <div style={{ ...styles.reviewHeader, justifyContent: 'space-between' }}>
          <button
            className="btn-clear"
            style={{ ...styles.btn, fontSize: 12, padding: '4px 10px' }}
            onClick={backToList}
          >
            ← {t('deckBack')}
          </button>
          <button
            className="btn-nav"
            style={{ ...styles.btn, fontSize: 12, padding: '4px 10px' }}
            onClick={backToList}
          >
            {t('deckDone')}
          </button>
        </div>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              display: 'block',
              marginBottom: 4,
            }}
          >
            {t('deckNameLabel')}
          </span>
          <input
            type="text"
            value={editingDeck.name}
            onChange={e => onRenameDeck(editingDeck.id, e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              fontSize: 15,
              boxSizing: 'border-box',
            }}
          />
        </label>
        <button
          className="btn-ai"
          style={{ ...styles.btn, ...styles.btnAI, marginBottom: 12 }}
          onClick={() => setDeckView('picker')}
        >
          ＋ {t('deckAddItems')}
        </button>
        {editingDeck.items.length === 0 ? (
          <div style={styles.reviewEmpty}>{t('deckEmpty')}</div>
        ) : (
          editingDeck.items.map((item, idx) => {
            const disp = resolveDisplay(item);
            if (!disp) return null;
            return (
              <div key={item.id} style={styles.deckEditorItem}>
                <span style={styles.deckEditorItemChar} lang="ar">
                  {disp.char}
                </span>
                <span style={styles.deckEditorItemLabel}>{disp.label}</span>
                <button
                  className="btn-clear"
                  style={{ ...styles.btn, fontSize: 11, padding: '2px 8px' }}
                  onClick={() => onReorderItem(editingDeck.id, idx, Math.max(0, idx - 1))}
                  disabled={idx === 0}
                  aria-label={t('deckMoveUp')}
                >
                  ↑
                </button>
                <button
                  className="btn-clear"
                  style={{ ...styles.btn, fontSize: 11, padding: '2px 8px' }}
                  onClick={() =>
                    onReorderItem(
                      editingDeck.id,
                      idx,
                      Math.min(editingDeck.items.length - 1, idx + 1),
                    )
                  }
                  disabled={idx === editingDeck.items.length - 1}
                  aria-label={t('deckMoveDown')}
                >
                  ↓
                </button>
                <button
                  className="btn-clear"
                  style={{ ...styles.btn, fontSize: 11, padding: '2px 8px' }}
                  onClick={() => onRemoveItem(editingDeck.id, item.id)}
                  aria-label={t('deckItemRemove')}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
    );
  }

  // ═══ Pane 3: Item picker ═══════════════════════════════
  if (deckView === 'picker' && editingDeck) {
    const subTabs = [
      { key: 'letters', label: t('deckPickerLetters') },
      { key: 'numbers', label: t('deckPickerNumbers') },
      { key: 'diacritics', label: t('deckPickerDiacritics') },
      { key: 'words', label: t('deckPickerWords') },
    ];
    return (
      <div style={styles.reviewDash}>
        <div style={{ ...styles.reviewHeader, justifyContent: 'space-between' }}>
          <button
            className="btn-clear"
            style={{ ...styles.btn, fontSize: 12, padding: '4px 10px' }}
            onClick={() => setDeckView('edit')}
          >
            ← {t('deckBack')}
          </button>
          <button
            className="btn-nav"
            style={{ ...styles.btn, fontSize: 12, padding: '4px 10px' }}
            onClick={() => setDeckView('edit')}
          >
            {t('deckDone')}
          </button>
        </div>
        <div style={styles.deckSubNav}>
          {subTabs.map(st => (
            <button
              key={st.key}
              className="btn-form"
              style={{
                ...styles.deckSubNavBtn,
                ...(pickerTab === st.key ? styles.deckSubNavBtnActive : {}),
              }}
              onClick={() => setPickerTab(st.key)}
              aria-pressed={pickerTab === st.key}
            >
              {st.label}
            </button>
          ))}
        </div>

        {pickerTab === 'letters' && (
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
        )}

        {pickerTab === 'numbers' && (
          <div style={styles.deckPickerGrid}>
            {NUMBERS.map(n => {
              const selected = isInDeck('number', n.name);
              return (
                <button
                  key={n.name}
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
                  aria-pressed={selected}
                >
                  <span style={styles.reviewTileChar} lang="ar">
                    {n.letter}
                  </span>
                  <span style={styles.reviewTileName}>{n.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {pickerTab === 'diacritics' && (
          <div style={styles.deckPickerGrid}>
            {DIACRITICS.map(d => {
              const selected = isInDeck('diacritic', d.name);
              return (
                <button
                  key={d.name}
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
                  aria-pressed={selected}
                >
                  <span style={styles.reviewTileChar} lang="ar">
                    {d.letter}
                  </span>
                  <span style={styles.reviewTileName}>{d.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {pickerTab === 'words' && (
          <div>
            {WORD_GROUPS.map((g, gIdx) => (
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
                {g.words.map((w, wIdx) => {
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
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fallback (shouldn't reach)
  return null;
}
```

- [ ] **Step 2: Run build to verify**

Run: `npm run build`
Expected: Build succeeds. `DeckManager` is not imported by PracticeView yet, so tree-shaking may exclude it, but syntax must be valid.

- [ ] **Step 3: Commit**

```bash
git add src/components/DeckManager.jsx
git commit -m "Add DeckManager presentational component"
```

---

## Task 5: Wire decks into PracticeView (state, session machine, render)

**Files:**

- Modify: `src/components/PracticeView.jsx`

This is the core wiring task: imports, state/refs/memos, the deck session state machine (`resolveDeckItem`, `enterDeckItem`, `advanceDeck`, `exitDeckSession`, `startDeckSession`), CRUD handlers, cross-tab storage listener, the Review tab sub-nav, and the `<DeckManager>` render. After this task, the Decks sub-tab is fully navigable and sessions can start (but AI-feedback wiring comes in Task 6, and the session progress bar / summary UI comes in Task 7).

- [ ] **Step 1: Add imports**

At the top of `src/components/PracticeView.jsx`, after the existing `WORD_GROUPS` import (line 22), add the `ALL_WORDS` import:

```js
import { ALL_WORDS } from '../data/words';
```

After line 45 (`import XpGainToast from "./XpGainToast";`), add:

```js
import DeckManager from './DeckManager';
import {
  getDecks,
  createDeck,
  renameDeck,
  deleteDeck,
  addDeckItem,
  removeDeckItem,
  reorderDeckItem,
} from '../utils/decks';
```

- [ ] **Step 2: Add state, refs, and memos**

Find the "Guided review session state" block (around line 186-196). After the `useEffect` syncing `reviewSessionRef` (line 196), insert:

```js
// Deck session state (separate from reviewSession — no SM-2, full-pass)
const [deckSession, setDeckSession] = useState(null);
// { deckId, deckName, queue: DeckItem[], index, summary: [{item, formKey, score, skipped, letterChar, name}], finished? }
const deckSessionRef = useRef(null);
const advanceDeckRef = useRef(null);
useEffect(() => {
  deckSessionRef.current = deckSession;
}, [deckSession]);

// Review sub-tab ("auto" = existing dashboard, "decks" = DeckManager)
const [reviewSubTab, setReviewSubTab] = useState('auto');

// Decks version counter — bumped on every deck CRUD write so the `decks`
// memo recomputes. Separate from progressVersion so deck edits don't
// needlessly re-memoize progress summaries.
const [decksVersion, setDecksVersion] = useState(0);
const decks = useMemo(() => getDecks(), [decksVersion]);

// Map word string -> { word, roman, meaning, hint, group, groupIndex, wordIndex }
// so a deck item with type:"word" can resolve to the right
// wordGroupIndex + wordIndex that the existing derivation expects.
const wordLookup = useMemo(() => {
  const m = new Map();
  WORD_GROUPS.forEach((g, gIdx) => {
    g.words.forEach((w, wIdx) => {
      if (!m.has(w.word)) m.set(w.word, { ...w, group: g.name, groupIndex: gIdx, wordIndex: wIdx });
    });
  });
  return m;
}, []);
```

- [ ] **Step 3: Add CRUD handlers + cross-tab storage listener**

Near other `useCallback` handlers (e.g. after `switchPracticeMode` around line 440), insert:

```js
const refreshDecks = useCallback(() => setDecksVersion(v => v + 1), []);

const handleCreateDeck = useCallback(
  name => {
    const deck = createDeck(name);
    refreshDecks();
    return deck;
  },
  [refreshDecks],
);

const handleRenameDeck = useCallback(
  (id, name) => {
    renameDeck(id, name);
    refreshDecks();
  },
  [refreshDecks],
);

const handleDeleteDeck = useCallback(
  id => {
    deleteDeck(id);
    refreshDecks();
  },
  [refreshDecks],
);

const handleAddDeckItem = useCallback(
  (deckId, item) => {
    addDeckItem(deckId, item);
    refreshDecks();
  },
  [refreshDecks],
);

const handleRemoveDeckItem = useCallback(
  (deckId, itemId) => {
    removeDeckItem(deckId, itemId);
    refreshDecks();
  },
  [refreshDecks],
);

const handleReorderDeckItem = useCallback(
  (deckId, fromIdx, toIdx) => {
    reorderDeckItem(deckId, fromIdx, toIdx);
    refreshDecks();
  },
  [refreshDecks],
);
```

And near the existing online/offline `useEffect` (around line 509), add a cross-tab storage listener:

```js
useEffect(() => {
  const onStorage = e => {
    if (e.key === 'arabic_decks') setDecksVersion(v => v + 1);
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}, []);
```

- [ ] **Step 4: Add the deck session state machine**

After `goToAnalyticsItem` (around line 1227), insert the deck session helpers. **Order matters:** `resolveDeckItem` first, then `enterDeckItem`, then `startDeckSession` (which references `enterDeckItem`), then `advanceDeck`, then `exitDeckSession`. The `advanceDeckRef.current = advanceDeck` assignment runs on every render (mirroring the `advanceReviewRef` pattern at line 1155) so the `setTimeout` auto-advance always calls the latest version with the current `activeForm`.

```js
// ─── Deck session helpers ─────────────────────────────
// Resolve a deck item { type, ref } to the data needed to render +
// practice it. Returns null if the ref can't be found (shouldn't happen
// with static data, but guard anyway).
const resolveDeckItem = useCallback(
  item => {
    if (!item) return null;
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
    if (item.type === 'number') {
      const n = NUMBERS.find(x => x.name === item.ref);
      if (!n) return null;
      return {
        glyph: n.letter,
        name: n.name,
        roman: n.roman,
        formKeys: ['isolated'],
        practiceMode: 'numbers',
        obj: n,
      };
    }
    if (item.type === 'diacritic') {
      const d = DIACRITICS.find(x => x.name === item.ref);
      if (!d) return null;
      return {
        glyph: d.letter,
        name: d.name,
        roman: d.roman,
        formKeys: ['isolated'],
        practiceMode: 'diacritics',
        obj: d,
      };
    }
    if (item.type === 'word') {
      const w = wordLookup.get(item.ref);
      if (!w) return null;
      return {
        glyph: w.word,
        name: w.word,
        roman: w.roman,
        formKeys: ['word'],
        practiceMode: 'words',
        obj: w,
      };
    }
    return null;
  },
  [wordLookup],
);

// Enter a specific deck queue index: resolve the item, set the right
// practiceMode + indices + first form, clear the canvas. Mirrors
// enterReviewItem but handles all four item types + lesson-mode index
// mapping for letters.
const enterDeckItem = useCallback(
  (idx, itemArg) => {
    const sess = deckSessionRef.current;
    if (!sess) return;
    const item = itemArg || sess.queue[idx];
    if (!item) return;
    const resolved = resolveDeckItem(item);
    if (!resolved) return;
    setPracticeMode(resolved.practiceMode);
    if (resolved.practiceMode === 'words') {
      setWordGroupIndex(resolved.obj.groupIndex);
      setWordIndex(resolved.obj.wordIndex);
    } else if (resolved.practiceMode === 'letters') {
      const alphIdx = LETTERS.findIndex(l => l.name === item.ref);
      if (lessonMode) {
        const lessonIdx = lessonToAlpha.indexOf(alphIdx);
        setLetterIndex(lessonIdx !== -1 ? lessonIdx : 0);
      } else {
        setLetterIndex(alphIdx);
      }
    } else {
      // numbers or diacritics — index into activeSet
      const set = resolved.practiceMode === 'numbers' ? NUMBERS : DIACRITICS;
      const idxInSet = set.findIndex(x => x.name === item.ref);
      setLetterIndex(idxInSet);
    }
    setFormIndex(resolved.formKeys[0]);
    setFeedback(null);
    setShowComparison(false);
    setShowHistory(false);
    alphaBtnRefs.current = [];
    clearCanvas();
  },
  [resolveDeckItem, lessonMode, lessonToAlpha, clearCanvas],
);

const startDeckSession = useCallback(
  deck => {
    if (reviewSessionRef.current) return; // conflict guard — can't start during auto review
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

// Advance the deck session. For letters, cycle through forms first; on
// the last form, advance to the next queue item. For non-letters, advance
// to the next item immediately.
const advanceDeck = useCallback(
  score => {
    const sess = deckSessionRef.current;
    if (!sess || sess.finished) return;
    const item = sess.queue[sess.index];
    const resolved = resolveDeckItem(item);
    if (!resolved) {
      const nextIndex = sess.index + 1;
      if (nextIndex >= sess.queue.length) {
        setDeckSession({ ...sess, finished: true });
      } else {
        setDeckSession({ ...sess, index: nextIndex });
        enterDeckItem(nextIndex);
      }
      return;
    }
    const formKeys = resolved.formKeys;
    const currentFormIdx = formKeys.indexOf(activeForm);
    const isLastForm = currentFormIdx === -1 || currentFormIdx === formKeys.length - 1;
    const skipped = score == null;
    const summary = [
      ...sess.summary,
      {
        item,
        formKey: activeForm,
        score,
        skipped,
        letterChar: resolved.glyph,
        name: resolved.name,
      },
    ];
    if (!isLastForm) {
      setDeckSession({ ...sess, summary });
      setFormIndex(formKeys[currentFormIdx + 1]);
      setFeedback(null);
      setShowComparison(false);
      setShowHistory(false);
      clearCanvas();
    } else {
      const nextIndex = sess.index + 1;
      if (nextIndex >= sess.queue.length) {
        setDeckSession({ ...sess, summary, finished: true });
      } else {
        setDeckSession({ ...sess, index: nextIndex, summary });
        enterDeckItem(nextIndex);
      }
    }
  },
  [activeForm, resolveDeckItem, enterDeckItem, clearCanvas],
);

advanceDeckRef.current = advanceDeck;

const exitDeckSession = useCallback(() => {
  setDeckSession(null);
  setFeedback(null);
  setShowComparison(false);
  setShowHistory(false);
  clearCanvas();
}, [clearCanvas]);
```

- [ ] **Step 5: Add the Review tab sub-nav + DeckManager render**

Find the "Review dashboard" block (line 1746-1814). Change line 1747 from:

```jsx
      {practiceMode === "review" && !reviewSession && (
```

to:

```jsx
      {practiceMode === "review" && !reviewSession && !deckSession && (
```

Immediately inside the `<div style={styles.reviewDash}>` (after the opening tag, before the `showResumePrompt` block at line 1749), insert the sub-nav:

```jsx
{
  /* Sub-nav: Auto Review vs My Decks */
}
<div style={styles.deckSubNav}>
  <button
    className="btn-form"
    style={{
      ...styles.deckSubNavBtn,
      ...(reviewSubTab === 'auto' ? styles.deckSubNavBtnActive : {}),
    }}
    onClick={() => setReviewSubTab('auto')}
    aria-pressed={reviewSubTab === 'auto'}
  >
    {t('subAutoReview')}
  </button>
  <button
    className="btn-form"
    style={{
      ...styles.deckSubNavBtn,
      ...(reviewSubTab === 'decks' ? styles.deckSubNavBtnActive : {}),
    }}
    onClick={() => setReviewSubTab('decks')}
    aria-pressed={reviewSubTab === 'decks'}
  >
    {t('subMyDecks')}
  </button>
</div>;
```

Now wrap the existing Auto Review content (the `showResumePrompt` block + `reviewHeader` + due-items grid/empty + Start button — everything from the `showResumePrompt` check through the closing `</>` at line 1812) in a `reviewSubTab === "auto"` condition, and add the DeckManager render for `reviewSubTab === "decks"` after it:

```jsx
{
  reviewSubTab === 'auto' && (
    <>
      {/* existing showResumePrompt block (lines 1749-1766) */}
      {/* existing reviewHeader + dueItems grid/empty + Start button (lines 1767-1811) */}
    </>
  );
}
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

- [ ] **Step 6: Run build to verify it exits zero**

Run: `npm run build`
Expected: Build succeeds. The deck session can now start from the UI, but AI feedback won't yet write progress for deck sessions (Task 6) and the session progress bar / summary won't render (Task 7).

- [ ] **Step 7: Commit**

```bash
git add src/components/PracticeView.jsx
git commit -m "Wire DeckManager + deck session state machine into PracticeView"
```

---

## Task 6: Wire deck session into `requestFeedback` + Next button

**Files:**

- Modify: `src/components/PracticeView.jsx`

This task makes deck sessions write to `arabic_progress` (unified), excludes deck sessions from `updateSR` (no SM-2), adds auto-advance after AI feedback, and adds a deck branch to the Next button (with skip-mode support).

- [ ] **Step 1: Update the `requestFeedback` progress-write block**

Find the `requestFeedback` function (line 1285). The progress-write block starts at line 1332:

```js
      if (practiceMode === "letters" || isNumbersMode || isDiacriticsMode || reviewSessionRef.current) {
```

Replace the entire block from line 1332 through line 1359 (the closing `}` of the `if` block, before `setFeedback({ text: cleanText, score });` at line 1360) with:

```js
const inDeck = !!deckSessionRef.current;
const progressName = practiceMode === 'words' && inDeck ? currentWord.word : letter.name;
const progressForm = practiceMode === 'words' && inDeck ? 'word' : activeForm;
if (
  practiceMode === 'letters' ||
  isNumbersMode ||
  isDiacriticsMode ||
  reviewSessionRef.current ||
  inDeck
) {
  if (!countedDrawingRef.current) {
    countedDrawingRef.current = true;
    markPracticed(progressName, progressForm);
  }
  if (score) {
    const inReview = !!reviewSessionRef.current;
    const onTime = !inReview || isReviewOnTime(progressName, progressForm);
    setScore(progressName, progressForm, score);
    // SM-2 scheduling only for non-deck paths (regular practice +
    // Auto Review). Deck sessions are full-pass, no SM-2.
    if (!inDeck) {
      updateSR(progressName, progressForm, score);
    }
    addXP(XP_AWARDS.SCORE[score] || 0, 'score');
    if (inReview && onTime) addXP(XP_AWARDS.REVIEW_ON_TIME, 'review-on-time');
    if (score >= 4) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 850);
      if (soundEnabled) playSuccessTone();
    }
  }
  addFeedbackEntry(progressName, progressForm, cleanText);
  setProgressVersion(v => v + 1);
}
```

- [ ] **Step 2: Add deck-session auto-advance**

Find the existing auto-advance block (lines 1362-1370):

```js
if (score && reviewSessionRef.current && !reviewSessionRef.current.finished) {
  setTimeout(() => {
    advanceReviewRef.current?.(score);
  }, 1400);
}
```

Immediately after it, add the parallel deck-session auto-advance:

```js
if (score && deckSessionRef.current && !deckSessionRef.current.finished) {
  setTimeout(() => {
    advanceDeckRef.current?.(score);
  }, 1400);
}
```

- [ ] **Step 3: Add a deck branch to the Next button**

Find the Next button's `onClick` (line 2314-2336). Replace the entire `onClick` handler with a version that adds a `deckSession` branch FIRST (deck sessions and review sessions are mutually exclusive via the conflict guard in `startDeckSession`):

```js
              onClick={() => {
                if (deckSession) {
                  if (apiKey === "skip") {
                    const sess = deckSessionRef.current;
                    if (sess && !sess.finished && strokesRef.current.length > 0) {
                      const item = sess.queue[sess.index];
                      const resolved = resolveDeckItem(item);
                      if (resolved) {
                        const pName = resolved.practiceMode === "words" ? resolved.name : resolved.obj.name;
                        const pForm = resolved.practiceMode === "words" ? "word" : activeForm;
                        if (!countedDrawingRef.current) {
                          countedDrawingRef.current = true;
                          markPracticed(pName, pForm);
                        }
                        addFeedbackEntry(pName, pForm, t("reviewSelfAssessed"));
                        addXP(XP_AWARDS.PRACTICE, "practice");
                        setProgressVersion(v => v + 1);
                      }
                    }
                  }
                  advanceDeckRef.current?.();
                } else if (reviewSession) {
                  if (apiKey === "skip") {
                    const sess = reviewSessionRef.current;
                    if (sess && !sess.finished && strokesRef.current.length > 0) {
                      const item = sess.queue[sess.index];
                      const onTime = isReviewOnTime(item.letterName, item.formKey);
                      markPracticed(item.letterName, item.formKey);
                      updateSR(item.letterName, item.formKey, 3);
                      addFeedbackEntry(item.letterName, item.formKey, t("reviewSelfAssessed"));
                      addXP(XP_AWARDS.REVIEW_SELF, "review-self");
                      if (onTime) addXP(XP_AWARDS.REVIEW_ON_TIME, "review-on-time");
                      setProgressVersion(v => v + 1);
                    }
                  }
                  advanceReviewRef.current?.();
                } else if (practiceMode === "words") {
                  const total = currentWordGroup.words.length;
                  selectWord(wordGroupIndex, (wordIndex + 1) % total);
                } else {
                  selectLetter((letterIndex + 1) % totalCount);
                }
              }}
```

- [ ] **Step 4: Run build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/PracticeView.jsx
git commit -m "Wire deck session into AI feedback + Next button"
```

---

## Task 7: Render deck session UI

**Files:**

- Modify: `src/components/PracticeView.jsx`

This task renders the deck session progress bar + summary screen, parallel to the existing `reviewSession` UI, and updates the "practice UI hidden" guard so the canvas shows during a deck session.

- [ ] **Step 1: Update the "practice UI hidden" guard**

Find line 1829:

```jsx
      {((practiceMode !== "review" && practiceMode !== "stats") ||
        reviewSession) && (
```

Change to also show during a deck session:

```jsx
      {((practiceMode !== "review" && practiceMode !== "stats") ||
        reviewSession ||
        deckSession) && (
```

- [ ] **Step 2: Add the deck session progress bar**

Find the review-session progress bar (lines 1832-1873), which renders when `reviewSession && !reviewSession.finished`. Immediately after that block's closing `)}` (line 1873), add the parallel deck-session progress bar:

```jsx
{
  deckSession && !deckSession.finished && (
    <div style={{ width: '100%', maxWidth: 520, padding: '8px 12px' }}>
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
        <button
          className="btn-clear"
          onClick={exitDeckSession}
          style={{ fontSize: 12, padding: '4px 10px' }}
        >
          Exit
        </button>
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

- [ ] **Step 3: Add the deck session summary screen**

Find the review-session summary screen (lines 1875-1947), which renders when `reviewSession?.finished`. Immediately after that block's closing `)}` (line 1947), add the parallel deck-session summary:

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
      <p
        style={{
          fontSize: 14,
          color: 'var(--color-text-soft)',
          marginBottom: 12,
        }}
      >
        {t('deckSessionReviewed')} {deckSession.summary.length} {t('deckSessionItems')}.
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
              alignItems: 'center',
              gap: 4,
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
          >
            {entry.letterChar}
            {entry.skipped ? (
              <span style={{ fontSize: 10, opacity: 0.6 }}>—</span>
            ) : (
              <span style={{ fontSize: 11, opacity: 0.8 }}>★{entry.score}</span>
            )}
          </span>
        ))}
      </div>
      <button className="btn-nav" onClick={exitDeckSession} style={styles.btn}>
        {t('deckDone')}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/PracticeView.jsx
git commit -m "Render deck session progress bar + summary screen"
```

---

## Task 8: Diacritics routing fix + conflict guard for Auto Review

**Files:**

- Modify: `src/components/PracticeView.jsx`

This task fixes the pre-existing bug where `enterReviewItem`/`goToReviewItem` silently no-op on diacritics (they only handle `Num`-prefixed names), and adds the reverse conflict guard so Auto Review can't start during a deck session (the deck→auto guard was already added in Task 5's `startDeckSession`).

- [ ] **Step 1: Fix `enterReviewItem` to handle diacritics**

Find `enterReviewItem` (line 1091-1116). It currently has a `letterName.startsWith("Num")` branch and an `else` (letters) branch. Add a `Diacritic`-prefix branch. Replace the body of the `useCallback` (lines 1092-1114) with:

```js
    (letterName, formKey) => {
      if (letterName.startsWith("Num")) {
        const numIdx = NUMBERS.findIndex((n) => n.name === letterName);
        if (numIdx === -1) return;
        setLetterIndex(numIdx);
        setFormIndex("isolated");
      } else if (letterName.startsWith("Diacritic")) {
        const diaIdx = DIACRITICS.findIndex((d) => d.name === letterName);
        if (diaIdx === -1) return;
        setLetterIndex(diaIdx);
        setFormIndex("isolated");
      } else {
        const alphIdx = LETTERS.findIndex((l) => l.name === letterName);
        if (alphIdx === -1) return;
        if (lessonMode) {
          const lessonIdx = lessonToAlpha.indexOf(alphIdx);
          setLetterIndex(lessonIdx !== -1 ? lessonIdx : 0);
        } else {
          setLetterIndex(alphIdx);
        }
        setFormIndex(formKey);
      }
      setFeedback(null);
      setShowComparison(false);
      setShowHistory(false);
      alphaBtnRefs.current = [];
      clearCanvas();
    },
```

The deps array (line 1115) stays `[lessonMode, lessonToAlpha, clearCanvas]` — `DIACRITICS` is a module-level import, not a dep.

- [ ] **Step 2: Fix `goToReviewItem` to handle diacritics**

Find `goToReviewItem` (line 1159-1192). It currently has a `Num` branch (with `setPracticeMode("numbers")`) and an else (letters) branch. Add a `Diacritic` branch. Replace the body (lines 1160-1190) with:

```js
    (letterName, formKey) => {
      // Numerals (name prefixed "Num") live in NUMBERS, not the alphabet.
      if (letterName.startsWith("Num")) {
        const numIdx = NUMBERS.findIndex((n) => n.name === letterName);
        if (numIdx === -1) return;
        setLetterIndex(numIdx);
        setFormIndex("isolated");
        setPracticeMode("numbers");
        setFeedback(null);
        setShowComparison(false);
        setShowHistory(false);
        alphaBtnRefs.current = [];
        clearCanvas();
        return;
      }
      // Diacritics (name prefixed "Diacritic") live in DIACRITICS.
      if (letterName.startsWith("Diacritic")) {
        const diaIdx = DIACRITICS.findIndex((d) => d.name === letterName);
        if (diaIdx === -1) return;
        setLetterIndex(diaIdx);
        setFormIndex("isolated");
        setPracticeMode("diacritics");
        setFeedback(null);
        setShowComparison(false);
        setShowHistory(false);
        alphaBtnRefs.current = [];
        clearCanvas();
        return;
      }
      const alphIdx = LETTERS.findIndex((l) => l.name === letterName);
      if (alphIdx === -1) return;
      if (lessonMode) {
        const lessonIdx = lessonToAlpha.indexOf(alphIdx);
        setLetterIndex(lessonIdx !== -1 ? lessonIdx : 0);
      } else {
        setLetterIndex(alphIdx);
      }
      setFormIndex(formKey);
      setPracticeMode("letters");
      setFeedback(null);
      setShowComparison(false);
      setShowHistory(false);
      alphaBtnRefs.current = [];
      clearCanvas();
    },
```

- [ ] **Step 3: Add conflict guard to `startReviewSession`**

Find `startReviewSession` (line 1118-1128). Add a guard at the top that no-ops if a deck session is active:

```js
const startReviewSession = useCallback(() => {
  if (deckSessionRef.current) return; // can't start auto review during a deck session
  if (!dueItems.length) return;
  const queue = dueItems.slice();
  // Fisher-Yates shuffle
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  setReviewSession({ queue, index: 0, summary: [] });
  enterReviewItem(queue[0].letterName, queue[0].formKey);
}, [dueItems, enterReviewItem]);
```

- [ ] **Step 4: Run build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/PracticeView.jsx
git commit -m "Fix diacritics review routing + add auto-review conflict guard"
```

---

## Task 9: Update AGENTS.md + final build + Playwright verification

**Files:**

- Modify: `AGENTS.md`

- [ ] **Step 1: Add `arabic_decks` to the localStorage keys list**

Find line 73 in `AGENTS.md` (the `Keys:` line). Add `arabic_decks` (decks JSON) to the list. Change:

```
Keys: `openrouter_key` (API key), `openrouter_model` (model ID), `brushScale` (brush size), `lessonMode` (`"true"`/`"false"`), `app_locale` (`"en"`/`"ar"`), `app_darkMode` (`"true"`/`"false"`), `arabic_progress` (SM-2 progress JSON), `arabic_feedback_history` (last 5 entries JSON). Renaming silently loses user data.
```

to:

```
Keys: `openrouter_key` (API key), `openrouter_model` (model ID), `brushScale` (brush size), `lessonMode` (`"true"`/`"false"`), `app_locale` (`"en"`/`"ar"`), `app_darkMode` (`"true"`/`"false"`), `arabic_progress` (SM-2 progress JSON), `arabic_feedback_history` (last 5 entries JSON), `arabic_decks` (user study decks JSON). Renaming silently loses user data.
```

- [ ] **Step 2: Note the new component + util + words-as-progress**

Find the `src/components/` line in the "Architecture & Data Flow" section (around line 20). Change:

```
- `src/components/`: `LoginScreen.jsx` (API key/skip), `PracticeView.jsx` (main UI, canvas, drawing, nav, AI feedback, ~1100 lines).
```

to:

```
- `src/components/`: `LoginScreen.jsx` (API key/skip), `PracticeView.jsx` (main UI, canvas, drawing, nav, AI feedback), `DeckManager.jsx` (presentational deck list/editor/picker, Review sub-tab).
```

Find the `src/utils/` line (around line 23). Change:

```
- `src/utils/`: `api.js` (OpenRouter vision), `drawing.js` (pressure/brush), `progress.js` (SM-2), `history.js` (feedback history).
```

to:

```
- `src/utils/`: `api.js` (OpenRouter vision), `drawing.js` (pressure/brush), `progress.js` (SM-2), `history.js` (feedback history), `decks.js` (study deck CRUD).
```

In the "AI Integration & Spaced Repetition (SM-2)" section, after the bullet about `markPracticed` → `setScore` → `updateSR` → `addFeedbackEntry`, add:

```
- **Words are first-class progress entries** when practiced via a deck session:
  `name` = the Arabic word string, `formKey` = `"word"`. Word strings (Arabic)
  never collide with letter/number/diacritic names (romanized). **Deck sessions
  do NOT call `updateSR`** — they're full-pass, no SM-2. Only regular practice
  and Auto Review use SM-2 scheduling.
```

- [ ] **Step 3: Run the final build**

Run: `npm run build`
Expected: Build succeeds and exits zero. The post-build `scripts/bust-sw.js` runs and bumps the SW cache (don't manually edit `sw.js`).

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "Document arabic_decks key, DeckManager, words-as-progress"
```

- [ ] **Step 5: Manual Playwright verification**

Run `npm run dev` and use the Playwright MCP tools (`browser_navigate` to `localhost:5173`, `browser_snapshot`, `browser_take_screenshot`) to verify each flow. For each, take a screenshot showing the result:

1. **Deck CRUD:** Review tab → "My Decks" sub-tab → "New Deck" → rename it → confirm it appears in the list.
2. **Item picker:** Edit a deck → "Add Items" → add a letter (Ba), a number (Num3), a diacritic (DiacriticFatha), and a word (سلام) → confirm they appear in the editor with glyphs + labels.
3. **Reorder + remove:** In the editor, use ↑/↓ to reorder, ✕ to remove an item → confirm the order/contents update.
4. **Empty deck session:** Click "Start Session" on an empty deck → confirm it's disabled (button `disabled`).
5. **Full session:** Start a session on a deck with the 4 items above → confirm the progress bar shows "Item 1/4" → draw + submit AI feedback (or use Skip mode) → confirm auto-advance after 1.4s → for the letter item, confirm form cycling (the progress shows "form 1/4" → "form 2/4" etc.).
6. **Session complete:** Finish the session → confirm the summary screen shows per-item ★/— chips + "Done" button → click Done → confirm return to the Decks sub-tab.
7. **Words write to progress:** After a word item in a deck session, check the Stats tab heatmap reflects the word practice (the word's progress entry now exists in `arabic_progress`).
8. **Cross-tab storage:** Open a second browser tab → create a deck in tab 1 → confirm it appears in tab 2 without a refresh (the `storage` listener bumps `decksVersion`).
9. **RTL + dark mode:** Toggle Arabic locale + dark mode → confirm the DeckManager renders RTL with dark-mode CSS vars.
10. **Diacritics routing fix:** Practice a diacritic with AI feedback, then check the Auto Review dashboard — if the diacritic is due, confirm clicking it navigates correctly (no silent no-op).
11. **Conflict guard:** Start a deck session → switch to Auto Review sub-tab → click "Start Review Session" → confirm it no-ops (the deck session continues).

- [ ] **Step 6: Commit any Playwright-followup fixes if needed**

If any flow fails, fix the code and re-run `npm run build` before committing. Use the systematic-debugging skill if a bug is non-trivial.

---

## Self-Review Notes

**Spec coverage check:**

- Named decks, all user-created, no automation → Tasks 1, 4, 5 (no SM-2 in deck path — Task 6 gates `updateSR` on `!inDeck`).
- Full-pass session semantics → Task 5 (`advanceDeck` walks the whole queue).
- Per-letter (all forms cycle) → Task 5 Step 4 (form cycling in `advanceDeck`).
- Keep Auto Review side-by-side → Task 5 Step 5 (sub-nav preserves Auto Review).
- Sub-section inside Review tab → Task 5 Step 5.
- Items in multiple decks → Task 1 (`addDeckItem` is per-deck, no uniqueness constraint).
- No mastery flag → no mastery code anywhere in the plan. ✓
- Unified progress (writes to `arabic_progress`) → Task 6 Step 1.
- Words as first-class → Task 6 Step 1 (`progressName`/`progressForm` for words).
- `DeckManager` extracted → Task 4.
- Diacritics routing fix → Task 8 Steps 1-2.
- `arabic_decks` in backups → Task 1 Step 2.
- AGENTS.md updates → Task 9.

**Placeholder scan:** None — all code blocks are complete.

**Type consistency:** `resolveDeckItem` returns `{ glyph, name, roman, formKeys, practiceMode, obj }` consistently across Tasks 4 (DeckManager display-only uses a separate `resolveDisplay`), 5, 6, 7. `deckSession` shape is consistent: `{ deckId, deckName, queue, index, summary, finished }`. `DeckManager` props match the handlers defined in Task 5. `advanceDeckRef.current = advanceDeck` mirrors the existing `advanceReviewRef` pattern. Each task produces a build that exits zero and can be committed independently.
