# AGENTS.md — Arabic Script Practice

## Project Overview

Arabic handwriting practice PWA built with React 19 + Vite 8. Users draw Arabic
letters on a canvas (Apple Pencil / touch / mouse) and get AI feedback from an
OpenRouter LLM via vision API. Deployed as a static site on Vercel — push to
`main` triggers auto-deploy.

## Architecture

```
index.html                 — Vite entry point (refs src/main.jsx)
package.json               — Dependencies & scripts
vite.config.js             — Vite + React plugin
src/
├── main.jsx               — createRoot + StrictMode
├── App.jsx                — Root component, API key state
├── components/
│   ├── LoginScreen.jsx    — API key entry
│   └── PracticeView.jsx   — Canvas + drawing + AI feedback
├── data/
│   └── letters.js         — 28 Arabic letters, form generation
├── utils/
│   ├── drawing.js         — Pressure calc, brush scale, stroke color
│   └── api.js             — OpenRouter vision API call
└── styles/
    ├── loginStyles.js     — Login screen style object
    └── practiceStyles.js  — Practice view style object (~40 keys)
public/                    — Static assets copied to dist/ as-is
├── sw.js                  — Service worker (cache-first)
├── manifest.json          — PWA manifest
├── vercel.json            — Vercel headers config
├── icon-192.png           — PWA icon
└── icon-512.png           — PWA icon
```

## Build & Development Commands

```bash
npm run dev       # Vite dev server → localhost:5173
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

There is **no test suite, no linter, no formatter** configured in this project.
Verify changes by running `npm run build` (must succeed with zero errors) and by
testing in the browser.

## Service Worker — IMPORTANT

After **any JS/asset change that produces a new build**, you must:
1. Run `npm run build` to get the new hashed filename (e.g. `index-XXXXXXXX.js`)
2. Update `public/sw.js`: bump `CACHE` version string and update the asset path in `ASSETS`

The root `sw.js` is a copy — the canonical version is `public/sw.js`.

## Code Style

### Language & Tooling

- **JavaScript (JSX)**, ES2022+. No TypeScript.
- Vite with `@vitejs/plugin-react` handles JSX transform automatically — no
  manual `import React` needed.
- `"type": "module"` in package.json — all files use ES module syntax.

### Imports

React hooks are imported individually from `'react'`:
```js
import { useState, useRef, useCallback, useEffect } from 'react';
```
Local imports use relative paths with explicit file extensions omitted:
```js
import styles from '../styles/practiceStyles';
import { LETTERS, FORM_NAMES } from '../data/letters';
```

### Component Structure

- **Functional components only** — no class components.
- One component per file, **default export**, filename matches component name.
- Props are destructured in the function signature: `function App({ apiKey, onClearKey })`.
- `useCallback` for functions passed as props or in dependency arrays.
- `useRef` for mutable data that must not trigger re-renders (e.g. stroke data).

### Naming Conventions

| Element           | Convention          | Example                          |
|-------------------|---------------------|----------------------------------|
| Components        | PascalCase          | `App`, `LoginScreen`             |
| Props/handlers    | camelCase, on/handle| `onSave`, `handlePointerDown`    |
| State             | camelCase           | `apiKey`, `letterIndex`          |
| State setters     | `set` + PascalCase  | `setApiKey`, `setLetterIndex`    |
| Module constants  | UPPER_SNAKE_CASE    | `STROKE_COLOR`, `TATWEEL`        |
| Style keys        | camelCase           | `styles.btnAI`, `styles.root`   |
| Refs              | camelCase + `Ref`   | `canvasRef`, `strokesRef`        |
| Utility functions | camelCase           | `calcLineWidth`, `setBrushScale` |

### Styling

- **All styles are inline JS objects** — no CSS files, no CSS modules, no Tailwind.
- Style objects live in `src/styles/` and export a single default object.
- Compose styles with spread: `{ ...styles.btn, ...styles.btnClear }`.
- Color palette (warm parchment theme):
  - Backgrounds: `#fdf0d0`, `#fdf6e8`, `#eedfa8`
  - Text: `#5c2d00`, `#3d1800`, `#6b3800`
  - Accent: `#8b4513`, `#c0703a`, `#9b6a30`

### State Management

- **Local state only** — no Redux, no Context.
- Canvas stroke data is in a `useRef` (mutable array), not React state.
- Persisted settings use `localStorage` with these **stable keys** (do not rename):
  - `openrouter_key` — API key
  - `openrouter_model` — selected model ID
  - `brushScale` — brush size multiplier

### Error Handling

- API errors: try/catch around fetch, displayed in feedback box with error styling.
- Guard: minimum 5 stroke points before allowing AI analysis.
- Service worker: 503 "Offline" response when cache + network both fail;
  navigation failures fall back to cached `/index.html`.

### JavaScript Patterns

- `??` (nullish coalescing) for defaults: `pressure ?? 0.5`
- Optional chaining where appropriate
- Arrow functions for callbacks and inline handlers
- Template literals for dynamic strings
- Destructuring for props, state, and event data

### Canvas & Drawing

- HiDPI: canvas scaled by `devicePixelRatio`, kept in sync via `ResizeObserver`.
- Strokes: array of `{ x, y, pressure, pointerType, newStroke }` objects.
- Smooth curves via `quadraticCurveTo` between midpoints.
- Line width from pressure: pen → `sqrt(pressure) * 32 * scale`,
  touch → `pressure * 28 * scale`.

### Git Conventions

- Short imperative commit messages: "Add brush size slider", "Fix manifest icons".
- No conventional-commit prefixes (no `feat:`, `fix:`, etc.).
- `node_modules/`, `dist/`, `.claude/`, `.kilo/` are gitignored.

## Critical Rules for Agents

1. **Bump `public/sw.js`** after any build — update `CACHE` version + asset path.
2. **Do not rename localStorage keys** — `openrouter_key`, `openrouter_model`,
   `brushScale` are used by existing clients.
3. **Arabic text is RTL** — use `direction: "rtl"` and Arabic fonts
   (`Amiri`, `Scheherazade New`) for letter rendering.
4. **API key is client-side in localStorage** — intentional for this personal tool.
5. **No test suite exists** — verify via `npm run build` + manual browser testing.
6. **Static assets go in `public/`** — they are copied un-hashed to `dist/` by Vite.
