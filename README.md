# Arabic Script Practice

A free PWA that helps you learn how to write Arabic, with AI-powered
calligraphy feedback on every stroke.

**Live:** <https://www.writearabic.app>

Draw individual letters (in all four positional forms), common words, or
work through a spaced-repetition review queue of letters due for re-practice.
Apple Pencil, stylus, touch, and mouse input are all supported. All progress
is stored locally; no account required.

## Running locally

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build + service-worker cache bust
npm run preview   # preview the production build
```

See [`AGENTS.md`](./AGENTS.md) for architecture notes, conventions, and the
deployment pipeline.
