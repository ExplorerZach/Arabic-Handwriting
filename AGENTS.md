# AGENTS.md — Arabic Script Practice

## Project Overview

An Arabic handwriting practice PWA (Progressive Web App) built with React 19 + Vite 8.
Users draw Arabic letters on a canvas with Apple Pencil / touch / mouse, then get
AI feedback from an OpenRouter LLM via vision API.

Deployed as a **static site on Vercel**. Production URL: pushed to `main` branch
triggers Vercel deployment automatically.

## Architecture

```
index.html                    — Vite entry point (refs src/main.jsx in dev)
package.json                  — Dependencies and scripts
vite.config.js                — Vite + React plugin config
src/
├── main.jsx                  — React root render + StrictMode
├── App.jsx                   — Root component, manages API key state
├── components/
│   ├── LoginScreen.jsx       — API key entry screen
│   └── PracticeView.jsx      — Main canvas + drawing + AI feedback UI
├── data/
│   └── letters.js            — 28 Arabic letters, form generation, labels
├── utils/
│   ├── drawing.js            — Pressure calc, brush scale, stroke color
│   └── api.js                — OpenRouter API call (vision)
└── styles/
    ├── loginStyles.js        — Login screen style object
    └── practiceStyles.js     — Practice view style object (~40 keys)

assets/                       — Vite build output (hashed bundles)
sw.js                         — Service worker (cache-first strategy)
manifest.json                 — PWA manifest
vercel.json                   — Vercel headers config
icon-192.png, icon-512.png    — PWA icons
```

## Tech Stack

| Layer        | Technology                                | Version   |
|-------------|-------------------------------------------|-----------|
| Framework   | React (JSX runtime, functional components) | 19.2.4    |
| Bundler     | Vite + @vitejs/plugin-react               | 8.0.7     |
| Language    | JavaScript (JSX)                          | ES2022+   |
| Styling     | Inline style objects (no CSS files)       | —         |
| Canvas      | HTML5 Canvas 2D API                       | —         |
| AI Backend  | OpenRouter API (chat completions + vision)| v1        |
| Deployment  | Vercel (static site)                      | —         |
| PWA         | Custom service worker + manifest.json     | —         |
| Linter      | ESLint 9 (react-hooks, react-refresh)     | 9.x       |
| Formatter   | Prettier                                  | 3.8       |
| VCS         | Git + GitHub                              | —         |

### Key Dependencies

- `react`, `react-dom` — UI framework
- `vite`, `@vitejs/plugin-react` — Build tooling
- No routing library (single-page, no URL routes)
- No state management library (local `useState` + `useRef` only)
- No CSS framework (all inline JS style objects)

## Build & Development Commands

```bash
npm run dev         # Start Vite dev server (localhost:5173)
npm run build       # Production build → dist/
npm run preview     # Preview production build locally
npx eslint .        # Lint all files
npx prettier --check .  # Check formatting
```

### Service Worker

After any build change, bump the `CACHE` version string in `sw.js` (e.g., `arabic-v3`
→ `arabic-v4`) so clients pick up the new assets.

### Deployment

Push to `main` → Vercel auto-deploys. `vercel.json` sets correct Content-Type
headers for `manifest.json` and `sw.js`.

## Testing with Browser Tools

Kilo has built-in Playwright/browser support via the `browser_*` tools (navigate,
snapshot, click, type, screenshot, etc.). **Use these tools to test the app in a
real browser after making changes:**

1. Start the dev server: `npx vite --host` (or `npm run dev`)
2. Use `browser_navigate` to open `http://localhost:5173`
3. Use `browser_snapshot` to inspect the page structure and verify UI renders
4. Use `browser_click`, `browser_type`, etc. to interact with form fields and buttons
5. Use `browser_take_screenshot` to capture visual state for verification
6. Use `browser_console_messages` to check for runtime errors

This is the preferred way to verify that changes work correctly — test in the
actual running app rather than only checking that the build succeeds.

## Code Style Guidelines

### Component Structure

- **Functional components only** — all components use React hooks (`useState`,
  `useRef`, `useCallback`, `useEffect`).
- **No class components.**
- Components are default-exported from their own files.
- One component per file, named to match the filename.

### Naming Conventions

| Element           | Convention          | Example                        |
|-------------------|---------------------|--------------------------------|
| Components        | PascalCase          | `App`, `LoginScreen`, `PracticeView` |
| Event handlers    | camelCase, verb-first | `onSave`, `onClearKey`, `handlePointerDown` |
| State variables   | camelCase           | `apiKey`, `letterIndex`, `formIndex` |
| State setters     | `set` + PascalCase  | `setApiKey`, `setLetterIndex`  |
| Constants         | UPPER_SNAKE_CASE    | `CACHE`, `ASSETS`, `TATWEEL`   |
| Style objects     | camelCase keys      | `styles.root`, `styles.btnAI`  |
| Refs              | camelCase + `Ref`   | `canvasRef`, `strokesRef`      |
| Utility functions | camelCase           | `calcLineWidth`, `getAIFeedback` |

### Styling

- **All styles are inline JavaScript objects** — no external CSS files, no CSS
  modules, no CSS-in-JS libraries.
- Styles are organized in dedicated files (`loginStyles.js`, `practiceStyles.js`)
  each exporting a single object with descriptive keys.
- Use spread syntax to compose styles: `{...styles.btn, ...styles.btnClear}`.
- Color palette is warm/parchment-themed:
  - Background: `#fdf0d0`, `#fdf6e8`
  - Text: `#5c2d00`, `#3d1800`, `#6b3800`
  - Accent: `#8b4513`, `#c0703a`, `#9b6a30`

### State Management

- **Local state only** — no Redux, no Context (except React internals).
- Canvas drawing data is stored in a `useRef` (mutable array of stroke points),
  not in React state, for performance.
- API key persisted in `localStorage` under key `openrouter_key`.
- Model selection uses `localStorage` key `openrouter_model`.
- Brush scale uses `localStorage` key `brushScale`.

### Canvas & Drawing

- Canvas uses `devicePixelRatio` scaling for crisp rendering on HiDPI displays.
- `ResizeObserver` keeps canvas dimensions in sync with CSS layout.
- Strokes are stored as `{x, y, pressure, pointerType, newStroke}` objects.
- Drawing uses `quadraticCurveTo` for smooth curves between sample points.
- Line width is computed from pressure — pen type gets thicker strokes
  via `Math.sqrt(pressure) * baseWidth`.

### API Integration

- AI feedback is sent to OpenRouter (`https://openrouter.ai/api/v1/chat/completions`).
- The canvas is exported to a base64 PNG for vision model analysis.
- A reference letter is drawn as a semi-transparent watermark on the exported image.
- Default model: `google/gemini-3-flash-preview` (configurable via localStorage).

### Error Handling

- API errors are caught in try/catch and displayed in a feedback box with an
  error style (`feedbackError`).
- Minimum stroke count (5 points) is enforced before allowing AI analysis.
- Service worker returns a 503 "Offline" response when both cache and network fail.
- Navigation failures in the SW fall back to cached `index.html` for SPA routing.

### JavaScript Patterns

- Use `??` (nullish coalescing) for defaults: `pressure ?? 0.5`.
- Use optional chaining where appropriate.
- Arrow functions for callbacks and event handlers.
- `useCallback` for functions passed as props or used in dependency arrays.
- `useRef` for mutable data that should not trigger re-renders.
- Destructuring for props and state.
- Template literals for dynamic strings.

### Git Conventions

- Commit messages are short imperative phrases: "Add brush size slider",
  "Fix icon entries in manifest.json", "Switch to OpenRouter with model selector".
- No conventional commit prefixes (feat:, fix:, etc.) — just plain English.
- The built bundle is committed directly to the repo (not `.gitignore`d).
- `node_modules`, `dist`, and `.claude` are gitignored.
- Backup branch `backup/pre-source-reconstruction` preserves the pre-refactor
  state at commit `5818212`.

### Important Caveats for Agents

1. **After any JS change**, update the service worker cache version in `sw.js`.
2. **The API key is stored client-side in localStorage** — this is intentional for
   this personal practice tool.
3. **Arabic text renders RTL** — the app uses `direction: "rtl"` and Arabic-specific
   fonts (`Amiri`, `Scheherazade New`).
4. **localStorage keys must remain stable** — `openrouter_key`, `openrouter_model`,
   and `brushScale` are used by existing clients. Do not rename them.
5. **Use browser tools to test** — always verify UI changes by running the dev server
   and using the `browser_*` tools to inspect and interact with the live app.
