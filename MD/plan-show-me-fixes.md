# Plan: Fix "Show Me" Stroke-Order Animation

> Created: 2026-04-22
> Based on analysis of `PracticeView.jsx`, `data/strokeOrder.js`, and `data/letters.js`

---

## 1. How It Currently Works

### Files involved
| File | Role |
|---|---|
| `src/components/PracticeView.jsx` | Lines 279–510 contain the entire animation engine. |
| `src/data/strokeOrder.js` | Static data: 28 letters, each with `strokes[]` (polylines in 0–100 space) and `dots[]`. |
| `src/data/letters.js` | Generates positional forms (isolated/initial/medial/final) via tatweel joining. |
| `src/locales/index.js` | UI strings `btnShowMe`, `btnShowMePlaying`, `ariaShowMeBtn`. |

### Animation technique — Glyph Reveal
1. **`glyphCanvas`** — Renders the current Arabic character in `Amiri` / `Scheherazade New` at `min(200px, rect.height * 0.8)`. This is the "truth" image.
2. **`maskCanvas`** — Blank offscreen canvas. The animation paints black brush strokes/dots here.
3. **`compCanvas`** — Every frame: copies `glyphCanvas`, then uses `globalCompositeOperation = 'destination-in'` with `maskCanvas`. Keeps only glyph pixels that overlap the mask, creating the illusion that a brush is revealing the letter.
4. **Main canvas** — Draws a faint 12%-opacity ghost of the full glyph underneath the revealed portion.

### Coordinate mapping
- Measures the **actual bounding box** of the rendered glyph via `measureText(actualBoundingBoxLeft/Right/Ascent/Descent)`.
- Maps authored `0–100` stroke paths into that box, scaled by `devicePixelRatio`.
- This is robust: animation aligns to real font metrics, not a fixed square.

### Playback loop
- Hand-rolled `requestAnimationFrame` state machine (`opIdx`, `dist`, `prevPoint`, `pauseCount`).
- Speed is constant in **screen pixels/frame**: `SPEED = glyphSize * dpr * 0.015`.
- `PAUSE_FRAMES = 18` (~300 ms) separates strokes and dots.
- Brush radius: `min(glyphW, glyphH) * dpr * 0.14`.

### UI gating
```js
practiceMode === 'letters' && STROKE_DATA[letter.letter]
```
Button disabled during playback (`animating` state, opacity 0.35).

### Cleanup
`useEffect` keyed to `[letterIndex, formIndex, practiceMode]` cancels RAF, flips `animatingRef` to `false`, resets React state so the button never stays stuck.

---

## 2. Strengths (Preserve These)

| Strength | Detail |
|---|---|
| **Font-accurate reveal** | Compositing the actual rendered glyph makes the reveal look like the real letter, not a crude approximation. |
| **HiDPI correct** | Uses `devicePixelRatio` for both text render and mask, stays crisp on Retina. |
| **Dynamic sizing** | Bounding-box measurement adapts to canvas size and font metrics automatically. |
| **Resilient to missing metrics** | Falls back to `fontSize * 0.5`, `fontSize * 0.55`, `fontSize * 0.35` if browser returns zero bounding-box values. |
| **Safe cancellation** | Navigating away mid-animation kills the loop and re-enables the button. |
| **No dependency drift** | `playStrokeAnimation` is in `useCallback` with minimal deps; reads live `getBoundingClientRect` values. |

---

## 3. Bugs & Limitations

### 3.1 Positional-form mismatch (HIGH PRIORITY)
`STROKE_DATA` only describes the **isolated** shape of each letter. But the animation renders whatever `currentChar` is — which can be the **initial, medial, or final** form (e.g., `بـ`, `ـبـ`, `ـب`). The authored isolated stroke path is stretched to fit the bounding box of the connected form.

**Result:** Non-isolated forms animate the wrong shape. For example, initial `بـ` is just the right-hand tooth, but the animation draws the full isolated `ب` path compressed into the narrower box. Dots are similarly misplaced.

**Code location:**
- `strokeOrder.js` line 15 — data is keyed by isolated char only.
- `PracticeView.jsx` line 282 — `STROKE_DATA[letter.letter]` always looks up the base character, ignoring `activeForm`.
- `PracticeView.jsx` line 320 — `gCtx.fillText(currentChar, ...)` renders the connected form.

### 3.2 User strokes are permanently destroyed (HIGH PRIORITY)
At the top of `playStrokeAnimation` (line 289):
```js
strokesRef.current = [];
```
The user’s current drawing is wiped with no snapshot. After animation finishes, there is no recovery. Undo does not restore it because the ref was mutated directly without pushing to the history stack.

### 3.3 No dark-mode color adaptation (MEDIUM PRIORITY)
Glyph is hardcoded brown:
```js
gCtx.fillStyle = '#8b4513'; // PracticeView.jsx ~line 316
```
In dark mode the rest of the app uses light-on-dark colors; the brown glyph looks visually out of place. The final frame also leaves this brown glyph on screen.

### 3.4 Limited to Letters mode (PRODUCT LIMITATION)
Stroke data is keyed by single characters with no word-level decomposition. The Show Me button is completely absent in **Words** mode.

### 3.5 No recovery from DPR changes (LOW PRIORITY)
If the user moves the window between displays with different `devicePixelRatio` mid-animation, the captured DPR at start could cause mask/glyph misalignment. No `matchMedia` listener updates it dynamically.

### 3.6 Performance of per-frame compositing (LOW PRIORITY)
`drawFrame()` performs 5 canvas operations per frame (clear, draw glyph, destination-in mask, clear main, draw ghost + composite). Acceptable for short animations, but could drop frames on very low-end devices.

---

## 4. Recommended Fixes

| Priority | Fix | Files to modify |
|---|---|---|
| **High** | Add positional-form stroke data, or at least a mapping, so `initial`/`medial`/`final` animations use correct path geometry. If full data is too much work, **temporarily disable the button for non-isolated forms**. | `strokeOrder.js`, `PracticeView.jsx` |
| **High** | Snapshot `strokesRef.current` before wiping it, and restore it after animation finishes (or provide an explicit "Restore drawing" action). | `PracticeView.jsx` |
| **Medium** | Respect dark mode by using a CSS-variable-derived color for the glyph fill, or by clearing the canvas fully at the end instead of leaving the brown glyph. | `PracticeView.jsx`, `styles/practiceStyles.js` or `styles/global.css` |
| **Low** | Cache offscreen `glyphCanvas` / `maskCanvas` / `compCanvas` in refs so they are reused across multiple plays instead of recreated on every click. | `PracticeView.jsx` |
| **Low** | Consider adding a `matchMedia` listener for DPR changes if targeting multi-monitor users. | `PracticeView.jsx` |

---

## 5. Quick Reference — Key Code Snippets

### Relevant refs and state in PracticeView
```jsx
const animFrameRef = useRef(null);
const animatingRef = useRef(false);
const [animating, setAnimating] = useState(false);
```

### Animation guard
```jsx
if (!data || animatingRef.current) return;
```

### Form check for button visibility
```jsx
{practiceMode === 'letters' && STROKE_DATA[letter.letter] && (
  <button ... onClick={playStrokeAnimation} disabled={animating}>
    {animating ? t('btnShowMePlaying') : t('btnShowMe')}
  </button>
)}
```

### Cleanup effect
```jsx
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
```

---

## 6. Context for Future Session

This is an Arabic handwriting practice PWA (React 19 + Vite 8). The "Show Me" button sits in the control bar below the drawing canvas, next to Clear and AI Feedback. It is only visible in **Letters** practice mode. The animation teaches stroke order by revealing the reference glyph brushstroke-by-brushstroke.

The project uses **inline JS style objects** (no Tailwind, no CSS modules) and **CSS custom properties** in `global.css` for dark mode. Canvas coordinates are normalized 0–1. Do not introduce TypeScript.

When fixing, run `npm run build` to verify it compiles, and test manually in browser.
