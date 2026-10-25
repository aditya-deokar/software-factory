---
name: ambition-engine
description: >
  Raise a task's target before anyone builds it, using Felix Rieseberg's
  types of ambition: Altitude (the goal beyond the goal), Depth (the standard
  the field's best would hold, worked from raw data and checked by an outside
  judge), and Range (methods borrowed from other fields). Produces the aim:
  the rung this PR takes, a hard target, the judge that will prove it, and
  follow-up issues for the rungs above. Use when triage has decided implement
  or spec and before spec or build, when asked to "be more ambitious", "aim
  higher", "think bigger", "go deeper", "fix the cause, not the symptom", or
  "what would a top expert do here", or to rewrite a prompt at a higher level.
license: MIT
compatibility: >
  Plain markdown, any harness. Filing follow-up issues needs an authenticated
  gh CLI. Records the aim in run-ledger when the repo has .factory/. Depth and
  Range need real data and tools; without them the skill names what is
  missing instead of guessing.
metadata:
  author: software-factory
  version: "1.0"
  signals: "[aimed-low]"
  source: "https://felixrieseberg.com/how-to-be-more-ambitious-a-tutorial-for-humans-with-models/"
allowed-tools: Bash(gh issue *) Bash(node:*) Bash(git:*)
---

# Ambition engine

Most tasks get built at the size they were typed. "Fix the login crash" gets
one crash fixed. The same model could often have kept login crash-free, held
the fix to the standard of the best engineer in the field, and proved it with
something other than its own word. The factory already demands proof. This
beat decides, before any code exists, what that proof should prove.

The method is Felix Rieseberg's, from [How to be more ambitious: a tutorial
for humans with models](https://felixrieseberg.com/how-to-be-more-ambitious-a-tutorial-for-humans-with-models/).
This skill applies it to a task on its way to a PR.

Default tier: `frontier`, or `balanced` for small tasks (see `model-routing`).
Every later beat works toward the aim, and the aim itself is short.

## Where it runs

```text
triage ─► AIM ─► spec ─► isolate ─► build ─► prove ─► ship ─► monitor
            │                                  ▲
            ├── hard target + judge ───────────┘
            └── rungs above this PR ─► new issues ─► triage
```

Triage decides whether the work happens. Aim decides how high it reaches.
Spec writes the decision down. Skip this beat when `.factory/config.json`
sets `beats.aim` to `false`.

| Takes in | Hands on |
|---|---|
| Triage's decision (`implement` or `spec`), size, and acceptance check | The aim block (step 7), on the issue, the spec, and the PR |
| The issue, the code, and memory (`memory.mjs search`) | The judge, which `spec-writing` turns into acceptance checks and `test-evidence` measures |
| | One issue per rung above this PR, so it enters triage instead of this diff |

## Four rules

1. **Better, not bigger.** Raise the outcome, the standard, or the methods.
   Never the number of deliverables. A rung that adds features without making
   the result better is not a rung. The rule in `AGENTS.md` still holds: keep
   changes to the task. The `unrequested-scope` friction key counts the times
   this goes wrong, and `aimed-low` counts the opposite.
2. **The judge is outside you.** Name the check that decides success before
   writing code: a failing test that turns green, a benchmark, a reproduction,
   held-out data, a production metric. Your own reading of the diff does not
   count. A rung with no judge is a wish; step down one rung.
3. **Treat the hard target as reasonable, then report against it honestly.**
   Specific hard goals beat "do your best". A missed target reported with real
   numbers is a good result. A hit claimed without the judge is a false done.
4. **Raise the standard, not the permissions.** Ask first when the rung
   replaces what was asked instead of raising it, spends money, touches
   production data, or cannot be undone. That route goes through
   `spec-writing` and a person.

## Procedure

### 1. The goal beyond the goal

One line on what should be true after this ships that the issue does not
say. Ask what the reporter wants to happen next. "Fix the login crash" becomes
"people can always log in".

### 2. Pick the types that fit

The article names four types. The fourth, Speed (the same work, faster), is
how models already get used and needs no help here. Pick from the other
three. Most tasks need one or two.

| Type | Fits when | Skip when |
|---|---|---|
| Altitude | The task serves an outcome someone will measure | The work is its own end |
| Depth | The result should meet an expert's standard | Throwaway code, a prototype deleted this week |
| Range | It has to land with people, or the obvious approach has run dry | A narrow fix with one right answer |

### 3. Altitude: build the ladder

Three rungs, each more ambitious than the last. In a codebase they usually
take this shape:

| Rung | Shape | Login crash example |
|---|---|---|
| 1. The instance, done properly | What was reported, with a test that fails before and passes after | This crash, reproduced and fixed |
| 2. The class | Every instance of the same cause, fixed at the cause | Every crash with this stack signature in the crash reports |
| 3. The durable workflow | A check that stops the class coming back without anyone asking | Crash reports pulled each release, mapped to commits, reproduced, fixed, verified |

Rung 3 often needs setup first: access to the crash reports, a map from app
version to commit, machines to reproduce on. Name the setup as part of the
rung. It is often an issue of its own.

This PR takes the highest rung that fits triage's size and has a judge you
can run with the access you have now. Every rung above it becomes an issue
(step 8). Do not build it here.

Know the ceiling. "Make the product succeed" has no judge.

### 4. Depth: work like the field's best

Go one level below the task, to the raw data and the instruments. For the
rung you picked, answer Felix's prompt in writing:

> I want a deeper version of this task, not a bigger one. Before rewriting
> it: (1) say what a top professional in this field would do here that I'm
> not asking for; (2) name the rawest material they would start from instead
> of what has already been digested for me; (3) name the specific methods and
> tools they would use; (4) say what, other than you or me, would show the
> result is right. Then rewrite my prompt to ask for exactly that.

Then hold the work to it:

- **Raw material over summaries.** The stack trace and the core dump, not the
  bug report. The profiler trace, not "it feels slow". The query plan, not the
  ORM call.
- **Instruments over vocabulary.** A top performance engineer opens a trace
  and a flame graph. A top database engineer reads `EXPLAIN ANALYZE`. Use
  the tool. Borrowing the words alone changes nothing.
- **An unreasonable target, treated as reasonable.** Asked to get a
  10-second page under 5? Aim for 200 ms, and measure.
- **Test the belief.** If the issue names a cause, try to reproduce it from
  the raw data before building on it. Reporters are often wrong about why.

### 5. Range: borrow other fields

- **Verbs, not nouns.** An error message is not "a string". It is "telling a
  stressed person what happened and what to do next, in one line". The verbs
  point at fields that can help: a technical writer, a support lead.
- **Assemble the crew.** Who would you send if this had to be excellent? For
  a payments change: a security reviewer, an SRE, an accountant. For an
  onboarding screen: a copywriter, an accessibility specialist, a designer.
- **Do what they do, not how they talk.** The accessibility specialist runs a
  screen reader and a contrast checker. The SRE writes the alert and the
  runbook. If the harness runs subagents, give each field its own subagent
  with that field's method and tools. Role play changes the transcript, not
  the result.

### 6. Name the access

List the data, tools, and permissions the rung needs, each marked `have` or
`missing`. Missing access lowers the rung, or ends the task as
`BLOCKED: <access> - unblock: <one action>`. Never invent a dataset, a
benchmark, or a result to cover the gap.

### 7. Write the aim

Post it where the next beat will read it: as a comment on the issue, at the
top of the spec, and in the PR body under `## Aim`.

```markdown
## Aim

Goal beyond the goal: people can always log in.
Types: Altitude, Depth. Range skipped, one right answer.
Rung: 2 of 3. Every crash with this stack signature, fixed at the cause.
Target: zero login crashes in the next release's crash reports.
Judge: the reproduction test fails before and passes after; crash rate for the build in <tool>.
Access: crash reports (have), symbolicated builds (missing, #142).
Above this PR: #141, rung 3, keep login crash-free every release.
```

Size it to the task. A small fix gets the judge line and the rung, and that
is enough.

### 8. Hand on

| Situation | Next |
|---|---|
| The rung fits triage's decision | `spec-writing` if triage said spec, otherwise `worktree-isolation` |
| The rung is larger than triage's size, or cross-cutting | Re-route to `spec-writing`; the spec opens with the aim |
| The rung replaces what was asked | Ask the person first (rule 4) |
| Even rung 1 needs access you lack | `BLOCKED`, with the one action that unblocks it |

File each rung above this PR, so it reaches triage and not this diff:

```bash
gh issue create --title "<the rung in one line>" \
  --body "Raised by the aim on #<n>. Goal beyond the goal: <line>. Judge: <check>. Needs: <setup>."
```

## Recording it

On the run that recorded triage (`$LEDGER` as resolved in `run-ledger`):

```bash
node "$LEDGER" beat current aim --set rung=2 --set rungs=3 --add types=altitude --add types=depth \
  --set goal="people can always log in" --set target="zero login crashes next release" \
  --set judge="repro test, then crash rate for the build" --add follow_ups=github:issue/141
```

When a person says the aim was too high or too low, record it with
`touch current --beat aim --kind correction`. Those touches, with the
`aimed-low` and `unrequested-scope` friction keys, are how
`skill-feedback-loop` tunes this skill in both directions.

## Outside the factory

Asked to make a prompt or task more ambitious with no issue behind it
("rewrite this prompt", `/aim <task>`): run steps 1 to 6, then write the
rewritten prompt in one fenced block the person can copy, ending with the
judge and what counts as a pass. A prompt to improve stops there. A task to
do continues: name the rung in one line and start, under rule 4.

Ladders for common task shapes (slow page, flaky test, feature request,
dependency upgrade, docs, migration):
[references/ladders.md](references/ladders.md).

## Do not do these

- **Do not build the rungs above this PR.** They are issues.
- **Do not grade yourself.** "The code looks right" is not a judge.
- **Do not role-play an expert.** Use their instruments, or leave the field
  out.
- **Do not lower the target afterwards to match the result.** The aim records
  what you set out to do; the prove beat records what happened. Both stay.
- **Do not aim everything at everything.** All three types on a typo is
  noise. Most tasks need one or two.

## Why it works

Felix ends on self-efficacy: what people believe they can do shapes what they
do. Locke and Latham's review of decades of goal-setting research found that
specific, hard goals beat "do your best". George Dantzig solved two open
statistics problems because he thought they were homework. Once Roger
Bannister ran a four-minute mile, someone else did it 46 days later. Agents
behave the same way. Say the hard thing is reachable, give a judge that
cannot be argued with, and allow an honest miss.

Credit: Felix Rieseberg for the method. RoboNuggets'
[be-ambitious](https://github.com/robonuggets/be-ambitious) skill, built on
DannyMac180's earlier version, showed how to turn the article into steps.
