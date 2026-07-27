# Handoff — PracticeView Refactoring

## Summary

PracticeView.jsx was refactored from ~2868 lines to ~2390 lines by extracting its logic
into 8 custom hooks under `src/hooks/`. Each hook owns a self-contained domain; the
parent component wires them together via props and ref bridges.

## The 8 Hooks

| #   | Hook               | Lines | Owns                                                                                 |
| --- | ------------------ | ----- | ------------------------------------------------------------------------------------ |
| 1   | `usePrefs`         | ~150  | brush/theme/sound/model/daily-goal state, handlers, download links, xpGain/timeout   |
| 2   | `useDrawing`       | ~220  | canvas, strokes, pointer events, undo, redraw, clearCanvas, hasStrokes               |
| 3   | `useExport`        | ~140  | saveDrawing (PNG download / Tauri file save), shareDrawing, exportCanvas (AI JPEG)   |
| 4   | `useAIFeedback`    | ~150  | feedback state, loading, consent dialog, requestFeedback, giveConsent, revokeConsent |
| 5   | `useAnimation`     | ~365  | stroke-order animation, ghost glyph overlay, requestAnimationFrame lifecycle         |
| 6   | `useReviewSession` | ~260  | SM-2 review session, due-item queue, snooze, sessionStorage stash/resume             |
| 7   | `useDeckSession`   | ~260  | deck practice session, resolveDeckItem, advanceDeck, lastSession persistence         |
| 8   | `useSyncConflict`  | ~65   | account-switch conflict detection, initial sync, connectivity retry                  |

## Hook Call Order

```
restGlyphRef, alphaBtnRef, …  (refs)
letterIndex, formIndex, …     (states)
useDrawing()                  (Hook 2 — needs addXPRef, setProgressVersionRef bridges)
usePrefs()                    (Hook 1 — needs redrawRef, setRestingGlyphRef bridges)
progressVersion               (state)
userId, needsConflictPrompt   (derived)
useSyncConflict()             (Hook 8)
reviewSessionRef, advanceReviewRef  (refs, owned by Hooks 6)
deckSessionRef, advanceDeckRef      (refs, owned by Hooks 7)
useExport()                   (Hook 3)
useAIFeedback()               (Hook 4 — needs eExportCanvas, reviewSessionRef, advanceReviewRef, deckSessionRef, advanceDeckRef)
useAnimation()                (Hook 5 — needs setFeedbackRef, setRestingGlyphRef bridges)
useReviewSession()            (Hook 6 — after dClearCanvas, dueItems, setProgressVersion)
useDeckSession()              (Hook 7 — after useReviewSession)
```

## Ref Bridge Pattern

Hooks called _earlier_ in the order sometimes need values produced by hooks called
_later_. Since React hook order is fixed, the parent defines a `useRef(null)` bridge
**before** all hooks, passes the ref to both the consumer (early hook) and the
producer (late hook), and the producer wires `ref.current = value` (either via
`useEffect` or direct assignment at call time).

| Ref Bridge              | Consumer(s)                       | Producer         | Purpose                                                                     |
| ----------------------- | --------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `redrawRef`             | usePrefs                          | useDrawing       | handlers trigger redraw                                                     |
| `addXPRef`              | useDrawing                        | practiceView     | handlePointerUp awards XP                                                   |
| `setProgressVersionRef` | useDrawing                        | practiceView     | handlePointerUp bumps version                                               |
| `setFeedbackRef`        | useDrawing, useAnimation          | useAIFeedback    | clear feedback on clearCanvas / animation start                             |
| `setRestingGlyphRef`    | useDrawing, usePrefs              | useAnimation     | clear resting glyph on new strokes / template change                        |
| `restGlyphRef`          | useDrawing, usePrefs              | useAnimation     | shared resting-glyph bitmap — read in redraw(), written by animation finish |
| `exitReviewSessionRef`  | practiceView (switchPracticeMode) | useReviewSession | clear review session on mode switch                                         |
| `setDeckSessionRef`     | practiceView (switchPracticeMode) | useDeckSession   | clear deck session on mode switch                                           |
| `reviewSessionRef`      | useAIFeedback                     | useReviewSession | AI feedback reads active session state                                      |
| `advanceReviewRef`      | useAIFeedback, Next button JSX    | useReviewSession | advance to next review item                                                 |
| `deckSessionRef`        | useAIFeedback                     | useDeckSession   | AI feedback reads active deck state                                         |
| `advanceDeckRef`        | useAIFeedback, Next button JSX    | useDeckSession   | advance to next deck item                                                   |

## Naming Convention

Hook return values are destructured with a 2–4 character prefix to avoid collisions
and satisfy the `react-hooks/immutability` lint rule:

| Prefix | Hook                                                                 |
| ------ | -------------------------------------------------------------------- |
| `d`    | useDrawing (e.g. `dCanvasRef`, `dClearCanvas`)                       |
| `e`    | useExport (e.g. `eSaveDrawing`, `eExportCanvas`)                     |
| `ai`   | useAIFeedback (e.g. `aiFeedback`, `aiRequestFeedback`)               |
| `anim` | useAnimation (e.g. `animAnimating`, `animPlayStrokeAnimation`)       |
| `rs`   | useReviewSession (e.g. `rsReviewSession`, `rsStartReviewSession`)    |
| `ds`   | useDeckSession (e.g. `dsDeckSession`, `dsResolveDeckItem`)           |
| `sc`   | useSyncConflict (e.g. `scConflictPromptOpen`, `scSetConflictChoice`) |

`usePrefs` exports many individual values with plain names (no prefix) since it's
called first and doesn't need collision avoidance.

## What Stays in the Parent

- **ResizeObserver effect** — depends on `reviewSession` (owned by a later hook).
- **Theme/brush sync effect** — bridges `usePrefs` state (`brushPack`, `paperTheme`)
  to `useDrawing` refs (`dDarkModeRef`, `dBrushColorRef`, `dPaperThemeRef`).
- **Deck CRUD handlers** (create, rename, delete, copy, reorder, add/remove items).
- **Alphabet navigation** (selectLetter, selectForm, toggleLessonMode).
- **`addXP` callback** and its ref wiring.
- **Import/export/wipe** handlers.

## Imports Removed from PracticeView

| Import                                                           | Moved to                            |
| ---------------------------------------------------------------- | ----------------------------------- |
| `setBrushScale`                                                  | `usePrefs`                          |
| `getDailyGoal`, `setDailyGoal`                                   | `usePrefs`                          |
| `useDownloadLinks`                                               | `usePrefs`                          |
| `DEFAULT_MODEL`                                                  | `usePrefs`                          |
| `calcLineWidth`                                                  | `useDrawing`                        |
| `markDayActive`                                                  | `useDrawing`                        |
| `XP_AWARDS`                                                      | `useDrawing`                        |
| `getBrushColor`, `drawPaperPattern`                              | `useDrawing` + `useAnimation`       |
| `getCanvasInkColor`                                              | `useAnimation`                      |
| `isTauri`                                                        | `useExport`                         |
| `getAIFeedback`                                                  | `useAIFeedback`                     |
| `FORM_FULL`                                                      | `useAIFeedback`                     |
| `removeItem`                                                     | `useAIFeedback` (for revokeConsent) |
| `setScore`                                                       | `useAIFeedback`                     |
| `playSuccessTone`                                                | `useAIFeedback`                     |
| `snoozeDue`, `snoozeAllDue`                                      | `useReviewSession`                  |
| `setLastSession`                                                 | `useDeckSession`                    |
| `todayLocal`                                                     | `useDeckSession`                    |
| `initialSync`, `resetInitialSync`, `isInitialSyncDone`           | `useSyncConflict`                   |
| `getLastSyncUserId`, `hasLocalLearningData`, `clearSyncableData` | `useSyncConflict`                   |

## Verification

```bash
npm run lint && npm run typecheck && npm run test:run && npm run build
```

All four exit zero (54 tests pass, build produces 119 modules).
