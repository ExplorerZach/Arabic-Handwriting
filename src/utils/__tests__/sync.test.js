import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  pushToCloud,
  pullFromCloud,
  initialSync,
  syncNow,
  isInitialSyncDone,
  resetInitialSync,
  isDirty,
  clearSyncableData,
  hasLocalLearningData,
} from '../sync.js';

// Controllable fake Supabase client. `from()` routes by method so tests can
// swap behavior per case.
let mockUpsert;
let mockSelectResult;
let mockDeleteResult;

vi.mock('../supabase.js', () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }),
    },
    from: () => ({
      upsert: (rows, opts) => mockUpsert(rows, opts),
      select: () => ({ eq: async () => mockSelectResult }),
      delete: () => ({ eq: async () => mockDeleteResult }),
    }),
  }),
}));

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetInitialSync();
  mockUpsert = async () => ({ error: null });
  mockSelectResult = { data: [], error: null };
  mockDeleteResult = { error: null };
});

describe('pushToCloud', () => {
  it('stores plain-string scalars as strings, not {}', async () => {
    localStorage.setItem('app_locale', 'en');
    localStorage.setItem('app_theme', 'parchment');
    let captured;
    mockUpsert = async rows => {
      captured = rows;
      return { error: null };
    };

    await pushToCloud();

    const locale = captured.find(r => r.key === 'app_locale');
    const theme = captured.find(r => r.key === 'app_theme');
    expect(locale.value).toBe('en');
    expect(theme.value).toBe('parchment');
  });

  it('uses _v as the row version for versioned keys', async () => {
    localStorage.setItem('arabic_progress', JSON.stringify({ _v: 7, Ha: { isolated: {} } }));
    let captured;
    mockUpsert = async rows => {
      captured = rows;
      return { error: null };
    };

    await pushToCloud();

    expect(captured.find(r => r.key === 'arabic_progress').version).toBe(7);
  });

  it('marks dirty on failure and clears dirty on success', async () => {
    localStorage.setItem('arabic_xp', JSON.stringify({ _v: 2, total: 10 }));
    mockUpsert = async () => ({ error: new Error('network') });

    await pushToCloud();
    expect(isDirty()).toBe(true);

    mockUpsert = async () => ({ error: null });
    await pushToCloud();
    expect(isDirty()).toBe(false);
  });
});

describe('pullFromCloud', () => {
  it('restores jsonb scalar strings verbatim', async () => {
    mockSelectResult = {
      data: [{ key: 'app_theme', value: 'parchment', version: 1 }],
      error: null,
    };

    const res = await pullFromCloud();

    expect(res.ok).toBe(true);
    expect(res.applied).toBe(1);
    expect(localStorage.getItem('app_theme')).toBe('parchment');
  });

  it('applies remote only when remote version is strictly higher', async () => {
    localStorage.setItem('arabic_progress', JSON.stringify({ _v: 5, old: true }));
    mockSelectResult = {
      data: [{ key: 'arabic_progress', value: { _v: 3, newer: true }, version: 3 }],
      error: null,
    };

    let res = await pullFromCloud();
    expect(res.applied).toBe(0);
    expect(JSON.parse(localStorage.getItem('arabic_progress')).old).toBe(true);

    mockSelectResult = {
      data: [{ key: 'arabic_progress', value: { _v: 9, newer: true }, version: 9 }],
      error: null,
    };
    res = await pullFromCloud();
    expect(res.applied).toBe(1);
    expect(JSON.parse(localStorage.getItem('arabic_progress')).newer).toBe(true);
  });

  it('dispatches a storage event per applied key so module caches invalidate', async () => {
    const seen = [];
    const listener = e => seen.push(e.key);
    window.addEventListener('storage', listener);
    mockSelectResult = {
      data: [{ key: 'arabic_xp', value: { _v: 4, total: 42 }, version: 4 }],
      error: null,
    };

    await pullFromCloud();
    window.removeEventListener('storage', listener);

    expect(seen).toContain('arabic_xp');
  });

  it('reports ok:false on error', async () => {
    mockSelectResult = { data: null, error: new Error('down') };
    const res = await pullFromCloud();
    expect(res.ok).toBe(false);
  });
});

describe('initialSync / queue', () => {
  it('is gated per user until the first pull→push completes', async () => {
    expect(isInitialSyncDone('user-1')).toBe(false);
    await initialSync('user-1');
    expect(isInitialSyncDone('user-1')).toBe(true);
    expect(isInitialSyncDone('other-user')).toBe(false);
  });

  it('skips the push leg when pushLocal is false', async () => {
    let pushed = false;
    mockUpsert = async () => {
      pushed = true;
      return { error: null };
    };
    mockSelectResult = { data: [], error: null };

    await initialSync('user-1', { pushLocal: false });
    expect(pushed).toBe(false);
    expect(isInitialSyncDone('user-1')).toBe(true);
  });

  it('does not mark synced when the pull fails', async () => {
    mockSelectResult = { data: null, error: new Error('offline') };

    await initialSync('user-1');
    expect(isInitialSyncDone('user-1')).toBe(false);
    expect(isDirty()).toBe(true);
  });

  it('serializes concurrent operations through the queue', async () => {
    localStorage.setItem('arabic_xp', JSON.stringify({ _v: 1, total: 5 }));
    const order = [];
    mockSelectResult = { data: [], error: null };
    mockUpsert = async () => {
      order.push('push');
      return { error: null };
    };

    await Promise.all([
      initialSync('user-1').then(() => order.push('initial-done')),
      syncNow().then(() => order.push('now-done')),
    ]);

    // The queued bare push runs after the initial sync's own push.
    expect(order).toEqual(['push', 'initial-done', 'push', 'now-done']);
  });
});

describe('account-switch helpers', () => {
  it('hasLocalLearningData only cares about learning keys', () => {
    expect(hasLocalLearningData()).toBe(false);
    localStorage.setItem('app_theme', 'parchment');
    expect(hasLocalLearningData()).toBe(false);
    localStorage.setItem('arabic_progress', '{}');
    expect(hasLocalLearningData()).toBe(true);
  });

  it('clearSyncableData removes syncable keys and notifies', async () => {
    localStorage.setItem('arabic_xp', '{}');
    localStorage.setItem('app_locale', 'ar');
    localStorage.setItem('unrelated_key', 'keep');
    const seen = [];
    const listener = e => seen.push(e.key);
    window.addEventListener('storage', listener);

    clearSyncableData();
    window.removeEventListener('storage', listener);

    expect(localStorage.getItem('arabic_xp')).toBe(null);
    expect(localStorage.getItem('app_locale')).toBe(null);
    expect(localStorage.getItem('unrelated_key')).toBe('keep');
    expect(seen).toContain('arabic_xp');
    expect(seen).toContain('app_locale');
  });
});
