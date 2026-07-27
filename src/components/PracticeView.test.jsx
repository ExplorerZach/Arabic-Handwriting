/**
 * Regression test for the blank-page TDZ crash (2026-07-27).
 *
 * The hook-extraction refactor left the canvas-sizing useEffect above the
 * useReviewSession() call while its deps array reads `rsReviewSession` — a
 * const still in the temporal dead zone. The first render threw
 * "ReferenceError: Cannot access 'z' before initialization", React unmounted
 * the whole tree, and production showed nothing but the background color.
 *
 * Mounting PracticeView exactly as App.jsx does fails this test if ANY
 * initialization error is thrown during render or mount effects.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PracticeView from './PracticeView';

beforeAll(() => {
  // jsdom lacks browser APIs the mount path touches unconditionally:

  // - canvas sizing effect constructs `new ResizeObserver(...)`
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // - useDrawing subscribes to resolution changes on mount
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  }));

  // - usePrefs → useDownloadLinks fetches GitHub releases on mount; keep the
  //   promise pending so no network happens and no state update lands after
  //   the test finishes.
  vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

  // - jsdom's canvas getContext returns null and logs "not implemented";
  //   redraw paths expect a 2D context object.
  const ctx2d = new Proxy(
    {},
    {
      get: (target, prop) => (prop in target ? target[prop] : () => {}),
      set: () => true,
    },
  );
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(ctx2d);
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

function renderPracticeView(overrides = {}) {
  const props = {
    apiKey: '',
    onSetKey: vi.fn(),
    onClearKey: vi.fn(),
    locale: 'en',
    darkMode: false,
    onToggleDarkMode: vi.fn(),
    onToggleLocale: vi.fn(),
    user: null,
    authLoading: false,
    onSignOut: vi.fn(),
    ...overrides,
  };
  return render(<PracticeView {...props} />);
}

describe('PracticeView mount (TDZ regression)', () => {
  it('mounts without throwing any initialization error', () => {
    expect(() => renderPracticeView()).not.toThrow();
  });

  it('renders the practice UI (canvas + app title)', () => {
    renderPracticeView();
    expect(document.getElementById('main-canvas')).toBeInTheDocument();
    expect(screen.getByText('Arabic Script Practice')).toBeInTheDocument();
  });

  it('mounts cleanly in dark mode with Arabic locale', () => {
    expect(() => renderPracticeView({ darkMode: true, locale: 'ar' })).not.toThrow();
  });
});
