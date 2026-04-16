import { useState, useRef, useCallback, useEffect } from 'react';
import { LETTERS, FORM_DESCRIPTIONS } from '../data/letters';
import { LESSON_ORDER, getLessonGroup } from '../data/lessonOrder';
import { calcLineWidth, setBrushScale } from '../utils/drawing';
import { getAIFeedback } from '../utils/api';
import { markPracticed, getProgress, isLetterStarted, isLetterComplete, countCompleted, setScore } from '../utils/progress';
import { addFeedbackEntry, getFeedbackHistory } from '../utils/history';
import STROKE_DATA from '../data/strokeOrder';
import { WORD_GROUPS } from '../data/words';
import { UI } from '../locales';
import styles from '../styles/practiceStyles';

const FORM_NAMES = { isolated: 'formIsolated', initial: 'formInitial', medial: 'formMedial', final: 'formFinal' };
const FORM_SHORT  = { isolated: 'formIsolatedShort', initial: 'formInitialShort', medial: 'formMedialShort', final: 'formFinalShort' };

const SCORE_LABELS = {
  5: 'feedbackScoreExcellent',
  4: 'feedbackScoreGreat',
  3: 'feedbackScoreGood',
  2: 'feedbackScoreKeep',
  1: 'feedbackScoreStart',
};

export default function PracticeView({ apiKey, onClearKey, locale, darkMode, onToggleDarkMode, onToggleLocale }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const canvasSnapshotRef = useRef(null);
  const animFrameRef = useRef(null);
  const alphaBtnRefs = useRef([]);

  const [letterIndex, setLetterIndex] = useState(0);
  const [formIndex, setFormIndex] = useState('isolated');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [progress, setProgress] = useState(() => getProgress());
  const [showHistory, setShowHistory] = useState(false);
  const [lessonMode, setLessonMode] = useState(
    () => localStorage.getItem('lessonMode') === 'true'
  );
  const [showComparison, setShowComparison] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [practiceMode, setPracticeMode] = useState('letters');
  const [wordGroupIndex, setWordGroupIndex] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);

  const t = (key) => UI[locale][key] ?? key;

  // Build lesson→alpha mapping
  const lessonToAlpha = LESSON_ORDER.map(
    (ch) => LETTERS.findIndex((l) => l.letter === ch)
  );

  const actualLetterIndex = lessonMode ? (lessonToAlpha[letterIndex] ?? 0) : letterIndex;
  const letter = LETTERS[actualLetterIndex];
  const formKeys = Object.keys(letter.forms);
  const activeForm = formKeys.includes(formIndex) ? formIndex : 'isolated';
  const currentChar = letter.forms[activeForm];
  const completedCount = countCompleted(LETTERS);
  const totalCount = lessonMode ? LESSON_ORDER.length : LETTERS.length;
  const lessonGroupInfo = lessonMode ? getLessonGroup(letterIndex) : null;

  const currentWordGroup = WORD_GROUPS[wordGroupIndex];
  const currentWord = currentWordGroup?.words[wordIndex];

  // ─── Drawing ─────────────────────────────────────────────

  const redraw = useCallback((points) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!points.length) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = darkMode ? '#ffffff' : '#1a0a00';
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const width = calcLineWidth(pt.pressure ?? 0.5, pt.pointerType ?? 'touch');
      if (pt.newStroke || i === 0) {
        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
        ctx.lineWidth = width;
      } else {
        const prev = points[i - 1];
        const mx = (prev.x + pt.x) / 2;
        const my = (prev.y + pt.y) / 2;
        ctx.lineWidth = width;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(mx, my);
      }
    }
    ctx.stroke();
  }, []);

  const clearCanvas = useCallback(() => {
    strokesRef.current = [];
    setFeedback(null);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
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
      const dpr = devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.getContext('2d').scale(dpr, dpr);
      redraw(strokesRef.current);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

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
  }, [redraw]);

  // ─── Stroke order animation ────────────────────────────

  const playStrokeAnimation = useCallback(async () => {
    const data = STROKE_DATA[letter.letter];
    if (!data || animating) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const dpr = devicePixelRatio || 1;
    strokesRef.current = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setAnimating(true);
    setFeedback(null);
    setShowComparison(false);
    try { await document.fonts.ready; } catch (_) {}

    const W = canvas.width;
    const H = canvas.height;

    const glyphCanvas = document.createElement('canvas');
    glyphCanvas.width = W;
    glyphCanvas.height = H;
    const gCtx = glyphCanvas.getContext('2d');
    const fontSize = rect.height * 0.65;
    gCtx.save();
    gCtx.scale(dpr, dpr);
    gCtx.font = `${fontSize}px "Amiri", "Scheherazade New", serif`;
    gCtx.fillStyle = '#8b4513';
    gCtx.textAlign = 'center';
    gCtx.textBaseline = 'middle';
    gCtx.direction = 'rtl';
    gCtx.fillText(currentChar, rect.width / 2, rect.height / 2);
    gCtx.restore();

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = W;
    maskCanvas.height = H;
    const mCtx = maskCanvas.getContext('2d');

    const scaleX = rect.width / 100;
    const scaleY = rect.height / 100;
    const interpolatePoints = (pts, stepsPerSeg) => {
      const result = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        for (let s = 0; s < stepsPerSeg; s++) {
          const t = s / stepsPerSeg;
          result.push({ x: (a.x + (b.x - a.x) * t) * scaleX * dpr, y: (a.y + (b.y - a.y) * t) * scaleY * dpr });
        }
      }
      const last = pts[pts.length - 1];
      result.push({ x: last.x * scaleX * dpr, y: last.y * scaleY * dpr });
      return result;
    };

    const BRUSH_RADIUS = Math.min(W, H) * 0.10;
    const STEPS_PER_SEG = 4;
    const ops = [];
    for (const stroke of data.strokes) {
      ops.push({ type: 'stroke', points: interpolatePoints(stroke, STEPS_PER_SEG) });
    }
    for (const dot of data.dots) {
      ops.push({ type: 'dot', point: { x: dot.x * scaleX * dpr, y: dot.y * scaleY * dpr } });
    }

    let opIdx = 0, ptIdx = 0;
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
      ctx.globalAlpha = 0.12;
      ctx.drawImage(glyphCanvas, 0, 0);
      ctx.globalAlpha = 1;
      ctx.drawImage(compCanvas, 0, 0);
      ctx.restore();
    };

    const animate = () => {
      if (opIdx >= ops.length) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(glyphCanvas, 0, 0);
        ctx.restore();
        setAnimating(false);
        return;
      }
      const op = ops[opIdx];
      if (op.type === 'stroke') {
        if (ptIdx < op.points.length) {
          const pt = op.points[ptIdx];
          mCtx.beginPath();
          mCtx.arc(pt.x, pt.y, BRUSH_RADIUS, 0, Math.PI * 2);
          mCtx.fillStyle = '#000';
          mCtx.fill();
          ptIdx++;
          drawFrame();
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        if (pauseCount < PAUSE_FRAMES) { pauseCount++; animFrameRef.current = requestAnimationFrame(animate); return; }
        opIdx++; ptIdx = 0; pauseCount = 0;
        animFrameRef.current = requestAnimationFrame(animate);
      } else if (op.type === 'dot') {
        const dp = op.point;
        mCtx.beginPath();
        mCtx.arc(dp.x, dp.y, BRUSH_RADIUS * 0.8, 0, Math.PI * 2);
        mCtx.fillStyle = '#000';
        mCtx.fill();
        drawFrame();
        if (pauseCount < PAUSE_FRAMES) { pauseCount++; animFrameRef.current = requestAnimationFrame(animate); return; }
        opIdx++; ptIdx = 0; pauseCount = 0;
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    drawFrame();
    animFrameRef.current = requestAnimationFrame(animate);
  }, [letter.letter, currentChar, animating]);

  useEffect(() => {
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [letterIndex]);

  // ─── Pointer events ────────────────────────────────

  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure ?? 0.5, pointerType: e.pointerType ?? 'touch' };
  };

  const handlePointerDown = (e) => { e.preventDefault(); strokesRef.current.push({ ...getPoint(e), newStroke: true }); };
  const handlePointerMove = (e) => { e.preventDefault(); if (e.buttons === 0) return; strokesRef.current.push({ ...getPoint(e), newStroke: false }); redraw(strokesRef.current); };
  const handlePointerUp = (e) => { e.preventDefault(); };

  // ─── Canvas export ────────────────────────────────

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    const dpr = devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const offscreen = document.createElement('canvas');
    offscreen.width = rect.width * dpr;
    offscreen.height = rect.height * dpr;
    const ctx = offscreen.getContext('2d');
    ctx.fillStyle = '#fdf6e8';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);
    const watermarkText = practiceMode === 'words' ? currentWord?.word : currentChar;
    const fontSize = practiceMode === 'words' ? Math.min(offscreen.width, offscreen.height) * 0.25 : Math.min(offscreen.width, offscreen.height) * 0.5;
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
    const MAX_SIZE = 512;
    const scale = Math.min(1, MAX_SIZE / Math.max(offscreen.width, offscreen.height));
    const compressed = document.createElement('canvas');
    compressed.width = Math.round(offscreen.width * scale);
    compressed.height = Math.round(offscreen.height * scale);
    compressed.getContext('2d').drawImage(offscreen, 0, 0, compressed.width, compressed.height);
    return compressed.toDataURL('image/jpeg', 0.85).split(',')[1];
  };

  // ─── AI feedback ────────────────────────────────

  const FORM_LABELS = {
    isolated: 'formIsolatedFull',
    initial: 'formInitialFull',
    medial: 'formMedialFull',
    final: 'formFinalFull',
  };

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
        text = await getAIFeedback(apiKey, imageBase64, letter.name, letter.letter, letter.roman, t(FORM_LABELS[activeForm]));
      }
      const scoreMatch = text.match(/\[SCORE:\s*(\d)\]/);
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
      const cleanText = text.replace(/\[SCORE:\s*\d\]\s*/g, '').trim();
      if (practiceMode === 'letters') {
        const updated = markPracticed(letter.name, activeForm);
        if (score) setScore(letter.name, activeForm, score);
        setProgress(updated);
        addFeedbackEntry(letter.name, activeForm, cleanText);
      }
      setFeedback({ text: cleanText, score });
      setShowComparison(true);
    } catch (err) {
      setFeedback({ error: err.message });
    }
    setLoading(false);
  };

  // ─── Keyboard nav for alphabet row ───────────────────

  const handleAlphaKeyDown = useCallback((e, idx) => {
    const total = totalCount;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      // In RTL, right arrow = previous, left = next
      const adjustedDir = locale === 'ar' ? -dir : dir;
      const next = (idx + adjustedDir + total) % total;
      selectLetter(next);
      setTimeout(() => alphaBtnRefs.current[next]?.focus(), 0);
    }
    if (e.key === 'Home') { e.preventDefault(); selectLetter(0); setTimeout(() => alphaBtnRefs.current[0]?.focus(), 0); }
    if (e.key === 'End') { e.preventDefault(); selectLetter(total - 1); setTimeout(() => alphaBtnRefs.current[total - 1]?.focus(), 0); }
  }, [totalCount, locale, selectLetter]);

  // ─── Render ───────────────────────────────────────

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
            {t('lessonGroup')} {lessonGroupInfo.groupIndex + 1}{locale === 'ar' ? ' ' + t('lessonGroupName') : ': ' + lessonGroupInfo.group.name}
          </span>
          <span style={styles.lessonGroupDesc}>{lessonGroupInfo.group.description}</span>
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
          <span style={{ fontSize: '12px', color: 'var(--color-text-soft)' }}>{t('settingsNote')}</span>

          {/* Dark mode toggle */}
          <button
            className="btn-panel"
            style={{ padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-surface-solid)', fontSize: '12px', color: 'var(--color-text)' }}
            onClick={onToggleDarkMode}
            aria-pressed={darkMode}
            aria-label={t('ariaDarkModeBtn')}
          >
            {darkMode ? '☀ ' + (locale === 'ar' ? 'وضع فاتح' : 'Light mode') : '🌙 ' + t('settingsDarkMode')}
          </button>

          {/* Language toggle */}
          <button
            className="btn-panel"
            style={{ padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: '6px', background: 'var(--color-surface-solid)', fontSize: '12px', color: 'var(--color-text)' }}
            onClick={onToggleLocale}
            aria-label={t('ariaLangBtn')}
          >
            {locale === 'ar' ? 'EN' : 'عربي'}
          </button>

          {/* Model selector */}
          <label style={{ fontSize: '12px', color: 'var(--color-text-soft)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {t('settingsModel')}
            <select
              defaultValue={localStorage.getItem('openrouter_model') || 'google/gemini-3-flash-preview'}
              onChange={(ev) => localStorage.setItem('openrouter_model', ev.target.value)}
              style={{ padding: '6px 8px', borderRadius: '8px', border: '1.5px solid var(--color-border)', background: 'var(--color-input-bg)', fontSize: '13px', fontFamily: 'Georgia,serif', color: 'var(--color-text)' }}
              aria-label={t('ariaModelSelect')}
            >
              <option value="google/gemini-3-flash-preview">Gemini 3 Flash</option>
              <option value="google/gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
              <option value="anthropic/claude-sonnet-4.6">Claude Sonnet 4.6</option>
              <option value="openai/gpt-5.4-mini">GPT-5.4 mini</option>
            </select>
          </label>

          <button className="btn-panel" style={styles.keyPanelBtn} onClick={onClearKey}>
            {t('settingsChangeKey')}
          </button>
        </div>
      )}

      {/* Mode tabs */}
      <div style={styles.modeTabs} role="tablist" aria-label={locale === 'ar' ? 'وضع التدريب' : 'Practice mode'}>
        <button
          className="btn-form"
          style={{ ...styles.modeTab, ...(practiceMode === 'letters' ? styles.modeTabActive : {}) }}
          onClick={() => switchPracticeMode('letters')}
          role="tab"
          aria-selected={practiceMode === 'letters'}
          aria-label={t('ariaModeTab') + ': ' + t('tabLetters')}
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
      </div>

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
        <div style={styles.formSwitcher} role="group" aria-label={locale === 'ar' ? 'شكل الحرف' : 'Letter form'}>
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
        <div style={styles.formSwitcher} role="group" aria-label={locale === 'ar' ? 'مجموعة كلمات' : 'Word group'}>
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
      <div style={styles.canvasWrap} className="canvas-max">
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
          role="img"
          aria-label={t('ariaCanvas')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
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
          defaultValue={parseFloat(localStorage.getItem('brushScale') || '1')}
          style={{ flex: 1, accentColor: 'var(--color-accent)' }}
          onChange={(e) => setBrushScale(parseFloat(e.target.value))}
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
        {practiceMode === 'letters' && STROKE_DATA[letter.letter] && (
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
          style={{ ...styles.btn, ...styles.btnAI, opacity: loading || apiKey === 'skip' || !isOnline ? 0.35 : 1 }}
          onClick={requestFeedback}
          disabled={loading || apiKey === 'skip' || !isOnline}
          aria-label={t('ariaAIFeedbackBtn')}
          aria-busy={loading}
        >
          {loading ? t('btnAIFeedbackLoading') : apiKey === 'skip' ? t('btnAIFeedbackNoKey') : !isOnline ? t('btnAIFeedbackOffline') : t('btnAIFeedback')}
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
      </div>

      {/* Feedback box */}
      {feedback && (
        <div
          style={feedback.error ? { ...styles.feedbackBox, ...styles.feedbackError } : styles.feedbackBox}
          role="region"
          aria-label={locale === 'ar' ? 'تعليقات المعلم' : "Teacher's feedback"}
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
      {(() => {
        const history = getFeedbackHistory(letter.name, activeForm);
        if (!history.length) return null;
        return (
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
        );
      })()}

      {/* Alphabet / lesson / word row */}
      {practiceMode === 'letters' ? (
        <div
          style={styles.alphabetRow}
          className="alpha-row-wrap"
          role="listbox"
          aria-label={locale === 'ar' ? 'اختيار الحرف' : 'Select a letter'}
          aria-activedescendant={`letter-btn-${letterIndex}`}
        >
          {(lessonMode ? LESSON_ORDER : LETTERS).map((item, idx) => {
            const l = lessonMode ? LETTERS[lessonToAlpha[idx]] : item;
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
                {lessonMode ? l.letter : l.letter}
                {isLetterComplete(l.name, Object.keys(l.forms)) ? <span style={styles.dotComplete} /> : isLetterStarted(l.name) ? <span style={styles.dotStarted} /> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div style={styles.alphabetRow} className="alpha-row-wrap" role="listbox" aria-label={locale === 'ar' ? 'اختيار كلمة' : 'Select a word'}>
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
    </div>
  );
}
