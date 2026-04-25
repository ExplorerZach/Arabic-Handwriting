import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { LETTERS } from '../data/letters';
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
} from '../utils/progress';
import { addFeedbackEntry, getFeedbackHistory } from '../utils/history';
import { markDayActive } from '../utils/analytics';
import STROKE_DATA from '../data/strokeOrder';
import { WORD_GROUPS } from '../data/words';
import { UI, FORM_NAMES, FORM_SHORT, FORM_FULL, FORM_DESCRIPTIONS } from '../locales';
import { PAPER_THEMES, BRUSH_PACKS, getPaperColors, getBrushColor, drawPaperPattern } from '../styles/themes';
import styles from '../styles/practiceStyles';
import AnalyticsPanel from './AnalyticsPanel';
import LoginScreen from './LoginScreen';

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
  const alphaBtnRefs = useRef([]);
  // Captures darkMode for redraw() without forcing redraw to change identity
  // (which would also change the ResizeObserver's callback). Kept in sync via
  // an effect below.
  const darkModeRef = useRef(darkMode);
  // Same pattern for brush color so redraw() can read it without being in deps.
  // Use a lazy initializer so we don't reference brushPack state before it's
  // declared below (TDZ). The effect further down keeps this ref in sync.
  const brushColorRef = useRef(
    getBrushColor(localStorage.getItem('brush_pack') || 'classic', darkMode)
  );
  // Mirrors paperTheme so redraw() can read the current theme without taking
  // it as a dep (which would invalidate the ResizeObserver on every theme
  // change). Kept in sync by the effect below.
  const paperThemeRef = useRef(localStorage.getItem('app_theme') || 'parchment');
  // When the pointer leaves the canvas mid-stroke and re-enters without a
  // lift, the next pointermove would otherwise draw a straight line across
  // the gap. This flag forces the next recorded point to start a new stroke.
  const strokeResumedRef = useRef(false);

  const [letterIndex, setLetterIndex] = useState(0);
  const [formIndex, setFormIndex] = useState('isolated');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showHistory, setShowHistory] = useState(false);
  const [lessonMode, setLessonMode] = useState(
    () => localStorage.getItem('lessonMode') === 'true'
  );
  const [showComparison, setShowComparison] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [practiceMode, setPracticeMode] = useState('letters');
  const [wordGroupIndex, setWordGroupIndex] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [model, setModel] = useState(
    () => localStorage.getItem('openrouter_model') || DEFAULT_MODEL
  );
  const [brushValue, setBrushValue] = useState(() => {
    const v = parseFloat(localStorage.getItem('brushScale') || '1');
    return Number.isFinite(v) ? v : 1;
  });
  const [paperTheme, setPaperTheme] = useState(
    () => localStorage.getItem('app_theme') || 'parchment'
  );
  const [brushPack, setBrushPack] = useState(
    () => localStorage.getItem('brush_pack') || 'classic'
  );
  // Bumps on every write to progress/history so derived summaries recompute
  // without us having to pipe state through every helper.
  const [progressVersion, setProgressVersion] = useState(0);

  // Controls the full-screen LoginScreen overlay that's launched from the
  // Settings panel's "Set/Change key" button.
  const [showKeyScreen, setShowKeyScreen] = useState(false);

  const t = (key) => UI[locale][key] ?? key;

  // Static mapping from lesson index → alphabetical index; both inputs are
  // frozen imports, so compute once.
  const lessonToAlpha = useMemo(
    () => LESSON_ORDER.map((ch) => LETTERS.findIndex((l) => l.letter === ch)),
    []
  );

  const actualLetterIndex = lessonMode ? (lessonToAlpha[letterIndex] ?? 0) : letterIndex;
  const letter = LETTERS[actualLetterIndex];
  const formKeys = Object.keys(letter.forms);
  const activeForm = formKeys.includes(formIndex) ? formIndex : 'isolated';
  const currentChar = letter.forms[activeForm];
  const totalCount = lessonMode ? LESSON_ORDER.length : LETTERS.length;
  const lessonGroupInfo = lessonMode ? getLessonGroup(letterIndex) : null;

  const currentWordGroup = WORD_GROUPS[wordGroupIndex];
  const currentWord = currentWordGroup?.words[wordIndex];

  // Batched progress reads: one load() per render instead of 56+.
  const progressSummary = useMemo(
    () => getProgressSummary(LETTERS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progressVersion]
  );
  const completedCount = useMemo(
    () => countCompleted(LETTERS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progressVersion]
  );
  const dueItems = useMemo(
    () => getDueLetters(LETTERS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progressVersion]
  );

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
  const redraw = useCallback((points) => {
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
    drawStrokes(ctx, points, W, H, brushColorRef.current);
  }, []);

  const clearCanvas = useCallback(() => {
    strokesRef.current = [];
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

  const selectLetter = useCallback((index) => {
    setLetterIndex(index);
    setFormIndex('isolated');
    setShowHistory(false);
    setShowComparison(false);
    clearCanvas();
  }, [clearCanvas]);

  const selectForm = useCallback((form) => {
    setFormIndex(form);
    setShowHistory(false);
    setShowComparison(false);
    clearCanvas();
  }, [clearCanvas]);

  const switchPracticeMode = useCallback((mode) => {
    setPracticeMode(mode);
    setFeedback(null);
    setShowComparison(false);
    setShowHistory(false);
    alphaBtnRefs.current = [];
    clearCanvas();
  }, [clearCanvas]);

  const selectWord = useCallback((groupIdx, wIdx) => {
    setWordGroupIndex(groupIdx);
    setWordIndex(wIdx);
    setFeedback(null);
    setShowComparison(false);
    setShowHistory(false);
    clearCanvas();
  }, [clearCanvas]);

  const toggleLessonMode = useCallback(() => {
    setLessonMode((prev) => {
      const next = !prev;
      localStorage.setItem('lessonMode', String(next));
      setLetterIndex(0);
      setFormIndex('isolated');
      setShowHistory(false);
      setShowComparison(false);
      alphaBtnRefs.current = [];
      clearCanvas();
      return next;
    });
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
  }, [redraw]);

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

  const playStrokeAnimation = useCallback(async () => {
    const data = STROKE_DATA[letter.letter];
    if (!data || animatingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const dpr = devicePixelRatio || 1;
    // Snapshot the user's drawing so we can restore it after the animation.
    const savedStrokes = strokesRef.current;
    strokesRef.current = [];
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
    try { await document.fonts.ready; } catch (_) { /* ignore */ }

    const W = canvas.width;
    const H = canvas.height;

    // ── Reference-square layout ─────────────────────────────
    // Stroke data was authored against a 0–100 square. We render the glyph
    // into that same square (centered on canvas, scaled to fit) so the
    // authored paths align with the actual letter shape regardless of font
    // metrics. This is far more robust than measureText bounding boxes.
    const CSS_SIZE = Math.min(200, rect.height * 0.8);
    const glyphSize = CSS_SIZE * dpr;
    const centerX = (rect.width / 2) * dpr;
    const centerY = (rect.height / 2) * dpr;
    const glyphX = centerX - glyphSize / 2;
    const glyphY = centerY - glyphSize / 2;

    const glyphCanvas = document.createElement('canvas');
    glyphCanvas.width = W;
    glyphCanvas.height = H;
    const gCtx = glyphCanvas.getContext('2d');
    gCtx.save();
    gCtx.font = `${glyphSize}px "Amiri", "Scheherazade New", serif`;
    gCtx.fillStyle = darkModeRef.current ? '#c0703a' : '#8b4513';
    gCtx.textAlign = 'center';
    gCtx.textBaseline = 'middle';
    gCtx.direction = 'rtl';
    gCtx.fillText(currentChar, centerX, centerY);
    gCtx.restore();

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = W;
    maskCanvas.height = H;
    const mCtx = maskCanvas.getContext('2d');

    const scale = glyphSize / 100;
    const mapX = (x) => glyphX + x * scale;
    const mapY = (y) => glyphY + y * scale;

    const buildPolyline = (pts) => pts.map((p) => ({ x: mapX(p.x), y: mapY(p.y) }));

    const BRUSH_RADIUS = glyphSize * 0.08;
    const SPEED = Math.max(3, glyphSize * 0.012);

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
    const PAUSE_FRAMES = 18;
    let pauseCount = 0;

    const compCanvas = document.createElement('canvas');
    compCanvas.width = W;
    compCanvas.height = H;
    const cCtx = compCanvas.getContext('2d');

    const drawFrame = () => {
      cCtx.clearRect(0, 0, W, H);
      cCtx.drawImage(glyphCanvas, 0, 0);
      cCtx.globalCompositeOperation = 'destination-in';
      cCtx.drawImage(maskCanvas, 0, 0);
      cCtx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // Paper background for animation
      const paperAnim = getPaperColors(paperTheme, darkModeRef.current);
      ctx.fillStyle = paperAnim.bg;
      ctx.fillRect(0, 0, W, H);
      drawPaperPattern(ctx, W, H, paperTheme, darkModeRef.current);
      ctx.globalAlpha = 0.12;
      ctx.drawImage(glyphCanvas, 0, 0);
      ctx.globalAlpha = 1;
      ctx.drawImage(compCanvas, 0, 0);
      ctx.restore();
    };

    const finish = () => {
      animatingRef.current = false;
      animFrameRef.current = null;
      setAnimating(false);
      strokesRef.current = savedStrokes;
      if (savedStrokes.length) setHasStrokes(true);
      redraw(savedStrokes);
    };

    const animate = () => {
      if (!animatingRef.current) return;
      if (opIdx >= ops.length) {
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
          dist = Math.min(dist + SPEED, op.total);
          const nextPoint = pointAt(op.poly, op.lens, dist);
          paintSegment(prevPoint, nextPoint, BRUSH_RADIUS);
          prevPoint = nextPoint;
          drawFrame();
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        if (pauseCount < PAUSE_FRAMES) { pauseCount++; animFrameRef.current = requestAnimationFrame(animate); return; }
        opIdx++; dist = 0; prevPoint = null; pauseCount = 0;
        animFrameRef.current = requestAnimationFrame(animate);
      } else if (op.type === 'dot') {
        const dp = op.point;
        mCtx.beginPath();
        mCtx.arc(dp.x, dp.y, BRUSH_RADIUS * 0.8, 0, Math.PI * 2);
        mCtx.fillStyle = '#000';
        mCtx.fill();
        drawFrame();
        if (pauseCount < PAUSE_FRAMES) { pauseCount++; animFrameRef.current = requestAnimationFrame(animate); return; }
        opIdx++; pauseCount = 0;
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    drawFrame();
    animFrameRef.current = requestAnimationFrame(animate);
  }, [letter.letter, currentChar]);

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
    };
  }, [letterIndex, formIndex, practiceMode]);

  // ─── Pointer events ────────────────────────────────

  const getPoint = (e) => {
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

  const handlePointerDown = (e) => {
    e.preventDefault();
    const p = getPoint(e);
    if (!p) return;
    strokeResumedRef.current = false;
    strokesRef.current.push({ ...p, newStroke: true });
    try { canvasRef.current?.setPointerCapture?.(e.pointerId); } catch (_) { /* ignore */ }
    if (!hasStrokes) setHasStrokes(true);
  };

  const handlePointerMove = (e) => {
    e.preventDefault();
    if (e.buttons === 0) return;
    const p = getPoint(e);
    if (!p) return;
    const startNew = strokeResumedRef.current;
    strokeResumedRef.current = false;
    strokesRef.current.push({ ...p, newStroke: startNew });
    redraw(strokesRef.current);
  };

  const handlePointerUp = (e) => {
    e.preventDefault();
    try { canvasRef.current?.releasePointerCapture?.(e.pointerId); } catch (_) { /* ignore */ }
    strokeResumedRef.current = false;
    // Mark today as active so streaks count for every practice session —
    // including words mode, review mode, and users who skipped the API key
    // and therefore never trigger the AI-feedback code path. Only bump
    // progressVersion when today was newly added (once per day per tab)
    // so we don't needlessly re-memoize on every stroke completion.
    if (markDayActive()) setProgressVersion((v) => v + 1);
  };

  const handlePointerLeave = (e) => {
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
    const fontSize = (practiceMode === 'words' ? 0.25 : 0.5) * Math.min(offscreen.width, offscreen.height);
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

  const saveDrawing = useCallback(() => {
    if (!strokesRef.current.length) return;
    const dataURL = exportForSave();
    const name = practiceMode === 'words'
      ? `arabic-${currentWord?.roman ?? 'word'}`
      : `arabic-${letter.name.toLowerCase()}-${activeForm}`;
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `${name}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [exportForSave, practiceMode, currentWord, letter.name, activeForm]);

  const shareDrawing = useCallback(async () => {
    if (!strokesRef.current.length) return;
    const dataURL = exportForSave();
    const name = practiceMode === 'words'
      ? `arabic-${currentWord?.roman ?? 'word'}`
      : `arabic-${letter.name.toLowerCase()}-${activeForm}`;
    if (navigator.share) {
      try {
        const res = await fetch(dataURL);
        const blob = await res.blob();
        const file = new File([blob], `${name}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Arabic Handwriting Practice' });
          return;
        }
      } catch (_) { /* fall through to download */ }
    }
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = `${name}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [exportForSave, practiceMode, currentWord, letter.name, activeForm]);

  // ─── Navigate to letter from review dashboard ──────────

  const goToReviewItem = useCallback((letterName, formKey) => {
    const alphIdx = LETTERS.findIndex((l) => l.name === letterName);
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
  }, [lessonMode, lessonToAlpha, clearCanvas]);

  const goToAnalyticsItem = useCallback((letterName, formKey) => {
    const alphIdx = LETTERS.findIndex((l) => l.name === letterName);
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
  }, [lessonMode, lessonToAlpha, clearCanvas]);

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
    const fontSize = practiceMode === 'words'
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
      setFeedback({ error: practiceMode === 'words' ? t('hintDrawWordFirst') : t('hintDrawFirst') });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const imageBase64 = exportCanvas();
      canvasSnapshotRef.current = `data:image/jpeg;base64,${imageBase64}`;
      let text;
      if (practiceMode === 'words' && currentWord) {
        text = await getAIFeedback(apiKey, imageBase64, currentWord.word, currentWord.word, currentWord.roman, `word "${currentWord.meaning}"`);
      } else {
        text = await getAIFeedback(apiKey, imageBase64, letter.name, letter.letter, letter.roman, t(FORM_FULL[activeForm]));
      }
      const scoreMatch = text.match(/\[SCORE:\s*([1-5])\s*\]/i);
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
      const cleanText = text.replace(/\[SCORE:\s*[1-5]\s*\]\s*/gi, '').trim();
      if (practiceMode === 'letters') {
        markPracticed(letter.name, activeForm);
        if (score) { setScore(letter.name, activeForm, score); updateSR(letter.name, activeForm, score); }
        addFeedbackEntry(letter.name, activeForm, cleanText);
        setProgressVersion((v) => v + 1);
      }
      setFeedback({ text: cleanText, score });
      setShowComparison(true);
    } catch (err) {
      setFeedback({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  // ─── Model / brush slider handlers (controlled) ─────

  const handleModelChange = (ev) => {
    const v = ev.target.value;
    setModel(v);
    localStorage.setItem('openrouter_model', v);
  };

  const handleBrushChange = (ev) => {
    const v = parseFloat(ev.target.value);
    const safe = Number.isFinite(v) ? v : 1;
    setBrushValue(safe);
    setBrushScale(safe);
  };

  const handleThemeChange = (themeId) => {
    setPaperTheme(themeId);
    localStorage.setItem('app_theme', themeId);
    redraw(strokesRef.current);
  };

  const handleBrushPackChange = (packId) => {
    setBrushPack(packId);
    localStorage.setItem('brush_pack', packId);
    brushColorRef.current = getBrushColor(packId, darkMode);
    redraw(strokesRef.current);
  };

  // ─── Keyboard nav for alphabet row ───────────────────

  const handleAlphaKeyDown = useCallback((e, idx) => {
    const total = totalCount;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const adjustedDir = locale === 'ar' ? -dir : dir;
      const next = (idx + adjustedDir + total) % total;
      selectLetter(next);
      setTimeout(() => alphaBtnRefs.current[next]?.focus(), 0);
    }
    if (e.key === 'Home') { e.preventDefault(); selectLetter(0); setTimeout(() => alphaBtnRefs.current[0]?.focus(), 0); }
    if (e.key === 'End') { e.preventDefault(); selectLetter(total - 1); setTimeout(() => alphaBtnRefs.current[total - 1]?.focus(), 0); }
  }, [totalCount, locale, selectLetter]);

  const dueCount = dueItems.length;
  const history = getFeedbackHistory(letter.name, activeForm);

  // ─── Render ───────────────────────────────────────

  // Full-screen key-entry overlay, launched from the Settings "Set/Change key"
  // button. Save commits the key and closes; Cancel just closes.
  if (showKeyScreen) {
    return (
      <LoginScreen
        onSave={(key) => {
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
        <span style={styles.appTitle} lang="ar">{t('appTitle')}</span>
        <span style={styles.appSubtitle}>
          {t('appSubtitle')}
          {completedCount > 0 && (
            <span style={styles.completedBadge} aria-label={`${completedCount} ${t('ariaCompletedBadge')}`}>
              {completedCount}/{LETTERS.length} {t('progressComplete')}
            </span>
          )}
        </span>
        <div style={styles.headerButtons}>
          <button
            className="btn-gear"
            style={{ ...styles.lessonToggle, ...(lessonMode ? styles.lessonToggleActive : {}) }}
            onClick={toggleLessonMode}
            aria-pressed={lessonMode}
            aria-label={t('ariaLessonModeBtn')}
            title={lessonMode ? t('lessonToggleTitleOn') : t('lessonToggleTitleOff')}
          >
            📖
          </button>
          <button
            className="btn-gear"
            style={styles.keyBtn}
            onClick={() => setShowSettings((v) => !v)}
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
        <div id="settings-panel" style={styles.keyPanel}>

          {/* ── Appearance ── */}
          <div style={styles.settingsSection} role="group" aria-labelledby="settings-heading-appearance">
            <span id="settings-heading-appearance" style={styles.settingsSectionTitle}>{t('settingsSectionAppearance')}</span>
            <div style={styles.settingsRow}>
              <button
                className="btn-panel"
                style={styles.settingsToggleBtn}
                onClick={onToggleDarkMode}
                aria-pressed={darkMode}
                aria-label={t('ariaDarkModeBtn')}
              >
                {darkMode ? '☀ ' + t('settingsLightMode') : '🌙 ' + t('settingsDarkMode')}
              </button>
              <button
                className="btn-panel"
                style={styles.settingsToggleBtn}
                onClick={onToggleLocale}
                aria-label={t('ariaLangBtn')}
              >
                {locale === 'ar' ? 'EN' : 'عربي'}
              </button>
            </div>
          </div>

          <div style={styles.settingsDivider} />

          {/* ── AI Model ── */}
          <div style={styles.settingsSection} role="group" aria-labelledby="settings-heading-model">
            <span id="settings-heading-model" style={styles.settingsSectionTitle}>{t('settingsSectionModel')}</span>
            <select
              value={model}
              onChange={handleModelChange}
              style={{ padding: '6px 8px', borderRadius: '8px', border: '1.5px solid var(--color-border)', background: 'var(--color-input-bg)', fontSize: '13px', fontFamily: 'Georgia,serif', color: 'var(--color-text)', width: '100%' }}
              aria-labelledby="settings-heading-model"
            >
              <option value="google/gemini-3-flash-preview">Gemini 3 Flash</option>
              <option value="google/gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
              <option value="anthropic/claude-sonnet-4.6">Claude Sonnet 4.6</option>
              <option value="openai/gpt-5.4-mini">GPT-5.4 mini</option>
            </select>
          </div>

          <div style={styles.settingsDivider} />

          {/* ── Canvas (Paper + Ink) ── */}
          <div style={styles.settingsSection} role="group" aria-labelledby="settings-heading-canvas">
            <span id="settings-heading-canvas" style={styles.settingsSectionTitle}>{t('settingsSectionCanvas')}</span>
            <div style={{ fontSize: '12px', color: 'var(--color-text-soft)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {t('settingsTheme')}
              <div style={styles.themeRow}>
                {Object.values(PAPER_THEMES).map((theme) => {
                  const colors = getPaperColors(theme.id, darkMode);
                  const isActive = paperTheme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      className={`btn-theme ${isActive ? 'btn-theme-active' : ''}`}
                      style={{ ...styles.themeBtn, ...(isActive ? styles.themeBtnActive : {}) }}
                      onClick={() => handleThemeChange(theme.id)}
                      aria-pressed={isActive}
                      aria-label={t(theme.nameKey)}
                    >
                      <span style={{ ...styles.themeSwatch, background: colors.bg }} />
                      <span>{t(theme.nameKey)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-soft)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {t('settingsBrush')}
              <div style={styles.brushRow}>
                {Object.values(BRUSH_PACKS).map((pack) => {
                  const color = getBrushColor(pack.id, darkMode);
                  const isActive = brushPack === pack.id;
                  return (
                    <button
                      key={pack.id}
                      className={`btn-swatch ${isActive ? 'btn-swatch-active' : ''}`}
                      style={{
                        ...styles.brushSwatch,
                        background: color,
                        ...(isActive ? styles.brushSwatchActive : {}),
                      }}
                      onClick={() => handleBrushPackChange(pack.id)}
                      aria-pressed={isActive}
                      aria-label={t(pack.nameKey)}
                      title={t(pack.nameKey)}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div style={styles.settingsDivider} />

          {/* ── API Key ── */}
          <div style={styles.settingsSection} role="group" aria-labelledby="settings-heading-apikey">
            <span id="settings-heading-apikey" style={styles.settingsSectionTitle}>{t('settingsSectionApiKey')}</span>
            <span style={{ fontSize: '12px', color: 'var(--color-text-soft)' }}>{t('settingsNote')}</span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-panel"
                style={{ ...styles.keyPanelBtn, flex: 1 }}
                onClick={() => {
                  setShowSettings(false);
                  setShowKeyScreen(true);
                }}
              >
                {apiKey && apiKey !== 'skip' ? t('settingsChangeKey') : t('settingsSetKey')}
              </button>
              {apiKey && apiKey !== 'skip' && (
                <button
                  className="btn-panel"
                  style={{
                    ...styles.keyPanelBtn,
                    flex: 1,
                    background: 'transparent',
                    color: 'var(--color-accent)',
                    border: '1px solid var(--color-border)',
                    boxShadow: 'none',
                  }}
                  onClick={onClearKey}
                >
                  {t('settingsClearKey')}
                </button>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Mode tabs */}
      <div style={styles.modeTabs} role="tablist" aria-label={t('ariaPracticeMode')}>
        <button
          className="btn-form"
          style={{ ...styles.modeTab, ...(practiceMode === 'letters' ? styles.modeTabActive : {}) }}
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
          style={{ ...styles.modeTab, ...(practiceMode === 'words' ? styles.modeTabActive : {}) }}
          onClick={() => switchPracticeMode('words')}
          role="tab"
          aria-selected={practiceMode === 'words'}
          aria-label={t('ariaModeTab') + ': ' + t('tabWords')}
          id="tab-words"
        >
          {t('tabWords')}
        </button>
        <button
          className="btn-form"
          style={{ ...styles.modeTab, ...(practiceMode === 'review' ? styles.modeTabActive : {}), position: 'relative' }}
          onClick={() => switchPracticeMode('review')}
          role="tab"
          aria-selected={practiceMode === 'review'}
          aria-label={t('ariaDashboardTab')}
          id="tab-review"
        >
          {t('tabReview')}
          {dueCount > 0 && (
            <span style={{ ...styles.reviewCount, position: 'absolute', top: '-6px', right: '-6px', fontSize: '10px', padding: '1px 5px' }}>
              {dueCount}
            </span>
          )}
        </button>
        <button
          className="btn-form"
          style={{ ...styles.modeTab, ...(practiceMode === 'stats' ? styles.modeTabActive : {}) }}
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
      {practiceMode === 'review' && (
        <div style={styles.reviewDash}>
          <div style={styles.reviewHeader}>
            {t('dashboardTitle')}
            {dueItems.length > 0 && (
              <span style={styles.reviewCount}>{dueItems.length} {t('dashboardCount')}</span>
            )}
          </div>
          {dueItems.length === 0 ? (
            <div style={styles.reviewEmpty}>{t('dashboardEmpty')}</div>
          ) : (
            <div style={styles.reviewGrid}>
              {dueItems.map(({ letterName, letterChar, formKey }) => (
                <button
                  key={`${letterName}-${formKey}`}
                  className="btn-alpha"
                  style={styles.reviewTile}
                  onClick={() => goToReviewItem(letterName, formKey)}
                  aria-label={`${letterName} ${t(FORM_NAMES[formKey] ?? formKey)}`}
                  title={`${letterName} — ${t(FORM_NAMES[formKey] ?? formKey)}`}
                >
                  <span style={styles.reviewTileChar} lang="ar">{letterChar}</span>
                  <span style={styles.reviewTileName}>{letterName}</span>
                  <span style={styles.reviewTileForm}>{t(FORM_NAMES[formKey] ?? formKey)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stats dashboard */}
      {practiceMode === 'stats' && (
        <AnalyticsPanel
          locale={locale}
          LETTERS={LETTERS}
          progress={getProgress()}
          progressVersion={progressVersion}
          onGoToItem={goToAnalyticsItem}
        />
      )}

      {/* Practice UI (hidden in review/stats mode) */}
      {practiceMode !== 'review' && practiceMode !== 'stats' && <>

      {/* Info bar */}
      {practiceMode === 'letters' ? (
        <div style={styles.infoBar}>
          <div style={styles.letterMeta}>
            <span style={styles.letterNameLarge}>{letter.name}</span>
            <span style={styles.letterRoman}>/{letter.roman}/</span>
          </div>
          <div style={styles.miniPreviews}>
            {Object.entries(letter.forms).map(([key]) => (
              <div key={key} style={styles.miniPreview}>
                <span style={styles.miniChar} lang="ar">{letter.forms[key]}</span>
                <span style={styles.miniLabel}>{t(FORM_NAMES[key])}</span>
              </div>
            ))}
          </div>
          <span style={styles.progressBadge} aria-label={`${t('ariaProgressBadge')}: ${letterIndex + 1} ${t('progressComplete')} ${totalCount}`}>
            {letterIndex + 1}/{totalCount}
          </span>
        </div>
      ) : (
        <div style={styles.infoBar}>
          <div style={styles.letterMeta}>
            <span style={styles.letterNameLarge} lang="ar" dir="rtl">{currentWord?.word}</span>
            <span style={styles.letterRoman}>/{currentWord?.roman}/ — {currentWord?.meaning}</span>
          </div>
          <span style={styles.progressBadge}>{wordIndex + 1}/{currentWordGroup?.words.length}</span>
        </div>
      )}

      {/* Form switcher */}
      {practiceMode === 'letters' && (
        <div style={styles.formSwitcher} role="group" aria-label={t('ariaLetterForm')}>
          {formKeys.map((key) => {
            const isActive = key === activeForm;
            return (
              <button
                key={key}
                className="btn-form"
                style={{ ...styles.formBtn, ...(isActive ? styles.formBtnActive : {}) }}
                onClick={() => selectForm(key)}
                aria-pressed={isActive}
                aria-label={`${t(FORM_NAMES[key])} ${t('ariaFormBtn')}`}
              >
                <span lang="ar" style={{ ...styles.formBtnChar, color: isActive ? '#fff8ee' : 'var(--color-text)' }}>{letter.forms[key]}</span>
                <span style={{ ...styles.formBtnName, color: isActive ? '#ffebd0' : 'var(--color-text)' }}>{t(FORM_NAMES[key])}</span>
                <span style={{ ...styles.formBtnSub, color: isActive ? '#ffd9a8' : 'var(--color-text-muted)' }}>{t(FORM_SHORT[key])}</span>
              </button>
            );
          })}
          {letter.nonJoiner && <div style={styles.nonJoinerNote}>{t('nonJoinerNote')}</div>}
        </div>
      )}

      {/* Word group selector */}
      {practiceMode === 'words' && (
        <div style={styles.formSwitcher} role="group" aria-label={t('ariaWordGroup')}>
          {WORD_GROUPS.map((g, gIdx) => {
            const isActive = gIdx === wordGroupIndex;
            return (
              <button
                key={gIdx}
                className="btn-form"
                style={{ ...styles.formBtn, ...(isActive ? styles.formBtnActive : {}) }}
                onClick={() => selectWord(gIdx, 0)}
                aria-pressed={isActive}
              >
                <span style={{ ...styles.formBtnName, color: isActive ? '#ffebd0' : 'var(--color-text)' }}>{g.name}</span>
                <span style={{ ...styles.formBtnSub, color: isActive ? '#ffd9a8' : 'var(--color-text-muted)' }}>{g.words.length} {t('wordsLabel')}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Hint */}
      <div style={styles.hintRow}>
        <span style={styles.hintIcon}>✦</span>
        <span style={styles.hintText}>
          {practiceMode === 'letters' ? (
            <>
              <strong>{letter.hint}</strong>
              {formKeys.length > 1 && <> <em>{t(FORM_DESCRIPTIONS[activeForm])}</em></>}
            </>
          ) : <strong>{currentWord?.hint}</strong>}
        </span>
      </div>

      {/* Canvas */}
      <div
        style={{
          ...styles.canvasWrap,
          background: getPaperColors(paperTheme, darkMode).bg,
        }}
        className="canvas-max"
      >
        {practiceMode === 'letters' ? (
          <div style={styles.ghostLetter} lang="ar">{currentChar}</div>
        ) : (
          <div style={styles.ghostWord} lang="ar" dir="rtl">{currentWord?.word}</div>
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
        <div style={styles.rtlGuide} aria-hidden="true">{t('hintRTL')}</div>
      </div>

      {/* Brush size slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', width: '100%', maxWidth: '520px' }}>
        <label style={{ fontSize: '12px', color: 'var(--color-text-soft)', whiteSpace: 'nowrap' }}>{t('brushSize')}</label>
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

      {/* Controls */}
      <div style={styles.controls}>
        <button
          className="btn-nav"
          style={{ ...styles.btn, ...styles.btnNav }}
          onClick={() => {
            if (practiceMode === 'words') {
              const total = currentWordGroup.words.length;
              selectWord(wordGroupIndex, (wordIndex - 1 + total) % total);
            } else { selectLetter((letterIndex - 1 + totalCount) % totalCount); }
          }}
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
        {practiceMode === 'letters' && formIndex === 'isolated' && STROKE_DATA[letter.letter] && (
          <button
            className="btn-nav"
            style={{ ...styles.btn, ...styles.btnShowMe, opacity: animating ? 0.35 : 1 }}
            onClick={playStrokeAnimation}
            disabled={animating}
            aria-label={t('ariaShowMeBtn')}
          >
            {animating ? t('btnShowMePlaying') : t('btnShowMe')}
          </button>
        )}
        <button
          className="btn-ai"
          style={{ ...styles.btn, ...styles.btnAI, opacity: loading || !apiKey || apiKey === 'skip' || !isOnline ? 0.35 : 1 }}
          onClick={requestFeedback}
          disabled={loading || !apiKey || apiKey === 'skip' || !isOnline}
          aria-label={t('ariaAIFeedbackBtn')}
          aria-busy={loading}
        >
          {loading ? t('btnAIFeedbackLoading') : !apiKey || apiKey === 'skip' ? t('btnAIFeedbackNoKey') : !isOnline ? t('btnAIFeedbackOffline') : t('btnAIFeedback')}
        </button>
        <button
          className="btn-nav"
          style={{ ...styles.btn, ...styles.btnNav }}
          onClick={() => {
            if (practiceMode === 'words') {
              const total = currentWordGroup.words.length;
              selectWord(wordGroupIndex, (wordIndex + 1) % total);
            } else { selectLetter((letterIndex + 1) % totalCount); }
          }}
          aria-label={t('ariaNextBtn')}
        >
          {t('btnNext')}
        </button>
        <button
          className="btn-clear"
          style={{ ...styles.btn, ...styles.btnSave, opacity: hasStrokes ? 1 : 0.35 }}
          onClick={saveDrawing}
          disabled={!hasStrokes}
          aria-label={t('ariaSaveBtn')}
        >
          {t('btnSave')}
        </button>
        <button
          className="btn-nav"
          style={{ ...styles.btn, ...styles.btnShare, opacity: hasStrokes ? 1 : 0.35 }}
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
          style={feedback.error ? { ...styles.feedbackBox, ...styles.feedbackError } : styles.feedbackBox}
          role="region"
          aria-label={t('ariaTeacherFeedback')}
        >
          {feedback.error ? (
            <span>{feedback.error}</span>
          ) : (
            <>
              {feedback.score && (
                <div style={styles.scoreRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} style={n <= feedback.score ? styles.starFilled : styles.starEmpty}>★</span>
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

      {/* Comparison */}
      {feedback && !feedback.error && canvasSnapshotRef.current && (
        <div style={{ width: '100%', maxWidth: '520px' }}>
          <button
            className="btn-history"
            style={styles.comparisonToggle}
            onClick={() => setShowComparison((v) => !v)}
            aria-expanded={showComparison}
          >
            {showComparison ? t('comparisonHide') : t('comparisonShow')} {t('comparisonLabel')}
          </button>
          {showComparison && (
            <div style={styles.comparisonWrap}>
              <div style={styles.comparisonPane}>
                <span style={styles.comparisonLabel}>{t('comparisonRef')}</span>
                <div style={{ ...styles.comparisonRef, ...(practiceMode === 'words' ? { fontSize: '60px', direction: 'rtl' } : {}) }} lang="ar">
                  {practiceMode === 'words' ? currentWord?.word : currentChar}
                </div>
              </div>
              <div style={styles.comparisonPane}>
                <span style={styles.comparisonLabel}>{t('comparisonAttempt')}</span>
                <img src={canvasSnapshotRef.current} alt={t('comparisonAttempt')} style={styles.comparisonAttempt} />
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
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
          >
            {showHistory ? t('historyHide') : t('historyShow')} {t('historyOf')} ({history.length})
          </button>
          {showHistory && (
            <div style={styles.historyPanel}>
              {history.map((entry, i) => (
                <div key={i} style={styles.historyEntry}>
                  <div style={styles.historyDate}>
                    {new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <p style={styles.historyText}>{entry.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alphabet / lesson / word row */}
      {practiceMode === 'letters' ? (
        <div
          style={styles.alphabetRow}
          className="alpha-row-wrap"
          role="listbox"
          aria-label={t('ariaSelectLetter')}
          aria-activedescendant={`letter-btn-${letterIndex}`}
        >
          {(lessonMode ? LESSON_ORDER : LETTERS).map((item, idx) => {
            const l = lessonMode ? LETTERS[lessonToAlpha[idx]] : item;
            const status = progressSummary[l.name];
            return (
              <button
                key={idx}
                ref={(el) => { alphaBtnRefs.current[idx] = el; }}
                className="btn-alpha"
                id={`letter-btn-${idx}`}
                style={{ ...styles.alphaBtn, ...(idx === letterIndex ? styles.alphaBtnActive : {}) }}
                onClick={() => selectLetter(idx)}
                onKeyDown={(e) => handleAlphaKeyDown(e, idx)}
                title={`${l.name} /${l.roman}/`}
                lang="ar"
                role="option"
                aria-selected={idx === letterIndex}
                aria-label={t('ariaLetterBtn') + ': ' + l.name}
              >
                {l.letter}
                {status?.complete ? <span style={styles.dotComplete} /> : status?.started ? <span style={styles.dotStarted} /> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={styles.alphabetRow} className="alpha-row-wrap" role="listbox" aria-label={t('ariaSelectWord')}>
          {currentWordGroup?.words.map((w, idx) => (
            <button
              key={idx}
              className="btn-alpha"
              style={{ ...styles.wordBtn, ...(idx === wordIndex ? styles.alphaBtnActive : {}) }}
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

      </>}
    </div>
  );
}
