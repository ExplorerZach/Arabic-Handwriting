# Session 4 — Light-Mode Palette Refactor + Tooling Findings (HANDOFF)

**Date:** 2026-07-28
**Branch:** merged to `main` and **live in production** — nothing left to finish on the palette work.
**Read first:** `AGENTS.md`, then `docs/architecture.md`. This file is the handoff for the _next_ session.

---

## 1. Status — what shipped

Two commits, rebased onto `main` via PR #5 (`--rebase`, branch deleted):

```
b584b99  feat(ui): rework light-mode palette to refined parchment   (9 files, +91/-89)
c6eb509  chore: apply prettier to the whole repo                    (30 files, formatting only)
```

Live production verified at `https://www.writearabic.app`:

| Check                             | Value                                                                 |
| --------------------------------- | --------------------------------------------------------------------- |
| `--color-bg`                      | `#faf6ec`                                                             |
| `--color-accent`                  | `#7d3f0f`                                                             |
| `--color-text-muted`              | `#7a5220`                                                             |
| `<meta name="theme-color">`       | `#6b3408`                                                             |
| `manifest.json`                   | `background_color #faf6ec`, `theme_color #6b3408`                     |
| `sw.js`                           | `arabic-v122`, asset hash `index-C_KhFaY6.css` (matches deployed CSS) |
| `/download.html`, `/privacy.html` | 200, new parchment palette                                            |
| Console / network errors          | none                                                                  |

### Files changed by the palette commit

1. `src/styles/global.css` — `:root` light palette rewritten; 3 dark-mode tweaks; 2 hover-selector fixes.
2. `src/styles/themes.js` — light paper backgrounds, ruled/grid line alphas, `getCanvasInkColor(false)`.
3. `src/hooks/useExport.js` — 2× hardcoded watermark ink.
4. `index.html` — `theme-color`.
5. `public/manifest.json` — `background_color`, `theme_color`.
6. `public/download.html`, `public/privacy.html` — their own local copies of the tokens.
7. `sw.js`, `public/sw.js` — cache bump from the build.

### Final light palette (`src/styles/global.css` `:root`)

```
bg #faf6ec | bg-alt #f4ecd8 | gradient #faf6ec → #f4ecd8 → #efe5cc
surface / surface-solid / card-bg  rgba(255,253,247,0.92)   surface-hover / input-bg #fffdf7
text #2e1404 | text-muted #7a5220 | text-soft #5a3a12 | primary #4a2408
accent #7d3f0f | accent-light #8f5320 | accent-warm #6b3408 | link #7d3f0f | outline #8f5320
border rgba(150,105,45,0.45) | border-strong rgba(150,105,45,0.7) | canvas-border rgba(150,105,45,0.5)
shadow rgba(90,55,10,0.15) | shadow-deep rgba(110,60,15,0.35)
ghost rgba(120,75,30,0.22)
btn-clear #f0e4c8 | btn-showme #f5e9cf | btn-nav rgba(255,253,247,0.92) | btn-alpha rgba(255,253,247,0.9)
btn-ai linear-gradient(135deg,#7d3f0f,#a8601f) | form-active linear-gradient(150deg,#6b3408,#a8601f)
dot-complete #3e7a34 | dot-started #8f5320 | star-filled #8f5320 | star-empty rgba(150,105,45,0.35)
progress-badge rgba(150,105,45,0.15) | offline rgba(150,105,45,0.18)
scrollbar-thumb rgba(120,75,30,0.4) / hover 0.65
```

Dark mode (only 3 tokens changed): `--color-text-muted #c0905a → #cfa06a`,
`--color-ghost .15 → .20`, `--color-border .35 → .45`.
High-contrast blocks (`[data-high-contrast="true"]`) were **not** touched and were verified unaffected.

---

## 2. Key decisions (and why)

1. **`--color-accent-light` is `#8f5320`, not the planned `#9a5a24`.** `#9a5a24` measured only
   4.34:1 against the darkest gradient stop `#efe5cc`. `#8f5320` gives 4.89:1 there and 5.68:1
   on `--color-bg`. Don't "restore" the planned value without re-measuring.
2. **Two hover selectors were scoped** at `src/styles/global.css:317` and `:327`:
   `.btn-form:hover` / `.btn-alpha:hover` forced a near-white background with `!important` even
   on the _active_ tab, whose label is white `#fff8ee` → invisible text on hover. Now excluded via
   `:not([aria-selected='true'])`; the `transform: scale(1.12)` on `.btn-alpha` still applies to all.
   Active state is exposed as `aria-selected` on both tabs and alphabet/word buttons, which is what
   the selector keys off — don't change that attribute without updating the CSS.
3. **Prettier was applied repo-wide as its own commit, first.** The repo had 38 non-clean files, and
   `lint-staged` (`package.json:26-32`) runs `prettier --write` on staged `*.{js,jsx}` and
   `*.{css,json,md}` — so any palette commit would have been reformatted at commit time anyway.
   Splitting made the palette commit a genuine color-only diff, and `format:check` now passes
   repo-wide for the first time.
4. **The paper themes and static pages were included**, not just the app shell, so the canvas and
   `/download.html` + `/privacy.html` don't clash with the new surrounding UI.
5. **No component/JSX restructuring** — the whole change is CSS custom properties + `themes.js` +
   two hardcoded hexes. `BRUSH_PACKS`, letter data, locales and storage keys were untouched.
6. **Ghost template stayed at 0.22 alpha.** It reads as a soft guide, visible in both modes in the
   screenshots. It is a tracing target, not text, so it is intentionally below AA. If the user asks
   for a stronger template, ~0.28 is the next step.

---

## 3. Verification methodology (reuse this)

### Contrast script

Blend `rgba` tokens over the background first, then compute WCAG ratios. All normal text ≥ 4.5:1 on
every background _and_ every surface/button tint; white-on-gradient checked at **both** gradient
ends (both landed at 4.57:1); status dots ≥ 3:1.

```js
function lum(rgb) {
  const c = rgb
    .map(v => v / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function cr(a, b) {
  const x = lum(a),
    y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
```

### Visual check — the ONLY reliable recipe (see §4.1 for why)

Drive a browser **on the host** against `http://localhost:5173`:

```bash
# outside the repo, e.g. %TEMP%\opencode
npm init -y && npm i playwright-core          # no browser download needed
```

```js
import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addInitScript(() => {
  // seed state; app has no login gate by default
  localStorage.setItem('app_darkMode', 'true');
  localStorage.setItem('high_contrast', 'false');
});
```

Useful keys: `app_darkMode`, `high_contrast`, `reduce_motion`, `app_theme`, `brush_pack`,
`app_locale`, `arabic_progress`, `arabic_xp`, `arabic_streak`, `arabic_daily_goal`.
Tabs are `[role="tab"]`; settings is the gear button; `colorScheme: 'dark'` in `newContext`
exercises the `prefers-color-scheme` blocks in `download.html`.
Views worth capturing: practice (+ a drawn stroke via `page.mouse`), stats, review, words,
settings, `/download.html`, `/privacy.html` — each in light, dark and high-contrast.

### Gates

`npm run lint && npm run typecheck && npm run test:run && npm run build` — all exit zero.
Baseline noise to expect: **7 pre-existing ESLint warnings, 0 errors**; 57 tests pass.
Pre-merge production check: `npm run preview` + the host-browser script (the Vercel preview URL
is behind deployment protection, see §4.7).

---

## 4. Tooling issues hit this session — fix these so the next agent doesn't

### 4.1 Containerized Playwright MCP cannot test this app at all (biggest time sink)

Failure chain, in order:

- The MCP browser runs in a Docker container on a `bridge` network, so `localhost:5173` is
  unreachable → must use `host.docker.internal`.
- `index.html:13` CSP contains `upgrade-insecure-requests`. Chrome exempts `localhost` from that
  upgrade but **not** `host.docker.internal`, so every subresource became `https://…:5173` →
  `ERR_SSL_PROTOCOL_ERROR`, blank page.
- Strip the CSP meta via request interception and Chrome's **Private Network Access** blocks it
  instead ("request client is not a secure context and the resource is in more-private address
  space `local`"). No MCP-exposed flag can turn that off.
- Interception + the service worker registered at `src/main.jsx:20` then **deadlocked the Playwright
  driver**. Worse, it took the whole `MCP_DOCKER` gateway down: the container disappeared
  (`docker ps -a` shows no playwright container) and every `MCP_DOCKER_*` tool vanished from the
  toolset for the rest of the session — the GitHub MCP tools, `fetch`, `context7` and
  `sequentialthinking` were all lost. Fallback to the `gh` CLI worked fine.

Fixes, in order of value:

- **Strip `upgrade-insecure-requests` in dev.** The identical CSP is already served as a response
  header by `vercel.json` in production, so the `<meta>` tag is duplicative for web (Tauri gets its
  own CSP from `src-tauri/tauri.conf.json`). A ~10-line Vite `transformIndexHtml` plugin that removes
  just that directive when `command === 'serve'` fixes the container browser and — more importantly —
  unblocks **testing on a real iPad over the LAN**: today `http://192.168.x.x:5173` from an iPad
  breaks in exactly the same way, which is rough for an Apple Pencil app.
- **Document the host-browser recipe (§3) in AGENTS.md** as the sanctioned visual-check path, since
  PNA makes the container browser a dead end regardless. Optionally add `playwright-core` as a
  devDependency plus `scripts/shots.mjs` (`npm run shots`) — no browser download, works offline,
  gitignored output.
- **Never use Playwright request interception on this app** — the SW deadlocks it. Worth a note next
  to the service-worker section of `docs/architecture.md`.

### 4.2 `opencode.json`'s `"formatter": true` vs. a repo that wasn't Prettier-clean

Every edit to `global.css` / `themes.js` reformatted the whole file (~200 lines of unrelated churn),
and `lint-staged` would have re-applied it at commit time anyway — manually stripping churn was
wasted effort. Solved permanently by `c6eb509`. **Add `npm run format:check` to CI** so it can't rot
again.

### 4.3 CRLF/LF phantom diffs

`core.autocrlf=true` + Prettier writing LF ⇒ files show as `M` with an _empty_ diff (`index.html`
did this twice). A `.gitattributes` with `* text=auto eol=lf` removes the whole class of confusion.

### 4.4 `git checkout -- <path>` restores from the **index**, not HEAD

That silently produced `arabic-v122` instead of `v121` when `sw.js` was staged by a `stash pop`.
Use `git restore --source=HEAD --staged --worktree <path>`.

### 4.5 `scripts/bust-sw.js` increments on every build

Two local builds ⇒ the version jumps two; and Vercel's build increments again, so production is
`arabic-v122` while the repo says `v121`. The committed value is effectively decorative for web.
Either state in AGENTS.md that a local `sw.js` bump needn't be committed, or make the script
idempotent by deriving the version from the asset hash.

### 4.6 PowerShell friction (predictable, worth documenting)

`rg` patterns containing quotes/parens got mangled into nonsense (a search for `getItem('darkMode')`
came back as `getItem(nMode')`), `node -e` with nested quotes failed repeatedly, and
`Select-Object -String` / `Format-Hex -Count` don't exist. Use the `grep`/`read` tools instead of
shell `rg`, and put any non-trivial Node in a `.mjs` file under `%TEMP%\opencode` rather than `-e`.

### 4.7 Vercel preview is behind deployment protection

PR #5's preview served the Vercel login page, so it couldn't be verified anonymously.
`docs/architecture.md:191` references `get_access_to_vercel_url` / `web_fetch_vercel_url`, but no
Vercel MCP was available this session. Either enable a protection-bypass token for automation, or
document `npm run preview` + host-browser as the standard pre-merge visual check (what was done).

---

## 5. CI `audit` job — decision and evidence

CI on `main` is red, and has been for at least the last three commits, **only** because of
`npm audit --audit-level=high` (`postcss` and `vite` advisories). Measured this session:

```
npm audit --omit=dev --audit-level=high   →  found 0 vulnerabilities
```

Both advisories are **dev-only**; nothing shipped to users is affected, and the two `vite` CVEs are
Windows dev-server issues (`launch-editor` UNC hash disclosure, `server.fs.deny` bypass). Security
urgency is essentially zero. The real problem is that permanently red CI trains everyone to ignore
it and hides genuine failures.

**Agreed plan: one small, separate PR that does both** —

1. `.github/workflows/web-check.yml` → `npm audit --omit=dev --audit-level=high`, so the gate
   reflects what actually ships and won't re-redden every time a build tool publishes an advisory.
2. `npm audit fix` to take the free patch bumps (`vite` → ≥ 8.0.16, inside the existing `^8.0.7`).
3. Full gate run **plus** a dev-server and `npm run preview` smoke check, because a `vite` bump is
   exactly the kind of change that can break the build.

Kept separate from the palette work for one concrete reason: if the `vite` bump breaks something, a
one-commit revert fixes it without touching the UI change.

---

## 6. Next steps (each as its own small PR, not a grab-bag)

1. **`chore(ci): scope audit to production deps + take patch bumps`** — §5. Acceptance: CI green on
   `main` for the first time; `npm run dev` and `npm run preview` both still serve the app.
2. **`fix(dev): drop upgrade-insecure-requests from the dev CSP`** — §4.1. Vite plugin, dev-only.
   Acceptance: production response header from `vercel.json` unchanged (verify with `curl -I`);
   `npm run dev -- --host` loads from a second device on the LAN; ideally confirm on an iPad.
3. **`chore: add .gitattributes (* text=auto eol=lf)`** — §4.3. Expect a one-time renormalization
   diff; land it alone.
4. **`chore(ci): add format:check to the CI matrix`** — §4.2, cheap insurance now that the repo is clean.
5. **Docs:** fold §3 (host-browser + contrast recipes), §4.1 (no interception; SW deadlock),
   §4.4 and §4.5 into `AGENTS.md` / `docs/architecture.md`.
6. **Optional, only if the user asks:** raise `--color-ghost` to ~0.28 for a stronger tracing
   template; port the palette to any remaining hardcoded hexes if new ones appear
   (`rg "8b4513|fdf0d0|c0703a"` currently only matches legitimate dark-mode values).

---

## 7. Loose ends / gotchas for the next session

- **Untracked, deliberately not committed:** `docs/UI-Improvements-Plan.md` (the original plan) and
  `opencode.json` (has `"formatter": true`, the `lint`/`verify`/`build` slash commands, and a `$schema`).
  Decide whether either belongs in the repo.
- `sw.js` / `public/sw.js` in the repo will always trail production by one cache version (§4.5).
- Working tree at handoff: clean except those two untracked files; `main` == `origin/main` == `b584b99`.
- Scratch artifacts from this session live in `%TEMP%\opencode` (`contrast.mjs`, `check-palette.mjs`,
  `apply.mjs`, `shots.mjs`, `verify-deploy.mjs`, `shots/*.png`). Not in the repo; recreate as needed.
- A separate `pages-build-deployment` workflow also fails on `main`. It is unrelated to Vercel
  (production is served by Vercel per `docs/architecture.md:179-191`) and was not investigated —
  it may be a stale GitHub Pages integration worth disabling.
- The 7 ESLint warnings are pre-existing (`react-hooks/refs` and `exhaustive-deps` in
  `PracticeView.jsx`, `useDrawing.js`, `usePrefs.js`); don't treat them as regressions.
