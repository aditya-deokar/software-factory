<div align="center">

# Software Factory

**A self-improving software factory for coding agents.**

Eighteen skills that take work from a new issue to a monitored merge with evidence attached, plus an outer loop that measures every run, remembers what agents learn, and proposes its own skill fixes as reviewed PRs.

<p align="center">
  <a href="https://www.npmjs.com/package/@software-factory/skills"><img src="https://img.shields.io/npm/v/@software-factory/skills?style=flat-square&color=black" alt="npm version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License: MIT" /></a>
  <a href="skills/"><img src="https://img.shields.io/badge/skills.sh-18%20skills-black?style=flat-square&logo=gnubash&logoColor=white" alt="18 skills" /></a>
  <a href="AGENTS.md"><img src="https://img.shields.io/badge/workflow-AGENTS.md-22c55e?style=flat-square" alt="Workflow: AGENTS.md" /></a>
  <a href="https://github.com/vercel-labs/skills#supported-agents"><img src="https://img.shields.io/badge/agents-80%2B%20supported-6366f1?style=flat-square" alt="Supported Agents" /></a>
</p>

<p align="center">
  <a href="#the-factory">The factory</a> &bull;
  <a href="#all-eighteen-skills">All eighteen skills</a> &bull;
  <a href="#install">Install</a> &bull;
  <a href="#why-this-exists">Why this exists</a> &bull;
  <a href="#documentation">Documentation</a>
</p>

</div>

```text
 INNER LOOP (every task)
 triage ─► spec ─► isolate ─► build ─► prove ─► ship ─► monitor ─┐
   ▲      (human    worktree   service  evidence  5/5     regress-│
   │      approves)            layer    before/   Greptile ions   │
   └──────────────────── new issues ◄───────────────────────────┘
                          │ every run writes .factory/
 OUTER LOOP               ▼
 run ledger · memory · routing · friction ─► one reviewed PR per skill fix
```

```bash
npx skills add aditya-deokar/software-factory
```

Works with Claude Code, Cursor, Codex, GitHub Copilot, OpenCode, Windsurf, and [75 more agents](https://github.com/vercel-labs/skills#supported-agents).

---

## Why this exists

An agent that says "I fixed it and tested it" has told you nothing you can
check. These skills replace that claim with artifacts: a branch that cannot
collide with another agent's, a screenshot pair in the PR body, a recorded
session showing the test being performed, and a review score that has to reach
5/5 before merge.

v3 adds the part that keeps it working: skills go stale, agents re-learn the
same root causes, and every task runs on the most expensive model. The outer
loop reads where people keep correcting agents, finds the skill that owns the
failure, and opens a small PR to fix it. A person reviews every one.

Longer version in [docs/BENEFITS.md](docs/BENEFITS.md).

## The factory

[`AGENTS.md`](AGENTS.md) sets the order; drop it into any repo alongside the
skills, or run `factory-setup` to do it for you.

| Beat | Skill | What you get |
|---|---|---|
| Triage | `issue-triage` | One decision per issue: implement, spec, duplicate, needs-info, decline |
| Spec | `spec-writing` | Product and tech spec, approved by a person before code starts |
| Isolate | `worktree-isolation` | A worktree and branch per task. Parallel agents stop colliding. |
| Build | `service-layer` | Boundaries own the why, services own the how. One fix propagates everywhere. |
| Prove | `test-evidence` | The before state and the after, as an artifact. Done with proof, or BLOCKED. |
| Ship | `visual-diff`, `code-review-loop` | Before/after table in the PR, iterated to a clean review. |
| Monitor | `release-monitoring` | The merge commit checked; a regression becomes a new issue. |

The outer loop runs on data in `.factory/`, committed to git:

| Part | Skill | What it does |
|---|---|---|
| Record | `run-ledger` | One JSON record per task: beats, evidence, review rounds, human corrections, tokens |
| Remember | `agent-memory` | Facts with a source link, read at task start, graduated into skills when used often |
| Route | `model-routing` | Task class to model tier, with a best-of-k eval to settle disputes |
| Improve | `skill-feedback-loop` | Friction counts per skill, then one reviewed PR that must move a number |

`prose-cleanup` runs across everything a person will read, at every beat.

## All eighteen skills

### Lifecycle

- **[issue-triage](skills/issue-triage/SKILL.md)** - Classifies incoming work
  before anyone writes code. Searches memory and closed issues for duplicates,
  asks reporters for specific missing facts instead of "more details", and
  labels the issue with the reason.

- **[spec-writing](skills/spec-writing/SKILL.md)** - Product spec (invariants,
  behavior, testable acceptance checks) and tech spec (boundary and service
  split, files touched, risks), opened as a PR with the open questions on top.
  Code waits for approval.

- **[release-monitoring](skills/release-monitoring/SKILL.md)** - One bounded
  look after merge: CI on the merge commit, the deploy, the PR's own evidence
  rerun, and the error sources the repo names. Regressions become
  `factory:regression` issues that feed back into triage.


### Workflow

- **[worktree-isolation](skills/worktree-isolation/SKILL.md)** - A branch alone does not
  isolate anything; two agents in one checkout interleave edits regardless. Sets
  up a worktree per task, checks for overlap with work already in flight before
  starting, and covers what worktrees do *not* isolate: ports, databases,
  lockfiles, global config.

- **[service-layer](skills/service-layer/SKILL.md)** - Two questions decide
  where code lives: would it change if the product rules changed, or if the
  vendor changed. Boundaries own the first, services own the second. Ships an
  ordered extraction procedure you can stop partway through, and the five ways
  it usually goes wrong.

- **[test-evidence](skills/test-evidence/SKILL.md)** -
  Replace "I tested it and it works" with an artifact. The bundled recorder
  (`scripts/record.py`) captures the session while the agent drives the app,
  burns timestamped pass/fail annotations into `evidence.mp4`, and writes a
  report. Headless environments fall back to scripted screenshots; changes with
  no visible surface still produce evidence as measured numbers and output
  pairs.

### Shipping

- **[visual-diff](skills/visual-diff/SKILL.md)** - Drives the
  `@vercel/before-and-after` CLI to produce a PR-ready `| Before | After |`
  table from two URLs, two images, or a mix.

- **[code-review-loop](skills/code-review-loop/SKILL.md)** - Iterates a PR, MR, or shelved
  changelist until Greptile gives 5/5 confidence with zero unresolved comments.
  Triggers the review, fixes actionable comments, resolves threads, pushes,
  repeats, up to `--max-iterations` (default 10).

- **[code-review-loop-large](skills/code-review-loop-large/SKILL.md)** - The same loop, triggered
  by tagging `@greptile-apps`, which bypasses the file-count limit that makes
  Greptile refuse huge PRs. Use when code-review-loop gets "Too many files changed for
  review".

### Craft

- **[prose-cleanup](skills/prose-cleanup/SKILL.md)** - Cuts AI tells from anything a person
  will read. Names 31 patterns (puffery, filler, hedging, chatbot phrases, em
  dashes, colons as connectors, bold and emoji overuse, abstract metaphor
  nouns, passive voice) and applies them as a four-step loop.

- **[skill-authoring](skills/skill-authoring/SKILL.md)** - Write and audit skills that
  actually load. Covers trigger-focused descriptions, the frontmatter fields
  that matter, the layout the CLI discovers, and a debugging order for a skill
  that never fires.

- **[package-release](skills/package-release/SKILL.md)** - Cut and publish a
  versioned release. Semver rules specific to skills, a pre-publish audit, npm
  scoped publishing, GitHub releases, and what rollback actually looks like
  when npm will not let you republish a version.

- **[cross-platform-shell](skills/cross-platform-shell/SKILL.md)** - Commands that run on
  Windows. PowerShell 5.1 traps, a POSIX translation table, path and
  line-ending rules, and why `npx skills add --copy` is the fix when symlinks
  fail.

### Outer loop and data

- **[run-ledger](skills/run-ledger/SKILL.md)** - One JSON record per task in
  `.factory/runs/`: class, size, model tier, beats, evidence, review rounds,
  every human correction, and token cost read from local Claude Code and Codex
  transcripts. `ledger.mjs report` turns them into a table.

- **[agent-memory](skills/agent-memory/SKILL.md)** - Facts agents would
  otherwise re-learn (root causes, environment quirks, decisions), one file
  each with a source link, reviewed in the PR that learned them. Search before
  debugging; memories used three times graduate into a skill.

- **[skill-feedback-loop](skills/skill-feedback-loop/SKILL.md)** - Counts
  repeated corrections per owning skill, picks the one climbing, and opens one
  small PR with the signal, diagnosis, and the number it should move. Flags its
  own changes for revert when the number does not drop.

- **[model-routing](skills/model-routing/SKILL.md)** - Rules map task class and
  size to a tier (`fast`, `balanced`, `frontier`), never to a model ID.
  `route-eval.mjs` runs a best-of-k comparison in throwaway worktrees when a
  rule is in dispute.

- **[factory-setup](skills/factory-setup/SKILL.md)** - Bootstraps `.factory/`,
  the `AGENTS.md` section, and optional GitHub Actions for triage, the weekly
  loop, and post-merge monitoring. Idempotent, with a dry run, plus a validator
  that exits 2 when it checked nothing.

## Install

```bash
# Everything, into the project
npx skills add aditya-deokar/software-factory

# Everything, available in every project
npx skills add aditya-deokar/software-factory --global

# Pick specific skills
npx skills add aditya-deokar/software-factory --skill worktree-isolation --skill prose-cleanup

# Target specific agents
npx skills add aditya-deokar/software-factory -a claude-code -a cursor

# See what is in here without installing
npx skills add aditya-deokar/software-factory --list
```

On Windows, symlinking needs Developer Mode or an elevated shell. If install
fails, add `--copy`.

From npm, if you prefer a pinned version:

```bash
npm install --save-dev @software-factory/skills
npx skills add ./node_modules/@software-factory/skills
```

As a Claude Code plugin, which adds three hooks (memory loaded at session
start, pushes to `main` and plain force-pushes blocked, unfinished run records
caught) and the `/triage`, `/spec`, `/factory-loop`, `/factory-report`, and
`/sidecar` commands:

```bash
/plugin marketplace add aditya-deokar/software-factory
/plugin install software-factory@software-factory
```

Then, in each repo that should run the factory:

```bash
node <skills dir>/factory-setup/scripts/setup.mjs --dry-run   # or ask the agent to "set up the factory"
```

Full walkthrough in [docs/USAGE.md](docs/USAGE.md). Coming from v2: nothing was
renamed, so installs keep working; see [docs/MIGRATION-v3.md](docs/MIGRATION-v3.md).

## Use one without installing

```bash
npx skills use aditya-deokar/software-factory@prose-cleanup | claude
```

## Documentation

| Doc | What is in it |
|---|---|
| [docs/V3-PLAN.md](docs/V3-PLAN.md) | The v3 plan: from one task per PR to a self-improving factory, phase by phase. |
| [docs/MIGRATION-v3.md](docs/MIGRATION-v3.md) | Moving a repo from the v2 workflow to v3. |
| [docs/adr/0001-v3-factory.md](docs/adr/0001-v3-factory.md) | The v3 design decisions and the defaults chosen. |
| [docs/ROADMAP.md](docs/ROADMAP.md) | The publishing plan. Six phases from empty repo to a listed, versioned package. |
| [docs/USAGE.md](docs/USAGE.md) | How to use these skills in a real project, with worked examples. |
| [docs/BENEFITS.md](docs/BENEFITS.md) | What each skill is worth, and where the value does not show up. |
| [NOTICE.md](NOTICE.md) | Origin and license of every skill. Read before publishing. |
| [AGENTS.md](AGENTS.md) | The workflow file. Copy into any repo. |

## Development

```bash
node scripts/lint-skills.mjs        # frontmatter, layout, AGENTS.md index, README links, plugin manifests
node scripts/sync-shared.mjs        # copy shared/ into each skill (--check in CI)
node scripts/run-node-tests.mjs     # factory script tests
python -m pytest tests/ -q          # recorder smoke tests
npx skills add . --list             # confirm the CLI discovers everything
npm pack --dry-run                  # inspect the published tarball
```

Shared code lives once in `shared/`. Skills install one at a time, so
`sync-shared.mjs` copies it into each skill that needs it, and CI fails if a
copy drifts. The linter and the drift check run on `prepublishOnly`, so a
broken skill cannot reach npm.

## Licensing

Fourteen skills are original work under the root MIT license, which also covers
the packaging, `scripts/`, the hooks, and the docs. Four are vendored and keep their upstream
licenses in their own folders: `code-review-loop` and `code-review-loop-large` (MIT, Greptile),
`prose-cleanup` (MIT, Cursor), and `visual-diff` (PolyForm Shield 1.0.0, Vercel
Labs, which is source-available rather than open source).

[NOTICE.md](NOTICE.md) records the origin of every skill and what was changed
from upstream.

## Credits

`visual-diff` from [vercel-labs](https://github.com/vercel-labs/before-and-after),
`code-review-loop` from [greptileai](https://github.com/greptileai/skills), `prose-cleanup`
from [cursor](https://github.com/cursor/plugins). The subject matter of
`service-layer`, `worktree-isolation`, and `test-evidence` was prompted by
[michaelshimeles/skills](https://github.com/michaelshimeles/skills); the skills
here were written from scratch. v3's outer loop borrows ideas, not text, from
[BuilderIO/agent-native](https://github.com/BuilderIO/agent-native) and Warp's
talks on self-improving software factories; see [NOTICE.md](NOTICE.md).
