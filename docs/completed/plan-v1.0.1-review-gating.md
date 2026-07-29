# Plan: Fix #4 (review-session gating) + hardening + v1.0.1

## Goal

1. Fix [issue #4](https://github.com/ExplorerZach/Arabic-Handwriting/issues/4) — mid-session
   letter swaps during Auto Review silently misattribute AI scores.
2. Add release hardening: workflow concurrency guard + version-bump script.
3. Cut v1.0.1 and use it to dogfood the Tauri updater end-to-end (the one
   release component never tested for real).

---

## Part 1 — Fix issue #4

### Root cause

In `src/components/PracticeView.jsx`:

- `requestFeedback` (~line 1781) writes progress to the **currently displayed**
  item: `progressName = letter.name`, `progressForm = activeForm`.
- `advanceReview` (~line 1308) records the same score against the **original
  queue item**: `sess.queue[sess.index]`.

Any UI control that changes `letterIndex`/`formIndex` mid-session (without
touching the review queue) makes the next score land on the wrong progress
entry while the session summary records it against the queue item.

### Fix sites (mirror deck-session gating from 9a5460d)

Gate on active session — `deckSession || reviewSession` — with
`disabled={...}` + `opacity: 0.35`, same pattern as 9a5460d:

1. **Prev button** (~line 2971): extend the existing `deckSession` gating
   (opacity, `if (...) return;` guard, `disabled`) to also cover
   `reviewSession`. Update the comment to mention review sessions.
2. **Lesson-mode toggle 📖** (~line 2024): extend `opacity`/`disabled` the
   same way (toggling remaps `letterIndex → letter` via `lessonToAlpha`).
3. **Form switcher** (~line 2703) — _beyond the issue's suggested fix, same
   bug class, found during planning:_ it stays active in letters mode and
   `selectForm(key)` changes `activeForm` → `progressForm` diverges from the
   queue item's `formKey`. This affects **both** `reviewSession` **and**
   `deckSession` letter items (9a5460d missed the deck case). Gate it on
   `deckSession || reviewSession` too.

Introduce a shared boolean in render scope to keep the three sites readable,
e.g. `const sessionActive = !!(deckSession || reviewSession);` — but only if it
doesn't churn unrelated lines; inline conditions are acceptable.

**Out of scope:** alphabet/word rows (already hidden during both sessions),
Next button (already routes through `advanceReviewRef`/`advanceDeckRef`).

### Verification

- `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`
  (all must exit zero).
- Regression test: only util tests exist today (`src/utils/__tests__/`). If
  mounting `PracticeView` with testing-library proves cheap, assert Prev/📖/
  form buttons are `disabled` with an active `reviewSession`; if mounting is
  heavy, skip — don't build a harness for one assertion.
- Manual (Playwright MCP): seed due letters (localStorage `arabic_progress`),
  start Auto Review → confirm Prev, 📖, and form buttons are disabled/dimmed →
  draw + submit (apiKey `skip` won't score; if no real key, simulate by
  checking disabled state only) → exit session → confirm controls re-enable.
  Repeat for a deck letter session (form switcher must be disabled).
- Confirm normal practice (no session) is unaffected.

**Commit:** branch `fix/review-session-gating`, PR with `Fixes #4` in the body
(auto-closes the issue on merge), merge to `main`.

---

## Part 2 — Hardening

### 2a. Workflow concurrency guard

Add to `.github/workflows/release.yml` (top level, after `permissions:`):

```yaml
concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: true
```

Prevents the tag delete/recreate race from running two builds that fight over
the same draft release (observed on v1.0.0 — one run had to be cancelled by
hand).

### 2b. Version-bump script

New `scripts/bump-version.js` (model on `scripts/bust-sw.js`, plain Node, no
deps): `node scripts/bump-version.js 1.0.1` validates `x.y.z`, then rewrites:

- `package.json` → `"version"`
- `src-tauri/tauri.conf.json` → `"version"`
- `src-tauri/Cargo.toml` → the `version = "..."` line under `[package]` only
  (first match — do NOT touch dependency versions)

Add npm script `"version:bump": "node scripts/bump-version.js"`.
Run `npm run tauri:check` afterwards so `Cargo.lock` re-syncs its `app`
entry, and commit the lockfile with the bump.

Update `AGENTS.md` → **Version Bumping** section to point at the script
(keep the "commit, then tag, then push tag" rule from **Cutting a Release**).

---

## Part 3 — Cut v1.0.1

Order matters — the tag must point at the commit containing the bump:

1. Merge Part 1 PR; land Part 2 on `main`.
2. `npm run version:bump 1.0.1` → `npm run tauri:check` → build green →
   commit (`Bump version to 1.0.1`) → push.
3. `git tag v1.0.1 && git push origin v1.0.1`.
4. Watch the Release run (`gh run list --workflow release.yml`): 4 green jobs,
   no duplicate run (concurrency guard working).
5. Verify the draft: 17 assets for 1.0.1, `latest.json` version `1.0.1`,
   all platform entries present.
6. Publish the draft. Release notes: short changelog (review-session gating
   fix + hardening) **plus the same "not code-signed" SmartScreen/Gatekeeper
   note from v1.0.0** (use `gh release edit --notes-file`, not inline
   `--notes` — PowerShell mangles multiline args).
7. **Dogfood the updater:** install the published **v1.0.0** NSIS build,
   launch it, trigger/wait for the updater check → confirm it offers and
   installs 1.0.1 and the app relaunches as 1.0.1. This is the first real
   end-to-end updater test.

### Rollback

If the 1.0.1 build is bad: unpublish via `gh release edit v1.0.1 --draft`,
delete tag (`git push origin :refs/tags/v1.0.1`), fix, re-tag. `releases/latest`
keeps pointing at v1.0.0 until a non-draft 1.0.1 exists, so users are
unaffected while it's a draft.

---

## File-touch summary

| File                                                                        | Change                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/components/PracticeView.jsx`                                           | Gate Prev, 📖 toggle, form switcher on `deckSession \|\| reviewSession` |
| `.github/workflows/release.yml`                                             | `concurrency` block                                                     |
| `scripts/bump-version.js`                                                   | New version-sync script                                                 |
| `package.json`                                                              | `version:bump` script (then 1.0.1 bump)                                 |
| `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` | 1.0.1 bump                                                              |
| `AGENTS.md`                                                                 | Version Bumping section → script                                        |
