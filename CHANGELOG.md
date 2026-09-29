# Changelog

Grouped by skill, per `package-release`. Package versions track the bundle;
each skill's `metadata.version` says whether that one skill changed.

## 3.0.0 (unreleased)

v3 turns the four-beat workflow into a self-improving software factory: an
inner loop from triage to post-merge monitoring, a data plane in `.factory/`,
and an outer loop that proposes skill fixes as reviewed PRs. No skill was
renamed or removed. See `docs/MIGRATION-v3.md`.

### Added

- `issue-triage` 1.0: one decision per incoming item (implement, spec,
  duplicate, needs-info, decline), with a memory and closed-issue search first.
- `spec-writing` 1.0: product and tech spec templates, opened as a PR and
  approved by a person before code starts.
- `release-monitoring` 1.0: one bounded post-merge check; regressions become
  `factory:regression` issues.
- `run-ledger` 1.0: one JSON record per task, `ledger.mjs report`, token usage
  from Claude Code and Codex transcripts.
- `agent-memory` 1.0: facts with provenance in `.factory/memory/`, search,
  use counts, prune, and graduation into skills.
- `skill-feedback-loop` 1.0: friction report, signal collection, ranking with
  thresholds and cooldowns, and follow-up that flags changes that did not help.
- `model-routing` 1.0: tier rules and `route-eval.mjs`, a best-of-k runner in
  throwaway worktrees.
- `factory-setup` 1.0: idempotent bootstrap of `.factory/` and `AGENTS.md`,
  GitHub Actions templates, and `check-factory.mjs`.
- Claude Code plugin: manifests, three hooks (memory at session start, push
  guard, run-record check), and five commands. Codex plugin manifest.

### Changed

- `AGENTS.md`: seven-beat inner loop, outer loop, human gates, and a
  done-or-blocked rule. 4,189 characters, down from 5,755.
- `test-evidence` 3.0: done-or-blocked endings, proof scaled to the change,
  ledger recording.
- `service-layer` 2.1: a sibling sweep before fixing a pattern bug.
- `skill-authoring` 1.1: `metadata.signals`, and how to review a loop proposal.
- `package-release` 1.1: changing the copied workflow contract is a major bump.
- `run-ledger` 1.1 (after review): bot review comments are review rounds, not human touches.
- `worktree-isolation` 2.1: owns the `worked-on-main` and `stale-branch`
  friction patterns (metadata only).

### Fixed

- `__pycache__` could leak into the npm tarball after a local pytest run,
  because the `files` allowlist overrides `.npmignore`.

### Tooling

- Lint checks the `AGENTS.md` size budget, the skills index, README links,
  friction ownership, plugin versions, and hook scripts.
- `scripts/sync-shared.mjs` keeps each skill's copy of `shared/` identical;
  CI fails on drift.
- 46 node tests across Linux, macOS, Windows, and Node 18.
