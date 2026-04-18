# Codebase Audit — Arabic Handwriting Practice PWA

You are performing a thorough code audit of a React 19 + Vite 8 PWA for Arabic handwriting practice. The app lets users draw Arabic letters/words on an HTML canvas (touch/pen/mouse) and receive AI calligraphy feedback via the OpenRouter vision API. It's a static site deployed on Vercel.

Your job: identify **real bugs**, **stale closure / React hook pitfalls**, **UX defects**, **performance issues**, **architectural weaknesses**, and **code quality improvements**. Be specific — quote the file and approximate line number for every finding. Categorize each finding as **Bug** / **UX Defect** / **Performance** / **Code Quality** / **Architecture**.

---

## Architecture Overview

```
src/
├── App.jsx                    — root; manages apiKey / locale / darkMode state
├── main.jsx
├── components/
│   ├── LoginScreen.jsx        — API key entry
│   └── PracticeView.jsx       — ~1060 lines; all practice UI, canvas, drawing, AI, animation
├── data/
│   ├── letters.js             — 28 letters; auto-generates positional forms via tatweel
│   ├── lessonOrder.js         — shape-family groups for lesson mode
│   ├── strokeOrder.js         — stroke-order coordinates (0–100 space) for animation
│   └── words.js               — word groups (ligatures, common words, phrases)
├── locales/index.js           — UI string map { en: {...}, ar: {...} }
├── utils/
│   ├── api.js                 — OpenRouter vision API call
│   ├── drawing.js             — brush scale (mutable module-level export), lineWidth calc
│   ├── progress.js            — per-letter/form practice tracking + SM-2 spaced repetition
│   └── history.js             — last-5 AI feedback entries per letter/form in localStorage
└── styles/
    ├── global.css             — CSS custom properties, responsive, dark mode, RTL
    ├── practiceStyles.js      — inline style objects for PracticeView
    └── loginStyles.js         — inline style objects for LoginScreen
public/
├── sw.js                      — service worker (cache-first)
└── manifest.json
scripts/
└── bust-sw.js                 — post-build: bumps SW cache version + patches asset hashes
```

**Key constraints:**
- No TypeScript, no test suite, no linter.
- `PracticeView` is intentionally one large component (~1060 lines). Don't recommend splitting it.
- `strokesRef` is a `useRef` (not state) for drawing perf — do not move to state.
- No React Context. Props flow from `App` down.
- Styling: inline JS objects in `src/styles/` + `global.css` for CSS vars, hover states, dark mode, RTL.
- All UI strings go through `t(key)` from `src/locales/index.js`.

---

## Full Source

### `src/App.jsx`
```jsx
import { useState, useEffect } from 'react';
import PracticeView from './components/PracticeView';
import LoginScreen from './components/LoginScreen';

export default function App() {
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem('openrouter_key') || ''
  );
  const [locale, setLocale] = useState(
    () => localStorage.getItem('app_locale') || 'en'
  );
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem('app_darkMode') === 'true'
  );

  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [darkMode]);

  useEffect(() => {
    document.documentElement.setAttribute('lang', locale);
    document.documentElement.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  }, [locale]);

  const handleSave = (key) => {
    localStorage.setItem('openrouter_key', key);
    setApiKey(key);
  };

  const handleClearKey = () => {
    localStorage.removeItem('openrouter_key');
    setApiKey('');
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      localStorage.setItem('app_darkMode', String(next));
      return next;
    });
  };

  const toggleLocale = () => {
    setLocale((prev) => {
      const next = prev === 'en' ? 'ar' : 'en';
      localStorage.setItem('app_locale', next);
      return next;
    });
  };

  return (
    <>
      <a href="#main-canvas" className="skip-link">Skip to canvas</a>
      {apiKey ? (
        <PracticeView
          apiKey={apiKey}
          onClearKey={handleClearKey}
          locale={locale}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onToggleLocale={toggleLocale}
        />
      ) : (
        <LoginScreen onSave={handleSave} darkMode={darkMode} onToggleDarkMode={toggleDarkMode} />
      )}
    </>
  );
}
```

---

### `src/utils/drawing.js`
```js
export let brushScale = parseFloat(localStorage.getItem('brushScale') || '1');

export function setBrushScale(value) {
  brushScale = value;
  localStorage.setItem('brushScale', String(value));
}

export function calcLineWidth(pressure, pointerType) {
  if (pointerType === 'pen') {
    return Math.max(3, Math.sqrt(pressure) * 32 * brushScale);
  }
  return Math.max(3, pressure * 28 * brushScale);
}
```

---

### `src/utils/progress.js`
```js
const STORAGE_KEY = 'arabic_progress';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function markPracticed(letterName, formKey) {
  const data = load();
  if (!data[letterName]) data[letterName] = {};
  const entry = data[letterName][formKey] || { practiced: false, practiceCount: 0 };
  entry.practiced = true;
  entry.practiceCount = (entry.practiceCount || 0) + 1;
  data[letterName][formKey] = entry;
  save(data);
  return data;
}

export function getProgress() { return load(); }

export function isLetterComplete(letterName, formKeys) {
  const data = load();
  const letterData = data[letterName] || {};
  return formKeys.every((k) => letterData[k]?.practiced);
}

export function isLetterStarted(letterName) {
  const data = load();
  const letterData = data[letterName] || {};
  return Object.values(letterData).some((v) => v?.practiced);
}

export function countCompleted(letters) {
  return letters.filter((l) =>
    isLetterComplete(l.name, Object.keys(l.forms))
  ).length;
}

export function setScore(letterName, formKey, score) {
  const data = load();
  if (!data[letterName]) data[letterName] = {};
  if (!data[letterName][formKey]) data[letterName][formKey] = { practiced: false, practiceCount: 0 };
  data[letterName][formKey].score = Math.max(1, Math.min(5, score));
  save(data);
  return data;
}

export function getScore(letterName, formKey) {
  const data = load();
  return data[letterName]?.[formKey]?.score ?? null;
}

export function updateSR(letterName, formKey, quality) {
  const data = load();
  if (!data[letterName]) data[letterName] = {};
  if (!data[letterName][formKey]) {
    data[letterName][formKey] = { practiced: false, practiceCount: 0 };
  }
  const entry = data[letterName][formKey];

  // Map AI score 1–5 to SM-2 quality 0–5
  // score 1 → quality 0 (complete fail)
  // score 2 → quality 2 (marginal)
  // score 3 → quality 3 (good pass)
  // score 4 → quality 4 (good pass)
  // score 5 → quality 5 (perfect)
  const q = Math.max(0, Math.min(5, quality));

  let { interval = 1, easeFactor = 2.5 } = entry;

  if (q < 3) {
    interval = 1;
  } else {
    if (interval <= 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
  }

  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  entry.interval = interval;
  entry.easeFactor = easeFactor;
  entry.lastReview = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  save(data);
  return entry;
}

export function getDueLetters(LETTERS) {
  const data = load();
  const today = new Date().toISOString().split('T')[0];
  const due = [];

  for (const letter of LETTERS) {
    for (const [formKey] of Object.entries(letter.forms)) {
      const stored = data[letter.name]?.[formKey];
      if (!stored?.practiced) continue;

      if (!stored.lastReview) {
        due.push({ letterName: letter.name, letterChar: letter.forms[formKey], formKey });
        continue;
      }

      const nextDate = new Date(stored.lastReview);
      nextDate.setDate(nextDate.getDate() + (stored.interval || 1));
      const nextReview = nextDate.toISOString().split('T')[0];
      if (nextReview <= today) {
        due.push({ letterName: letter.name, letterChar: letter.forms[formKey], formKey });
      }
    }
  }

  return due;
}
```

---

### `src/utils/history.js`
```js
const STORAGE_KEY = 'arabic_feedback_history';
const MAX_PER_SLOT = 5;

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function slotKey(letterName, formKey) {
  return `${letterName}_${formKey}`;
}

export function addFeedbackEntry(letterName, formKey, text) {
  const data = load();
  const key = slotKey(letterName, formKey);
  const entries = data[key] || [];
  entries.push({ text, date: new Date().toISOString() });
  data[key] = entries.slice(-MAX_PER_SLOT);
  save(data);
  return data[key];
}

export function getFeedbackHistory(letterName, formKey) {
  const data = load();
  const key = slotKey(letterName, formKey);
  return (data[key] || []).slice().reverse();
}
```

---

### `src/utils/api.js`
```js
export async function getAIFeedback(apiKey, imageBase64, letterName, letterChar, romanName, formDescription) {
  const model = localStorage.getItem('openrouter_model') || 'google/gemini-3-flash-preview';

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content: "You are an expert Arabic calligraphy instructor teaching beginners. The student's drawing is in dark ink; the faint watermark in the background is the correct reference stroke they are trying to copy. When giving feedback, compare the student's strokes directly against the reference shape — look at proportions, stroke curvature, entry/exit angles, dot placement (if applicable), and overall shape fidelity. Arabic is written right-to-left, so stroke direction and flow matter. Structure your response: (1) Start with a score tag in this exact format: [SCORE:N] where N is 1–5 (1=unrecognizable, 2=rough attempt, 3=recognizable with issues, 4=good with minor issues, 5=excellent). (2) One specific thing they did well — be concrete, e.g. 'Your baseline is steady'; (3) one or two specific things to improve, e.g. 'The downward stroke should taper more at the tip'; (4) a short encouraging close. 3–5 sentences total after the score tag, conversational not clinical, use the letter's name naturally.",
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: `The student is practicing the ${formDescription} form of the Arabic letter ${letterName} (${letterChar}), romanized as "${romanName}". Their attempt is in dark ink; the faint background is the correct reference. Please compare them and give structured feedback.`,
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json();

  if (data.error) {
    const msg = data.error.message || '';
    const code = data.error.code ?? response.status;
    if (code === 401 || response.status === 401) throw new Error('Invalid API key. Go to Settings → Change key and enter a valid OpenRouter key.');
    if (code === 402 || response.status === 402) throw new Error('Insufficient credits. Top up your OpenRouter balance at openrouter.ai/credits.');
    if (code === 429 || response.status === 429) throw new Error('Rate limit reached. Wait a few seconds and try again.');
    if (code === 503 || response.status === 503) throw new Error('The AI model is temporarily unavailable. Try switching models in Settings.');
    throw new Error(msg || `Unexpected error (${response.status}).`);
  }

  return (data.choices?.[0]?.message?.content) || 'No feedback.';
}
```

---

### `src/data/letters.js` (excerpt — key logic)
```js
const TATWEEL = 'ـ';
const NON_JOINERS = new Set(['ا', 'د', 'ذ', 'ر', 'ز', 'و']);

function generateForms(letter) {
  if (NON_JOINERS.has(letter)) {
    return { isolated: letter, final: TATWEEL + letter };
  }
  return {
    isolated: letter,
    initial: letter + TATWEEL,
    medial: TATWEEL + letter + TATWEEL,
    final: TATWEEL + letter,
  };
}

export const FORM_NAMES = { isolated: 'Isolated', initial: 'Initial', medial: 'Medial', final: 'Final' };
export const FORM_SHORT = { isolated: 'alone', initial: 'word start', medial: 'word middle', final: 'word end' };
export const FORM_DESCRIPTIONS = { isolated: 'Stand-alone...', initial: 'Start of word...', medial: 'Middle of word...', final: 'End of word...' };

export const LETTERS = [
  { letter: 'ا', name: 'Alef', roman: 'a / ā', hint: '...', nonJoiner: true },
  // ... 28 letters total ...
].map((entry) => ({ ...entry, forms: generateForms(entry.letter) }));
```

---

### `src/components/PracticeView.jsx` (full, ~1060 lines)

Key sections to focus on:

**Imports & constants (lines 1–23):**
```jsx
import { useState, useRef, useCallback, useEffect } from 'react';
// ... imports ...
const FORM_NAMES = { isolated: 'formIsolated', initial: 'formInitial', medial: 'formMedial', final: 'formFinal' };
const FORM_SHORT  = { isolated: 'formIsolatedShort', ... };
const SCORE_LABELS = { 5: 'feedbackScoreExcellent', 4: 'feedbackScoreGreat', ... };
```

**State & derived values (lines 24–65):**
```jsx
const [letterIndex, setLetterIndex] = useState(0);
const [formIndex, setFormIndex] = useState('isolated');
// ...
const lessonToAlpha = LESSON_ORDER.map((ch) => LETTERS.findIndex((l) => l.letter === ch));
const actualLetterIndex = lessonMode ? (lessonToAlpha[letterIndex] ?? 0) : letterIndex;
const letter = LETTERS[actualLetterIndex];
const formKeys = Object.keys(letter.forms);
const activeForm = formKeys.includes(formIndex) ? formIndex : 'isolated';
const currentChar = letter.forms[activeForm];
const completedCount = countCompleted(LETTERS);
```

**`redraw` callback (lines 69–97):**
```jsx
const redraw = useCallback((points) => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!points.length) return;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = darkMode ? '#ffffff' : '#1a0a00';
  // ... drawing loop ...
}, []); // <-- empty deps; darkMode captured at creation time
```

**`getPoint` helper (lines 339–342):**
```jsx
const getPoint = (e) => {
  const rect = canvasRef.current.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure: e.pressure ?? 0.5, pointerType: e.pointerType ?? 'touch' };
};
```

**Pointer handlers (lines 344–346):**
```jsx
const handlePointerDown = (e) => { e.preventDefault(); strokesRef.current.push({ ...getPoint(e), newStroke: true }); if (!hasStrokes) setHasStrokes(true); };
const handlePointerMove = (e) => { e.preventDefault(); if (e.buttons === 0) return; strokesRef.current.push({ ...getPoint(e), newStroke: false }); redraw(strokesRef.current); };
const handlePointerUp = (e) => { e.preventDefault(); };
```

**`exportCanvas` (lines 437–466) — not memoized:**
```jsx
const exportCanvas = () => {
  // ...
  ctx.fillStyle = '#fdf6e8'; // always light background for AI
  // ...
};
```

**`requestFeedback` (lines 477–507):**
```jsx
const requestFeedback = async () => {
  if (strokesRef.current.length < 5) { ... return; }
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
      markPracticed(letter.name, activeForm);
      if (score) { setScore(letter.name, activeForm, score); updateSR(letter.name, activeForm, score); }
      addFeedbackEntry(letter.name, activeForm, cleanText);
    }
    setFeedback({ text: cleanText, score });
    setShowComparison(true);
  } catch (err) {
    setFeedback({ error: err.message });
  }
  setLoading(false); // not in finally
};
```

**Mode tabs (lines 631–675) — getDueLetters called in render:**
```jsx
{(() => {
  const dueCount = getDueLetters(LETTERS).length;  // localStorage read in render
  return ( /* tabs JSX */ );
})()}
```

**Review dashboard (lines 678–710) — getDueLetters called again:**
```jsx
{practiceMode === 'review' && (() => {
  const dueItems = getDueLetters(LETTERS);  // second localStorage read same render
  return ( /* review grid */ );
})()}
```

**Model select — uncontrolled (lines 611–622):**
```jsx
<select
  defaultValue={localStorage.getItem('openrouter_model') || 'google/gemini-3-flash-preview'}
  onChange={(ev) => localStorage.setItem('openrouter_model', ev.target.value)}
  // ...no state binding...
>
```

**Brush slider — uncontrolled (lines 827–836):**
```jsx
<input
  type="range"
  defaultValue={parseFloat(localStorage.getItem('brushScale') || '1')}
  onChange={(e) => setBrushScale(parseFloat(e.target.value))}
  // ...no state binding...
/>
```

**Alphabet row — letter-in-lesson-mode redundant ternary (line 1034):**
```jsx
{lessonMode ? l.letter : l.letter}
```

**Animation cleanup — only on letterIndex change (lines 333–335):**
```jsx
useEffect(() => {
  return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
}, [letterIndex]); // misses: formIndex change, component unmount during animation
```

**`updateSR` called with raw AI score, not mapped quality (line 498):**
```jsx
if (score) { setScore(letter.name, activeForm, score); updateSR(letter.name, activeForm, score); }
// score is 1–5 but updateSR's comment says quality should be 0–5
// score 1 → quality 1  (not 0 as documented)
// score 2 → quality 2  (fine)
// The function clamps to [0,5] but the mapping described in comments is never applied
```

**`countCompleted` in render (line 60):**
```jsx
const completedCount = countCompleted(LETTERS); // calls load() in render
```

**`isLetterComplete` + `isLetterStarted` per alphabet button (line 1035):**
```jsx
{isLetterComplete(l.name, Object.keys(l.forms)) ? ... : isLetterStarted(l.name) ? ... : null}
// Both call load() — 28+ localStorage reads per render of the alphabet row
```

**`getDueLetters` timezone edge case (progress.js lines 159–162):**
```js
const nextDate = new Date(stored.lastReview); // parses YYYY-MM-DD as UTC midnight
nextDate.setDate(nextDate.getDate() + (stored.interval || 1));
const nextReview = nextDate.toISOString().split('T')[0]; // UTC date
// today = new Date().toISOString().split('T')[0]   also UTC
// Consistent BUT: if user is UTC+N, their "today" (local) may be tomorrow UTC
// → a review due "today" local might not show up until they roll over UTC midnight
```

**`getPoint` — null safety and pressure=0 for mouse:**
```jsx
const getPoint = (e) => {
  const rect = canvasRef.current.getBoundingClientRect(); // crashes if canvasRef.current is null
  return { ..., pressure: e.pressure ?? 0.5, ... };
  // e.pressure for mouse events is typically 0 (not null/undefined)
  // ?? 0.5 falls back only for null/undefined, so mouse users get pressure=0
  // calcLineWidth(0, 'touch') = Math.max(3, 0 * 28 * brushScale) = 3px always
};
```

**`playStrokeAnimation` dependency on `animating` state (lines 200–331):**
```jsx
const playStrokeAnimation = useCallback(async () => {
  if (!data || animating) return; // guard uses stale `animating` from closure
  // ...
  setAnimating(true);
  // ...
}, [letter.letter, currentChar, animating]); // animating in deps recreates callback constantly
```

**`FORM_NAMES` / `FORM_SHORT` / `FORM_DESCRIPTIONS` defined in 3 places:**
- `src/data/letters.js` — English raw labels
- `src/locales/index.js` — locale key map
- `PracticeView.jsx` lines 13–14 — locale key map (shadows the data/ exports)

**`historyCount` locale key (locales/index.js line 87/line 217):**
```js
historyCount: '(',  // defined in both en and ar but never used via t()
```

---

## What to Analyze

1. **Bugs** — anything that causes wrong behavior, crashes, or data loss
2. **Stale closures** — `useCallback`/`useEffect` with incorrect deps
3. **React anti-patterns** — unnecessary re-renders, missing memoization causing perf issues at 28+ letter buttons
4. **SM-2 correctness** — is `updateSR` receiving the right quality value?
5. **localStorage I/O** — how many reads happen per render? Can they be batched?
6. **UX defects** — mouse pressure issue, timezone due-date edge case, animation not cancelled on form/unmount
7. **Type safety gaps** — places where unexpected values could slip through
8. **Localization gaps** — any hardcoded English strings not going through `t()`
9. **Canvas/drawing correctness** — HiDPI, dark mode closure, snapshot staleness
10. **SW / PWA** — any caching issues

## Output Format

For each finding:
```
### [SEVERITY: Critical/High/Medium/Low] Title
Category: Bug | UX Defect | Performance | Code Quality | Architecture
File: src/... line ~N
Description: ...
Root cause: ...
Fix: ...
```

Order findings by severity (Critical first). At the end, provide a prioritized fix list of the top 10 most impactful changes.
