import { describe, it, expect, beforeEach, vi } from 'vitest';

let decks;

beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  decks = await import('../decks.js');
});

describe('createDeck / getDecks', () => {
  it('creates a deck and returns it in list', () => {
    const d = decks.createDeck('Test Deck');
    expect(d.name).toBe('Test Deck');
    expect(d.items).toEqual([]);
    const list = decks.getDecks();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(d.id);
  });

  it('defaults name to empty string', () => {
    const d = decks.createDeck();
    expect(d.name).toBe('');
  });
});

describe('renameDeck', () => {
  it('renames an existing deck', () => {
    const d = decks.createDeck('Old');
    decks.renameDeck(d.id, 'New');
    expect(decks.getDeck(d.id).name).toBe('New');
  });

  it('returns undefined for missing deck', () => {
    const result = decks.renameDeck('nonexistent', 'New');
    expect(result).toBeUndefined();
  });
});

describe('deleteDeck', () => {
  it('removes deck from list', () => {
    const d = decks.createDeck('To Delete');
    expect(decks.getDecks()).toHaveLength(1);
    decks.deleteDeck(d.id);
    expect(decks.getDecks()).toHaveLength(0);
  });
});

describe('addDeckItem / removeDeckItem', () => {
  it('adds an item to a deck', () => {
    const d = decks.createDeck('Test');
    const item = decks.addDeckItem(d.id, { type: 'letter', ref: 'Alef' });
    expect(item).not.toBeNull();
    expect(item.type).toBe('letter');
    expect(item.ref).toBe('Alef');
    expect(decks.getDeck(d.id).items).toHaveLength(1);
  });

  it('rejects invalid items', () => {
    const d = decks.createDeck('Test');
    expect(decks.addDeckItem(d.id, {})).toBeNull();
    expect(decks.addDeckItem(d.id, null)).toBeNull();
  });

  it('removes an item', () => {
    const d = decks.createDeck('Test');
    const item = decks.addDeckItem(d.id, { type: 'letter', ref: 'Ba' });
    decks.removeDeckItem(d.id, item.id);
    expect(decks.getDeck(d.id).items).toHaveLength(0);
  });
});

describe('duplicateDeck', () => {
  it('creates a copy with new ids', () => {
    const d = decks.createDeck('Original');
    decks.addDeckItem(d.id, { type: 'letter', ref: 'Alef' });
    const copy = decks.duplicateDeck(d.id);
    expect(copy.name).toBe('Original copy');
    expect(copy.id).not.toBe(d.id);
    expect(copy.items).toHaveLength(1);
    expect(copy.items[0].id).not.toBe(d.items[0].id);
    expect(copy.items[0].ref).toBe('Alef');
    expect(copy.lastSession).toBeNull();
  });

  it('returns null for missing deck', () => {
    expect(decks.duplicateDeck('nonexistent')).toBeNull();
  });
});

describe('bulkAddItems', () => {
  it('adds multiple unique items', () => {
    const d = decks.createDeck('Test');
    const count = decks.bulkAddItems(d.id, [
      { type: 'letter', ref: 'Alef' },
      { type: 'letter', ref: 'Ba' },
    ]);
    expect(count).toBe(2);
    expect(decks.getDeck(d.id).items).toHaveLength(2);
  });

  it('skips duplicates', () => {
    const d = decks.createDeck('Test');
    decks.bulkAddItems(d.id, [{ type: 'letter', ref: 'Alef' }]);
    const count = decks.bulkAddItems(d.id, [
      { type: 'letter', ref: 'Alef' },
      { type: 'letter', ref: 'Ba' },
    ]);
    expect(count).toBe(1);
    expect(decks.getDeck(d.id).items).toHaveLength(2);
  });
});

describe('restoreDeck', () => {
  it('inserts a deck and re-indexes order', () => {
    const d = decks.createDeck('Original');
    const saved = JSON.parse(JSON.stringify(d));
    decks.deleteDeck(d.id);
    expect(decks.getDecks()).toHaveLength(0);
    decks.restoreDeck(saved);
    const list = decks.getDecks();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(d.id);
  });
});

describe('reorderDeckItem', () => {
  it('moves an item within a deck', () => {
    const d = decks.createDeck('Test');
    const a = decks.addDeckItem(d.id, { type: 'letter', ref: 'Alef' });
    const b = decks.addDeckItem(d.id, { type: 'letter', ref: 'Ba' });
    decks.reorderDeckItem(d.id, 0, 1);
    const items = decks.getDeck(d.id).items;
    expect(items[0].id).toBe(b.id);
    expect(items[1].id).toBe(a.id);
  });
});
