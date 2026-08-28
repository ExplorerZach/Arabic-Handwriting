# Gotchas — Arabic Script Practice

Surprising behaviors, footguns, and safe workarounds discovered during
development. For operational rules and constraints, see the **Critical Rules**
section of `AGENTS.md` — those remain the primary reference and should not be
copied here.

## Entry template

```markdown
### GOT-XXX — Short title

- **Status:** Active | Resolved | Superseded
- **Area:** component / hook / build / platform / API
- **Observed:** YYYY-MM-DD
- **Revalidated:** YYYY-MM-DD (or "N/A" if not yet re-checked)

**Symptom:** What the agent or developer sees go wrong.

**Cause:** Why it happens (root cause, not just surface).

**Safe approach:** How to work around or avoid it.

**Evidence / References:**

- `path/to/file.js:123` — relevant code
- Related GOT: GOT-XXX

**Remove / revalidate when:** Condition under which this entry can be
removed or should be re-checked (e.g., "After upgrading to React 20",
"Revalidate after Q3 2026").
```

---

## Active

### GOT-001 — Supabase free plan auto-pauses the project

- **Status:** Active
- **Area:** API / platform
- **Observed:** 2026-08-27
- **Revalidated:** 2026-08-27

**Symptom:** All DB queries and auth fail with connection timeouts; the
security/performance advisors are unreachable. `supabase_get_project` reports
`status: INACTIVE` (or `COMING_UP` for minutes after restore).

**Cause:** Free-tier Supabase projects pause after ~1 week of inactivity. The
MCP tools work for management APIs but any SQL tool call times out until the
project is restored.

**Safe approach:** Call restore (takes ~5 min → `ACTIVE_HEALTHY`) before any
DB work. If outages become user-facing (the app needs auth for cloud sync),
either add a weekly keep-alive ping or upgrade the plan.

**Evidence / References:**

- Production project ref: `nxkhhpazrbzmxcwrfaqu` (free plan, us-west-2)

**Remove / revalidate when:** Plan is upgraded or a keep-alive exists.

---

### GOT-002 — Leaked-password protection unavailable on free plan

- **Status:** Active
- **Area:** API / auth
- **Observed:** 2026-08-27
- **Revalidated:** 2026-08-27

**Symptom:** Security advisor reports `auth_leaked_password_protection` (WARN):
the HaveIBeenPwned check cannot be enabled — it is a Pro-plan feature and the
dashboard toggle is not available.

**Cause:** Organization `Coffee Cow` is on the free plan.

**Safe approach:** Compensate app-side: raise the minimum password length in
`AuthForm.jsx` (currently `password.length < 6` — the Supabase default of 6 is
weak). Revisit the HIBP toggle if/when the plan is upgraded.

**Evidence / References:**

- `src/components/AuthForm.jsx:91`
- Advisor finding `auth_leaked_password_protection`

**Remove / revalidate when:** Org upgrades to Pro.

---

### GOT-003 — Tauri auto-update relaunch has no process permission

- **Status:** Active
- **Area:** platform
- **Observed:** 2026-08-27
- **Revalidated:** N/A

**Symptom:** After installing an update via `@tauri-apps/plugin-updater`,
`relaunch()` from `@tauri-apps/plugin-process` fails at runtime (permission
not granted) — the user must restart the app manually.

**Cause:** `src-tauri/capabilities/default.json` grants
`core:default/notification/dialog/fs/store/stronghold` and `desktop.json`
grants `updater:default`, but neither grants `process:allow-restart`.

**Safe approach:** Add `"process:allow-restart"` to `desktop.json`
permissions when the in-app relaunch is wanted, then `npm run tauri:check`
and a manual `npm run tauri dev` update-flow test.

**Evidence / References:**

- `src/utils/updater.js:9-10` — imports both `plugin-updater` and `relaunch`
- `src-tauri/capabilities/desktop.json` — only `updater:default`

**Remove / revalidate when:** Permission added and verified in a build.

---
