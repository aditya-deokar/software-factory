# ADR 0001: v3 turns the skills into a self-improving factory

Status: accepted, 2026-09-29

## Context

v2 ships one task as one PR with evidence attached. It has no intake, no
monitoring, no memory between tasks, and no way to notice that a skill keeps
failing. The v3 plan (`docs/V3-PLAN.md`) adds a lifecycle loop, a data plane,
and an outer loop that improves the inner one.

## Decisions

1. **The data plane is plain files in `.factory/`, committed to git.** No
   database, no hosted service. Run records, memory, routing rules, and
   friction patterns are diffable, reviewable, and survive any harness. The
   cost is merge noise on shared files, which is why `memory/INDEX.md` is
   generated and regenerated on conflict, like a lockfile.
2. **Routing rules name tiers, never model IDs.** `fast`, `balanced`, and
   `frontier` map to concrete models per harness in one table, so a model
   release changes one line instead of every rule.
3. **The outer loop proposes, a human merges.** Skill edits, memory
   graduations, and routing changes all arrive as PRs. Nothing in v3 merges
   its own output.
4. **Vendored skill bodies stay untouched.** `code-review-loop`,
   `code-review-loop-large`, `visual-diff`, and `prose-cleanup` are wired in
   through `AGENTS.md` and the ledger. When the loop finds a problem owned by a
   vendored skill, it proposes an `AGENTS.md` change instead.
5. **No renames, no removals.** The folder name is the install path. All ten
   v2 skills keep their names; v3 only adds.
6. **Scripts have zero dependencies and live inside the skill that uses them.**
   Skills install one at a time, so a script cannot import from another
   skill's folder. Shared code lives once in `shared/` and
   `scripts/sync-shared.mjs` copies it into each skill; CI fails if a copy
   drifts.
7. **Harness extras are optional.** The Claude Code plugin, hooks, and
   commands speed things up, but every skill states what to do without them.
8. **`agent-native/` is inspiration only.** It has no root license file, and
   v2 already had to rewrite three skills copied from an unlicensed source.
   v3 copies no text, regex, or code from it.

## Defaults chosen for the plan's open questions

| Question | Default |
|---|---|
| Skill names | As proposed: `issue-triage`, `spec-writing`, `release-monitoring`, `run-ledger`, `agent-memory`, `skill-feedback-loop`, `model-routing`, `factory-setup` |
| Where specs live | Files at `specs/<slug>.md`, reviewed in a PR |
| Talk transcripts | Kept local and gitignored |
| Agent in the workflow templates | `anthropics/claude-code-action` by default, Codex when the repo variable `FACTORY_AGENT` is `codex` |
| Plugin in 3.0 or 3.1 | 3.0 |

## Consequences

- A repo that adopts v3 gains a `.factory/` directory and a few extra lines
  in each PR body (run id, memories used).
- The v2 behavior is what you get with every `.factory/config.json` switch
  off, so adoption can go one beat at a time.
