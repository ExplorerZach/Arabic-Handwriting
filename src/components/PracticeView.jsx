import { useState, useRef, useCallback, useEffect } from 'react';
import { LETTERS, FORM_NAMES, FORM_SHORT, FORM_DESCRIPTIONS } from '../data/letters';
import { calcLineWidth, setBrushScale, STROKE_COLOR } from '../utils/drawing';
import styles from '../styles/practiceStyles';

/** Mapping from form key to a human-friendly description for the AI prompt */
const FORM_LABELS = {
  isolated: 'isolated (stand-alone)',
  initial: 'initial (start of word)',
  medial: 'medial (middle of word)',
  final: 'final (end of word)',
};

export default function PracticeView({ apiKey, onClearKey }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);

  const [letterIndex, setLetterIndex] = useState(0);
  const [formIndex, setFormIndex] = useState('isolated');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const letter = LETTERS[letterIndex];
  const formKeys = Object.keys(letter.forms);
  const activeForm = formKeys.includes(formIndex) ? formIndex : 'isolated';
  const currentChar = letter.forms[activeForm];

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
      clearCanvas();
    },
    [clearCanvas]
  );

  const selectForm = useCallback(
    (form) => {
      setFormIndex(form);
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

    return offscreen.toDataURL('image/png').split(',')[1];
  };

  // ─── AI feedback ───────────────────────────────────────

  const requestFeedback = async () => {
    if (strokesRef.current.length < 5) {
      setFeedback({ error: 'Draw the letter first!' });
      return;
    }

    setLoading(true);
    setFeedback(null);

    const formDescription = FORM_LABELS[activeForm];

    try {
      const imageBase64 = exportCanvas();

      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model:
              localStorage.getItem('openrouter_model') ||
              'google/gemini-3-flash-preview',
            max_tokens: 1000,
            messages: [
              {
                role: 'system',
                content:
                  "You are an expert Arabic calligraphy instructor teaching beginners. The student's drawing is in dark ink; the faint watermark in the background is the correct reference stroke they are trying to copy. When giving feedback, compare the student's strokes directly against the reference shape — look at proportions, stroke curvature, entry/exit angles, dot placement (if applicable), and overall shape fidelity. Arabic is written right-to-left, so stroke direction and flow matter. Structure your response: (1) one specific thing they did well — be concrete, e.g. 'Your baseline is steady'; (2) one or two specific things to improve, e.g. 'The downward stroke should taper more at the tip'; (3) a short encouraging close. 3–5 sentences total, conversational not clinical, use the letter's name naturally.",
              },
              {
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:image/png;base64,${imageBase64}`,
                    },
                  },
                  {
                    type: 'text',
                    text: `The student is practicing the ${formDescription} form of the Arabic letter ${letter.name} (${letter.letter}), romanized as "${letter.roman}". Their attempt is in dark ink; the faint background is the correct reference. Please compare them and give structured feedback.`,
                  },
                ],
              },
            ],
          }),
        }
      );

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      setFeedback({
        text:
          (data.choices &&
            data.choices[0] &&
            data.choices[0].message &&
            data.choices[0].message.content) ||
          'No feedback.',
      });
    } catch (err) {
      setFeedback({ error: `Error: ${err.message}` });
    }

    setLoading(false);
  };

  // ─── Render ────────────────────────────────────────────

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.appTitle}>مكتبة الخط</span>
        <span style={styles.appSubtitle}>Arabic Script Practice</span>
        <button
          style={styles.keyBtn}
          onClick={() => setShowSettings((v) => !v)}
          title="API Key settings"
        >
          ⚙
        </button>
      </div>

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
          <button style={styles.keyPanelBtn} onClick={onClearKey}>
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
          style={{ ...styles.btn, ...styles.btnNav }}
          onClick={() =>
            selectLetter((letterIndex - 1 + LETTERS.length) % LETTERS.length)
          }
        >
          ‹ Prev
        </button>
        <button
          style={{ ...styles.btn, ...styles.btnClear }}
          onClick={clearCanvas}
        >
          Clear
        </button>
        <button
          style={{
            ...styles.btn,
            ...styles.btnAI,
            opacity: loading || apiKey === 'skip' ? 0.35 : 1,
          }}
          onClick={requestFeedback}
          disabled={loading || apiKey === 'skip'}
        >
          {loading
            ? 'Analyzing…'
            : apiKey === 'skip'
              ? 'No API Key'
              : '✦ AI Feedback'}
        </button>
        <button
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

      {/* Alphabet row */}
      <div style={styles.alphabetRow}>
        {LETTERS.map((l, idx) => (
          <button
            key={idx}
            style={{
              ...styles.alphaBtn,
              ...(idx === letterIndex ? styles.alphaBtnActive : {}),
            }}
            onClick={() => selectLetter(idx)}
            title={l.name}
            lang="ar"
          >
            {l.letter}
          </button>
        ))}
      </div>
    </div>
  );
}
