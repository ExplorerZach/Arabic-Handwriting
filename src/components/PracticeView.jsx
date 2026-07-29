import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { LETTERS } from '../data/letters';
import { NUMBERS } from '../data/numbers';
import { DIACRITICS } from '../data/diacritics';
import { LESSON_ORDER, getLessonGroup } from '../data/lessonOrder';
import {
  markPracticed,
  countCompleted,
  updateSR,
  getDueLetters,
  getProgressSummary,
  getProgress,
  isReviewOnTime,
} from '../utils/progress';
import { addFeedbackEntry, getFeedbackHistory } from '../utils/history';
import { exportBackup, importBackupFile, wipeAllData } from '../utils/backup';
import STROKE_DATA from '../data/strokeOrder';
import { WORD_GROUPS } from '../data/words';
import { UI, FORM_NAMES, FORM_SHORT, FORM_DESCRIPTIONS } from '../locales';
import { getPaperColors, getBrushColor } from '../styles/themes';
import styles from '../styles/practiceStyles';
import AnalyticsPanel from './AnalyticsPanel';
import LoginScreen from './LoginScreen';
import DailyGoalRing from './DailyGoalRing';
import SettingsPanel from './SettingsPanel';
import { getTodayProgress } from '../utils/dailyGoal';
import { getXPTotal, awardXP, XP_AWARDS } from '../utils/xp';
import LevelBadge from './LevelBadge';
import XpGainToast from './XpGainToast';
import UndoToast from './UndoToast';
import DeckManager from './DeckManager';

import { getItem, setItem } from '../utils/storage';
import usePrefs from '../hooks/usePrefs';
import useDrawing from '../hooks/useDrawing';
import useExport from '../hooks/useExport';
import useAIFeedback from '../hooks/useAIFeedback';
import useAnimation from '../hooks/useAnimation';
import useReviewSession from '../hooks/useReviewSession';
import useDeckSession from '../hooks/useDeckSession';
import useSyncConflict from '../hooks/useSyncConflict';
import { deleteCloudData } from '../utils/sync';
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
  bulkAddItems,
  restoreDeck,
} from '../utils/decks';

const SCORE_LABELS = {
  5: 'feedbackScoreExcellent',
  4: 'feedbackScoreGreat',
  3: 'feedbackScoreGood',
  2: 'feedbackScoreKeep',
  1: 'feedbackScoreStart',
};

export default function PracticeView({
  apiKey,
  onSetKey,
  onClearKey,
  locale,
  darkMode,
  onToggleDarkMode,
  onToggleLocale,
  user,
  authLoading,
  onSignOut,
}) {
  // Holds the fully-revealed glyph bitmap left on screen after a "Show me"
  // animation finishes (when the user has no strokes of their own). redraw()
  // re-blits this so layout reflows / ResizeObserver repaints don't wipe the
  // finished letter. Cleared on any draw / clear / navigation.
  const restGlyphRef = useRef(null);
  // In-canvas ghost template bridge — { text, fontSizePx, color } synced by an
  // effect below; redraw() paints it so the canvas can own an opaque paper
  // background without covering an HTML ghost overlay.
  const ghostRef = useRef(null);
  const alphaBtnRef = useRef([]);
  // Hidden <input type=file> used by the Settings "Import progress" button.
  const importInputRef = useRef(null);
  const redrawRef = useRef(null);
  // Ref bridges for values defined later in the component (addXP,
  // setProgressVersion) that the drawing hook needs via pointer handlers.
  const addXPRef = useRef(null);
  const setProgressVersionRef = useRef(null);
  const setFeedbackRef = useRef(null);
  const setRestingGlyphRef = useRef(null);
  const exitReviewSessionRef = useRef(null);
  const setDeckSessionRef = useRef(null);

  const [letterIndex, setLetterIndex] = useState(0);
  const [formIndex, setFormIndex] = useState('isolated');
  const [showSettings, setShowSettings] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showHistory, setShowHistory] = useState(false);
  const [lessonMode, setLessonMode] = useState(() => getItem('lessonMode') === 'true');
  const [showComparison, setShowComparison] = useState(false);
  const [practiceMode, setPracticeMode] = useState('letters');
  const [wordGroupIndex, setWordGroupIndex] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);

  // Derive letter/activeForm early for the drawing hook (plain vars, not hooks).
  // These mirror the useMemo-based derivations below; the drawing hook needs
  // them before the eventual letter/activeForm memo block is reached.
  const _numbersMode = practiceMode === 'numbers';
  const _diacriticsMode = practiceMode === 'diacritics';
  const _activeSet = _numbersMode ? NUMBERS : _diacriticsMode ? DIACRITICS : LETTERS;
  const _useLessonOrder = lessonMode && practiceMode === 'letters';
  const _lessonToAlpha = LESSON_ORDER.map(ch => LETTERS.findIndex(l => l.letter === ch));
  const _actualLetterIndex = _useLessonOrder ? (_lessonToAlpha[letterIndex] ?? 0) : letterIndex;
  const _letter = _activeSet[Math.min(_actualLetterIndex, _activeSet.length - 1)];
  const _formKeys = Object.keys(_letter.forms);
  const _activeForm = _formKeys.includes(formIndex) ? formIndex : 'isolated';

  const {
    canvasRef: dCanvasRef,
    strokesRef: dStrokesRef,
    canvasSnapshotRef: dCanvasSnapshotRef,
    dprRef: dDprRef,
    darkModeRef: dDarkModeRef,
    brushColorRef: dBrushColorRef,
    paperThemeRef: dPaperThemeRef,
    strokeResumedRef: _dStrokeResumedRef,
    countedDrawingRef: dCountedDrawingRef,
    hasStrokes: dHasStrokes,
    setHasStrokes: dSetHasStrokes,
    drawStrokes: dDrawStrokes,
    redraw: dRedraw,
    clearCanvas: dClearCanvas,
    undoStroke: dUndoStroke,
    handlePointerDown: dHandlePointerDown,
    handlePointerMove: dHandlePointerMove,
    handlePointerUp: dHandlePointerUp,
    handlePointerLeave: dHandlePointerLeave,
  } = useDrawing({
    darkMode,
    practiceMode,
    calligraphyStyle,
    letter: _letter,
    activeForm: _activeForm,
    addXPRef,
    setProgressVersionRef,
    setFeedbackRef,
    restGlyphRef,
    setRestingGlyphRef,
    redrawRef,
    ghostRef,
  });

  const {
    brushValue,
    brushPack,
    paperTheme,
    templateScale,
    soundEnabled,
    reduceMotion,
    highContrast,
    model,
    dailyGoalState,
    dailyGoalInput,
    celebrate,
    xpGain,
    xpGainTimerRef,
    appTitleRef,
    dlLinks,
    dlFallback,
    setCelebrate,
    setXpGain,
    setHighContrast,
    handleBrushChange,
    handleBrushPackChange,
    handleThemeChange,
    handleTemplateScaleChange,
    handleModelChange,
    handleDailyGoalChange,
    handleDailyGoalBlur,
    handleSoundToggle,
    handleReduceMotionChange,
  } = usePrefs({
    redrawRef,
    strokesRef: dStrokesRef,
    brushColorRef: dBrushColorRef,
    restGlyphRef,
    darkMode,
    setRestingGlyphRef,
  });
  // Bumps on every write to progress/history so derived summaries recompute
  // without us having to pipe state through every helper.
  const [progressVersion, setProgressVersion] = useState(0);

  // Wire late-defined values into the ref bridges used by useDrawing.
  useEffect(() => {
    setProgressVersionRef.current = setProgressVersion;
  }, [setProgressVersion]);

  // Controls the full-screen LoginScreen overlay that's launched from the
  // Settings panel's "Set/Change key" button.
  const [showKeyScreen, setShowKeyScreen] = useState(false);

  // ─── Cloud sync on sign-in ────────────────────────────

  const userId = user?.id ?? null;

  const { conflictPromptOpen: scConflictPromptOpen, setConflictChoice: scSetConflictChoice } =
    useSyncConflict({ userId, isOnline, setProgressVersion });

  // Review session refs (owned by useReviewSession hook, but needed here
  // for useAIFeedback which is called before the review hook).
  const reviewSessionRef = useRef(null);
  const advanceReviewRef = useRef(null);

  // Deck session refs (owned by useDeckSession hook, but needed here
  // for useAIFeedback which is called before the deck hook).
  const deckSessionRef = useRef(null);
  const advanceDeckRef = useRef(null);

  // Review sub-tab ("auto" = existing dashboard, "decks" = DeckManager)
  const [reviewSubTab, setReviewSubTab] = useState('auto');

  // Decks version counter — bumped on every deck CRUD write so the `decks`
  // memo recomputes. Separate from progressVersion so deck edits don't
  // needlessly re-memoize progress summaries.
  const [decksVersion, setDecksVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const decks = useMemo(() => getDecks(), [decksVersion]);

  const [undoDelete, setUndoDelete] = useState(null);
  const deleteBtnRef = useRef(null);

  // Map word string -> { word, roman, meaning, hint, group, groupIndex, wordIndex }
  // so a deck item with type:"word" can resolve to the right
  // wordGroupIndex + wordIndex that the existing derivation expects.
  const wordLookup = useMemo(() => {
    const m = new Map();
    WORD_GROUPS.forEach((g, gIdx) => {
      g.words.forEach((w, wIdx) => {
        if (!m.has(w.word))
          m.set(w.word, { ...w, group: g.name, groupIndex: gIdx, wordIndex: wIdx });
      });
    });
    return m;
  }, []);

  const t = useCallback(key => UI[locale][key] ?? key, [locale]);

  // Static mapping from lesson index → alphabetical index; both inputs are
  // frozen imports, so compute once.
  const lessonToAlpha = useMemo(
    () => LESSON_ORDER.map(ch => LETTERS.findIndex(l => l.letter === ch)),
    [],
  );

  // Numbers reuse the entire letters rendering path but swap the dataset.
  // They have a single isolated form, no positional variants, and lesson
  // mode (which is alphabet-shape ordering) doesn't apply.
  const isNumbersMode = practiceMode === 'numbers';
  const isDiacriticsMode = practiceMode === 'diacritics';
  const activeSet = isNumbersMode ? NUMBERS : isDiacriticsMode ? DIACRITICS : LETTERS;
  // Lesson ordering only exists for letters; force off in numbers/diacritics mode.
  const useLessonOrder = lessonMode && practiceMode === 'letters';

  const actualLetterIndex = useLessonOrder ? (lessonToAlpha[letterIndex] ?? 0) : letterIndex;
  const letter = activeSet[Math.min(actualLetterIndex, activeSet.length - 1)];
  const formKeys = Object.keys(letter.forms);
  const activeForm = formKeys.includes(formIndex) ? formIndex : 'isolated';
  const currentChar = letter.forms[activeForm];
  const totalCount = useLessonOrder ? LESSON_ORDER.length : activeSet.length;
  const lessonGroupInfo = useLessonOrder ? getLessonGroup(letterIndex) : null;

  const currentWordGroup = WORD_GROUPS[wordGroupIndex];
  const currentWord = currentWordGroup?.words[wordIndex];

  // Batched progress reads: one load() per render instead of 56+.
  // Includes NUMBERS so the numerals row shows started/complete dots too.
  const progressSummary = useMemo(
    () => getProgressSummary([...LETTERS, ...NUMBERS, ...DIACRITICS]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progressVersion],
  );
  const completedCount = useMemo(
    () => countCompleted(LETTERS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progressVersion],
  );
  const dueItems = useMemo(
    () => getDueLetters([...LETTERS, ...NUMBERS, ...DIACRITICS]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progressVersion],
  );
  const dailyGoal = dailyGoalState;
  const todayProgress = useMemo(
    () => getTodayProgress(getProgress()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progressVersion],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const xpTotal = useMemo(() => getXPTotal(), [progressVersion]);

  // ─── Drawing ─────────────────────────────────────────────
  // (extracted to useDrawing — use clearCanvas / redraw etc.)

  const selectLetter = useCallback(
    index => {
      setLetterIndex(index);
      setFormIndex('isolated');
      setShowHistory(false);
      setShowComparison(false);
      dClearCanvas();
    },
    [dClearCanvas],
  );

  const selectForm = useCallback(
    form => {
      setFormIndex(form);
      setShowHistory(false);
      setShowComparison(false);
      dClearCanvas();
    },
    [dClearCanvas],
  );

  const switchPracticeMode = useCallback(
    mode => {
      if (deckSessionRef.current) setDeckSessionRef.current?.(null);
      if (reviewSessionRef.current) exitReviewSessionRef.current?.();
      setPracticeMode(mode);
      // Reset selection — letters (28) and numbers (10) have different lengths,
      // so a stale letterIndex/form could point past the smaller set.
      setLetterIndex(0);
      setFormIndex('isolated');
      setShowComparison(false);
      setShowHistory(false);
      alphaBtnRef.current = [];
      dClearCanvas();
    },
    [dClearCanvas],
  );

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
      const deck = getDeck(id);
      if (!deck) return;
      const snapshot = JSON.parse(JSON.stringify(deck));
      deleteDeck(id);
      refreshDecks();
      // timestamp lets the toast render use it as `key`: a second delete while
      // the toast is up remounts UndoToast, restarting its auto-dismiss timer
      // (and re-moving focus to the new Undo button) instead of letting the
      // first delete's timer kill the second delete's undo window early.
      setUndoDelete({ deletedDeck: snapshot, timestamp: Date.now() });
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

  const selectWord = useCallback(
    (groupIdx, wIdx) => {
      setWordGroupIndex(groupIdx);
      setWordIndex(wIdx);
      setShowComparison(false);
      setShowHistory(false);
      dClearCanvas();
    },
    [dClearCanvas],
  );

  const toggleLessonMode = useCallback(() => {
    setLessonMode(prev => {
      const next = !prev;
      setItem('lessonMode', String(next));
      return next;
    });
    setLetterIndex(0);
    setFormIndex('isolated');
    setShowHistory(false);
    setShowComparison(false);
    alphaBtnRef.current = [];
    dClearCanvas();
  }, [dClearCanvas]);

  // ─── Theme/brush sync → repaint existing strokes ───────
  // Keeps the refs that redraw() reads in step with state. Repaints so
  // existing strokes pick up the new color/paper immediately, even though
  // redraw itself has stable identity (so the ResizeObserver effect below
  // does not tear down on theme changes).

  useEffect(() => {
    dDarkModeRef.current = darkMode;
    dBrushColorRef.current = getBrushColor(brushPack, darkMode);
    dPaperThemeRef.current = paperTheme;
    dRedraw(dStrokesRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [darkMode, brushPack, paperTheme, dRedraw]);

  // ─── Online / offline detection ───────────────────────

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const onStorage = e => {
      if (e.key === 'arabic_decks') setDecksVersion(v => v + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // ─── Undo ────────────────────────────────────────────
  // (extracted to useDrawing — use dUndoStroke)

  // ─── Pointer events ────────────────────────────────
  // (extracted to useDrawing — use drawing.handlePointerxxx)

  // ─── Export ────────────────────────────────────────

  const {
    saveDrawing: eSaveDrawing,
    shareDrawing: eShareDrawing,
    exportCanvas: eExportCanvas,
  } = useExport({
    dCanvasRef,
    dStrokesRef,
    dDrawStrokes,
    paperTheme,
    brushPack,
    darkMode,
    calligraphyStyle,
    practiceMode,
    currentWord,
    currentChar,
    letterName: letter.name,
    activeForm,
  });

  // ─── AI Feedback ────────────────────────────────────

  const {
    feedback: aiFeedback,
    setFeedback: aiSetFeedback,
    loading: aiLoading,
    showConsentDialog: aiShowConsentDialog,
    setShowConsentDialog: aiSetShowConsentDialog,
    requestFeedback: aiRequestFeedback,
    giveConsent: aiGiveConsent,
    revokeConsent: aiRevokeConsent,
  } = useAIFeedback({
    apiKey,
    t,
    practiceMode,
    currentWord,
    letter,
    isNumbersMode,
    isDiacriticsMode,
    activeForm,
    setProgressVersion,
    setCelebrate,
    soundEnabled,
    addXPRef,
    eExportCanvas,
    dStrokesRef,
    dCanvasSnapshotRef,
    dCountedDrawingRef,
    reviewSessionRef,
    advanceReviewRef,
    deckSessionRef,
    advanceDeckRef,
  });

  setFeedbackRef.current = aiSetFeedback;

  // ─── Stroke order animation ────────────────────────────────────

  const {
    animating: animAnimating,
    setRestingGlyph: animSetRestingGlyph,
    playStrokeAnimation: animPlayStrokeAnimation,
  } = useAnimation({
    dCanvasRef,
    dStrokesRef,
    dDprRef,
    dSetHasStrokes,
    dRedraw,
    dPaperThemeRef,
    dDarkModeRef,
    restGlyphRef,
    templateScale,
    calligraphyStyle,
    reduceMotion,
    paperTheme,
    currentChar,
    letterKey: letter.letter,
    setShowComparison,
    setFeedbackRef,
    letterIndex,
    formIndex,
    practiceMode,
  });

  setRestingGlyphRef.current = animSetRestingGlyph;

  // ─── Ghost template sync → in-canvas ghost ───────────
  // Keeps the bridge ref in step with the current letter/word, template size,
  // and theme, then repaints. Skipped while a stroke-order animation owns the
  // canvas (a redraw would stomp its frames).
  useEffect(() => {
    const isWords = practiceMode === 'words';
    const text = isWords ? currentWord?.word : currentChar;
    const fontSizePx = (isWords ? 100 : 200) * templateScale;
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-ghost')
      .trim();
    ghostRef.current = text ? { text, fontSizePx, color } : null;
    if (!animAnimating) dRedraw(dStrokesRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceMode, currentChar, currentWord, templateScale, darkMode, highContrast]);

  // ─── Guided review session ─────────────────────────────

  const {
    rsReviewSession: rsReviewSession,
    startReviewSession: rsStartReviewSession,
    exitReviewSession: rsExitReviewSession,
    goToReviewItem: rsGoToReviewItem,
    goToAnalyticsItem: rsGoToAnalyticsItem,
    handleSnoozeCurrentItem: rsHandleSnoozeCurrentItem,
    handleSnoozeItem: rsHandleSnoozeItem,
    handleResetDueList: rsHandleResetDueList,
    showResumePrompt: rsShowResumePrompt,
    stashedSession: rsStashedSession,
    resumeReviewSession: rsResumeReviewSession,
    dismissResumePrompt: rsDismissResumePrompt,
  } = useReviewSession({
    dClearCanvas,
    lessonMode,
    lessonToAlpha,
    dueItems,
    setProgressVersion,
    deckSessionRef,
    alphaBtnRef,
    setLetterIndex,
    setFormIndex,
    setPracticeMode,
    setShowComparison,
    setShowHistory,
    reviewSessionRef,
    advanceReviewRef,
    exitReviewSessionRef,
  });

  // ─── Canvas sizing (HiDPI) ─────────────────────────────
  // Must stay below useReviewSession: the deps array reads rsReviewSession,
  // so placing this effect above the hook puts it in the TDZ and crashes the
  // first render with a ReferenceError (blank page in production).

  useEffect(() => {
    const canvas = dCanvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      // setTransform (not scale — cumulative) so repeated resizes stay sane.
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
      dRedraw(dStrokesRef.current);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
    // practiceMode and !!rsReviewSession deps ensure the observer re-attaches
    // when the canvas mounts again after being unmounted (e.g. switching modes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dRedraw, practiceMode, rsReviewSession]);

  // ─── Deck session ─────────────────────────────────────

  const {
    deckSession: dsDeckSession,
    resolveDeckItem: dsResolveDeckItem,
    startDeckSession: dsStartDeckSession,
    exitDeckSession: dsExitDeckSession,
    restartDeckSession: dsRestartDeckSession,
  } = useDeckSession({
    dClearCanvas,
    lessonMode,
    lessonToAlpha,
    wordLookup,
    activeForm,
    reviewSessionRef,
    deckSessionRef,
    advanceDeckRef,
    setDeckSessionRef,
    alphaBtnRef,
    setLetterIndex,
    setFormIndex,
    setPracticeMode,
    setWordGroupIndex,
    setWordIndex,
    setShowComparison,
    setShowHistory,
    setUndoDelete,
    setReviewSubTab,
    refreshDecks,
    t,
  });

  // ─── Canvas export (AI, JPEG 512px) ──────────────────
  // (extracted to useExport — use eExportCanvas)

  const handleWipeData = useCallback(async () => {
    // Delete cloud rows first (best effort — an offline wipe still proceeds
    // locally, but cloud data would re-apply on the next sign-in).
    try {
      await deleteCloudData();
    } catch {
      /* offline — local wipe proceeds */
    }
    wipeAllData();
    window.location.reload();
  }, []);

  // Award XP and flash a "+N XP" toast. The accompanying setProgressVersion
  // bump (at each call site) is what re-renders the LevelBadge; this helper
  // only persists the XP and triggers the toast. No-op for amount <= 0 so
  // score-1 attempts don't show a "+0 XP" flash.
  const addXP = useCallback((amount, reason) => {
    if (amount <= 0) return;
    awardXP(amount, reason);
    const rect = appTitleRef.current?.getBoundingClientRect();
    const position = rect ? { left: rect.left - 100, top: rect.top + rect.height / 2 - 10 } : null;
    setXpGain({ amount, key: Date.now(), position });
    if (xpGainTimerRef.current) clearTimeout(xpGainTimerRef.current);
    xpGainTimerRef.current = setTimeout(() => setXpGain(null), 1700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    addXPRef.current = addXP;
  }, [addXP]);

  // ─── Progress backup (export / import) ───────────────

  const handleImportFile = async ev => {
    const file = ev.target.files?.[0];
    // Reset the input so picking the same file twice still fires onChange.
    ev.target.value = '';
    if (!file) return;
    if (!window.confirm(t('importConfirm'))) return;
    const result = await importBackupFile(file);
    if (!result.ok) {
      window.alert(t('importError'));
      return;
    }
    // Reload so every module's in-memory cache re-reads the imported data.
    window.alert(t('importSuccess'));
    window.location.reload();
  };

  // ─── Keyboard nav for alphabet row ───────────────────

  const handleAlphaKeyDown = useCallback(
    (e, idx) => {
      const total = totalCount;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const adjustedDir = locale === 'ar' ? -dir : dir;
        const next = (idx + adjustedDir + total) % total;
        selectLetter(next);
        setTimeout(() => alphaBtnRef.current[next]?.focus(), 0);
      }
      if (e.key === 'Home') {
        e.preventDefault();
        selectLetter(0);
        setTimeout(() => alphaBtnRef.current[0]?.focus(), 0);
      }
      if (e.key === 'End') {
        e.preventDefault();
        selectLetter(total - 1);
        setTimeout(() => alphaBtnRef.current[total - 1]?.focus(), 0);
      }
    },
    [totalCount, locale, selectLetter],
  );

  const dueCount = dueItems.length;
  const history = getFeedbackHistory(letter.name, activeForm);

  // ─── Render ───────────────────────────────────────

  // Full-screen key-entry overlay, launched from the Settings "Set/Change key"
  // button. Save commits the key and closes; Cancel just closes.
  if (showKeyScreen) {
    return (
      <LoginScreen
        onSave={key => {
          onSetKey(key);
          setShowKeyScreen(false);
        }}
        onCancel={() => setShowKeyScreen(false)}
        darkMode={darkMode}
        onToggleDarkMode={onToggleDarkMode}
        locale={locale}
      />
    );
  }

  // AI consent dialog overlay — shown when user clicks "Get Feedback"
  // without having granted consent.
  if (aiShowConsentDialog) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.55)',
          fontFamily: 'Georgia,serif',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '90%',
            background: 'var(--color-bg)',
            borderRadius: 16,
            padding: 32,
            boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
            color: 'var(--color-text)',
            lineHeight: 1.6,
          }}
        >
          <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{t('consentTitle')}</h3>
          <p style={{ margin: '0 0 8px', fontSize: 14 }}>{t('consentBody')}</p>
          <p style={{ margin: '0 0 20px', fontSize: 13 }}>
            <a
              href="/privacy.html"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--color-accent)',
                textDecoration: 'underline',
                textUnderlineOffset: 2,
              }}
            >
              {t('privacyLink')}
            </a>
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={aiGiveConsent}
              style={{
                flex: 1,
                minWidth: 120,
                padding: '10px 20px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 600,
                color: '#fff',
                background: 'var(--color-accent)',
              }}
            >
              {t('consentAgree')}
            </button>
            <button
              onClick={() => aiSetShowConsentDialog(false)}
              style={{
                flex: 1,
                minWidth: 120,
                padding: '10px 20px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                cursor: 'pointer',
                fontSize: 15,
                color: 'var(--color-text-muted)',
                background: 'transparent',
              }}
            >
              {t('consentSkip')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root} className="practice-root">
      {/* Header */}
      <div style={styles.header}>
        <span ref={appTitleRef} style={styles.appTitle} lang="ar">
          {t('appTitle')}
        </span>
        <span style={styles.appSubtitle}>
          {t('appSubtitle')}
          {completedCount > 0 && (
            <span
              style={styles.completedBadge}
              aria-label={`${completedCount} ${t('ariaCompletedBadge')}`}
            >
              {completedCount}/{LETTERS.length} {t('progressComplete')}
            </span>
          )}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginLeft: 'auto',
          }}
        >
          <LevelBadge totalXp={xpTotal} label={t('xpLevel')} t={t} />
          <DailyGoalRing current={todayProgress} goal={dailyGoal} label={t('dailyGoalTitle')} />
        </div>
        <div style={styles.headerButtons}>
          <button
            className="btn-gear"
            style={{
              ...styles.lessonToggle,
              ...(lessonMode ? styles.lessonToggleActive : {}),
              // Toggling lesson order mid-session remaps letterIndex → letter
              // and would misattribute the next score.
              opacity: dsDeckSession || rsReviewSession ? 0.35 : 1,
            }}
            onClick={toggleLessonMode}
            disabled={!!(dsDeckSession || rsReviewSession)}
            aria-pressed={lessonMode}
            aria-label={t('ariaLessonModeBtn')}
            title={lessonMode ? t('lessonToggleTitleOn') : t('lessonToggleTitleOff')}
          >
            📖
          </button>
          <button
            className="btn-gear"
            style={styles.keyBtn}
            onClick={() => setShowSettings(v => !v)}
            aria-label={t('ariaSettingsBtn')}
            aria-expanded={showSettings}
            aria-controls="settings-panel"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Lesson mode group indicator */}
      {lessonMode && lessonGroupInfo && (
        <div style={styles.lessonBanner}>
          <span style={styles.lessonGroupName}>
            {t('lessonGroup')} {lessonGroupInfo.groupIndex + 1}: {t(lessonGroupInfo.group.nameKey)}
          </span>
          <span style={styles.lessonGroupDesc}>{t(lessonGroupInfo.group.descKey)}</span>
        </div>
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div style={styles.offlineBanner} role="alert" aria-live="polite">
          {t('offlineBanner')}
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <SettingsPanel
          t={t}
          locale={locale}
          darkMode={darkMode}
          onToggleDarkMode={onToggleDarkMode}
          onToggleLocale={onToggleLocale}
          highContrast={highContrast}
          setHighContrast={setHighContrast}
          reduceMotion={reduceMotion}
          handleReduceMotionChange={handleReduceMotionChange}
          soundEnabled={soundEnabled}
          handleSoundToggle={handleSoundToggle}
          model={model}
          handleModelChange={handleModelChange}
          paperTheme={paperTheme}
          handleThemeChange={handleThemeChange}
          brushPack={brushPack}
          handleBrushPackChange={handleBrushPackChange}
          apiKey={apiKey}
          onClearKey={onClearKey}
          setShowSettings={setShowSettings}
          setShowKeyScreen={setShowKeyScreen}
          exportBackup={exportBackup}
          importInputRef={importInputRef}
          handleImportFile={handleImportFile}
          dailyGoalInput={dailyGoalInput}
          handleDailyGoalChange={handleDailyGoalChange}
          handleDailyGoalBlur={handleDailyGoalBlur}
          onRevokeConsent={aiRevokeConsent}
          onWipeData={handleWipeData}
          user={user}
          authLoading={authLoading}
          onSignOut={onSignOut}
        />
      )}

      {/* Mode tabs */}
      <div style={styles.modeTabs} role="tablist" aria-label={t('ariaPracticeMode')}>
        <button
          className="btn-form"
          style={{
            ...styles.modeTab,
            ...(practiceMode === 'letters' ? styles.modeTabActive : {}),
            opacity: dsDeckSession || rsReviewSession ? 0.35 : 1,
          }}
          onClick={() => switchPracticeMode('letters')}
          disabled={!!(dsDeckSession || rsReviewSession)}
          role="tab"
          aria-selected={practiceMode === 'letters'}
          aria-label={t('ariaLetterTab')}
          id="tab-letters"
        >
          {t('tabLetters')}
        </button>
        <button
          className="btn-form"
          style={{
            ...styles.modeTab,
            ...(practiceMode === 'numbers' ? styles.modeTabActive : {}),
            opacity: dsDeckSession || rsReviewSession ? 0.35 : 1,
          }}
          onClick={() => switchPracticeMode('numbers')}
          disabled={!!(dsDeckSession || rsReviewSession)}
          role="tab"
          aria-selected={practiceMode === 'numbers'}
          aria-label={t('ariaNumberTab')}
          id="tab-numbers"
        >
          {t('tabNumbers')}
        </button>
        <button
          className="btn-form"
          style={{
            ...styles.modeTab,
            ...(practiceMode === 'words' ? styles.modeTabActive : {}),
            opacity: dsDeckSession || rsReviewSession ? 0.35 : 1,
          }}
          onClick={() => switchPracticeMode('words')}
          disabled={!!(dsDeckSession || rsReviewSession)}
          role="tab"
          aria-selected={practiceMode === 'words'}
          aria-label={t('ariaModeTab') + ': ' + t('tabWords')}
        >
          {t('tabWords')}
        </button>
        <button
          className="btn-form"
          style={{
            ...styles.modeTab,
            ...(practiceMode === 'diacritics' ? styles.modeTabActive : {}),
            opacity: dsDeckSession || rsReviewSession ? 0.35 : 1,
          }}
          onClick={() => switchPracticeMode('diacritics')}
          disabled={!!(dsDeckSession || rsReviewSession)}
          role="tab"
          aria-selected={practiceMode === 'diacritics'}
          aria-label={t('ariaModeTab') + ': ' + t('tabDiacritics')}
        >
          {t('tabDiacritics')}
        </button>
        <button
          className="btn-form"
          style={{
            ...styles.modeTab,
            ...(practiceMode === 'review' ? styles.modeTabActive : {}),
            position: 'relative',
            opacity: dsDeckSession || rsReviewSession ? 0.35 : 1,
          }}
          onClick={() => switchPracticeMode('review')}
          disabled={!!(dsDeckSession || rsReviewSession)}
          role="tab"
          aria-selected={practiceMode === 'review'}
          aria-label={t('ariaDashboardTab')}
          id="tab-review"
        >
          {t('tabReview')}
          {dueCount > 0 && (
            <span
              style={{
                ...styles.reviewCount,
                position: 'absolute',
                top: '-6px',
                right: '-6px',
                fontSize: '10px',
                padding: '1px 5px',
              }}
            >
              {dueCount}
            </span>
          )}
        </button>
        <button
          className="btn-form"
          style={{
            ...styles.modeTab,
            ...(practiceMode === 'stats' ? styles.modeTabActive : {}),
            opacity: dsDeckSession || rsReviewSession ? 0.35 : 1,
          }}
          onClick={() => switchPracticeMode('stats')}
          disabled={!!(dsDeckSession || rsReviewSession)}
          role="tab"
          aria-selected={practiceMode === 'stats'}
          aria-label={t('tabStats')}
          id="tab-stats"
        >
          {t('tabStats')}
        </button>
      </div>

      {/* Review dashboard */}
      {practiceMode === 'review' && !rsReviewSession && !dsDeckSession && (
        <div style={styles.reviewDash}>
          {/* Sub-nav: Auto Review vs My Decks */}
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
          </div>
          {reviewSubTab === 'auto' && (
            <>
              {rsShowResumePrompt && rsStashedSession && (
                <div
                  style={{
                    padding: '12px 16px',
                    marginBottom: 12,
                    background: 'var(--color-card-bg)',
                    borderRadius: 12,
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <p style={{ marginBottom: 8, fontSize: 14, color: 'var(--color-text)' }}>
                    {t('reviewResume')}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn-ai"
                      style={{ ...styles.btn, ...styles.btnAI, flex: 1 }}
                      onClick={rsResumeReviewSession}
                    >
                      {t('reviewResumeYes')}
                    </button>
                    <button
                      className="btn-clear"
                      style={{ ...styles.btn, flex: 1 }}
                      onClick={rsDismissResumePrompt}
                    >
                      {t('reviewResumeNo')}
                    </button>
                  </div>
                </div>
              )}
              <div style={styles.reviewHeader}>
                <span style={styles.reviewHeaderLeft}>
                  {t('dashboardTitle')}
                  {dueItems.length > 0 && (
                    <span style={styles.reviewCount}>
                      {dueItems.length} {t('dashboardCount')}
                    </span>
                  )}
                </span>
                {dueItems.length > 0 && (
                  <button
                    className="btn-clear"
                    style={styles.reviewResetBtn}
                    onClick={rsHandleResetDueList}
                    aria-label={t('ariaResetDueList')}
                    title={t('ariaResetDueList')}
                  >
                    {t('resetDueList')}
                  </button>
                )}
              </div>
              {dueItems.length === 0 ? (
                <div style={styles.reviewEmpty}>{t('dashboardEmpty')}</div>
              ) : (
                <>
                  <div style={styles.reviewGrid}>
                    {dueItems.map(({ letterName, letterChar, formKey }) => (
                      <div key={`${letterName}-${formKey}`} style={styles.reviewTileWrap}>
                        <button
                          className="btn-alpha"
                          style={styles.reviewTile}
                          onClick={() => rsGoToReviewItem(letterName, formKey)}
                          aria-label={`${letterName} ${t(FORM_NAMES[formKey] ?? formKey)}`}
                          title={`${letterName} — ${t(FORM_NAMES[formKey] ?? formKey)}`}
                        >
                          <span style={styles.reviewTileChar} lang="ar">
                            {letterChar}
                          </span>
                          <span style={styles.reviewTileName}>{letterName}</span>
                          <span style={styles.reviewTileForm}>
                            {t(FORM_NAMES[formKey] ?? formKey)}
                          </span>
                        </button>
                        <button
                          className="btn-clear"
                          style={styles.reviewTileRemove}
                          onClick={e => {
                            e.stopPropagation();
                            rsHandleSnoozeItem(letterName, formKey);
                          }}
                          aria-label={`${t('ariaRemoveDueItem')} ${letterName} ${t(FORM_NAMES[formKey] ?? formKey)}`}
                          title={t('ariaRemoveDueItem')}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn-ai"
                    onClick={rsStartReviewSession}
                    style={{
                      ...styles.btn,
                      ...styles.btnAI,
                      marginTop: 16,
                      width: '100%',
                      maxWidth: 520,
                    }}
                  >
                    {t('startReviewSession')}
                  </button>
                </>
              )}
            </>
          )}
          {reviewSubTab === 'decks' && (
            <DeckManager
              t={t}
              locale={locale}
              decks={decks}
              onCreateDeck={handleCreateDeck}
              onRenameDeck={handleRenameDeck}
              onDeleteDeck={handleDeleteDeck}
              onAddItem={handleAddDeckItem}
              onRemoveItem={handleRemoveDeckItem}
              onReorderItem={handleReorderDeckItem}
              onReorderDecks={handleReorderDecks}
              onCopyDeck={handleCopyDeck}
              restoreFocusRef={deleteBtnRef}
              onStartSession={(deck, mode) => dsStartDeckSession(deck, mode)}
            />
          )}
        </div>
      )}

      {/* Stats dashboard */}
      {practiceMode === 'stats' && (
        <AnalyticsPanel
          locale={locale}
          LETTERS={[...LETTERS, ...NUMBERS, ...DIACRITICS]}
          progress={getProgress()}
          progressVersion={progressVersion}
          onGoToItem={rsGoToAnalyticsItem}
        />
      )}

      {/* Practice UI (hidden in review/stats mode unless in a guided session) */}
      {((practiceMode !== 'review' && practiceMode !== 'stats') ||
        rsReviewSession ||
        dsDeckSession) && (
        <>
          {rsReviewSession && !rsReviewSession.finished && (
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
                  {t('reviewProgressLabel')} {rsReviewSession.index + 1} /{' '}
                  {rsReviewSession.queue.length}
                </span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn-clear"
                    onClick={rsHandleSnoozeCurrentItem}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    aria-label={t('ariaSnoozeItem')}
                    title={t('ariaSnoozeItem')}
                  >
                    {t('btnSnooze')}
                  </button>
                  <button
                    className="btn-clear"
                    onClick={rsExitReviewSession}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                  >
                    {t('btnExit')}
                  </button>
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
                    width: `${(rsReviewSession.index / rsReviewSession.queue.length) * 100}%`,
                    height: '100%',
                    background: 'var(--color-accent)',
                    borderRadius: 99,
                    transition: 'width 0.25s ease',
                  }}
                />
              </div>
            </div>
          )}

          {dsDeckSession && !dsDeckSession.finished && (
            <div style={{ width: '100%', maxWidth: 520, padding: '8px 12px' }}>
              <div style={styles.deckSessionHeader}>
                <span style={styles.deckSessionName}>
                  {dsDeckSession.deckName}
                  <span
                    style={{
                      ...styles.deckSessionModeChip,
                      ...(dsDeckSession.mode === 'lowScore'
                        ? styles.deckModeChipLowScore
                        : styles.deckModeChipFull),
                    }}
                  >
                    {dsDeckSession.mode === 'lowScore' ? t('deckModeLowScore') : t('deckModeFull')}
                  </span>
                </span>
                <button
                  className="btn-clear"
                  onClick={dsExitDeckSession}
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
                  {t('deckSessionProgress')} {dsDeckSession.index + 1} {t('deckSessionOf')}{' '}
                  {dsDeckSession.queue.length}
                  {(() => {
                    const item = dsDeckSession.queue[dsDeckSession.index];
                    const resolved = dsResolveDeckItem(item);
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
                    width: `${(dsDeckSession.index / dsDeckSession.queue.length) * 100}%`,
                    height: '100%',
                    background: 'var(--color-accent)',
                    borderRadius: 99,
                    transition: 'width 0.25s ease',
                  }}
                />
              </div>
            </div>
          )}

          {rsReviewSession?.finished && (
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
              <h3 style={{ marginBottom: 8, color: 'var(--color-text)' }}>
                {t('reviewCompleteTitle')}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--color-text-soft)',
                  marginBottom: 12,
                }}
              >
                {rsReviewSession.summary.length} {t('reviewedItemsLabel')}
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 12,
                }}
              >
                {rsReviewSession.summary.map((item, i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 6,
                      background:
                        item.snoozed || item.skipped
                          ? 'var(--color-progress-badge-bg)'
                          : item.score >= 4
                            ? 'rgba(90,158,78,0.15)'
                            : 'rgba(192,112,58,0.15)',
                      color: 'var(--color-text)',
                      fontSize: 13,
                      opacity: item.skipped || item.snoozed ? 0.55 : 1,
                    }}
                    lang="ar"
                  >
                    {item.letterChar}
                    {item.snoozed ? (
                      <span style={{ fontSize: 10, opacity: 0.7 }}>⏰</span>
                    ) : item.skipped ? (
                      <span style={{ fontSize: 10, opacity: 0.6 }}>—</span>
                    ) : (
                      <span style={{ fontSize: 11, opacity: 0.8 }}>★{item.score}</span>
                    )}
                  </span>
                ))}
              </div>
              <button className="btn-nav" onClick={rsExitReviewSession} style={styles.btn}>
                {t('btnDone')}
              </button>
            </div>
          )}

          {dsDeckSession?.finished && (
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
              <h3 style={{ marginBottom: 8, color: 'var(--color-text)' }}>
                {t('deckSessionComplete')}
              </h3>
              {(() => {
                const scored = dsDeckSession.summary.filter(s => s.score != null);
                const avg =
                  scored.length > 0
                    ? (scored.reduce((sum, s) => sum + s.score, 0) / scored.length).toFixed(1)
                    : null;
                const lowCount = dsDeckSession.summary.filter(
                  s => s.score == null || s.score <= 3,
                ).length;
                return (
                  <>
                    <p style={styles.deckSummarySubtitle}>
                      {dsDeckSession.deckName} · {dsDeckSession.summary.length}{' '}
                      {t('deckSessionItems')}
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
                      {dsDeckSession.summary.map((entry, i) => (
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
                            const resolved = dsResolveDeckItem(entry.item);
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
                        onClick={() => dsRestartDeckSession('full')}
                        style={styles.btn}
                      >
                        {t('deckRunAgain')}
                      </button>
                      {lowCount > 0 && (
                        <button
                          className="btn-ai"
                          onClick={() => dsRestartDeckSession('lowScore')}
                          style={{ ...styles.btn, ...styles.btnAI }}
                        >
                          {t('deckRerunLowCount').replace('{n}', String(lowCount))}
                        </button>
                      )}
                      <button className="btn-clear" onClick={dsExitDeckSession} style={styles.btn}>
                        {t('deckDone')}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* Info bar */}
          {practiceMode !== 'words' ? (
            <div style={styles.infoBar}>
              <div style={styles.letterMeta}>
                <span
                  style={styles.letterNameLarge}
                  lang={isNumbersMode || isDiacriticsMode ? 'ar' : undefined}
                >
                  {isNumbersMode || isDiacriticsMode ? letter.letter : letter.name}
                </span>
                <span style={styles.letterRoman}>/{letter.roman}/</span>
              </div>
              <div style={styles.miniPreviews}>
                {Object.entries(letter.forms).map(([key]) => (
                  <div key={key} style={styles.miniPreview}>
                    <span style={styles.miniChar} lang="ar">
                      {letter.forms[key]}
                    </span>
                    <span style={styles.miniLabel}>{t(FORM_NAMES[key])}</span>
                  </div>
                ))}
              </div>
              <span
                style={styles.progressBadge}
                aria-label={`${t('ariaProgressBadge')}: ${letterIndex + 1} ${t('progressComplete')} ${totalCount}`}
              >
                {letterIndex + 1}/{totalCount}
              </span>
            </div>
          ) : (
            <div style={styles.infoBar}>
              <div style={styles.letterMeta}>
                <span style={styles.letterNameLarge} lang="ar" dir="rtl">
                  {currentWord?.word}
                </span>
                <span style={styles.letterRoman}>
                  /{currentWord?.roman}/ — {currentWord?.meaning}
                </span>
              </div>
              <span style={styles.progressBadge}>
                {wordIndex + 1}/{currentWordGroup?.words.length}
              </span>
            </div>
          )}

          {/* Form switcher */}
          {practiceMode === 'letters' && (
            <div style={styles.formSwitcher} role="group" aria-label={t('ariaLetterForm')}>
              {formKeys.map(key => {
                const isActive = key === activeForm;
                return (
                  <button
                    key={key}
                    className="btn-form"
                    style={{
                      ...styles.formBtn,
                      ...(isActive ? styles.formBtnActive : {}),
                      ...(dsDeckSession || rsReviewSession ? { opacity: 0.35 } : {}),
                    }}
                    onClick={() => selectForm(key)}
                    disabled={!!(dsDeckSession || rsReviewSession)}
                    aria-pressed={isActive}
                    aria-label={`${t(FORM_NAMES[key])} ${t('ariaFormBtn')}`}
                  >
                    <span
                      lang="ar"
                      style={{
                        ...styles.formBtnChar,
                        color: isActive ? '#fff8ee' : 'var(--color-text)',
                      }}
                    >
                      {letter.forms[key]}
                    </span>
                    <span
                      style={{
                        ...styles.formBtnName,
                        color: isActive ? '#ffebd0' : 'var(--color-text)',
                      }}
                    >
                      {t(FORM_NAMES[key])}
                    </span>
                    <span
                      style={{
                        ...styles.formBtnSub,
                        color: isActive ? '#ffd9a8' : 'var(--color-text-muted)',
                      }}
                    >
                      {t(FORM_SHORT[key])}
                    </span>
                  </button>
                );
              })}
              {letter.nonJoiner && <div style={styles.nonJoinerNote}>{t('nonJoinerNote')}</div>}
            </div>
          )}

          {/* Word group selector — hidden during deck sessions so a mid-session
              group click can't move the next score to a different word. */}
          {practiceMode === 'words' && !dsDeckSession && (
            <div style={styles.formSwitcher} role="group" aria-label={t('ariaWordGroup')}>
              {WORD_GROUPS.map((g, gIdx) => {
                const isActive = gIdx === wordGroupIndex;
                return (
                  <button
                    key={gIdx}
                    className="btn-form"
                    style={{
                      ...styles.formBtn,
                      ...(isActive ? styles.formBtnActive : {}),
                    }}
                    onClick={() => selectWord(gIdx, 0)}
                    aria-pressed={isActive}
                  >
                    <span
                      style={{
                        ...styles.formBtnName,
                        color: isActive ? '#ffebd0' : 'var(--color-text)',
                      }}
                    >
                      {g.name}
                    </span>
                    <span
                      style={{
                        ...styles.formBtnSub,
                        color: isActive ? '#ffd9a8' : 'var(--color-text-muted)',
                      }}
                    >
                      {g.words.length} {t('wordsLabel')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Hint */}
          <div style={styles.hintRow}>
            <span style={styles.hintIcon}>✦</span>
            <span style={styles.hintText}>
              {practiceMode !== 'words' ? (
                <>
                  <strong>{letter.hint}</strong>
                  {!(isNumbersMode || isDiacriticsMode) && formKeys.length > 1 && (
                    <>
                      {' '}
                      <em>{t(FORM_DESCRIPTIONS[activeForm])}</em>
                    </>
                  )}
                </>
              ) : (
                <strong>{currentWord?.hint}</strong>
              )}
            </span>
          </div>

          {/* Canvas */}
          <div
            style={{
              ...styles.canvasWrap,
              background: highContrast
                ? darkMode
                  ? '#000000'
                  : '#ffffff'
                : getPaperColors(paperTheme, darkMode).bg,
            }}
            className="canvas-max"
          >
            <canvas
              ref={dCanvasRef}
              id="main-canvas"
              style={styles.canvas}
              tabIndex={0}
              role="application"
              aria-label={t('ariaCanvas')}
              onPointerDown={dHandlePointerDown}
              onPointerMove={dHandlePointerMove}
              onPointerUp={dHandlePointerUp}
              onPointerCancel={dHandlePointerUp}
              onPointerLeave={dHandlePointerLeave}
            />
            <div style={styles.rtlGuide} aria-hidden="true">
              {t('hintRTL')}
            </div>
          </div>

          {/* Brush size slider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              width: '100%',
              maxWidth: '520px',
            }}
          >
            <label
              style={{
                fontSize: '12px',
                color: 'var(--color-text-soft)',
                whiteSpace: 'nowrap',
                minWidth: '90px',
              }}
            >
              {t('brushSize')}
            </label>
            <input
              type="range"
              min={0.2}
              max={2}
              step={0.1}
              value={brushValue}
              style={{ flex: 1, accentColor: 'var(--color-accent)' }}
              onChange={handleBrushChange}
              aria-label={t('ariaBrushSlider')}
            />
          </div>

          {/* Template size slider */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              width: '100%',
              maxWidth: '520px',
            }}
          >
            <label
              style={{
                fontSize: '12px',
                color: 'var(--color-text-soft)',
                whiteSpace: 'nowrap',
                minWidth: '90px',
              }}
            >
              {t('templateSize')}
            </label>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={templateScale}
              style={{ flex: 1, accentColor: 'var(--color-accent)' }}
              onChange={handleTemplateScaleChange}
              aria-label={t('ariaTemplateSlider')}
            />
          </div>

          {/* Controls */}
          <div style={styles.controls}>
            <button
              className="btn-nav"
              style={{
                ...styles.btn,
                ...styles.btnNav,
                // Deck and review sessions are linear (Next advances the
                // session queue); a free Prev would swap the displayed item
                // without updating the session and misattribute the next score.
                opacity: dsDeckSession || rsReviewSession ? 0.35 : 1,
              }}
              onClick={() => {
                if (dsDeckSession || rsReviewSession) return;
                if (practiceMode === 'words') {
                  const total = currentWordGroup.words.length;
                  selectWord(wordGroupIndex, (wordIndex - 1 + total) % total);
                } else {
                  selectLetter((letterIndex - 1 + totalCount) % totalCount);
                }
              }}
              disabled={!!(dsDeckSession || rsReviewSession)}
              aria-label={t('ariaPrevBtn')}
            >
              {t('btnPrev')}
            </button>
            <button
              className="btn-clear"
              style={{ ...styles.btn, ...styles.btnClear }}
              onClick={dUndoStroke}
              aria-label={t('ariaUndoBtn')}
            >
              {t('btnUndo')}
            </button>
            <button
              className="btn-clear"
              style={{ ...styles.btn, ...styles.btnClear }}
              onClick={dClearCanvas}
              aria-label={t('ariaClearBtn')}
            >
              {t('btnClear')}
            </button>
            {practiceMode !== 'words' && STROKE_DATA[letter.letter] && (
              <button
                className="btn-nav"
                style={{
                  ...styles.btn,
                  ...styles.btnShowMe,
                  opacity: animAnimating ? 0.35 : 1,
                }}
                onClick={animPlayStrokeAnimation}
                disabled={animAnimating}
                aria-label={t('ariaShowMeBtn')}
              >
                {animAnimating ? t('btnShowMePlaying') : t('btnShowMe')}
              </button>
            )}
            <button
              className="btn-ai"
              style={{
                ...styles.btn,
                ...styles.btnAI,
                opacity: aiLoading || !apiKey || apiKey === 'skip' || !isOnline ? 0.35 : 1,
              }}
              onClick={aiRequestFeedback}
              disabled={aiLoading || !apiKey || apiKey === 'skip' || !isOnline}
              aria-label={t('ariaAIFeedbackBtn')}
              aria-busy={aiLoading}
            >
              {aiLoading
                ? t('btnAIFeedbackLoading')
                : !apiKey || apiKey === 'skip'
                  ? t('btnAIFeedbackNoKey')
                  : !isOnline
                    ? t('btnAIFeedbackOffline')
                    : t('btnAIFeedback')}
            </button>
            <button
              className="btn-nav"
              style={{ ...styles.btn, ...styles.btnNav }}
              onClick={() => {
                if (dsDeckSession) {
                  if (apiKey === 'skip') {
                    const sess = deckSessionRef.current;
                    if (sess && !sess.finished && dStrokesRef.current.length > 0) {
                      const item = sess.queue[sess.index];
                      const resolved = dsResolveDeckItem(item);
                      if (resolved) {
                        const pName =
                          resolved.practiceMode === 'words' ? resolved.name : resolved.obj.name;
                        const pForm = resolved.practiceMode === 'words' ? 'word' : activeForm;
                        if (!dCountedDrawingRef.current) {
                          dCountedDrawingRef.current = true;
                          markPracticed(pName, pForm);
                          addXP(XP_AWARDS.PRACTICE, 'practice');
                        }
                        addFeedbackEntry(pName, pForm, t('reviewSelfAssessed'));
                        setProgressVersion(v => v + 1);
                      }
                    }
                  }
                  advanceDeckRef.current?.();
                } else if (rsReviewSession) {
                  if (apiKey === 'skip') {
                    const sess = reviewSessionRef.current;
                    if (sess && !sess.finished && dStrokesRef.current.length > 0) {
                      const item = sess.queue[sess.index];
                      const onTime = isReviewOnTime(item.letterName, item.formKey);
                      markPracticed(item.letterName, item.formKey);
                      updateSR(item.letterName, item.formKey, 3);
                      addFeedbackEntry(item.letterName, item.formKey, t('reviewSelfAssessed'));
                      addXP(XP_AWARDS.REVIEW_SELF, 'review-self');
                      if (onTime) addXP(XP_AWARDS.REVIEW_ON_TIME, 'review-on-time');
                      setProgressVersion(v => v + 1);
                    }
                  }
                  advanceReviewRef.current?.();
                } else if (practiceMode === 'words') {
                  const total = currentWordGroup.words.length;
                  selectWord(wordGroupIndex, (wordIndex + 1) % total);
                } else {
                  selectLetter((letterIndex + 1) % totalCount);
                }
              }}
              aria-label={t('ariaNextBtn')}
            >
              {t('btnNext')}
            </button>
            <button
              className="btn-clear"
              style={{
                ...styles.btn,
                ...styles.btnSave,
                opacity: dHasStrokes ? 1 : 0.35,
              }}
              onClick={eSaveDrawing}
              disabled={!dHasStrokes}
              aria-label={t('ariaSaveBtn')}
            >
              {t('btnSave')}
            </button>
            <button
              className="btn-nav"
              style={{
                ...styles.btn,
                ...styles.btnShare,
                opacity: dHasStrokes ? 1 : 0.35,
              }}
              onClick={eShareDrawing}
              disabled={!dHasStrokes}
              aria-label={t('ariaShareBtn')}
            >
              {t('btnShare')}
            </button>
          </div>

          {/* Feedback box */}
          {aiFeedback && (
            <div
              style={
                aiFeedback.error
                  ? { ...styles.feedbackBox, ...styles.feedbackError }
                  : styles.feedbackBox
              }
              role="region"
              aria-label={t('ariaTeacherFeedback')}
            >
              {aiFeedback.error ? (
                <span>{aiFeedback.error}</span>
              ) : (
                <>
                  {aiFeedback.score && (
                    <div style={styles.scoreRow}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <span
                          key={n}
                          style={n <= aiFeedback.score ? styles.starFilled : styles.starEmpty}
                        >
                          ★
                        </span>
                      ))}
                      <span style={styles.scoreLabel}>{t(SCORE_LABELS[aiFeedback.score])}</span>
                    </div>
                  )}
                  <div style={styles.feedbackLabel}>{t('feedbackLabel')}</div>
                  <p style={styles.feedbackText}>{aiFeedback.text}</p>
                </>
              )}
            </div>
          )}

          {celebrate && (
            <div className="score-celebrate" aria-hidden="true">
              ★
            </div>
          )}

          <XpGainToast
            gain={xpGain?.amount ?? 0}
            gainKey={xpGain?.key ?? 0}
            position={xpGain?.position}
            t={t}
            reduceMotion={reduceMotion}
          />

          {/* Comparison */}
          {}
          {aiFeedback && !aiFeedback.error && dCanvasSnapshotRef.current && (
            <div style={{ width: '100%', maxWidth: '520px' }}>
              <button
                className="btn-history"
                style={styles.comparisonToggle}
                onClick={() => setShowComparison(v => !v)}
                aria-expanded={showComparison}
              >
                {showComparison ? t('comparisonHide') : t('comparisonLabel')}
              </button>
              {showComparison && (
                <div style={styles.comparisonWrap}>
                  <div style={styles.comparisonPane}>
                    <span style={styles.comparisonLabel}>{t('comparisonRef')}</span>
                    <div
                      style={{
                        ...styles.comparisonRef,
                        ...(practiceMode === 'words' ? { fontSize: '60px', direction: 'rtl' } : {}),
                      }}
                      lang="ar"
                    >
                      {practiceMode === 'words' ? currentWord?.word : currentChar}
                    </div>
                  </div>
                  <div style={styles.comparisonPane}>
                    <span style={styles.comparisonLabel}>{t('comparisonAttempt')}</span>
                    <img
                      src={dCanvasSnapshotRef.current}
                      alt={t('comparisonAttempt')}
                      style={styles.comparisonAttempt}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Feedback history */}
          {history.length > 0 && (
            <div style={{ width: '100%', maxWidth: '520px' }}>
              <button
                className="btn-history"
                style={styles.historyToggle}
                onClick={() => setShowHistory(v => !v)}
                aria-expanded={showHistory}
              >
                {showHistory ? t('historyHide') : t('historyShow')} {t('historyOf')} (
                {history.length})
              </button>
              {showHistory && (
                <div style={styles.historyPanel}>
                  {history.map((entry, i) => (
                    <div key={i} style={styles.historyEntry}>
                      <div style={styles.historyDate}>
                        {new Date(entry.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                      <p style={styles.historyText}>{entry.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Alphabet / numerals / lesson / word row — hidden during guided
              review AND deck sessions so mid-session item clicks can't
              misattribute the next score to a different letter/word. */}
          {rsReviewSession || dsDeckSession ? (
            <div
              style={{
                padding: '8px 0',
                color: 'var(--color-text-soft)',
                fontSize: 13,
              }}
            >
              {dsDeckSession ? t('deckSessionActive') : t('reviewSessionActive')}
            </div>
          ) : practiceMode !== 'words' ? (
            <div
              style={styles.alphabetRow}
              className="alpha-row-wrap"
              role="listbox"
              aria-label={
                isNumbersMode
                  ? t('ariaNumberTab')
                  : isDiacriticsMode
                    ? t('ariaDiacriticTab')
                    : t('ariaSelectLetter')
              }
              aria-activedescendant={`letter-btn-${letterIndex}`}
            >
              {(useLessonOrder ? LESSON_ORDER : activeSet).map((item, idx) => {
                const l = useLessonOrder ? LETTERS[lessonToAlpha[idx]] : item;
                const status = progressSummary[l.name];
                return (
                  <button
                    key={idx}
                    ref={el => {
                      alphaBtnRef.current[idx] = el;
                    }}
                    className="btn-alpha"
                    id={`letter-btn-${idx}`}
                    style={{
                      ...styles.alphaBtn,
                      ...(idx === letterIndex ? styles.alphaBtnActive : {}),
                    }}
                    onClick={() => selectLetter(idx)}
                    onKeyDown={e => handleAlphaKeyDown(e, idx)}
                    title={`${l.name} /${l.roman}/`}
                    lang="ar"
                    role="option"
                    aria-selected={idx === letterIndex}
                    aria-label={
                      (isNumbersMode
                        ? t('ariaNumberTab')
                        : isDiacriticsMode
                          ? t('ariaDiacriticTab')
                          : t('ariaLetterBtn')) +
                      ': ' +
                      l.roman
                    }
                  >
                    {l.letter}
                    {status?.complete ? (
                      <span style={styles.dotComplete} />
                    ) : status?.started ? (
                      <span style={styles.dotStarted} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div
              style={styles.alphabetRow}
              className="alpha-row-wrap"
              role="listbox"
              aria-label={t('ariaSelectWord')}
            >
              {currentWordGroup?.words.map((w, idx) => (
                <button
                  key={idx}
                  className="btn-alpha"
                  style={{
                    ...styles.wordBtn,
                    ...(idx === wordIndex ? styles.alphaBtnActive : {}),
                  }}
                  onClick={() => selectWord(wordGroupIndex, idx)}
                  title={`${w.roman} — ${w.meaning}`}
                  lang="ar"
                  dir="rtl"
                  role="option"
                  aria-selected={idx === wordIndex}
                  aria-label={t('ariaWordBtn') + ': ' + w.roman}
                >
                  {w.word}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {undoDelete && (
        <UndoToast
          key={undoDelete.timestamp}
          message={t('undoDeleteMessage').replace('{name}', undoDelete.deletedDeck.name)}
          actionLabel={t('undo')}
          onUndo={handleUndoDelete}
          onDismiss={handleDismissUndo}
          dismissRef={deleteBtnRef}
        />
      )}
      <div
        style={{
          textAlign: 'center',
          padding: '12px 0 4px',
          fontSize: 12,
          color: 'var(--color-text-muted)',
        }}
      >
        <button
          onClick={() => {
            const el = document.getElementById('download-footer-panel');
            if (el) {
              el.style.display = el.style.display === 'none' ? 'block' : 'none';
            }
          }}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'Georgia,serif',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
        >
          {t('downloadTitle')}
        </button>
        <div
          id="download-footer-panel"
          style={{
            display: 'none',
            marginTop: 8,
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--color-border)',
            background: 'var(--color-card-bg)',
            maxWidth: 280,
            margin: '8px auto 0',
          }}
        >
          <p style={{ marginBottom: 8, fontSize: 11, lineHeight: 1.5 }}>{t('downloadDesc')}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <a
              href={
                dlLinks.win ||
                dlFallback ||
                'https://github.com/ExplorerZach/arabic-handwriting/releases/latest'
              }
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'var(--color-btn-alpha-bg)',
                color: 'var(--color-text)',
                fontSize: 12,
                textDecoration: 'none',
                fontFamily: 'Georgia,serif',
              }}
            >
              🪟 {t('downloadWindows')}
            </a>
            <a
              href={
                dlLinks.mac ||
                dlFallback ||
                'https://github.com/ExplorerZach/arabic-handwriting/releases/latest'
              }
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'var(--color-btn-alpha-bg)',
                color: 'var(--color-text)',
                fontSize: 12,
                textDecoration: 'none',
                fontFamily: 'Georgia,serif',
              }}
            >
              🍎 {t('downloadMacOS')}
            </a>
            <a
              href={
                dlLinks.linux ||
                dlFallback ||
                'https://github.com/ExplorerZach/arabic-handwriting/releases/latest'
              }
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
                background: 'var(--color-btn-alpha-bg)',
                color: 'var(--color-text)',
                fontSize: 12,
                textDecoration: 'none',
                fontFamily: 'Georgia,serif',
              }}
            >
              🐧 {t('downloadLinux')}
            </a>
          </div>
        </div>
      </div>

      {/* Account-switch prompt — a different account signed in on a device
          that still holds local progress from the previous account. Blocks
          all syncing until the user picks merge or discard. Rendered as an
          overlay (not an early return) so the canvas/state stay mounted.
          Guarded on userId so a sign-out in another tab closes it without
          a setState-in-effect reset. */}
      {scConflictPromptOpen && userId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
            fontFamily: 'Georgia,serif',
          }}
        >
          <div
            style={{
              maxWidth: 420,
              width: '90%',
              background: 'var(--color-bg)',
              borderRadius: 16,
              padding: 32,
              boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
              color: 'var(--color-text)',
              lineHeight: 1.6,
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{t('accountConflictTitle')}</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14 }}>{t('accountConflictBody')}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                onClick={() => scSetConflictChoice({ uid: userId, choice: 'merge' })}
                style={{
                  flex: 1,
                  minWidth: 120,
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#fff',
                  background: 'var(--color-accent)',
                }}
              >
                {t('accountConflictMerge')}
              </button>
              <button
                onClick={() => scSetConflictChoice({ uid: userId, choice: 'discard' })}
                style={{
                  flex: 1,
                  minWidth: 120,
                  padding: '10px 20px',
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer',
                  fontSize: 15,
                  color: 'var(--color-text)',
                  background: 'transparent',
                }}
              >
                {t('accountConflictDiscard')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
