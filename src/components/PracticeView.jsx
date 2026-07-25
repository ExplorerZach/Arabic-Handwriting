import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { LETTERS } from '../data/letters';
import { NUMBERS } from '../data/numbers';
import { DIACRITICS } from '../data/diacritics';
import { LESSON_ORDER, getLessonGroup } from '../data/lessonOrder';
import { calcLineWidth, setBrushScale } from '../utils/drawing';
import { getAIFeedback } from '../utils/api';
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
  snoozeDue,
  snoozeAllDue,
} from '../utils/progress';
import { addFeedbackEntry, getFeedbackHistory } from '../utils/history';
import { markDayActive } from '../utils/analytics';
import { exportBackup, importBackupFile } from '../utils/backup';
import STROKE_DATA from '../data/strokeOrder';
import { WORD_GROUPS } from '../data/words';
import { UI, FORM_NAMES, FORM_SHORT, FORM_FULL, FORM_DESCRIPTIONS } from '../locales';
import {
  getPaperColors,
  getBrushColor,
  getCanvasInkColor,
  drawPaperPattern,
} from '../styles/themes';
import styles from '../styles/practiceStyles';
import AnalyticsPanel from './AnalyticsPanel';
import LoginScreen from './LoginScreen';
import DailyGoalRing from './DailyGoalRing';
import SettingsPanel from './SettingsPanel';
import { playSuccessTone } from '../utils/sound';
import { getDailyGoal, setDailyGoal, getTodayProgress } from '../utils/dailyGoal';
import { getXPTotal, awardXP, XP_AWARDS } from '../utils/xp';
import LevelBadge from './LevelBadge';
import XpGainToast from './XpGainToast';
import UndoToast from './UndoToast';
import DeckManager from './DeckManager';
import { isTauri } from '../utils/env';
import { useDownloadLinks } from '../utils/downloads';
import { getItem, setItem } from '../utils/storage';
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

const SCORE_LABELS = {
  5: 'feedbackScoreExcellent',
  4: 'feedbackScoreGreat',
  3: 'feedbackScoreGood',
  2: 'feedbackScoreKeep',
  1: 'feedbackScoreStart',
};

const DEFAULT_MODEL = 'google/gemini-3-flash-preview';

export default function PracticeView({
  apiKey,
  onSetKey,
  onClearKey,
  locale,
  darkMode,
  onToggleDarkMode,
  onToggleLocale,
}) {
  const canvasRef = useRef(null);
  // Strokes are stored as { x, y, pressure, pointerType, newStroke } where x,y
  // are normalized 0–1 relative to the canvas rect. They get scaled to CSS
  // pixels at draw time, so window resize / orientation change re-places them
  // correctly instead of leaving them anchored to stale absolute coords.
  const strokesRef = useRef([]);
  const canvasSnapshotRef = useRef(null);
  const animFrameRef = useRef(null);
  const animatingRef = useRef(false);
  const glyphCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const compCanvasRef = useRef(null);
  // Holds the fully-revealed glyph bitmap left on screen after a "Show me"
  // animation finishes (when the user has no strokes of their own). redraw()
  // re-blits this so layout reflows / ResizeObserver repaints don't wipe the
  // finished letter. Cleared on any draw / clear / navigation.
  const restGlyphRef = useRef(null);
  const dprRef = useRef(devicePixelRatio || 1);
  const alphaBtnRefs = useRef([]);
  // Hidden <input type=file> used by the Settings "Import progress" button.
  const importInputRef = useRef(null);
  // Captures darkMode for redraw() without forcing redraw to change identity
  // (which would also change the ResizeObserver's callback). Kept in sync via
  // an effect below.
  const darkModeRef = useRef(darkMode);
  // Same pattern for brush color so redraw() can read it without being in deps.
  // Use a lazy initializer so we don't reference brushPack state before it's
  // declared below (TDZ). The effect further down keeps this ref in sync.
  const brushColorRef = useRef(getBrushColor(getItem('brush_pack') || 'classic', darkMode));
  // Mirrors paperTheme so redraw() can read the current theme without taking
  // it as a dep (which would invalidate the ResizeObserver on every theme
  // change). Kept in sync by the effect below.
  const paperThemeRef = useRef(getItem('app_theme') || 'parchment');
  // When the pointer leaves the canvas mid-stroke and re-enters without a
  // lift, the next pointermove would otherwise draw a straight line across
  // the gap. This flag forces the next recorded point to start a new stroke.
  const strokeResumedRef = useRef(false);

  // Whether the current drawing has already incremented practiceCount, so a
  // single drawing of a letter+form counts once regardless of how many
  // strokes it takes or whether AI feedback also fires. Reset whenever the
  // canvas is cleared or the user navigates to a different letter/form.
  const countedDrawingRef = useRef(false);

  const [letterIndex, setLetterIndex] = useState(0);
  const [formIndex, setFormIndex] = useState('isolated');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showHistory, setShowHistory] = useState(false);
  const [lessonMode, setLessonMode] = useState(() => getItem('lessonMode') === 'true');
  const [showComparison, setShowComparison] = useState(false);
  const [animating, setAnimating] = useState(false);
  // True while a fully-revealed "Show me" glyph is left resting on the canvas
  // (user has drawn nothing). Used to hide the DOM ghost div so the canvas's
  // own aligned faint ghost is the only one shown.
  const [restingGlyph, setRestingGlyph] = useState(false);
  const [practiceMode, setPracticeMode] = useState('letters');
  const [wordGroupIndex, setWordGroupIndex] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [model, setModel] = useState(() => getItem('openrouter_model') || DEFAULT_MODEL);
  const { links: dlLinks, fallback: dlFallback } = useDownloadLinks();
  const [brushValue, setBrushValue] = useState(() => {
    const v = parseFloat(getItem('brushScale') || '1');
    return Number.isFinite(v) ? v : 1;
  });
  const [templateScale, setTemplateScale] = useState(() => {
    const v = parseFloat(getItem('templateScale') || '1');
    return Number.isFinite(v) ? v : 1;
  });
  const [paperTheme, setPaperTheme] = useState(() => getItem('app_theme') || 'parchment');
  const [brushPack, setBrushPack] = useState(() => getItem('brush_pack') || 'classic');
  const [dailyGoalState, setDailyGoalState] = useState(() => getDailyGoal());
  const [dailyGoalInput, setDailyGoalInput] = useState(() => String(getDailyGoal()));
  const [reduceMotion, setReduceMotion] = useState(() => {
    const saved = getItem('reduce_motion');
    const initial =
      saved !== null
        ? saved === 'true'
        : (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
    document.documentElement.setAttribute('data-reduced-motion', String(initial));
    return initial;
  });
  const [highContrast, setHighContrast] = useState(() => getItem('high_contrast') === 'true');
  const [celebrate, setCelebrate] = useState(false);
  const [xpGain, setXpGain] = useState(null); // { amount, key } | null
  const xpGainTimerRef = useRef(null);
  const appTitleRef = useRef(null);
  const [soundEnabled, setSoundEnabled] = useState(() => getItem('sound_enabled') === 'true');
  // Bumps on every write to progress/history so derived summaries recompute
  // without us having to pipe state through every helper.
  const [progressVersion, setProgressVersion] = useState(0);

  // Controls the full-screen LoginScreen overlay that's launched from the
  // Settings panel's "Set/Change key" button.
  const [showKeyScreen, setShowKeyScreen] = useState(false);

  // Guided review session state
  const [reviewSession, setReviewSession] = useState(null);
  // { queue: DueItem[], index: number, summary: { letterName, letterChar, formKey, score }[], finished?: boolean }
  const reviewSessionRef = useRef(null);
  const advanceReviewRef = useRef(null);
  const RESUME_KEY = 'arabic_review_session';
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [stashedSession, setStashedSession] = useState(null);
  useEffect(() => {
    reviewSessionRef.current = reviewSession;
  }, [reviewSession]);

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

  // Stash review session to sessionStorage for resume on refresh
  useEffect(() => {
    if (reviewSession) {
      try {
        sessionStorage.setItem(RESUME_KEY, JSON.stringify(reviewSession));
        // eslint-disable-next-line no-empty
      } catch {}
    } else {
      sessionStorage.removeItem(RESUME_KEY);
    }
  }, [reviewSession, RESUME_KEY]);

  // Check for stashed session on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RESUME_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.queue && !parsed.finished) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setStashedSession(parsed);
          setShowResumePrompt(true);
        }
      }
      // eslint-disable-next-line no-empty
    } catch {}
  }, [RESUME_KEY]);

  useEffect(() => {
    document.documentElement.setAttribute('data-high-contrast', String(highContrast));
    setItem('high_contrast', String(highContrast));
  }, [highContrast]);

  useEffect(() => {
    document.documentElement.setAttribute('data-reduced-motion', String(reduceMotion));
    setItem('reduce_motion', String(reduceMotion));
  }, [reduceMotion]);

  useEffect(() => {
    return () => {
      if (xpGainTimerRef.current) clearTimeout(xpGainTimerRef.current);
    };
  }, []);

  const handleReduceMotionChange = v => {
    setReduceMotion(v);
  };

  const handleSoundToggle = v => {
    setSoundEnabled(v);
    setItem('sound_enabled', String(v));
  };

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

  // Strokes stored in normalized 0–1 coords → pixel-space path rendering.
  // Extracted so exportCanvas() can re-stroke onto an offscreen canvas with
  // a forced brush color (needed so dark-mode white strokes don't disappear
  // on the light-paper AI export).
  const drawStrokes = (ctx, points, W, H, brushColor) => {
    if (!points.length) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = brushColor;
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const x = pt.x * W;
      const y = pt.y * H;
      const width = calcLineWidth(pt.pressure ?? 0.5, pt.pointerType ?? 'touch');
      if (pt.newStroke || i === 0) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineWidth = width;
      } else {
        const prev = points[i - 1];
        const px = prev.x * W;
        const py = prev.y * H;
        const mx = (px + x) / 2;
        const my = (py + y) / 2;
        ctx.lineWidth = width;
        ctx.quadraticCurveTo(px, py, mx, my);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mx, my);
      }
    }
    ctx.stroke();
  };

  // redraw() must have STABLE identity — the ResizeObserver effect and undo
  // both depend on it, and changing it on every theme toggle would tear down
  // and rebuild the observer. darkMode, brushPack, and paperTheme are read
  // through refs that the effect below keeps in sync. Empty deps, always.
  const redraw = useCallback(points => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const W = rect.width;
    const H = rect.height;
    // Clear full bitmap (ctx is DPR-scaled, so draw in CSS pixel space).
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    const theme = paperThemeRef.current;
    // Draw paper pattern first so strokes appear on top
    if (theme === 'ruled' || theme === 'grid') {
      drawPaperPattern(ctx, W, H, theme, darkModeRef.current);
    }
    // Re-blit a finished "Show me" glyph (if any) so reflow-driven repaints
    // (ResizeObserver, theme sync) don't erase it. It's stored at full bitmap
    // resolution, so draw it under the identity transform.
    if (restGlyphRef.current && !points.length) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(restGlyphRef.current, 0, 0);
      ctx.restore();
      return;
    }
    drawStrokes(ctx, points, W, H, brushColorRef.current);
  }, []);

  const clearCanvas = useCallback(() => {
    strokesRef.current = [];
    restGlyphRef.current = null;
    setRestingGlyph(false);
    countedDrawingRef.current = false;
    setFeedback(null);
    setHasStrokes(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }, []);

  const selectLetter = useCallback(
    index => {
      setLetterIndex(index);
      setFormIndex('isolated');
      setShowHistory(false);
      setShowComparison(false);
      clearCanvas();
    },
    [clearCanvas],
  );

  const selectForm = useCallback(
    form => {
      setFormIndex(form);
      setShowHistory(false);
      setShowComparison(false);
      clearCanvas();
    },
    [clearCanvas],
  );

  const switchPracticeMode = useCallback(
    mode => {
      if (deckSessionRef.current) setDeckSession(null);
      setPracticeMode(mode);
      // Reset selection — letters (28) and numbers (10) have different lengths,
      // so a stale letterIndex/form could point past the smaller set.
      setLetterIndex(0);
      setFormIndex('isolated');
      setFeedback(null);
      setShowComparison(false);
      setShowHistory(false);
      alphaBtnRefs.current = [];
      clearCanvas();
    },
    [clearCanvas],
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
      setFeedback(null);
      setShowComparison(false);
      setShowHistory(false);
      clearCanvas();
    },
    [clearCanvas],
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
    alphaBtnRefs.current = [];
    clearCanvas();
  }, [clearCanvas]);

  // ─── Canvas sizing (HiDPI) ─────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      // setTransform (not scale — cumulative) so repeated resizes stay sane.
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw(strokesRef.current);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
    // practiceMode and !!reviewSession deps ensure the observer re-attaches
    // when the canvas mounts again after being unmounted (e.g. switching modes).
  }, [redraw, practiceMode, reviewSession]);

  // ─── Theme/brush sync → repaint existing strokes ───────
  // Keeps the refs that redraw() reads in step with state. Repaints so
  // existing strokes pick up the new color/paper immediately, even though
  // redraw itself has stable identity (so the ResizeObserver effect below
  // does not tear down on theme changes).

  useEffect(() => {
    darkModeRef.current = darkMode;
    brushColorRef.current = getBrushColor(brushPack, darkMode);
    paperThemeRef.current = paperTheme;
    redraw(strokesRef.current);
  }, [darkMode, brushPack, paperTheme, redraw]);

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

  const undoStroke = useCallback(() => {
    const strokes = strokesRef.current;
    if (!strokes.length) return;
    let i = strokes.length - 1;
    while (i > 0 && !strokes[i].newStroke) i--;
    strokesRef.current = strokes.slice(0, i);
    redraw(strokesRef.current);
    if (!strokesRef.current.length) setHasStrokes(false);
  }, [redraw]);

  // ─── Stroke order animation ────────────────────────────

  const drawReferenceGlyph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const W = rect.width;
    const H = rect.height;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    const theme = paperThemeRef.current;
    if (theme === 'ruled' || theme === 'grid') {
      drawPaperPattern(ctx, W, H, theme, darkModeRef.current);
    }
    // Draw the reference character as a full-opacity ghost.
    const fontSize = Math.min(W, H) * 0.65 * templateScale;
    ctx.save();
    ctx.font = `${fontSize}px "Scheherazade New", "Amiri", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = darkModeRef.current ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.25)';
    ctx.fillText(currentChar, W / 2, H / 2 + fontSize * 0.08);
    ctx.restore();
  }, [currentChar, templateScale]);

  const playStrokeAnimation = useCallback(async () => {
    const data = STROKE_DATA[letter.letter];
    if (!data || animatingRef.current) return;
    if (reduceMotion) {
      // Reveal the full reference glyph instantly instead of animating.
      drawReferenceGlyph();
      setRestingGlyph(true);
      return;
    }
    // Connected forms (initial/medial/final) render the same base glyph with
    // tatweel tails. The authored isolated paths drive reveal *order* while
    // source-in guarantees only real ink shows; the completion pass below then
    // reveals any ink the spine paths don't pass through (e.g. the tails).
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const dpr = dprRef.current;
    // Snapshot the user's drawing so we can restore it after the animation.
    const savedStrokes = strokesRef.current;
    strokesRef.current = [];
    restGlyphRef.current = null;
    setRestingGlyph(false);
    setHasStrokes(false);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const paperClear = getPaperColors(paperTheme, darkModeRef.current);
    ctx.fillStyle = paperClear.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawPaperPattern(ctx, canvas.width, canvas.height, paperTheme, darkModeRef.current);
    ctx.restore();
    animatingRef.current = true;
    setAnimating(true);
    setFeedback(null);
    setShowComparison(false);
    try {
      await document.fonts.ready;
      // eslint-disable-next-line no-empty
    } catch {}

    const W = canvas.width;
    const H = canvas.height;

    // ── Reference-square layout ─────────────────────────────
    // Stroke data was authored against a 0–100 square. We render the glyph
    // into that same square (centered on canvas, scaled to fit) so the
    // authored paths align with the actual letter shape regardless of font
    // metrics. This is far more robust than measureText bounding boxes.
    const CSS_SIZE = Math.min(200, rect.height * 0.8) * templateScale;
    const glyphSize = CSS_SIZE * dpr;
    const centerX = (rect.width / 2) * dpr;
    const centerY = (rect.height / 2) * dpr;
    const glyphX = centerX - glyphSize / 2;
    const glyphY = centerY - glyphSize / 2;

    const glyphCanvas = glyphCanvasRef.current ?? document.createElement('canvas');
    glyphCanvas.width = W;
    glyphCanvas.height = H;
    glyphCanvasRef.current = glyphCanvas;
    const gCtx = glyphCanvas.getContext('2d');
    gCtx.clearRect(0, 0, W, H);
    gCtx.save();
    gCtx.font = `${glyphSize}px "Amiri", "Scheherazade New", serif`;
    gCtx.fillStyle = getCanvasInkColor(darkModeRef.current);
    gCtx.textAlign = 'center';
    gCtx.textBaseline = 'middle';
    gCtx.direction = 'rtl';
    gCtx.fillText(currentChar, centerX, centerY);
    gCtx.restore();

    // Scan rendered pixels to find the actual visual bounding box of the glyph.
    // Arabic font metrics vary wildly per-glyph, so we can't trust em-square math.
    const pixels = gCtx.getImageData(0, 0, W, H).data;
    let minX = W,
      maxX = 0,
      minY = H,
      maxY = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (pixels[(y * W + x) * 4 + 3] > 16) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    // Fall back to theoretical square if the glyph wasn't rendered yet.
    if (minX > maxX || minY > maxY) {
      minX = glyphX;
      maxX = glyphX + glyphSize;
      minY = glyphY;
      maxY = glyphY + glyphSize;
    }
    const renderedW = maxX - minX;
    const renderedH = maxY - minY;

    const maskCanvas = maskCanvasRef.current ?? document.createElement('canvas');
    maskCanvas.width = W;
    maskCanvas.height = H;
    maskCanvasRef.current = maskCanvas;
    const mCtx = maskCanvas.getContext('2d');
    mCtx.clearRect(0, 0, W, H);

    // Map stroke coords (0–100 square) onto the actual rendered pixel bbox.
    const mapX = x => minX + (x / 100) * renderedW;
    const mapY = y => minY + (y / 100) * renderedH;

    const buildPolyline = pts => pts.map(p => ({ x: mapX(p.x), y: mapY(p.y) }));

    // Reveal brush is generous so it uncovers the full thickness of the glyph
    // stroke near the authored path (the paths run through the letter's spine,
    // not along its edges). Oversized reveal is clipped to real ink anyway.
    const BRUSH_RADIUS = Math.max(renderedW, renderedH) * 0.2;
    // Time-based pen speed (px/sec) so the reveal is slow, hand-like, and
    // framerate-independent. Scales with glyph size so big and small letters
    // take a similar amount of time; the divisor sets the "how slow" feel
    // (a full letter lands around ~2s rather than the old ~1s frame-rate sweep).
    const PIXELS_PER_SEC = Math.max(80, Math.max(renderedW, renderedH) / 3.0);

    const ops = [];
    for (const stroke of data.strokes) {
      const poly = buildPolyline(stroke);
      const lens = [0];
      for (let i = 1; i < poly.length; i++) {
        const dx = poly[i].x - poly[i - 1].x;
        const dy = poly[i].y - poly[i - 1].y;
        lens.push(lens[i - 1] + Math.hypot(dx, dy));
      }
      ops.push({ type: 'stroke', poly, lens, total: lens[lens.length - 1] });
    }
    for (const dot of data.dots) {
      ops.push({ type: 'dot', point: { x: mapX(dot.x), y: mapY(dot.y) } });
    }

    // The mask canvas accumulates an opaque "reveal" region as the brush
    // sweeps along each authored path. We never paint the brush color itself;
    // instead drawFrame uses this region to clip the *actual glyph ink*, so
    // whatever shows on screen is always real font pixels — never a path that
    // diverges from the letter. The authored paths only drive reveal order.
    const paintSegment = (from, to, radius) => {
      mCtx.beginPath();
      mCtx.moveTo(from.x, from.y);
      mCtx.lineTo(to.x, to.y);
      mCtx.strokeStyle = '#000';
      mCtx.lineWidth = radius * 2;
      mCtx.lineCap = 'round';
      mCtx.lineJoin = 'round';
      mCtx.stroke();
    };

    const pointAt = (poly, lens, d) => {
      if (d <= 0) return poly[0];
      const total = lens[lens.length - 1];
      if (d >= total) return poly[poly.length - 1];
      for (let i = 1; i < lens.length; i++) {
        if (lens[i] >= d) {
          const segLen = lens[i] - lens[i - 1];
          const tt = segLen === 0 ? 0 : (d - lens[i - 1]) / segLen;
          const a = poly[i - 1];
          const b = poly[i];
          return { x: a.x + (b.x - a.x) * tt, y: a.y + (b.y - a.y) * tt };
        }
      }
      return poly[poly.length - 1];
    };

    let opIdx = 0;
    let dist = 0;
    let prevPoint = null;
    // Brief lift between strokes/dots, like a hand repositioning the pen.
    const PAUSE_MS = 150;
    let pauseElapsed = 0;
    // Completion fill: once the ordered sweep is done we ramp a full-glyph
    // reveal so every pixel of ink shows, even ink the authored spine paths
    // never pass through (wave crests, tails on connected forms, extremities).
    const FILL_MS = 350;
    let fillElapsed = 0;
    // Wall-clock timestamp of the previous frame; advancement is time-based so
    // the speed is identical on 60Hz and 120Hz displays.
    let lastTs = null;

    // Compositing canvas: glyph ink clipped to the revealed mask region.
    const compCanvas = compCanvasRef.current ?? document.createElement('canvas');
    compCanvas.width = W;
    compCanvas.height = H;
    compCanvasRef.current = compCanvas;
    const cCtx = compCanvas.getContext('2d');

    // fillAlpha (0–1) fades in any not-yet-swept glyph ink at the end so the
    // full letter is always shown, never just the portion under the brush path.
    const drawFrame = (fillAlpha = 0) => {
      // Build "revealed glyph" = real glyph ink ∩ swept mask region.
      cCtx.save();
      cCtx.setTransform(1, 0, 0, 1, 0, 0);
      cCtx.clearRect(0, 0, W, H);
      cCtx.drawImage(maskCanvas, 0, 0); // opaque reveal region
      cCtx.globalCompositeOperation = 'source-in';
      cCtx.drawImage(glyphCanvas, 0, 0); // keep only glyph ink inside it
      cCtx.restore();

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const paperAnim = getPaperColors(paperTheme, darkModeRef.current);
      ctx.fillStyle = paperAnim.bg;
      ctx.fillRect(0, 0, W, H);
      drawPaperPattern(ctx, W, H, paperTheme, darkModeRef.current);
      // Faint ghost of the full glyph as a target outline
      ctx.globalAlpha = 0.14;
      ctx.drawImage(glyphCanvas, 0, 0);
      ctx.globalAlpha = 1;
      // Progressively revealed real glyph ink along the authored stroke order.
      ctx.drawImage(compCanvas, 0, 0);
      // Completion fill: fade in the remaining full-glyph ink on top so every
      // pixel ends up visible regardless of where the spine paths ran.
      if (fillAlpha > 0) {
        ctx.globalAlpha = fillAlpha;
        ctx.drawImage(glyphCanvas, 0, 0);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };

    const finish = () => {
      animatingRef.current = false;
      animFrameRef.current = null;
      setAnimating(false);
      strokesRef.current = savedStrokes;
      if (savedStrokes.length) {
        // User had their own drawing — restore it; the glyph was only a demo.
        restGlyphRef.current = null;
        setRestingGlyph(false);
        setHasStrokes(true);
        redraw(savedStrokes);
      } else {
        // No user strokes: keep the fully-revealed glyph as the resting frame.
        // Snapshot the glyph ink into a *dedicated* canvas (not glyphCanvasRef,
        // which gets cleared/reused on the next animation) so redraw() can
        // re-blit it over paper when a reflow repaint fires.
        const snap = document.createElement('canvas');
        snap.width = W;
        snap.height = H;
        snap.getContext('2d').drawImage(glyphCanvas, 0, 0);
        restGlyphRef.current = snap;
        setRestingGlyph(true);
        redraw([]);
      }
    };

    const animate = ts => {
      if (!animatingRef.current) return;
      // Seconds elapsed since the previous frame, clamped so a backgrounded
      // tab (which freezes rAF) doesn't teleport the pen on resume.
      if (lastTs === null) lastTs = ts;
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      if (opIdx >= ops.length) {
        // Completion fill: ramp fillAlpha 0→1 so any ink not reached by the
        // ordered sweep fades into view, then leave the full glyph revealed.
        if (fillElapsed < FILL_MS) {
          fillElapsed += dt * 1000;
          drawFrame(Math.min(1, fillElapsed / FILL_MS));
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        // Bake the whole glyph into the mask so the resting frame is complete.
        mCtx.save();
        mCtx.setTransform(1, 0, 0, 1, 0, 0);
        mCtx.globalCompositeOperation = 'source-over';
        mCtx.drawImage(glyphCanvas, 0, 0);
        mCtx.restore();
        drawFrame(0);
        finish();
        return;
      }
      const op = ops[opIdx];
      if (op.type === 'stroke') {
        if (prevPoint === null) {
          prevPoint = op.poly[0];
          mCtx.beginPath();
          mCtx.arc(prevPoint.x, prevPoint.y, BRUSH_RADIUS, 0, Math.PI * 2);
          mCtx.fillStyle = '#000';
          mCtx.fill();
          drawFrame();
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        if (dist < op.total) {
          dist = Math.min(dist + PIXELS_PER_SEC * dt, op.total);
          const nextPoint = pointAt(op.poly, op.lens, dist);
          paintSegment(prevPoint, nextPoint, BRUSH_RADIUS);
          prevPoint = nextPoint;
          drawFrame();
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        if (pauseElapsed < PAUSE_MS) {
          pauseElapsed += dt * 1000;
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        opIdx++;
        dist = 0;
        prevPoint = null;
        pauseElapsed = 0;
        animFrameRef.current = requestAnimationFrame(animate);
      } else if (op.type === 'dot') {
        const dp = op.point;
        mCtx.beginPath();
        mCtx.arc(dp.x, dp.y, BRUSH_RADIUS, 0, Math.PI * 2);
        mCtx.fillStyle = '#000';
        mCtx.fill();
        drawFrame();
        if (pauseElapsed < PAUSE_MS) {
          pauseElapsed += dt * 1000;
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        opIdx++;
        pauseElapsed = 0;
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    drawFrame();
    animFrameRef.current = requestAnimationFrame(animate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter.letter, currentChar, templateScale]);

  // Cancel in-flight animation when the user navigates away (letter, form,
  // or practice mode change) and on unmount. Resets the button state so it
  // doesn't stay disabled.
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      animatingRef.current = false;
      setAnimating(false);
      restGlyphRef.current = null;
      setRestingGlyph(false);
    };
  }, [letterIndex, formIndex, practiceMode]);

  // Keep dprRef in sync if the user moves the window to a different monitor
  // or zooms during an active session
  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    const mediaQuery = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const handler = () => {
      dprRef.current = window.devicePixelRatio || 1;
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // ─── Pointer events ────────────────────────────────

  const getPoint = e => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
      pressure: e.pressure > 0 ? e.pressure : 0.5,
      pointerType: e.pointerType || 'touch',
    };
  };

  const handlePointerDown = e => {
    e.preventDefault();
    const p = getPoint(e);
    if (!p) return;
    // Starting to draw dismisses any leftover "Show me" demo glyph.
    if (restGlyphRef.current) {
      restGlyphRef.current = null;
      setRestingGlyph(false);
      redraw([]);
    }
    strokeResumedRef.current = false;
    strokesRef.current.push({ ...p, newStroke: true });
    try {
      canvasRef.current?.setPointerCapture?.(e.pointerId);
      // eslint-disable-next-line no-empty
    } catch {}
    if (!hasStrokes) setHasStrokes(true);
  };

  const handlePointerMove = e => {
    e.preventDefault();
    if (e.buttons === 0) return;
    const p = getPoint(e);
    if (!p) return;
    const startNew = strokeResumedRef.current;
    strokeResumedRef.current = false;
    strokesRef.current.push({ ...p, newStroke: startNew });
    redraw(strokesRef.current);
  };

  const handlePointerUp = e => {
    e.preventDefault();
    try {
      canvasRef.current?.releasePointerCapture?.(e.pointerId);
      // eslint-disable-next-line no-empty
    } catch {}
    strokeResumedRef.current = false;
    // Mark today as active so streaks count for every practice session —
    // including words mode, review mode, and users who skipped the API key
    // and therefore never trigger the AI-feedback code path. Only bump
    // progressVersion when today was newly added (once per day per tab)
    // so we don't needlessly re-memoize on every stroke completion.
    let bump = markDayActive();
    // Count the letter as practiced once the user has actually drawn it,
    // independent of AI feedback (which is gated behind an API key and never
    // fires for no-key/words-mode users). Without this the practice heatmap
    // stays flat at its opacity floor for anyone who hasn't set a key.
    // Guarded so a single drawing counts once no matter how many strokes it
    // takes; cleared on clear/navigation so the next drawing recounts.
    if (
      (practiceMode === 'letters' || practiceMode === 'numbers' || practiceMode === 'diacritics') &&
      !countedDrawingRef.current &&
      strokesRef.current.length > 0
    ) {
      countedDrawingRef.current = true;
      markPracticed(letter.name, activeForm);
      addXP(XP_AWARDS.PRACTICE, 'practice');
      bump = true;
    }
    if (bump) setProgressVersion(v => v + 1);
  };

  const handlePointerLeave = e => {
    e.preventDefault();
    // If the pointer is still pressed, treat the next move as a fresh
    // stroke so we don't connect across the gap.
    if (e.buttons !== 0) strokeResumedRef.current = true;
  };

  // ─── Export for save (full-res PNG) ─────────────────

  const exportForSave = useCallback(() => {
    const canvas = canvasRef.current;
    const dpr = devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const offscreen = document.createElement('canvas');
    offscreen.width = rect.width * dpr;
    offscreen.height = rect.height * dpr;
    const ctx = offscreen.getContext('2d');
    // Paper theme background
    const paper = getPaperColors(paperTheme, darkMode);
    ctx.fillStyle = paper.bg;
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    drawPaperPattern(ctx, offscreen.width, offscreen.height, paperTheme, darkMode);
    const watermarkText = practiceMode === 'words' ? currentWord?.word : currentChar;
    const fontSize =
      (practiceMode === 'words' ? 0.25 : 0.5) * Math.min(offscreen.width, offscreen.height);
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#8b4513';
    ctx.font = `bold ${fontSize}px 'Amiri','Scheherazade New',serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(watermarkText, offscreen.width / 2, offscreen.height / 2);
    ctx.restore();
    ctx.drawImage(canvas, 0, 0);
    return offscreen.toDataURL('image/png');
  }, [darkMode, paperTheme, practiceMode, currentWord, currentChar]);

  const saveDrawing = useCallback(async () => {
    if (!strokesRef.current.length) return;
    const dataURL = exportForSave();
    const name =
      practiceMode === 'words'
        ? `arabic-${currentWord?.roman ?? 'word'}`
        : `arabic-${letter.name.toLowerCase()}-${activeForm}`;

    if (isTauri) {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const filePath = await save({
        defaultPath: `${name}.png`,
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      });
      if (!filePath) return;
      const res = await fetch(dataURL);
      const blob = await res.blob();
      const buf = await blob.arrayBuffer();
      await writeFile(filePath, new Uint8Array(buf));
      return;
    }

    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `${name}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [exportForSave, practiceMode, currentWord, letter.name, activeForm]);

  const shareDrawing = useCallback(async () => {
    if (!strokesRef.current.length) return;
    if (isTauri) {
      saveDrawing();
      return;
    }
    const dataURL = exportForSave();
    const name =
      practiceMode === 'words'
        ? `arabic-${currentWord?.roman ?? 'word'}`
        : `arabic-${letter.name.toLowerCase()}-${activeForm}`;
    if (navigator.share) {
      try {
        const res = await fetch(dataURL);
        const blob = await res.blob();
        const file = new File([blob], `${name}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Arabic Handwriting Practice',
          });
          return;
        }
        // eslint-disable-next-line no-empty
      } catch {}
    }
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `${name}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [exportForSave, practiceMode, currentWord, letter.name, activeForm, saveDrawing]);
  // ─── Guided review session helpers ─────────────────

  const enterReviewItem = useCallback(
    (letterName, formKey) => {
      if (letterName.startsWith('Num')) {
        const numIdx = NUMBERS.findIndex(n => n.name === letterName);
        if (numIdx === -1) return;
        setLetterIndex(numIdx);
        setFormIndex('isolated');
      } else if (letterName.startsWith('Diacritic')) {
        const diaIdx = DIACRITICS.findIndex(d => d.name === letterName);
        if (diaIdx === -1) return;
        setLetterIndex(diaIdx);
        setFormIndex('isolated');
      } else {
        const alphIdx = LETTERS.findIndex(l => l.name === letterName);
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
    [lessonMode, lessonToAlpha, clearCanvas],
  );

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

  const exitReviewSession = useCallback(() => {
    setReviewSession(null);
  }, []);

  const advanceReview = useCallback(
    (score, { snoozed = false } = {}) => {
      const sess = reviewSessionRef.current;
      if (!sess || sess.finished) return;
      const item = sess.queue[sess.index];
      const skipped = score == null && !snoozed;
      const summary = [...sess.summary, { ...item, score, skipped, snoozed }];
      const nextIndex = sess.index + 1;
      if (nextIndex >= sess.queue.length) {
        setReviewSession({ ...sess, summary, finished: true });
      } else {
        setReviewSession({ ...sess, index: nextIndex, summary });
        enterReviewItem(sess.queue[nextIndex].letterName, sess.queue[nextIndex].formKey);
      }
    },
    [enterReviewItem],
  );

  // eslint-disable-next-line react-hooks/refs
  advanceReviewRef.current = advanceReview;

  // Snooze the item currently being reviewed and move on, without
  // touching its SM-2 mastery data.
  const handleSnoozeCurrentItem = useCallback(() => {
    const sess = reviewSessionRef.current;
    if (!sess || sess.finished) return;
    const item = sess.queue[sess.index];
    snoozeDue(item.letterName, item.formKey);
    setProgressVersion(v => v + 1);
    advanceReviewRef.current?.(null, { snoozed: true });
  }, []);

  // Snooze a single letter+form from the due-review dashboard grid.
  const handleSnoozeItem = useCallback((letterName, formKey) => {
    snoozeDue(letterName, formKey);
    setProgressVersion(v => v + 1);
  }, []);

  // Snooze every currently-due item at once (bulk "Reset due list").
  const handleResetDueList = useCallback(() => {
    if (!dueItems.length) return;
    snoozeAllDue(dueItems);
    setProgressVersion(v => v + 1);
  }, [dueItems]);

  // ─── Navigate to letter from review dashboard ──────────

  const goToReviewItem = useCallback(
    (letterName, formKey) => {
      // Numerals (name prefixed "Num") live in NUMBERS, not the alphabet.
      if (letterName.startsWith('Num')) {
        const numIdx = NUMBERS.findIndex(n => n.name === letterName);
        if (numIdx === -1) return;
        setLetterIndex(numIdx);
        setFormIndex('isolated');
        setPracticeMode('numbers');
        setFeedback(null);
        setShowComparison(false);
        setShowHistory(false);
        alphaBtnRefs.current = [];
        clearCanvas();
        return;
      }
      // Diacritics (name prefixed "Diacritic") live in DIACRITICS.
      if (letterName.startsWith('Diacritic')) {
        const diaIdx = DIACRITICS.findIndex(d => d.name === letterName);
        if (diaIdx === -1) return;
        setLetterIndex(diaIdx);
        setFormIndex('isolated');
        setPracticeMode('diacritics');
        setFeedback(null);
        setShowComparison(false);
        setShowHistory(false);
        alphaBtnRefs.current = [];
        clearCanvas();
        return;
      }
      const alphIdx = LETTERS.findIndex(l => l.name === letterName);
      if (alphIdx === -1) return;
      if (lessonMode) {
        const lessonIdx = lessonToAlpha.indexOf(alphIdx);
        setLetterIndex(lessonIdx !== -1 ? lessonIdx : 0);
      } else {
        setLetterIndex(alphIdx);
      }
      setFormIndex(formKey);
      setPracticeMode('letters');
      setFeedback(null);
      setShowComparison(false);
      setShowHistory(false);
      alphaBtnRefs.current = [];
      clearCanvas();
    },
    [lessonMode, lessonToAlpha, clearCanvas],
  );

  const goToAnalyticsItem = useCallback(
    (letterName, formKey) => {
      let targetSet = 'letters';
      let idx = LETTERS.findIndex(l => l.name === letterName);

      if (idx === -1) {
        idx = NUMBERS.findIndex(l => l.name === letterName);
        if (idx !== -1) {
          targetSet = 'numbers';
        } else {
          idx = DIACRITICS.findIndex(l => l.name === letterName);
          if (idx !== -1) targetSet = 'diacritics';
        }
      }

      if (idx === -1) return;

      if (targetSet === 'letters' && lessonMode) {
        const lessonIdx = lessonToAlpha.indexOf(idx);
        setLetterIndex(lessonIdx !== -1 ? lessonIdx : 0);
      } else {
        setLetterIndex(idx);
      }

      setFormIndex(formKey);
      setPracticeMode(targetSet);
      setFeedback(null);
      setShowComparison(false);
      setShowHistory(false);
      alphaBtnRefs.current = [];
      clearCanvas();
    },
    [lessonMode, lessonToAlpha, clearCanvas],
  );

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
        const allForms = Object.keys(l.forms);
        const formKeys =
          item.formKey && allForms.includes(item.formKey) ? [item.formKey] : allForms;
        return {
          glyph: l.letter,
          name: l.name,
          roman: l.roman,
          formKeys,
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
      // NOTE: deckSessionRef only syncs via a useEffect one render after
      // setDeckSession, so it can still be null/stale here when this is
      // called synchronously right after setDeckSession (e.g. from
      // startDeckSession). Don't gate on `sess` being non-null — prefer the
      // explicitly-passed itemArg (always provided by session-start callers)
      // and only fall back to the ref's queue for callers that omit itemArg
      // (advanceDeck's item-to-item transitions, where the ref is already
      // populated from the session's earlier renders).
      const sess = deckSessionRef.current;
      const item = itemArg || (sess && sess.queue[idx]);
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

  const buildLowScoreQueue = useCallback(deckId => {
    const deck = getDeck(deckId);
    if (!deck || !deck.lastSession || !deck.lastSession.items) return [];
    // Filter to entries still in the deck — items removed since the last
    // session must not be re-practiced (spec edge case #4, no stale refs).
    return deck.lastSession.items
      .filter(
        e =>
          (e.score == null || e.score <= 3) &&
          deck.items.some(i => i.type === e.type && i.ref === e.ref),
      )
      .map(e => ({ type: e.type, ref: e.ref, formKey: e.formKey }));
  }, []);

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

  const startDeckSession = useCallback(
    (deck, mode = 'full') => {
      if (reviewSessionRef.current) return; // conflict guard — can't start during auto review
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
      const currentFormKey = currentFormIdx !== -1 ? formKeys[currentFormIdx] : formKeys[0];
      const isLastForm = currentFormIdx === -1 || currentFormIdx === formKeys.length - 1;
      const skipped = score == null;
      const summary = [
        ...sess.summary,
        {
          item,
          formKey: currentFormKey,
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
          // Session finished — write lastSession before marking finished.
          const scored = summary.filter(s => s.score != null);
          const avgScore =
            scored.length > 0 ? scored.reduce((sum, s) => sum + s.score, 0) / scored.length : null;
          setLastSession(sess.deckId, {
            date: todayLocal(),
            mode: sess.mode || 'full',
            avgScore,
            items: summary.map(s => ({
              ref: s.item.ref,
              type: s.item.type,
              formKey: s.formKey,
              score: s.score,
            })),
          });
          refreshDecks();
          setDeckSession({ ...sess, summary, finished: true });
        } else {
          setDeckSession({ ...sess, index: nextIndex, summary });
          enterDeckItem(nextIndex);
        }
      }
    },
    [activeForm, resolveDeckItem, enterDeckItem, clearCanvas, refreshDecks],
  );

  // eslint-disable-next-line react-hooks/refs
  advanceDeckRef.current = advanceDeck;

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

  // ─── Canvas export (AI, JPEG 512px) ──────────────────

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    const dpr = devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const offscreen = document.createElement('canvas');
    offscreen.width = rect.width * dpr;
    offscreen.height = rect.height * dpr;
    const ctx = offscreen.getContext('2d');
    // Force light paper for AI export — the model is trained on the
    // light-parchment look, and a dark background would tank scoring.
    const paper = getPaperColors(paperTheme, false);
    ctx.fillStyle = paper.bg;
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    drawPaperPattern(ctx, offscreen.width, offscreen.height, paperTheme, false);
    const watermarkText = practiceMode === 'words' ? currentWord?.word : currentChar;
    const fontSize =
      practiceMode === 'words'
        ? Math.min(offscreen.width, offscreen.height) * 0.25
        : Math.min(offscreen.width, offscreen.height) * 0.5;
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#8b4513';
    ctx.font = `bold ${fontSize}px 'Amiri','Scheherazade New',serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(watermarkText, offscreen.width / 2, offscreen.height / 2);
    ctx.restore();
    // Re-stroke from strokesRef with the FORCED-LIGHT brush color rather
    // than drawImage()ing the live canvas — a dark-mode user draws in
    // white, and white strokes on light parchment are nearly invisible
    // to the vision model.
    ctx.save();
    ctx.scale(dpr, dpr);
    const exportBrush = getBrushColor(brushPack, false);
    drawStrokes(ctx, strokesRef.current, rect.width, rect.height, exportBrush);
    ctx.restore();
    const MAX_SIZE = 512;
    const scale = Math.min(1, MAX_SIZE / Math.max(offscreen.width, offscreen.height));
    const compressed = document.createElement('canvas');
    compressed.width = Math.round(offscreen.width * scale);
    compressed.height = Math.round(offscreen.height * scale);
    compressed.getContext('2d').drawImage(offscreen, 0, 0, compressed.width, compressed.height);
    return compressed.toDataURL('image/jpeg', 0.85).split(',')[1];
  };

  // ─── AI feedback ────────────────────────────────

  const requestFeedback = async () => {
    if (strokesRef.current.length < 5) {
      setFeedback({
        error: practiceMode === 'words' ? t('hintDrawWordFirst') : t('hintDrawFirst'),
      });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const imageBase64 = exportCanvas();
      canvasSnapshotRef.current = `data:image/jpeg;base64,${imageBase64}`;
      let text;
      if (practiceMode === 'words' && currentWord) {
        text = await getAIFeedback(
          apiKey,
          imageBase64,
          currentWord.word,
          currentWord.word,
          currentWord.roman,
          `word "${currentWord.meaning}"`,
        );
      } else if (isNumbersMode || isDiacriticsMode) {
        text = await getAIFeedback(
          apiKey,
          imageBase64,
          letter.name,
          letter.letter,
          letter.roman,
          isNumbersMode ? 'Arabic numeral' : 'Arabic diacritic (harakat)',
        );
      } else {
        text = await getAIFeedback(
          apiKey,
          imageBase64,
          letter.name,
          letter.letter,
          letter.roman,
          t(FORM_FULL[activeForm]),
        );
      }
      const scoreMatch = text.match(/\[SCORE:\s*([1-5])\s*\]/i);
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
      const cleanText = text.replace(/\[SCORE:\s*[1-5]\s*\]\s*/gi, '').trim();
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
        // Only count if drawing the strokes didn't already count this drawing
        // (handlePointerUp counts on draw), so submitting feedback on a letter
        // you just drew doesn't double-count it in the heatmap.
        if (!countedDrawingRef.current) {
          countedDrawingRef.current = true;
          markPracticed(progressName, progressForm);
        }
        if (score) {
          // Compute on-time BEFORE updateSR overwrites lastReview.
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
          // Celebrate + sound on a strong score (wires the dormant #16
          // scaffolding: setCelebrate / playSuccessTone were imported but
          // never previously invoked).
          if (score >= 4) {
            setCelebrate(true);
            setTimeout(() => setCelebrate(false), 850);
            if (soundEnabled) playSuccessTone();
          }
        }
        addFeedbackEntry(progressName, progressForm, cleanText);
        setProgressVersion(v => v + 1);
      }
      setFeedback({ text: cleanText, score });
      setShowComparison(true);
      if (score && reviewSessionRef.current && !reviewSessionRef.current.finished) {
        setTimeout(() => {
          advanceReviewRef.current?.(score);
        }, 1400);
      }
      if (score && deckSessionRef.current && !deckSessionRef.current.finished) {
        setTimeout(() => {
          advanceDeckRef.current?.(score);
        }, 1400);
      }
    } catch (err) {
      setFeedback({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ─── Model / brush slider handlers (controlled) ─────

  const handleModelChange = ev => {
    const v = ev.target.value;
    setModel(v);
    setItem('openrouter_model', v);
  };

  const handleDailyGoalChange = ev => {
    const raw = ev.target.value;
    setDailyGoalInput(raw);
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      const value = setDailyGoal(n);
      setDailyGoalState(value);
    }
  };

  const handleDailyGoalBlur = () => {
    const n = parseInt(dailyGoalInput, 10);
    if (Number.isFinite(n) && n > 0) {
      const value = setDailyGoal(n);
      setDailyGoalState(value);
      setDailyGoalInput(String(value));
    } else {
      setDailyGoalInput(String(dailyGoalState));
    }
  };

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
  }, []);

  const handleBrushChange = ev => {
    const v = parseFloat(ev.target.value);
    const safe = Number.isFinite(v) ? v : 1;
    setBrushValue(safe);
    setBrushScale(safe);
  };

  const handleTemplateScaleChange = ev => {
    const v = parseFloat(ev.target.value);
    const safe = Number.isFinite(v) ? v : 1;
    setTemplateScale(safe);
    setItem('templateScale', String(safe));
    if (restGlyphRef.current) {
      restGlyphRef.current = null;
      setRestingGlyph(false);
      redraw(strokesRef.current);
    }
  };

  const handleThemeChange = themeId => {
    setPaperTheme(themeId);
    setItem('app_theme', themeId);
    redraw(strokesRef.current);
  };

  const handleBrushPackChange = packId => {
    setBrushPack(packId);
    setItem('brush_pack', packId);
    brushColorRef.current = getBrushColor(packId, darkMode);
    redraw(strokesRef.current);
  };

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
        setTimeout(() => alphaBtnRefs.current[next]?.focus(), 0);
      }
      if (e.key === 'Home') {
        e.preventDefault();
        selectLetter(0);
        setTimeout(() => alphaBtnRefs.current[0]?.focus(), 0);
      }
      if (e.key === 'End') {
        e.preventDefault();
        selectLetter(total - 1);
        setTimeout(() => alphaBtnRefs.current[total - 1]?.focus(), 0);
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
              opacity: deckSession || reviewSession ? 0.35 : 1,
            }}
            onClick={toggleLessonMode}
            disabled={!!(deckSession || reviewSession)}
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
        />
      )}

      {/* Mode tabs */}
      <div style={styles.modeTabs} role="tablist" aria-label={t('ariaPracticeMode')}>
        <button
          className="btn-form"
          style={{
            ...styles.modeTab,
            ...(practiceMode === 'letters' ? styles.modeTabActive : {}),
          }}
          onClick={() => switchPracticeMode('letters')}
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
          }}
          onClick={() => switchPracticeMode('numbers')}
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
          }}
          onClick={() => switchPracticeMode('words')}
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
          }}
          onClick={() => switchPracticeMode('diacritics')}
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
          }}
          onClick={() => switchPracticeMode('review')}
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
          }}
          onClick={() => switchPracticeMode('stats')}
          role="tab"
          aria-selected={practiceMode === 'stats'}
          aria-label={t('tabStats')}
          id="tab-stats"
        >
          {t('tabStats')}
        </button>
      </div>

      {/* Review dashboard */}
      {practiceMode === 'review' && !reviewSession && !deckSession && (
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
              {showResumePrompt && stashedSession && (
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
                      onClick={() => {
                        setReviewSession(stashedSession);
                        enterReviewItem(
                          stashedSession.queue[stashedSession.index].letterName,
                          stashedSession.queue[stashedSession.index].formKey,
                        );
                        setShowResumePrompt(false);
                        setStashedSession(null);
                      }}
                    >
                      {t('reviewResumeYes')}
                    </button>
                    <button
                      className="btn-clear"
                      style={{ ...styles.btn, flex: 1 }}
                      onClick={() => {
                        sessionStorage.removeItem(RESUME_KEY);
                        setShowResumePrompt(false);
                        setStashedSession(null);
                      }}
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
                    onClick={handleResetDueList}
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
                          onClick={() => goToReviewItem(letterName, formKey)}
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
                            handleSnoozeItem(letterName, formKey);
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
                    onClick={startReviewSession}
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
          onGoToItem={goToAnalyticsItem}
        />
      )}

      {/* Practice UI (hidden in review/stats mode unless in a guided session) */}
      {((practiceMode !== 'review' && practiceMode !== 'stats') ||
        reviewSession ||
        deckSession) && (
        <>
          {reviewSession && !reviewSession.finished && (
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
                  {t('reviewProgressLabel')} {reviewSession.index + 1} /{' '}
                  {reviewSession.queue.length}
                </span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn-clear"
                    onClick={handleSnoozeCurrentItem}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    aria-label={t('ariaSnoozeItem')}
                    title={t('ariaSnoozeItem')}
                  >
                    {t('btnSnooze')}
                  </button>
                  <button
                    className="btn-clear"
                    onClick={exitReviewSession}
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
                    width: `${(reviewSession.index / reviewSession.queue.length) * 100}%`,
                    height: '100%',
                    background: 'var(--color-accent)',
                    borderRadius: 99,
                    transition: 'width 0.25s ease',
                  }}
                />
              </div>
            </div>
          )}

          {deckSession && !deckSession.finished && (
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
          )}

          {reviewSession?.finished && (
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
                {reviewSession.summary.length} {t('reviewedItemsLabel')}
              </p>
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  marginBottom: 12,
                }}
              >
                {reviewSession.summary.map((item, i) => (
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
              <button className="btn-nav" onClick={exitReviewSession} style={styles.btn}>
                {t('btnDone')}
              </button>
            </div>
          )}

          {deckSession?.finished && (
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
                const scored = deckSession.summary.filter(s => s.score != null);
                const avg =
                  scored.length > 0
                    ? (scored.reduce((sum, s) => sum + s.score, 0) / scored.length).toFixed(1)
                    : null;
                const lowCount = deckSession.summary.filter(
                  s => s.score == null || s.score <= 3,
                ).length;
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
                      ...(deckSession || reviewSession ? { opacity: 0.35 } : {}),
                    }}
                    onClick={() => selectForm(key)}
                    disabled={!!(deckSession || reviewSession)}
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
          {practiceMode === 'words' && !deckSession && (
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
            {practiceMode !== 'words' ? (
              // Hidden while the canvas is showing its own (aligned) glyph — during
              // a "Show me" animation or while a revealed glyph rests on the canvas.
              // Otherwise the centered CSS ghost wouldn't coincide with the canvas
              // glyph and would read as a misaligned double image.
              <div
                style={{
                  ...styles.ghostLetter,
                  fontSize: `${200 * templateScale}px`,
                  opacity: animating || restingGlyph ? 0 : (styles.ghostLetter.opacity ?? 1),
                }}
                lang="ar"
              >
                {currentChar}
              </div>
            ) : (
              <div
                style={{
                  ...styles.ghostWord,
                  fontSize: `${100 * templateScale}px`,
                }}
                lang="ar"
                dir="rtl"
              >
                {currentWord?.word}
              </div>
            )}
            <canvas
              ref={canvasRef}
              id="main-canvas"
              style={styles.canvas}
              tabIndex={0}
              role="application"
              aria-label={t('ariaCanvas')}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerLeave}
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
                opacity: deckSession || reviewSession ? 0.35 : 1,
              }}
              onClick={() => {
                if (deckSession || reviewSession) return;
                if (practiceMode === 'words') {
                  const total = currentWordGroup.words.length;
                  selectWord(wordGroupIndex, (wordIndex - 1 + total) % total);
                } else {
                  selectLetter((letterIndex - 1 + totalCount) % totalCount);
                }
              }}
              disabled={!!(deckSession || reviewSession)}
              aria-label={t('ariaPrevBtn')}
            >
              {t('btnPrev')}
            </button>
            <button
              className="btn-clear"
              style={{ ...styles.btn, ...styles.btnClear }}
              onClick={undoStroke}
              aria-label={t('ariaUndoBtn')}
            >
              {t('btnUndo')}
            </button>
            <button
              className="btn-clear"
              style={{ ...styles.btn, ...styles.btnClear }}
              onClick={clearCanvas}
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
                  opacity: animating ? 0.35 : 1,
                }}
                onClick={playStrokeAnimation}
                disabled={animating}
                aria-label={t('ariaShowMeBtn')}
              >
                {animating ? t('btnShowMePlaying') : t('btnShowMe')}
              </button>
            )}
            <button
              className="btn-ai"
              style={{
                ...styles.btn,
                ...styles.btnAI,
                opacity: loading || !apiKey || apiKey === 'skip' || !isOnline ? 0.35 : 1,
              }}
              onClick={requestFeedback}
              disabled={loading || !apiKey || apiKey === 'skip' || !isOnline}
              aria-label={t('ariaAIFeedbackBtn')}
              aria-busy={loading}
            >
              {loading
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
                if (deckSession) {
                  if (apiKey === 'skip') {
                    const sess = deckSessionRef.current;
                    if (sess && !sess.finished && strokesRef.current.length > 0) {
                      const item = sess.queue[sess.index];
                      const resolved = resolveDeckItem(item);
                      if (resolved) {
                        const pName =
                          resolved.practiceMode === 'words' ? resolved.name : resolved.obj.name;
                        const pForm = resolved.practiceMode === 'words' ? 'word' : activeForm;
                        if (!countedDrawingRef.current) {
                          countedDrawingRef.current = true;
                          markPracticed(pName, pForm);
                          addXP(XP_AWARDS.PRACTICE, 'practice');
                        }
                        addFeedbackEntry(pName, pForm, t('reviewSelfAssessed'));
                        setProgressVersion(v => v + 1);
                      }
                    }
                  }
                  advanceDeckRef.current?.();
                } else if (reviewSession) {
                  if (apiKey === 'skip') {
                    const sess = reviewSessionRef.current;
                    if (sess && !sess.finished && strokesRef.current.length > 0) {
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
                opacity: hasStrokes ? 1 : 0.35,
              }}
              onClick={saveDrawing}
              disabled={!hasStrokes}
              aria-label={t('ariaSaveBtn')}
            >
              {t('btnSave')}
            </button>
            <button
              className="btn-nav"
              style={{
                ...styles.btn,
                ...styles.btnShare,
                opacity: hasStrokes ? 1 : 0.35,
              }}
              onClick={shareDrawing}
              disabled={!hasStrokes}
              aria-label={t('ariaShareBtn')}
            >
              {t('btnShare')}
            </button>
          </div>

          {/* Feedback box */}
          {feedback && (
            <div
              style={
                feedback.error
                  ? { ...styles.feedbackBox, ...styles.feedbackError }
                  : styles.feedbackBox
              }
              role="region"
              aria-label={t('ariaTeacherFeedback')}
            >
              {feedback.error ? (
                <span>{feedback.error}</span>
              ) : (
                <>
                  {feedback.score && (
                    <div style={styles.scoreRow}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <span
                          key={n}
                          style={n <= feedback.score ? styles.starFilled : styles.starEmpty}
                        >
                          ★
                        </span>
                      ))}
                      <span style={styles.scoreLabel}>{t(SCORE_LABELS[feedback.score])}</span>
                    </div>
                  )}
                  <div style={styles.feedbackLabel}>{t('feedbackLabel')}</div>
                  <p style={styles.feedbackText}>{feedback.text}</p>
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
          {/* eslint-disable-next-line react-hooks/refs */}
          {feedback && !feedback.error && canvasSnapshotRef.current && (
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
                      // eslint-disable-next-line react-hooks/refs
                      src={canvasSnapshotRef.current}
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
          {reviewSession || deckSession ? (
            <div
              style={{
                padding: '8px 0',
                color: 'var(--color-text-soft)',
                fontSize: 13,
              }}
            >
              {deckSession ? t('deckSessionActive') : t('reviewSessionActive')}
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
                      alphaBtnRefs.current[idx] = el;
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
    </div>
  );
}
