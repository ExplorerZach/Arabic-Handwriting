# Architecture Decisions — Arabic Script Practice

ADR-style record of design and architecture decisions. For the current
architecture itself, see `AGENTS.md` and `docs/architecture.md`. This file
captures the _why_ behind decisions that are not obvious from the code.

## Entry template

```markdown
### ADR-XXX — Short title

- **Status:** Proposed | Accepted | Deprecated | Superseded
- **Date:** YYYY-MM-DD
- **Area:** component / hook / data flow / tooling / process

**Decision:** What we decided.

**Context:** What problem or situation led to this decision.

**Rationale:** Why this choice over alternatives.

**Consequences:** What this enables and what it constrains.

**Evidence / References:**

- `path/to/relevant/file.js` — specific lines or patterns
- Related ADR: ADR-XXX

**Supersedes:** ADR-XXX (if replacing a prior decision)
**Superseded by:** ADR-XXX (if later replaced)
```

---

## Decisions

### ADR-001 — Curated agent memory bank

- **Status:** Accepted
- **Date:** 2026-08-17
- **Area:** process

**Decision:** Maintain a deliberately small, curated agent memory bank at
`docs/agent-memory/` with two files: `decisions.md` (ADR-style) and
`gotchas.md` (surprising behaviors). `AGENTS.md` remains the operational entry
point; source code and tests remain authoritative.

**Context:** AI coding agents working on this project need durable context
beyond what source code provides — rationale for past decisions, known
footguns, and non-obvious constraints. Without a memory bank, agents either
rediscover the same issues or make decisions that contradict past reasoning.

**Rationale:** A small curated bank is better than:

- **No memory:** Agents repeat mistakes and re-litigate settled decisions.
- **Auto-generated memory:** LLM-generated summaries drift, duplicate, and
  lose precision. They become noise.
- **Large comprehensive docs:** High maintenance burden; agents waste tokens
  reading irrelevant entries. The bank stays small by design — if it grows
  beyond ~20 entries, entries should be promoted to `AGENTS.md` or
  `docs/architecture.md`.

**Consequences:**

- Agents have a single place to find non-obvious project rationale.
- Maintenance burden is low: entries are only added for durable discoveries.
- The "source code is authoritative" rule prevents stale memory from causing
  harm.
- Entries that duplicate `AGENTS.md` or `docs/architecture.md` are explicitly
  forbidden, preventing fragmentation.

**Evidence / References:**

- `AGENTS.md` — operational entry point, critical rules
- `docs/architecture.md` — deep architecture reference
- `docs/agent-memory/README.md` — maintenance contract and rules
