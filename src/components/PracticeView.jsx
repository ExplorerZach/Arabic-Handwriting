import { useState, useRef, useCallback, useEffect } from 'react';
import { LETTERS, FORM_NAMES, FORM_SHORT, FORM_DESCRIPTIONS } from '../data/letters';
import { calcLineWidth, setBrushScale, STROKE_COLOR } from '../utils/drawing';
import { getAIFeedback } from '../utils/api';
import { markPracticed, getProgress, isLetterStarted, isLetterComplete, countCompleted } from '../utils/progress';
import { addFeedbackEntry, getFeedbackHistory } from '../utils/history';
import styles from '../styles/practiceStyles';

export default function PracticeView({ apiKey, onClearKey }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);

  const [letterIndex, setLetterIndex] = useState(0);
  const [formIndex, setFormIndex] = useState('isolated');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [progress, setProgress] = useState(() => getProgress());
  const [showHistory, setShowHistory] = useState(false);

  const letter = LETTERS[letterIndex];
  const formKeys = Object.keys(letter.forms);
  const activeForm = formKeys.includes(formIndex) ? formIndex : 'isolated';
  const currentChar = letter.forms[activeForm];
  const completedCount = countCompleted(LETTERS);

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
      clearCanvas();
    },
    [clearCanvas]
  );

  const selectForm = useCallback(
    (form) => {
      setFormIndex(form);
      setShowHistory(false);
      clearCanvas();
    },
    [clearCanvas]
  );

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

    // Draw reference letter as faint watermark
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#8b4513';
    ctx.font = `bold ${Math.min(offscreen.width, offscreen.height) * 0.5}px 'Amiri','Scheherazade New',serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(currentChar, offscreen.width / 2, offscreen.height / 2);
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
      setFeedback({ error: 'Draw the letter first!' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const imageBase64 = exportCanvas();
      const text = await getAIFeedback(
        apiKey,
        imageBase64,
        letter.name,
        letter.letter,
        letter.roman,
        FORM_LABELS[activeForm]
      );
      // Mark as practiced, save to history, refresh progress state
      const updated = markPracticed(letter.name, activeForm);
      setProgress(updated);
      addFeedbackEntry(letter.name, activeForm, text);
      setFeedback({ text });
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
        <button
          className="btn-gear"
          style={styles.keyBtn}
          onClick={() => setShowSettings((v) => !v)}
          title="API Key settings"
        >
          ⚙
        </button>
      </div>

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

      {/* Info bar */}
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
          {letterIndex + 1}/{LETTERS.length}
        </span>
      </div>

      {/* Form switcher */}
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

      {/* Hint */}
      <div style={styles.hintRow}>
        <span style={styles.hintIcon}>✦</span>
        <span style={styles.hintText}>
          <strong>{letter.hint}</strong>
          {formKeys.length > 1 && (
            <>
              {' '}
              <em>{FORM_DESCRIPTIONS[activeForm]}</em>
            </>
          )}
        </span>
      </div>

      {/* Canvas */}
      <div style={styles.canvasWrap}>
        <div style={styles.ghostLetter} lang="ar">
          {currentChar}
        </div>
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
          onClick={() =>
            selectLetter((letterIndex - 1 + LETTERS.length) % LETTERS.length)
          }
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
          onClick={() =>
            selectLetter((letterIndex + 1) % LETTERS.length)
          }
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
              <div style={styles.feedbackLabel}>Teacher's Notes</div>
              <p style={styles.feedbackText}>{feedback.text}</p>
            </>
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

      {/* Alphabet row */}
      <div style={styles.alphabetRow}>
        {LETTERS.map((l, idx) => (
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
    </div>
  );
}
