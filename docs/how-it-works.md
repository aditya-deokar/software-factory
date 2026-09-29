# How the Software Factory Works

Complete technical explanation of this repo, as of v3. Companion to `video-script.md`, which is the spoken v2 version. This file is the reference version: what each part does, how parts connect, and where to look in code.

Source of truth: `AGENTS.md` plus the eighteen skills under `skills/`. The design decisions behind v3 are in `docs/adr/0001-v3-factory.md`, and the plan it was built from is `docs/V3-PLAN.md`.

---

## 1. The idea in one paragraph

An agent that says "done and tested" gives you a claim you cannot check. The factory replaces each claim with an artifact: an isolated branch that cannot collide, code placed so one fix lands everywhere, a recording or measurement that shows the behavior, a before/after table in the PR, and a 5/5 review score before merge. That is the inner loop, and v3 wraps it on both sides: triage and specs before it, monitoring after it. v3 also adds an outer loop that watches the inner one. Every run is recorded, facts agents learn are kept, work is routed to the cheapest model that does it well, and repeated human corrections turn into a reviewed PR against the skill that failed. `AGENTS.md` sets the order. Skills supply the how. `.factory/` holds the data.

It is model agnostic and harness agnostic. It works with Claude Code, Cursor, Codex, Copilot, OpenCode, Windsurf, and others because it is workflow, markdown, and dependency-free Node scripts, not a product. The Claude Code plugin adds hooks on top, and nothing depends on them.

---

## 2. Repo map

```text
AGENTS.md                          <- the controller, copy into any repo (or run factory-setup)
skills/
  issue-triage/                    <- Beat 0: Triage
  spec-writing/                    <- Beat 1: Spec (product + tech templates in references/)
  worktree-isolation/              <- Beat 2: Isolate
  service-layer/                   <- Beat 3: Build
  test-evidence/                   <- Beat 4: Prove (scripts/record.py)
  visual-diff/                     <- Beat 5a: Ship (before/after)
  code-review-loop/                <- Beat 5b: Ship (Greptile to 5/5)
  code-review-loop-large/          <- Beat 5b variant for huge PRs
  release-monitoring/              <- Beat 6: Monitor
  run-ledger/scripts/ledger.mjs    <- outer loop: one record per task
  agent-memory/scripts/memory.mjs  <- outer loop: facts with provenance
  model-routing/scripts/route*.mjs <- outer loop: tiers and best-of-k evals
  skill-feedback-loop/scripts/     <- outer loop: friction report, signals, proposals
  factory-setup/                   <- bootstrap .factory/, validator, workflow templates
  prose-cleanup/                   <- cross-cutting, human-readable text
  skill-authoring/, package-release/, cross-platform-shell/   <- meta
shared/                            <- lib/ and schemas/ copied into skills by scripts/sync-shared.mjs
hooks/                             <- Claude Code plugin hooks
commands/                          <- /triage, /spec, /factory-loop, /factory-report, /sidecar
.claude-plugin/, .codex-plugin/    <- plugin manifests
.factory/                          <- this repo's own factory data (it runs itself)
scripts/                           <- lint-skills, check-package, sync-shared, run-node-tests
tests/                             <- recorder tests (Python), factory tests (tests/node)
```

Install entry: `npx skills add aditya-deokar/software-factory`, or the Claude Code plugin marketplace. Package name: `@software-factory/skills`.

---

## 3. The controller: AGENTS.md

`AGENTS.md` is under 6,000 characters on purpose (the linter enforces it), because it is loaded on every task. Its order:

1. **Skills index**, second on the page, so an agent that reads nothing else still knows which skill covers which moment. The linter fails if a skill is missing from it.
2. **Inner loop**, beats 0 to 6: triage, spec (when triage says so, approved by a person), isolate, build, prove, ship, monitor.
3. **Outer loop**: remember, route, record, improve.
4. **Human gates**: spec approval, merge, and every outer-loop PR.
5. **Rules**: one worktree per task, scope check, no plain `--force`, regenerate lockfiles and the memory index on conflict, keep changes to the task, `prose-cleanup` on text, and every report ends as Done with its artifact or `BLOCKED: <what> - unblock: <one action>`.
6. **Completing a task**, then a **repo-specific** section to fill in.

`factory-setup` writes this file into a repo that has none, or appends a marked, shorter section to one that does.

---

## 4. End-to-end flow

```mermaid
flowchart TD
    IN[Issue, message, or regression] --> TR[0. Triage: one decision]
    TR -->|duplicate / decline / needs-info| CLOSE[Label, comment, stop]
    TR -->|spec| SP[1. Spec: product + tech]
    SP -->|human approves| ISO
    TR -->|implement| ISO[2. Isolate: worktree off origin/main]
    ISO --> BUILD[3. Build: service-layer split]
    BUILD --> PROVE[4. Prove: before + after artifacts]
    PROVE -->|no proof| BUILD
    PROVE --> PR[5. Ship: PR with proof, run id, memories]
    PR --> REV[code-review-loop: Greptile]
    REV -->|below 5/5| BUILD
    REV -->|5/5, zero open| MERGE[Human merges]
    MERGE --> MON[6. Monitor: merge commit, deploy, errors]
    MON -->|regression| IN

    ISO -. start run .-> L[(.factory/runs)]
    PROVE -. evidence .-> L
    REV -. rounds, corrections .-> L
    TR -. search .-> M[(.factory/memory)]
    BUILD -. search, save .-> M
    L --> LOOP[skill-feedback-loop]
    M --> LOOP
    LOOP -->|one reviewed PR| SKILLS[Skill text]
```

The inner loops are the same as v2: Prove loops back to Build when evidence shows the fix did not land, and Ship loops back when Greptile scores below 5/5. v3 adds the outer arrow: every run writes data, and the loop turns that data into skill changes that a person reviews.

Claim to artifact mapping:

| Claim | Artifact | Produced by |
|---|---|---|
| I tested it | Recording with annotations, or before/after output | `test-evidence` |
| The UI looks right | Before/After table in PR body | `visual-diff` |
| It is clean code | 5/5 Greptile, zero unresolved comments | `code-review-loop` |
| I did not break anyone | Separate worktree and branch, scope check first | `worktree-isolation` |
| It shipped fine | Monitor status on the run record, or a regression issue | `release-monitoring` |
| The factory is getting better | `ledger.mjs report` and the friction report, window over window | `run-ledger`, `skill-feedback-loop` |

---


## 5. Beat 2: Isolate

Skill: `skills/worktree-isolation/SKILL.md`.

### Problem

Two agents in one checkout interleave edits even on different branches, because there is one working tree. Result: deleted files, overwritten work, unmergeable branches. Non-technical builders hit this most, because nothing warns them.

### What it does

1. Detects harness help first. Claude Code already provisions under `.claude/worktrees/`. Cursor does the same for `worktree-*` branches. Plain terminal does the full setup. Check with `git rev-parse --show-toplevel` and `git branch --show-current`.
2. Scope check before any edit:
   ```bash
   git fetch origin --prune
   gh pr list --state open
   gh pr diff <number> --name-only
   git status --porcelain
   ```
   If your task needs a file that open work touches, stop and ask. That decision belongs to the human directing work.
3. Setup:
   ```bash
   git fetch origin
   git worktree add ../wt/<task-name> -b agent/<task-name> origin/main
   ```
   Branch from `origin/main`, not stale local `main`. Name for the task with a unique suffix. Put worktrees outside the repo or in a gitignored dir. Then install deps inside the new dir, because worktrees do not share `node_modules` or `.venv`.
4. Teardown after merge:
   ```bash
   git worktree remove ../wt/<task-name>
   git branch -D agent/<task-name>
   ```
   Keep the worktree until the PR merges or closes, so review fixes land on the right branch.

### What it does NOT isolate

```mermaid
flowchart LR
    subgraph Files [Isolated by worktree]
      A[Working tree]
      B[Branch]
    end
    subgraph Shared [Still shared]
      P[Ports - confirm with lsof or netstat]
      D[Databases - use task DB or coordinate]
      L[Lockfiles - regenerate, never hand-merge]
      G[Global config - npmrc, aws, docker]
    end
    A -.-> P
    A -.-> D
```

Ports: two dev servers both want 3000. Confirm the port answers your process or set one port per worktree. Databases: shared dev DB means your migration is everyone's migration. Lockfiles: take one side then rerun install, for example `git checkout --theirs package-lock.json && npm install`.

### Diagram

```mermaid
flowchart TD
    MAIN[origin/main] --> W1[Worktree A: agent/landing-9c1f]
    MAIN --> W2[Worktree B: agent/api-speed-4f2a]
    MAIN --> W3[Worktree C: agent/email-client-77bd]
    W1 --> PR1[PR 1]
    W2 --> PR2[PR 2]
    W3 --> PR3[PR 3]
    PR1 --> MAIN2[main after merge]
    PR2 --> MAIN2
    PR3 --> MAIN2
```

Cost is about 30 seconds per task. Value is parallel agents without collision. Skip only for solo single-session work with no parallelism.

---

## 6. Beat 3: Build

Skill: `skills/service-layer/SKILL.md`.

### The two questions

- Will this change if product rules change? Then it belongs in the boundary. Auth, permission, whether to act, user-facing wording, state transition.
- Will this change if the vendor changes? Then it belongs in the service. Retries, SDK calls, timeouts, polling, payload shape.

Code that answers yes to both is doing two jobs. Split it.

### Shape

```mermaid
flowchart LR
    REQ[Request: route, action, CLI, cron] --> B[Boundary: who, whether, what next]
    B --> S[Service: how, retry, validate input]
    S --> V[Vendor or driver]
    V --> S
    S -->|structured result ok or typed error| B
    B -->|map to response + write state| RESP[Response + state transition]
```

Rules:

- Boundary calls service. Service never calls boundary, never reads session, never writes domain tables, never decides permission. If a service needs to know who the user is, pass it as an argument.
- Service function: everything arrives as parameters, return is structured (`{ ok: true; ... }` or `{ ok: false; reason; detail }`), failure is in the type, and it does one thing. See `skills/service-layer/SKILL.md:69-87` for the `putObject` example and lines 110-134 for the route handler that stays readable.
- Quick test from the skill: pricing decision, permission rule, and user-facing wording go in boundary. Vendor swap, timeout policy, and payload field go in service. If one function would change for reasons on both sides, it is two functions.

### Ordered extraction

Stop after any step and still have working code:

1. Find real duplication. A change to one should always change the other, else they are coincidental twins.
2. Extract for one caller only. Temporary duplication is fine.
3. Verify that caller with tests, typecheck, and a real run.
4. Migrate the next caller. Differences become parameters, not `if (mode === admin)` branches. Flag params mean a product rule leaked in.
5. Delete originals. Dead copies mislead the next reader.
6. Leave domain logic where it was. Auth and wording move back if they slipped into the service.

### Failure modes

God service (`handleUpload` doing everything), leaky service (writes DB directly so callers cannot test or transact), flag parameter (`skipValidation, asAdmin, silent`), mismatched siblings (throw vs null vs `{ error }` in one module), anticipatory abstraction (service built before the second caller exists).

Skip on prototypes, one-off scripts, and flows about to be deleted. Structure is a bet on repeated change.

---

## 7. Beat 4: Prove

Skill: `skills/test-evidence/SKILL.md`. Recorder: `skills/test-evidence/scripts/record.py`.

### Two rules for every change

1. Capture before first, while the bug still reproduces. After the fix, showing old behavior means stashing everything.
2. Vary one thing. Same viewport, same machine, same input, same warm state. Else the comparison proves nothing.

### Evidence by change kind

| Kind | Evidence |
|---|---|
| Visible UI behavior | Recording of you driving it, annotated with `step`, `pass`, `fail`, `note` |
| Visual with no interaction | Before and after screenshots, pinned viewport |
| Bug fix | Failure reproduced first, then same steps passing |
| Performance | Same measurement before and after, several runs, report spread |
| API or CLI | Request and response, or command and output, both versions, diffed |
| Data or migration | Row counts plus sample, query included |
| Refactor, no behavior change | Suite passing plus the riskiest behavior exercised |

### Recording path

```mermaid
flowchart TD
    DOC[record.py doctor] --> START[start --label test-name]
    START --> DRIVE[Drive app: click + type real cases]
    DRIVE --> ANN[annotate assertions: pass or fail]
    ANN --> STOP[stop]
    STOP --> OUT[evidence.mp4 + report.md + manifest.json]
    OUT --> ATTACH[Attach: video to PR, report as comment, images via visual-diff]
```

Commands:

```bash
python skills/test-evidence/scripts/record.py doctor
python skills/test-evidence/scripts/record.py start --label "Cart totals with tax"
python skills/test-evidence/scripts/record.py annotate "Added 2 items to cart"
python skills/test-evidence/scripts/record.py annotate "NY tax shows 4.44" --kind pass
python skills/test-evidence/scripts/record.py stop
```

Recording well: annotate the assertion not the click, record failures too, keep 60-90 seconds, slow down slightly, do not narrate code. If `stop` fails, `raw.ts` in the session dir is still playable. If `doctor` reports missing `libx264` or `ass` filter, you need a different FFmpeg build. macOS needs Screen Recording permission. No display means use the headless path.

### Headless and non-visual paths

```bash
npx playwright screenshot --viewport-size=1280,800 http://localhost:3000/cart before.png
# apply change, restart, then
npx playwright screenshot --viewport-size=1280,800 http://localhost:3000/cart after.png
```

Performance: `hyperfine --warmup 3` on same machine, report both numbers and spread. Output: `git stash`, capture to `/tmp/before.json`, `git stash pop`, capture after, `diff -u`. Queries: counts before and after with the query pasted beside the number.

### PR placement

Structure from the skill, proof before explanation:

```markdown
## What changed
One or two sentences.

## Evidence
<video or before/after table>

| Case | Result |
|---|---|
| Cart with 2 items | pass |

## Risks
What could still be wrong, and what is untested.
```

Video cannot upload via `gh`. Drag `evidence.mp4` into the browser comment box. Images go via `visual-diff --markdown`. Do not rehearse after the fact, do not crop failures, do not claim more than captured, and if a change needs no evidence say what you did check in one line.

---

## 8. Beat 5: Ship

Two skills in order: `visual-diff` then `code-review-loop`.

### 8a. visual-diff

Skill: `skills/visual-diff/SKILL.md`. Drives `@vercel/before-and-after` plus `agent-browser`.

```mermaid
flowchart TD
    PRE[Pre-flight: which before-and-after or install] --> PROT[Protection check: curl URL, 401/403 means Vercel protection]
    PROT --> CAP[Capture: visual-diff before after]
    CAP --> UP[Upload: upload-and-copy.sh --markdown]
    UP --> PR[PR integration: gh pr edit append table]
```

Quick reference:

```bash
visual-diff <before-url> <after-url>
visual-diff url1 url2 --mobile
visual-diff before.png after.png --markdown
npx @vercel/before-and-after url1 url2
```

Rules baked into the skill: assume current state is After, never switch branches or assume what before is, do not use `--full` unless asked, ask for the before URL when only one is given, check Vercel protection before capture, resolve `$SKILL_DIR` before calling upload scripts, run POSIX upload scripts from Git Bash or WSL on Windows, set `AGENT_BROWSER_ARGS="--no-sandbox"` in containers where Chrome reports no usable sandbox.

Watch out: default upload host `0x0.st` is public. Fine for marketing pages, wrong for customer data. Pass `--upload-url` or use the gist adapter.

Cost is one command. Value per effort is the highest in the set, because reviewers decide from two images.

### 8b. code-review-loop and large variant

Skills: `skills/code-review-loop/SKILL.md` and `skills/code-review-loop-large/SKILL.md`.

```mermaid
flowchart TD
    PUSH[Push branch] --> TRIG[Trigger Greptile: @greptile review]
    TRIG --> WAIT[Poll check or pipeline, up to ~10 min]
    WAIT --> FETCH[Fetch score + unresolved comments from body, comments, reviews]
    FETCH --> EXIT{5/5 and zero open?}
    EXIT -->|yes| DONE[Report and present PR URL]
    EXIT -->|no| FIX[Fix actionable comments in code]
    FIX --> RES[Resolve threads via API]
    RES --> COMMIT[Commit + push]
    COMMIT --> TRIG
```

Details:

- Inputs: PR/MR/CL number optional with auto-detect, `--max-iterations` default 10. Hitting the cap usually means the PR is too large, not that the loop needs more rounds.
- Platforms: GitHub via `gh`, GitLab via `glab`, Perforce via `p4` plus Swarm. Auto-detects remote, with `--vcs` override.
- Exit needs both 5/5 confidence and zero unresolved comments. Parse score patterns like `3/5` from the most recently updated Greptile source, and carry forward the Prompt to fix all with AI section even when inline endpoint returns zero.
- Each fix cycle: read file in context, fix actionable items, note false positives but still resolve, commit as `address greptile review feedback (code-review-loop iteration N)`, push, re-trigger.
- Use `code-review-loop-large` when Greptile refuses with too many files changed. It tags `@greptile-apps`, which bypasses the file-count limit. Descriptions overlap by design, so name the skill explicitly when the agent picks wrong.

Both need Greptile installed on the repo. Without it they have nothing to talk to. Cost is Greptile plus wall-clock review cycles. Value is boring issues fixed before a human reviews: naming, error handling, null checks, edge cases.

---

## 9. Triage, spec, and monitor

These three beats wrap the v2 core.

**Triage** (`skills/issue-triage/SKILL.md`) makes exactly one decision per incoming item: `implement`, `spec`, `duplicate`, `needs-info`, or `decline`. It searches memory and closed issues first, because two reporters describe one bug differently but paste the same error. `needs-info` asks for at most three specific facts, each with the reason it matters. The decision goes on the issue as a `factory:*` label plus one comment, and into the run record. Default tier: `fast`.

**Spec** (`skills/spec-writing/SKILL.md`) writes a product spec (problem, invariants, behavior, non-goals, acceptance checks that `test-evidence` can prove) and a tech spec (current and proposed shape in boundary/service terms, files touched, data and migration, risks, rollout). Open questions go at the top with a recommended answer each. The spec is a PR under `specs/`; code waits until a person approves it, and the approval is a `touch` in the ledger. Default tier: `frontier`.

**Monitor** (`skills/release-monitoring/SKILL.md`) takes one bounded look after merge: CI on the merge commit (`gh run list --commit`), the deploy status, the PR's own evidence rerun against the shipped build when that is cheap and read-only, and the error sources named in `AGENTS.md`. The result is `clean`, `regression`, `pending`, or `skipped` on the run record. A regression becomes one `factory:regression` issue, which goes back through triage. Without an agent, `factory-monitor.yml` does the CI half of this with plain `gh`.

---

## 10. The outer loop and the data plane

Everything lives in `.factory/`, committed to git, so every change to it is reviewed like code. Schemas are in `shared/schemas/`; `factory-setup/scripts/check-factory.mjs` validates the directory and exits 0 (valid), 1 (problems), or 2 (nothing to check, which CI treats as failure).

```text
.factory/
  config.json               switches per beat and loop; all off = v2 behavior
  runs/<id>.json            one per task (run-ledger)
  memory/<name>.md          one per fact, plus generated INDEX.md (agent-memory)
  routing.json              rules to tiers, tiers to models per harness (model-routing)
  friction-patterns.json    corrections to count, each owned by a skill (skill-feedback-loop)
  proposals/<date>-<key>.md loop proposals, with status for cooldowns and follow-up
  evals/                    routing eval tasks and results
  .cache/                   gitignored: signals quoting local transcripts
```

**Record** (`run-ledger`). `ledger.mjs start` creates the record (class, size, tier, branch), `beat` merges fields per beat, `touch` records each human correction or approval with a link, and `finish` sets the outcome and sums token usage from local Claude Code and Codex transcripts for this repo and time window. Claude Code repeats usage on every content block of a response, so usage is deduplicated by message id. With no transcript, cost stays `null`, never zero. `report` prints runs by outcome, class, and tier, median review rounds, touches per shipped run, evidence rates, and tokens per shipped run.

**Remember** (`agent-memory`). `memory.mjs add` refuses a memory without a source link, and refuses anything shaped like a known token format. It warns when a new memory repeats an existing one. `search` ranks by keyword, `use` counts a use and links it to the run, `prune` marks long-unused memories stale without deleting them, and `graduate` lists memories used three or more times, which belong in a skill. `INDEX.md` is generated; on a merge conflict you regenerate it, like a lockfile.

**Route** (`model-routing`). Rules match on beat, class, and size and name a tier; the first match wins. Tiers map to a model per harness in one table, so a model release edits one line. `route-eval.mjs` settles disputes: it runs each task k times per tier in throwaway worktrees, runs the task's `check:` command, and recommends the cheapest tier within a margin of the best pass rate. It never edits `routing.json`; that change is a reviewed PR with the result file as evidence.

**Improve** (`skill-feedback-loop`). `friction-report.mjs` counts user turns matching each pattern in `friction-patterns.json`, for this window and the one before, with short quotes. `collect-signals.mjs` adds the ledger (corrections by beat, runs shipped without evidence), human review comments on merged PRs grouped by skill, and memory graduation candidates. It then ranks: a key qualifies when it reached `min_occurrences`, is new or climbing, and its owner has no open proposal and is not in cooldown. The agent diagnoses, changes one skill, writes the proposal (signal, diagnosis, change, expected movement with baseline, rollback), and opens one PR. Later runs compare each merged proposal's key to its baseline and flag it for revert if the number did not drop in two windows.

Rules the loop keeps: one skill per PR, no rule without a friction key, vendored skill bodies are never edited, and nothing merges itself.

---

## 11. Mechanisms: plugin, hooks, CI

Where a rule kept failing as prose, v3 replaces it with something that runs.

| Mechanism | Replaces the rule | Where |
|---|---|---|
| `session-start.mjs` hook | "Read the memory index at task start" | `hooks/` |
| `guard-push.mjs` hook | "Never push to main; no plain `--force`" | `hooks/` |
| `stop-ledger.mjs` hook | "Finish the run record" (only after the ship beat) | `hooks/` |
| AGENTS.md budget and index check | "Keep AGENTS.md small and complete" | `scripts/lint-skills.mjs` |
| Friction ownership check | "Every rule names what it moves" | `scripts/lint-skills.mjs` |
| Shared-copy drift check | "Keep the copies in step" | `scripts/sync-shared.mjs --check` |

Hooks fail open: an error inside a hook exits 0 so a hook bug never blocks work. They are Claude Code only; every skill states what to do without them.

---

## 12. Cross-cutting: prose-cleanup

Skill: `skills/prose-cleanup/SKILL.md`.

Runs on commit messages, PR titles and bodies, docs, code comments, and closing replies, before commit, post, or send. Only on text you wrote or changed.

Four-step loop: scan for 31 patterns, rewrite with meaning kept, add voice, self-audit for what still looks machine-made. Patterns include puffery, filler, hedging, chatbot phrases, AI vocabulary like delve and leverage, em dash overuse, colon as connector, bold-label lists, emoji overuse, passive voice, rule of three, synonym cycling.

Cost is nothing, no tools. Frequency is highest, because it touches every human-readable line.

---

## 13. Supporting skills

| Skill | When to reach for it |
|---|---|
| `skill-authoring` | Writing a skill, or installed skill never fires. Almost always the description, not the body. |
| `package-release` | Cutting a version. Scoped publish needs `--access public`. Published versions cannot be republished. Renaming a skill folder is breaking. |
| `cross-platform-shell` | Command fails on Windows, or scripts must run on Linux, macOS, and Windows. PowerShell 5.1 traps, POSIX table, path and line-ending rules. Reason `.gitattributes` exists here. |

Quality gates: `node scripts/lint-skills.mjs`, `node scripts/sync-shared.mjs --check`, `node scripts/check-package.mjs`, `node scripts/run-node-tests.mjs`, `python -m pytest tests/ -q`, `npm pack --dry-run`. `npm test` runs them all. The linter, drift check, and package check run on `prepublishOnly`, so a broken skill cannot reach npm.

---

## 14. Install and wire-up

```mermaid
flowchart TD
    INST[npx skills add aditya-deokar/software-factory] --> WHERE{Where?}
    WHERE -->|own machine| GLOB[--global: Claude, Cursor, Copilot paths]
    WHERE -->|shared repo| PROJ[install in project + commit skills dirs]
    WHERE -->|edit skills| LOCAL[npx skills add local path --global, symlink edit]
    INST --> SETUP[factory-setup: .factory/ + AGENTS.md, optional workflows]
    PLUG[/plugin install software-factory/] --> SETUP
    SETUP --> FILL[Fill Commands, Invariants, Monitoring]
    FILL --> TASK[Run a task: triage to monitor]
```

Windows note: CLI symlinks by default and Windows blocks them without Developer Mode or elevated shell. Use `--copy` on failure. Copies need `npx skills update` to track changes.

Minimal `AGENTS.md` bottom section, from `docs/USAGE.md`:

- Install, dev server plus port, tests, typecheck, lint, with exact commands.
- Hard invariants: generated dirs, DB access path, input validation.
- Environment: Node and package manager versions, DB location and seed, env file source. Ask for secrets, do not invent them.

---

## 15. Full vs lite: when to run what

Full inner loop for: multiple agents on one repo, work another person reviews, UI work, long-lived codebases, anything with your name on it.

Lite path for: one-line typo, prototype you delete this week, solo work nobody reviews, repos without Greptile for the review skills specifically.

Rule from `docs/USAGE.md` and `docs/BENEFITS.md`: `AGENTS.md` describes the maximum, not the mandatory minimum. A process you resent is one you abandon.

---

## 16. Limits and honest tradeoffs

- Adds minutes per task: worktree setup, recording and encode, review cycles.
- Needs external tools you do not bundle: Node 18+, `gh` or `glab`, Greptile on the repo, FFmpeg with `libx264` and `ass` filter for recording, Playwright for headless, Chrome for visual-diff, Python 3.9+ for `record.py`. See `NOTICE.md:93-100`.
- Vendored skills drift from upstream. External tools change flags. Budget upkeep.
- A skill is instructions. An agent can read and still do otherwise. This raises the floor, not a guarantee. v3's hooks cover three rules mechanically, in Claude Code only.
- The ledger is only as complete as the agent's discipline in calling it. Token counts need local Claude Code or Codex transcripts; other harnesses record cost as unknown.
- Friction patterns are regexes. They misfire, which is why each ships with match and miss examples and the loop reads samples before acting.
- The outer loop needs two windows of data before its comparisons mean anything, and `route-eval.mjs` spends real tokens.
- `visual-diff` default upload is public. `code-review-loop` pair overlap in trigger text by design. Recorder does not support GNOME or KDE Wayland; wlroots needs `wf-recorder`.
- Licenses: root MIT covers original work, scripts, and docs. `code-review-loop`, `code-review-loop-large`, and `prose-cleanup` stay MIT with upstream files. `visual-diff` is PolyForm Shield 1.0.0, source-available not OSI open source, keep its LICENSE and do not build a competing screenshot product from it. See `NOTICE.md`.

---

## 17. File index for the video (v2)

These line references point at the v2 files the video was recorded against. Show these on screen in this order:

1. `README.md:24-34` - four beats table.
2. `AGENTS.md:10-26` - workflow the agent follows.
3. `skills/worktree-isolation/SKILL.md:49-104` - scope check plus setup.
4. `skills/service-layer/SKILL.md:44-64` - boundary versus service shape.
5. `skills/test-evidence/SKILL.md:32-54` - evidence table plus before-first rules.
6. `skills/test-evidence/scripts/record.py` - `doctor`, `start`, `annotate`, `stop`.
7. `skills/visual-diff/SKILL.md:56-78` - capture and markdown commands.
8. `skills/code-review-loop/SKILL.md:78-106` - trigger plus poll cycle.
9. `skills/prose-cleanup/SKILL.md:12-21` - cleanup loop.
10. `docs/USAGE.md:96-170` - task start to finish.
11. `docs/BENEFITS.md:15-26` - claim to artifact thesis.
