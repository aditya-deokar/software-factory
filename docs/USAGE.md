# Using these skills in your projects

Written for the person who owns this repo and wants the skills working in real
work, not just published.

## Install once, globally

You wrote these for yourself. Put them where every project sees them.

```bash
npx skills add aditya-deokar/software-factory --global
```

That lands in `~/.claude/skills/` for Claude Code, `~/.cursor/skills/` for
Cursor, and the equivalent for whichever agents the CLI detects on your
machine. On Windows the global path is `C:\Users\adity\.claude\skills\`.

Windows symlink note: the CLI symlinks by default, and Windows blocks symlink
creation unless Developer Mode is on or the shell is elevated. If the install
errors, use `--copy`. Copies are independent, so `npx skills update` matters
more when you go that route.

```bash
npx skills add aditya-deokar/software-factory --global --copy
```

### Or per project, committed

When a team should get the same skills automatically, install without
`--global` and commit the result.

```bash
cd your-project
npx skills add aditya-deokar/software-factory
git add .claude/skills .agents/skills
git commit -m "Add Software Factory skills"
```

Now anyone who clones the repo gets them. This is the better choice for a
shared project. Global is the better choice for your own machine.

### While developing the skills themselves

Point the CLI at the local folder so edits take effect without a round trip
through GitHub.

```bash
npx skills add "C:\Users\adity\Documents\Software Factory" --global
```

Symlink mode means editing `skills/prose-cleanup/SKILL.md` changes the installed skill
immediately.

## Wire up the workflow

Installing the skills gives your agent eighteen capabilities it can reach for.
`AGENTS.md` tells it when to reach for which, in what order, and `.factory/`
gives the outer loop somewhere to keep its data. That second part is where the
value is.

Let `factory-setup` do it. Ask the agent to "set up the factory", or run it
yourself and read the plan first:

```bash
node .claude/skills/factory-setup/scripts/setup.mjs --dry-run
node .claude/skills/factory-setup/scripts/setup.mjs
```

It creates `.factory/` and writes `AGENTS.md` (or appends a marked section to
yours). It never overwrites a file, so rerunning it is safe. Add `--workflows`
for the GitHub Actions templates, and read them before committing; the agent
steps spend API credits.

Then fill in the repo-specific sections at the bottom. The template leaves
placeholders because an agent that cannot run your tests cannot prove anything.
At minimum:

```markdown
## Commands and checks

- Install: `pnpm install`
- Dev server: `pnpm dev` (port 3000)
- Tests: `pnpm test`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`

Run typecheck, lint, and tests before every commit.

## Hard invariants

- Never commit anything under `src/generated/`. It is built.
- All database access goes through `src/services/db.ts`. No raw queries in
  route handlers.
- API routes validate input with zod before touching the service layer.

## Environment

- Node 20, pnpm 9
- Postgres on 5432, seeded with `pnpm db:seed`
- `.env.local` from `.env.example`. Ask for secrets; do not invent them.
```

Vague entries here produce vague work. "Run the tests" is useless. `pnpm test`
is actionable.

## A task, start to finish

What the inner loop looks like in practice. v3 adds a triage step before the
v2 beats and a monitor step after them, and the ledger records each one.

### 0. Triage, and a spec when needed

An issue arrives. `issue-triage` searches memory and closed issues, then makes
one decision. "Implement" moves straight on. "Spec" sends it to
`spec-writing`, which opens `specs/<slug>.md` as a PR with the open questions
at the top, and waits for you to approve it. Say "approved" or approve the
PR; that approval lands in the run record.

The agent routes the task and starts a run:

```bash
node <skills>/model-routing/scripts/route.mjs --beat build --class bugfix --size small
node <skills>/run-ledger/scripts/ledger.mjs start --class bugfix --size small --tier fast --rule chore-small
```

### 1. Isolate

You ask for a fix. Before writing code the agent runs `worktree-isolation`: fetches
origin, checks open PRs for overlapping files, and creates a worktree on a
branch off `origin/main`.

The scope check is the part people underrate. If PR #12 is already editing
`src/services/auth.ts` and your task needs the same file, the agent stops and
asks instead of building a conflict you resolve later.

In Claude Code the harness manages worktrees itself, so the skill skips the
manual `git worktree add` and keeps the harness-assigned branch. That delta is
written into the skill.

### 2. Build

`service-layer` fires when the agent notices the same operational logic in two
places. It pushes toward one split: actions own the why and when, services own
the how.

The practical payoff is that a bug fixed in the service layer is fixed in every
flow that calls it. When the same logic is copy-pasted across three route
handlers, you fix it three times and forget the third.

The skill is deliberately conservative about extraction. Logic used by exactly
one caller stays where it is. Premature service extraction is its own mess.

### 3. Prove

`test-evidence` is the beat that changes what you get. The agent
starts the recorder, drives the app through each test case by hand via computer
use, annotates assertions as it goes, and stops the recorder. Out comes
`evidence.mp4` with annotations burned in, a `report.md`, and a `manifest.json`.

Capture the before state *while reproducing the bug*, before fixing it. That is
the only moment it is cheap. After the fix, reproducing the old behaviour means
stashing your work.

Environments without a GUI fall back to scripted Playwright screenshots.
Changes with no visible surface still produce evidence, as measured numbers or
output pairs. A performance fix gets a before and after timing, not a claim
that it is faster.

The recorder needs Python 3 and FFmpeg with `libx264` and the `ass` filter.
Check before you rely on it:

```bash
python skills/test-evidence/scripts/record.py doctor
```

On Windows it uses `gdigrab` and needs no extra permissions. macOS needs Screen
Recording permission granted to the terminal.

### 4. Ship

`visual-diff` turns two URLs or two PNGs into a markdown table and uploads
the images.

```bash
visual-diff http://localhost:3000/pricing https://myapp.com/pricing --markdown
```

Default upload host is 0x0.st, which is public. Fine for a marketing page,
wrong for anything with customer data on screen. Pass `--upload-url` or switch
to the gist adapter for those.

Then `code-review-loop` runs the review cycle: trigger Greptile, fix actionable
comments, resolve threads, push, repeat until 5/5 with zero unresolved
comments, capped at `--max-iterations` (default 10). On a PR too large for
Greptile's file limit, `code-review-loop-large` does the same thing through a different
trigger.

Both need Greptile installed on the repo. Without it neither skill has anything
to talk to.

The PR body carries a `Run:` line pointing at the run record, and "Memories
used / written" lines, so a reviewer can see what memory did.

### 5. Monitor

After you merge, `release-monitoring` checks CI on the merge commit, the
deploy, and whatever error sources your `AGENTS.md` names, then records
`clean` or opens a `factory:regression` issue that goes back to triage.

## Running the outer loop

Once a week, or when agents keep making the same mistake:

```bash
node <skills>/run-ledger/scripts/ledger.mjs report --since 14d
node <skills>/skill-feedback-loop/scripts/friction-report.mjs --since 14d
```

Or ask for "the factory report" (`/factory-report` in the plugin). To let the
loop act, ask it to "run the loop" (`/factory-loop`). It opens at most one PR,
labeled `factory:skill-loop`, that changes one skill and says which number it
should move. Review it like code; `skill-authoring` has the checklist.

The loop needs two things before it is useful: two windows of run records,
and local transcripts. On a machine that never ran Claude Code or Codex in
this repo, the friction report exits 2 and says so.

## Using single skills without the workflow

Most of these stand alone.

**`prose-cleanup` on a commit message or PR body.** The one with the highest
frequency. It catches em dashes, "delve", "leverage", bold-label lists, and the
other 27 tells.

```bash
npx skills use aditya-deokar/software-factory@prose-cleanup | claude
```

**`cross-platform-shell` when a command fails.** "is not recognized as the name of a
cmdlet" usually means a bash one-liner hit PowerShell. The skill has the
translation table and the 5.1 traps, including that `&&` is a parser error, not
a runtime one.

**`skill-authoring` when writing a skill.** Also the right thing to read when a
skill is installed but never fires. That is nearly always the description, not
the body.

**`package-release` when publishing.** Semver rules for skills, the pre-publish
audit, and what rollback means when npm will not let you republish a version.

## Keeping them current

```bash
npx skills update                    # everything
npx skills update prose-cleanup             # one skill
npx skills list                      # what is installed and where
npx skills remove <name>             # drop one
```

Symlinked installs track the source automatically. Copied installs need
`update` to pull changes, which is the tradeoff for `--copy`.

## When things do not work

**A skill never fires.** Confirm it is installed with `npx skills list`. If it
is there, the description is the problem: it probably describes what the skill
does instead of naming the situation that triggers it. `skill-authoring` has the
debugging order.

**Two skills fight.** `code-review-loop` and `code-review-loop-large` have 80% description
overlap by design, since they are variants of one loop. If the agent picks the
wrong one, name it explicitly. The linter flags any new pair that overlaps this
much, which is usually a mistake rather than a design choice.

**Install fails on Windows.** Symlinks. Use `--copy` or enable Developer Mode.

**`visual-diff` cannot find its scripts.** Older versions told the agent to
run `./scripts/upload-and-copy.sh`, which resolves against your project instead
of the skill folder. Fixed here; the skill resolves its own directory first.

**Chrome fails with "No usable sandbox".** Containers and VMs.

```bash
export AGENT_BROWSER_ARGS="--no-sandbox"
```

**The recorder produces nothing.** Run `record.py doctor`. It names the missing
piece rather than making you guess. Missing `libx264` or the `ass` filter is the
usual answer, and the fix is a different FFmpeg build, not a flag.

## What to expect honestly

The workflow adds real time per task. The worktree setup, the
recording, the review loop: each costs minutes. It pays off on work that gets
reviewed by someone else, touches a UI, or runs in parallel with other agents.

The outer loop costs little per task (a few ledger calls) but needs weeks of
data before it says anything you can trust. Start with the ledger alone, and
switch the rest on in `.factory/config.json` once there are numbers to read.

For a one-line typo fix in a README, skip to `prose-cleanup` and commit. Running the
full workflow on trivial changes is how a good process becomes something you
resent and then abandon.
