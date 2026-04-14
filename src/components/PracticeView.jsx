import { useState, useRef, useCallback, useEffect } from 'react';
import { LETTERS, FORM_NAMES, FORM_SHORT, FORM_DESCRIPTIONS } from '../data/letters';
import { LESSON_ORDER, LESSON_GROUPS, getLessonGroup } from '../data/lessonOrder';
import { calcLineWidth, setBrushScale, STROKE_COLOR } from '../utils/drawing';
import { getAIFeedback } from '../utils/api';
import { markPracticed, getProgress, isLetterStarted, isLetterComplete, countCompleted, setScore, getScore } from '../utils/progress';
import { addFeedbackEntry, getFeedbackHistory } from '../utils/history';
import STROKE_DATA from '../data/strokeOrder';
import { WORD_GROUPS, ALL_WORDS } from '../data/words';
import styles from '../styles/practiceStyles';

export default function PracticeView({ apiKey, onClearKey }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const canvasSnapshotRef = useRef(null);
  const animFrameRef = useRef(null);

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
  const [practiceMode, setPracticeMode] = useState('letters'); // 'letters' | 'words'
  const [wordGroupIndex, setWordGroupIndex] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);

  // Build a mapping from lesson order to LETTERS indices
  const lessonToAlpha = LESSON_ORDER.map(
    (ch) => LETTERS.findIndex((l) => l.letter === ch)
  );

  // In lesson mode, letterIndex refers to the position in LESSON_ORDER
  const actualLetterIndex = lessonMode ? (lessonToAlpha[letterIndex] ?? 0) : letterIndex;
  const letter = LETTERS[actualLetterIndex];
  const formKeys = Object.keys(letter.forms);
  const activeForm = formKeys.includes(formIndex) ? formIndex : 'isolated';
  const currentChar = letter.forms[activeForm];
  const completedCount = countCompleted(LETTERS);
  const totalCount = lessonMode ? LESSON_ORDER.length : LETTERS.length;
  const lessonGroupInfo = lessonMode ? getLessonGroup(letterIndex) : null;

  // Word practice derived state
  const currentWordGroup = WORD_GROUPS[wordGroupIndex];
  const currentWord = currentWordGroup?.words[wordIndex];

  // ─── Drawing ────────────────────────────────────────────

  const redraw = useCallback((points) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!points.length) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = STROKE_COLOR;

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

  const selectLetter = useCallback(
    (index) => {
      setLetterIndex(index);
      setFormIndex('isolated');
      setShowHistory(false);
      setShowComparison(false);
      clearCanvas();
    },
    [clearCanvas]
  );

  const selectForm = useCallback(
    (form) => {
      setFormIndex(form);
      setShowHistory(false);
      setShowComparison(false);
      clearCanvas();
    },
    [clearCanvas]
  );

  const switchPracticeMode = useCallback(
    (mode) => {
      setPracticeMode(mode);
      setFeedback(null);
      setShowComparison(false);
      setShowHistory(false);
      clearCanvas();
    },
    [clearCanvas]
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
    [clearCanvas]
  );

  const toggleLessonMode = useCallback(() => {
    setLessonMode((prev) => {
      const next = !prev;
      localStorage.setItem('lessonMode', String(next));
      // Reset to first letter in whichever ordering we switch to
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

  // ─── Online / offline detection ────────────────────────

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

  // ─── Undo ──────────────────────────────────────────────

  const undoStroke = useCallback(() => {
    const strokes = strokesRef.current;
    if (!strokes.length) return;
    // Walk backwards to find the start of the last stroke (newStroke: true)
    let i = strokes.length - 1;
    while (i > 0 && !strokes[i].newStroke) i--;
    strokesRef.current = strokes.slice(0, i);
    redraw(strokesRef.current);
  }, [redraw]);

  // ─── Stroke order animation (progressive reveal) ───────
  //
  // Technique: render the perfect letter glyph (via fillText with Amiri font)
  // onto an offscreen canvas, then progressively reveal it by painting a thick
  // circular brush along our stroke-order paths.  The canvas compositing mode
  // 'destination-in' is used so only the intersection of the glyph and the
  // brush-trail remains visible.  This guarantees the final result is always
  // the real font shape, regardless of how rough the stroke-order coordinates
  // are.

  const playStrokeAnimation = useCallback(async () => {
    const data = STROKE_DATA[letter.letter];
    if (!data || animating) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    const dpr = devicePixelRatio || 1;

    // Clear canvas & state
    strokesRef.current = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setAnimating(true);
    setFeedback(null);
    setShowComparison(false);

    // Ensure Arabic font is loaded before rendering
    try { await document.fonts.ready; } catch (_) { /* proceed anyway */ }

    const W = canvas.width;   // physical (HiDPI) pixels
    const H = canvas.height;

    // ── 1. Render glyph onto an offscreen "glyph" canvas ───
    const glyphCanvas = document.createElement('canvas');
    glyphCanvas.width = W;
    glyphCanvas.height = H;
    const gCtx = glyphCanvas.getContext('2d');

    // Choose font size: ~65% of canvas height gives good coverage
    const fontSize = (rect.height * 0.65);
    gCtx.save();
    gCtx.scale(dpr, dpr);
    gCtx.font = `${fontSize}px "Amiri", "Scheherazade New", serif`;
    gCtx.fillStyle = '#8b4513';
    gCtx.textAlign = 'center';
    gCtx.textBaseline = 'middle';
    gCtx.direction = 'rtl';
    gCtx.fillText(currentChar, rect.width / 2, rect.height / 2);
    gCtx.restore();

    // ── 2. Create a "mask" canvas where the brush trail accumulates ─
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = W;
    maskCanvas.height = H;
    const mCtx = maskCanvas.getContext('2d');

    // ── 3. Interpolate stroke points for smooth movement ────
    // Take the rough stroke-order coords and create many intermediate points
    const scaleX = rect.width / 100;
    const scaleY = rect.height / 100;

    const interpolatePoints = (pts, stepsPerSeg) => {
      const result = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        for (let s = 0; s < stepsPerSeg; s++) {
          const t = s / stepsPerSeg;
          result.push({
            x: (a.x + (b.x - a.x) * t) * scaleX * dpr,
            y: (a.y + (b.y - a.y) * t) * scaleY * dpr,
          });
        }
      }
      // Push the last point
      const last = pts[pts.length - 1];
      result.push({ x: last.x * scaleX * dpr, y: last.y * scaleY * dpr });
      return result;
    };

    // Brush radius — generous enough to cover the glyph width
    const BRUSH_RADIUS = Math.min(W, H) * 0.10;

    // Build operations list with interpolated points
    const STEPS_PER_SEG = 4;  // interpolation density
    const ops = [];
    for (const stroke of data.strokes) {
      const interp = interpolatePoints(stroke, STEPS_PER_SEG);
      ops.push({ type: 'stroke', points: interp });
    }
    for (const dot of data.dots) {
      ops.push({
        type: 'dot',
        point: {
          x: dot.x * scaleX * dpr,
          y: dot.y * scaleY * dpr,
        },
      });
    }

    let opIdx = 0;
    let ptIdx = 0;
    const PAUSE_FRAMES = 18;
    let pauseCount = 0;

    // ── 4. Compose a single frame onto the visible canvas ──
    //
    // We need a third offscreen canvas to composite the masked glyph,
    // because 'destination-in' on the visible canvas would erase the ghost.
    const compCanvas = document.createElement('canvas');
    compCanvas.width = W;
    compCanvas.height = H;
    const cCtx = compCanvas.getContext('2d');

    const drawFrame = () => {
      // Build the masked (revealed) portion on compCanvas
      cCtx.clearRect(0, 0, W, H);
      cCtx.drawImage(glyphCanvas, 0, 0);
      cCtx.globalCompositeOperation = 'destination-in';
      cCtx.drawImage(maskCanvas, 0, 0);
      cCtx.globalCompositeOperation = 'source-over';

      // Draw onto visible canvas: ghost behind, revealed on top
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // Faint ghost of the whole letter
      ctx.globalAlpha = 0.12;
      ctx.drawImage(glyphCanvas, 0, 0);

      // Fully opaque revealed portion
      ctx.globalAlpha = 1;
      ctx.drawImage(compCanvas, 0, 0);
      ctx.restore();
    };

    // ── 5. Animation loop ───────────────────────────────────
    const animate = () => {
      if (opIdx >= ops.length) {
        // Final frame: show the full glyph at full opacity
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
        const pts = op.points;

        if (ptIdx < pts.length) {
          // Paint brush circle on the mask canvas
          const pt = pts[ptIdx];
          mCtx.beginPath();
          mCtx.arc(pt.x, pt.y, BRUSH_RADIUS, 0, Math.PI * 2);
          mCtx.fillStyle = '#000';
          mCtx.fill();
          ptIdx++;
          drawFrame();
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }

        // Stroke done — pause
        if (pauseCount < PAUSE_FRAMES) {
          pauseCount++;
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }

        opIdx++;
        ptIdx = 0;
        pauseCount = 0;
        animFrameRef.current = requestAnimationFrame(animate);
      } else if (op.type === 'dot') {
        // Reveal dot area
        const dp = op.point;
        mCtx.beginPath();
        mCtx.arc(dp.x, dp.y, BRUSH_RADIUS * 0.8, 0, Math.PI * 2);
        mCtx.fillStyle = '#000';
        mCtx.fill();
        drawFrame();

        if (pauseCount < PAUSE_FRAMES) {
          pauseCount++;
          animFrameRef.current = requestAnimationFrame(animate);
          return;
        }
        opIdx++;
        ptIdx = 0;
        pauseCount = 0;
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    // Draw initial ghost + start
    drawFrame();
    animFrameRef.current = requestAnimationFrame(animate);
  }, [letter.letter, currentChar, animating]);

  // Clean up animation on unmount or letter change
  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [letterIndex]);

  // ─── Pointer events ────────────────────────────────────

  const getPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure ?? 0.5,
      pointerType: e.pointerType ?? 'touch',
    };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    strokesRef.current.push({ ...getPoint(e), newStroke: true });
  };

  const handlePointerMove = (e) => {
    e.preventDefault();
    if (e.buttons === 0) return;
    strokesRef.current.push({ ...getPoint(e), newStroke: false });
    redraw(strokesRef.current);
  };

  const handlePointerUp = (e) => {
    e.preventDefault();
  };

  // ─── Canvas export with ghost watermark ────────────────

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    const dpr = devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Full-resolution offscreen canvas for compositing
    const offscreen = document.createElement('canvas');
    offscreen.width = rect.width * dpr;
    offscreen.height = rect.height * dpr;

    const ctx = offscreen.getContext('2d');
    ctx.fillStyle = '#fdf6e8';
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    // Draw reference text as faint watermark
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

    // Draw the student's strokes on top
    ctx.drawImage(canvas, 0, 0);

    // Downscale to max 512px to reduce payload size before sending to AI
    const MAX_SIZE = 512;
    const scale = Math.min(1, MAX_SIZE / Math.max(offscreen.width, offscreen.height));
    const compressed = document.createElement('canvas');
    compressed.width = Math.round(offscreen.width * scale);
    compressed.height = Math.round(offscreen.height * scale);
    compressed.getContext('2d').drawImage(offscreen, 0, 0, compressed.width, compressed.height);

    return compressed.toDataURL('image/jpeg', 0.85).split(',')[1];
  };

  // ─── AI feedback ───────────────────────────────────────

  const FORM_LABELS = {
    isolated: 'isolated (stand-alone)',
    initial: 'initial (start of word)',
    medial: 'medial (middle of word)',
    final: 'final (end of word)',
  };

  const requestFeedback = async () => {
    if (strokesRef.current.length < 5) {
      setFeedback({ error: practiceMode === 'words' ? 'Draw the word first!' : 'Draw the letter first!' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const imageBase64 = exportCanvas();

      // Capture a snapshot of the user's drawing for comparison view
      canvasSnapshotRef.current = `data:image/jpeg;base64,${imageBase64}`;

      let text;
      if (practiceMode === 'words' && currentWord) {
        text = await getAIFeedback(
          apiKey,
          imageBase64,
          currentWord.word,
          currentWord.word,
          currentWord.roman,
          `word "${currentWord.meaning}"`
        );
      } else {
        text = await getAIFeedback(
          apiKey,
          imageBase64,
          letter.name,
          letter.letter,
          letter.roman,
          FORM_LABELS[activeForm]
        );
      }

      // Parse score tag [SCORE:N] from AI response
      const scoreMatch = text.match(/\[SCORE:\s*(\d)\]/);
      const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
      // Strip the score tag from the displayed text
      const cleanText = text.replace(/\[SCORE:\s*\d\]\s*/g, '').trim();

      if (practiceMode === 'letters') {
        // Mark as practiced, save to history, refresh progress state
        const updated = markPracticed(letter.name, activeForm);
        if (score) {
          setScore(letter.name, activeForm, score);
        }
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

  // ─── Render ────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.appTitle}>مكتبة الخط</span>
        <span style={styles.appSubtitle}>
          Arabic Script Practice
          {completedCount > 0 && (
            <span style={styles.completedBadge}>
              {completedCount}/{LETTERS.length} complete
            </span>
          )}
        </span>
        <div style={styles.headerButtons}>
          <button
            className="btn-gear"
            style={{
              ...styles.lessonToggle,
              ...(lessonMode ? styles.lessonToggleActive : {}),
            }}
            onClick={toggleLessonMode}
            title={lessonMode ? 'Switch to alphabetical order' : 'Switch to lesson mode (grouped by shape)'}
          >
            {lessonMode ? '📖' : '📖'}
          </button>
          <button
            className="btn-gear"
            style={styles.keyBtn}
            onClick={() => setShowSettings((v) => !v)}
            title="API Key settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Lesson mode group indicator */}
      {lessonMode && lessonGroupInfo && (
        <div style={styles.lessonBanner}>
          <span style={styles.lessonGroupName}>
            Lesson {lessonGroupInfo.groupIndex + 1}: {lessonGroupInfo.group.name}
          </span>
          <span style={styles.lessonGroupDesc}>
            {lessonGroupInfo.group.description}
          </span>
        </div>
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div style={styles.offlineBanner}>
          You are offline — AI feedback is unavailable
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div style={styles.keyPanel}>
          <span style={{ fontSize: '12px', color: '#6b4010' }}>
            API key is saved on this device.
          </span>
          <label
            style={{
              fontSize: '12px',
              color: '#6b4010',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            Model
            <select
              defaultValue={
                localStorage.getItem('openrouter_model') ||
                'google/gemini-3-flash-preview'
              }
              onChange={(ev) =>
                localStorage.setItem('openrouter_model', ev.target.value)
              }
              style={{
                padding: '6px 8px',
                borderRadius: '8px',
                border: '1.5px solid rgba(180,130,60,.4)',
                background: 'rgba(255,252,240,.9)',
                fontSize: '13px',
                fontFamily: 'Georgia,serif',
                color: '#5c3010',
              }}
            >
              <option value="google/gemini-3-flash-preview">
                Gemini 3 Flash
              </option>
              <option value="google/gemini-3.1-pro-preview">
                Gemini 3.1 Pro
              </option>
              <option value="anthropic/claude-sonnet-4.6">
                Claude Sonnet 4.6
              </option>
              <option value="openai/gpt-5.4-mini">GPT-5.4 mini</option>
            </select>
          </label>
          <button className="btn-panel" style={styles.keyPanelBtn} onClick={onClearKey}>
            Change key
          </button>
        </div>
      )}

      {/* Mode tabs — Letters / Words */}
      <div style={styles.modeTabs}>
        <button
          className="btn-form"
          style={{
            ...styles.modeTab,
            ...(practiceMode === 'letters' ? styles.modeTabActive : {}),
          }}
          onClick={() => switchPracticeMode('letters')}
        >
          Letters
        </button>
        <button
          className="btn-form"
          style={{
            ...styles.modeTab,
            ...(practiceMode === 'words' ? styles.modeTabActive : {}),
          }}
          onClick={() => switchPracticeMode('words')}
        >
          Words
        </button>
      </div>

      {/* Info bar — differs between letter and word mode */}
      {practiceMode === 'letters' ? (
        <div style={styles.infoBar}>
          <div style={styles.letterMeta}>
            <span style={styles.letterNameLarge}>{letter.name}</span>
            <span style={styles.letterRoman}>/{letter.roman}/</span>
          </div>
          <div style={styles.miniPreviews}>
            {Object.entries(letter.forms).map(([key]) => (
              <div key={key} style={styles.miniPreview}>
                <span style={styles.miniChar} lang="ar">
                  {letter.forms[key]}
                </span>
                <span style={styles.miniLabel}>{FORM_NAMES[key]}</span>
              </div>
            ))}
          </div>
          <span style={styles.progressBadge}>
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

      {/* Form switcher (letters mode only) */}
      {practiceMode === 'letters' && (
        <div style={styles.formSwitcher}>
          {formKeys.map((key) => {
            const isActive = key === activeForm;
            return (
              <button
                key={key}
                className="btn-form"
                style={{
                  ...styles.formBtn,
                  ...(isActive ? styles.formBtnActive : {}),
                }}
                onClick={() => selectForm(key)}
              >
                <span
                  lang="ar"
                  style={{
                    ...styles.formBtnChar,
                    color: isActive ? '#fff8ee' : '#5c2d00',
                  }}
                >
                  {letter.forms[key]}
                </span>
                <span
                  style={{
                    ...styles.formBtnName,
                    color: isActive ? '#ffebd0' : '#5c2d00',
                  }}
                >
                  {FORM_NAMES[key]}
                </span>
                <span
                  style={{
                    ...styles.formBtnSub,
                    color: isActive ? '#ffd9a8' : '#9b6a30',
                  }}
                >
                  {FORM_SHORT[key]}
                </span>
              </button>
            );
          })}
          {letter.nonJoiner && (
            <div style={styles.nonJoinerNote}>
              Non-joining — no initial or medial form
            </div>
          )}
        </div>
      )}

      {/* Word group selector (words mode only) */}
      {practiceMode === 'words' && (
        <div style={styles.formSwitcher}>
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
              >
                <span
                  style={{
                    ...styles.formBtnName,
                    color: isActive ? '#ffebd0' : '#5c2d00',
                  }}
                >
                  {g.name}
                </span>
                <span
                  style={{
                    ...styles.formBtnSub,
                    color: isActive ? '#ffd9a8' : '#9b6a30',
                  }}
                >
                  {g.words.length} words
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
          {practiceMode === 'letters' ? (
            <>
              <strong>{letter.hint}</strong>
              {formKeys.length > 1 && (
                <>
                  {' '}
                  <em>{FORM_DESCRIPTIONS[activeForm]}</em>
                </>
              )}
            </>
          ) : (
            <strong>{currentWord?.hint}</strong>
          )}
        </span>
      </div>

      {/* Canvas */}
      <div style={styles.canvasWrap}>
        {practiceMode === 'letters' ? (
          <div style={styles.ghostLetter} lang="ar">
            {currentChar}
          </div>
        ) : (
          <div style={styles.ghostWord} lang="ar" dir="rtl">
            {currentWord?.word}
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={styles.canvas}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        <div style={styles.rtlGuide}>← Write right-to-left</div>
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
            color: '#6b3800',
            whiteSpace: 'nowrap',
          }}
        >
          Brush Size
        </label>
        <input
          type="range"
          min={0.2}
          max={2}
          step={0.1}
          defaultValue={parseFloat(
            localStorage.getItem('brushScale') || '1'
          )}
          style={{ flex: 1, accentColor: '#8b4513' }}
          onChange={(e) => setBrushScale(parseFloat(e.target.value))}
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
            } else {
              selectLetter((letterIndex - 1 + totalCount) % totalCount);
            }
          }}
        >
          ‹ Prev
        </button>
        <button
          className="btn-clear"
          style={{ ...styles.btn, ...styles.btnClear }}
          onClick={undoStroke}
        >
          Undo
        </button>
        <button
          className="btn-clear"
          style={{ ...styles.btn, ...styles.btnClear }}
          onClick={clearCanvas}
        >
          Clear
        </button>
        {practiceMode === 'letters' && STROKE_DATA[letter.letter] && (
          <button
            className="btn-nav"
            style={{
              ...styles.btn,
              ...styles.btnShowMe,
              opacity: animating ? 0.35 : 1,
            }}
            onClick={playStrokeAnimation}
            disabled={animating}
          >
            {animating ? 'Playing…' : '▶ Show me'}
          </button>
        )}
        <button
          className="btn-ai"
          style={{
            ...styles.btn,
            ...styles.btnAI,
            opacity: loading || apiKey === 'skip' || !isOnline ? 0.35 : 1,
          }}
          onClick={requestFeedback}
          disabled={loading || apiKey === 'skip' || !isOnline}
        >
          {loading
            ? 'Analyzing…'
            : apiKey === 'skip'
              ? 'No API Key'
              : !isOnline
                ? 'Offline'
                : '✦ AI Feedback'}
        </button>
        <button
          className="btn-nav"
          style={{ ...styles.btn, ...styles.btnNav }}
          onClick={() => {
            if (practiceMode === 'words') {
              const total = currentWordGroup.words.length;
              selectWord(wordGroupIndex, (wordIndex + 1) % total);
            } else {
              selectLetter((letterIndex + 1) % totalCount);
            }
          }}
        >
          Next ›
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
        >
          {feedback.error ? (
            <span>{feedback.error}</span>
          ) : (
            <>
              {/* Score stars */}
              {feedback.score && (
                <div style={styles.scoreRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      style={n <= feedback.score ? styles.starFilled : styles.starEmpty}
                    >
                      ★
                    </span>
                  ))}
                  <span style={styles.scoreLabel}>
                    {feedback.score === 5
                      ? 'Excellent!'
                      : feedback.score >= 4
                        ? 'Great work'
                        : feedback.score >= 3
                          ? 'Good effort'
                          : feedback.score >= 2
                            ? 'Keep practicing'
                            : 'Just starting'}
                  </span>
                </div>
              )}
              <div style={styles.feedbackLabel}>Teacher's Notes</div>
              <p style={styles.feedbackText}>{feedback.text}</p>
            </>
          )}
        </div>
      )}

      {/* Side-by-side comparison */}
      {feedback && !feedback.error && canvasSnapshotRef.current && (
        <div style={{ width: '100%', maxWidth: '520px' }}>
          <button
            className="btn-history"
            style={styles.comparisonToggle}
            onClick={() => setShowComparison((v) => !v)}
          >
            {showComparison ? '▾ Hide' : '▸ Show'} comparison
          </button>
          {showComparison && (
            <div style={styles.comparisonWrap}>
              <div style={styles.comparisonPane}>
                <span style={styles.comparisonLabel}>Reference</span>
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
                <span style={styles.comparisonLabel}>Your attempt</span>
                <img
                  src={canvasSnapshotRef.current}
                  alt="Your drawing"
                  style={styles.comparisonAttempt}
                />
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
            >
              {showHistory ? '▾' : '▸'} Past feedback ({history.length})
            </button>
            {showHistory && (
              <div style={styles.historyPanel}>
                {history.map((entry, i) => (
                  <div key={i} style={styles.historyEntry}>
                    <div style={styles.historyDate}>
                      {new Date(entry.date).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
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
        <div style={styles.alphabetRow}>
          {lessonMode
            ? LESSON_ORDER.map((ch, idx) => {
                const alphaIdx = lessonToAlpha[idx];
                const l = LETTERS[alphaIdx];
                return (
                  <button
                    key={idx}
                    className="btn-alpha"
                    style={{
                      ...styles.alphaBtn,
                      ...(idx === letterIndex ? styles.alphaBtnActive : {}),
                    }}
                    onClick={() => selectLetter(idx)}
                    title={l.name}
                    lang="ar"
                  >
                    {l.letter}
                    {isLetterComplete(l.name, Object.keys(l.forms)) ? (
                      <span style={styles.dotComplete} />
                    ) : isLetterStarted(l.name) ? (
                      <span style={styles.dotStarted} />
                    ) : null}
                  </button>
                );
              })
            : LETTERS.map((l, idx) => (
                <button
                  key={idx}
                  className="btn-alpha"
                  style={{
                    ...styles.alphaBtn,
                    ...(idx === letterIndex ? styles.alphaBtnActive : {}),
                  }}
                  onClick={() => selectLetter(idx)}
                  title={l.name}
                  lang="ar"
                >
                  {l.letter}
                  {isLetterComplete(l.name, Object.keys(l.forms)) ? (
                    <span style={styles.dotComplete} />
                  ) : isLetterStarted(l.name) ? (
                    <span style={styles.dotStarted} />
                  ) : null}
                </button>
              ))}
        </div>
      ) : (
        <div style={styles.alphabetRow}>
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
            >
              {w.word}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
