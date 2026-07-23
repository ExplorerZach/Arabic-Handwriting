# Arabic Script Practice

A free app that helps you learn how to write Arabic, with AI-powered
calligraphy feedback on every stroke. Available as a **web PWA** and a
**native desktop app** (Windows, macOS, Linux).

**Web:** <https://www.writearabic.app>

**Desktop:** Download the latest release from
[GitHub Releases](https://github.com/YOUR_USERNAME/arabic-handwriting/releases/latest).

Draw individual letters (in all four positional forms), common words, or
work through a spaced-repetition review queue of letters due for re-practice.
Apple Pencil, stylus, touch, and mouse input are all supported. All progress
is stored locally; no account required.

## Running locally

### Web (PWA)

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build + service-worker cache bust
npm run preview   # preview the production build
```

### Desktop (Tauri)

Requires Rust (via `rustup`) and platform build tools — MSVC on Windows,
Xcode on macOS, or webkit2gtk on Linux.

```bash
npm install
npm run tauri dev    # native window with Vite HMR
npm run tauri build  # native binaries (.exe / .dmg / .AppImage)
```

## Tech stack

React 19, Vite 8, Tauri 2 (Rust), OpenRouter vision API, CSS variables
(no libraries), localStorage for persistence (SM-2 spaced repetition).

See [`AGENTS.md`](./AGENTS.md) for architecture notes, conventions, and the
deployment pipeline.
