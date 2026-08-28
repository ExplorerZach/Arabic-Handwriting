# Agent Memory Bank — Arabic Script Practice

A curated, deliberately small memory bank for AI coding agents working on this
project. It captures durable project-specific discoveries that are not obvious
from source code, tests, or config alone.

## Authority

**Current source code, tests, and configuration files are authoritative over
this memory bank.** If memory contradicts the codebase, the codebase wins —
update or remove the stale entry.

`AGENTS.md` remains the operational entry point: commands, critical rules,
architecture map, and MCP tool assignments live there. This bank supplements it
with deeper rationale and hard-won lessons.

## What goes where

| File           | Purpose                                                  | Boundaries                                                                                                                              |
| -------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `decisions.md` | Architecture/design decisions with rationale (ADR-style) | Only decisions that are **not** already documented in `AGENTS.md` or `docs/architecture.md`. Do not restate existing architecture.      |
| `gotchas.md`   | Surprising behaviors, footguns, and safe workarounds     | Only discoveries that are **not** already captured as Critical Rules in `AGENTS.md`. Existing operational warnings stay in `AGENTS.md`. |

**Do not duplicate** content from these existing docs — point to them instead:

- `docs/architecture.md` — deep architecture, data flow, hooks, Tauri, SW
- `docs/ROADMAP.md` — feature backlog and priorities
- `docs/KNOWN_ISSUES.md` — minor bugs and polish items
- `docs/superpowers/specs/` — task/design specifications
- `docs/superpowers/plans/` — implementation plans

## Rules for entries

1. **Only durable, project-specific discoveries.** If it is general knowledge
   (e.g., "React hooks rules"), it does not belong here.
2. **Concise.** Each entry should be a few paragraphs at most. Include code
   pointers or file paths as evidence.
3. **Date and revalidate.** Entries that could expire (API behavior, library
   quirks, platform-specific workarounds) must include an observed date and a
   revalidation condition. Stale entries are worse than no entries.
4. **Update or remove contradicted entries.** When a decision is reversed or a
   gotcha is fixed, update the entry status and add a superseding reference.
   Do not leave dead entries.
5. **No task status, conversation summaries, file-by-file maps, speculation,
   secrets, or duplicated AGENTS content.**

## When to read this bank

Agents should consult relevant entries when:

- Making a design decision that touches an area with a recorded decision
- Investigating surprising behavior that might match a known gotcha
- Onboarding to a subsystem with non-obvious constraints

Not every task requires reading the bank. Use judgment: if the task is a
straightforward bug fix in well-understood code, skip it.

## Maintenance

Anyone (human or agent) may propose an entry. Before adding:

1. Verify the discovery is not already covered by `AGENTS.md` or
   `docs/architecture.md`.
2. Check that it meets the durability bar — will this still be useful in six
   months?
3. Use the template from the target file.
4. Keep the bank small. If it grows beyond ~20 entries total, consider whether
   some should be promoted to `AGENTS.md` rules or `docs/architecture.md`
   sections instead.
