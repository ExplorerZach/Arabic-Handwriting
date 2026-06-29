/**
 * Study decks — persisted in localStorage under 'arabic_decks'.
 *
 * Shape:
 * {
 *   decks: [
 *     {
 *       id: "deck_1700000000000_1",
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
  window.addEventListener('storage', (e) => {
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
    name: name || '',
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
  const deck = data.decks.find((d) => d.id === id);
  if (deck) {
    deck.name = name;
    save(data);
  }
  return deck;
}

/** Delete a deck by id. */
export function deleteDeck(id) {
  const data = load();
  data.decks = data.decks.filter((d) => d.id !== id);
  save(data);
}

/** Get a single deck by id (or null). */
export function getDeck(id) {
  return load().decks.find((d) => d.id === id) || null;
}

/** Add an item `{ type, ref }` to a deck; returns the added item. */
export function addDeckItem(deckId, item) {
  const data = load();
  const deck = data.decks.find((d) => d.id === deckId);
  if (!deck) return null;
  if (!item || !item.type || !item.ref) return null;
  const full = { id: uniqueId('item'), type: item.type, ref: item.ref };
  deck.items.push(full);
  save(data);
  return full;
}

/** Remove an item from a deck by item id. */
export function removeDeckItem(deckId, itemId) {
  const data = load();
  const deck = data.decks.find((d) => d.id === deckId);
  if (!deck) return;
  deck.items = deck.items.filter((it) => it.id !== itemId);
  save(data);
}

/** Move an item within a deck from fromIdx to toIdx. */
export function reorderDeckItem(deckId, fromIdx, toIdx) {
  const data = load();
  const deck = data.decks.find((d) => d.id === deckId);
  if (!deck) return;
  const items = deck.items;
  if (fromIdx < 0 || fromIdx >= items.length) return;
  if (toIdx < 0 || toIdx >= items.length) return;
  const [moved] = items.splice(fromIdx, 1);
  items.splice(toIdx, 0, moved);
  save(data);
}
