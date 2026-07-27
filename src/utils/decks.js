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

import { getItem, setItem } from './storage.js';

const STORAGE_KEY = 'arabic_decks';

let cache = null;
let idCounter = 0;

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
    cache = JSON.parse(getItem(STORAGE_KEY) || '{"decks":[]}');
    cache = migrate(cache);
  } catch {
    cache = migrate({ decks: [] });
  }
  if (cache._v === undefined) {
    cache._v = 1;
    setItem(STORAGE_KEY, JSON.stringify(cache));
  }
  return cache;
}

function save(data) {
  data._v = (data._v || 0) + 1;
  cache = data;
  setItem(STORAGE_KEY, JSON.stringify(data));
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
  return load()
    .decks.slice()
    .sort((a, b) => a.order - b.order);
}

/** Create a new empty deck and return it. */
export function createDeck(name) {
  const data = load();
  const deck = {
    id: uniqueId('deck'),
    name: name || '',
    createdAt: new Date().toISOString(),
    order: data.decks.length,
    items: [],
    lastSession: null,
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
  if (!item || !item.type || !item.ref) return null;
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

/** Write the last completed session result onto a deck. */
export function setLastSession(deckId, session) {
  const data = load();
  const deck = data.decks.find(d => d.id === deckId);
  if (!deck) return;
  deck.lastSession = session;
  save(data);
}

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
