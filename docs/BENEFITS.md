# What this is actually worth

An honest accounting of where these skills pay off, where they cost more than
they return, and what publishing them gets you.

## The problem they solve

An agent finishes a task and reports: "I've implemented the fix and tested it
thoroughly. Everything works as expected."

You cannot check any part of that sentence. Not what it implemented, not what
tested means, not what expected was. So you read the whole diff yourself, which
is most of the work you were trying to delegate.

Every skill here converts one unverifiable claim into an artifact.

| Claim | Artifact |
|---|---|
| "I tested it" | A recording of the test being performed, annotated |
| "The UI looks right" | A before/after image pair in the PR body |
| "It's clean code" | A 5/5 review score with zero unresolved comments |
| "I didn't break anything" | A branch that could not touch anyone else's work |
| "It's faster now" | A measured before and after number |

That is the whole thesis. The four-beat workflow is a delivery mechanism for
it.

## Per skill

### worktree-isolation

**Costs** about 30 seconds per task.

**Returns** the ability to run more than one agent at once. Without worktree
isolation, two agents in one checkout produce interleaved edits and a
conflicted branch nobody can untangle. With it they cannot see each other.

The underrated part is the scope check. Reading open PRs' changed files before
starting catches the conflict while it is still hypothetical. The alternative
is discovering it at merge, after both branches are finished.

**Skip it** when you work alone in one session and never run parallel agents.
The overhead is real and the benefit is not.

### service-layer

**Costs** some judgment calls and occasional argument about where a function
belongs.

**Returns** one fix instead of N. The failure it prevents is specific: the same
operational logic copy-pasted into three route handlers, a bug found in one,
fixed in one, and still live in the other two. That bug class is invisible
until a customer finds it.

The skill is careful to say when *not* to extract. Logic with one caller stays
put. An over-abstracted service layer is worse than duplication because it
hides control flow behind indirection that pays for nothing.

**Skip it** on prototypes and scripts. Structure is a bet that code will be
changed repeatedly, and throwaway code never collects on that bet.

### test-evidence

The expensive one and the valuable one.

**Costs** real minutes per task: recorder setup, driving the app by hand, the
encode on stop. Plus FFmpeg with the right build flags, which is a one-time
fight you will have exactly once.

**Returns** the only thing that makes agent work reviewable at a glance. A
90-second annotated video of the feature working is faster to check than a
200-line diff, and it shows behaviour the diff cannot. It is also the only
artifact here that survives the conversation. Six months later the PR still
has the video.

The instruction to capture *before* while reproducing the bug is worth more
than the tooling. That state is free to capture right then and expensive to
reconstruct after the fix, and almost nobody does it in the right order the
first time.

**Skip it** for changes with no observable surface. Though note the skill says
non-UI changes still need evidence, just different evidence: a measured
latency delta, a diff of command output, a transcript excerpt.

### visual-diff

**Costs** one command.

**Returns** the highest ratio in the set. A `| Before | After |` table in a PR
body changes review speed more than any amount of prose describing the change.
Reviewers look at two images and know immediately whether it is right.

**Watch out** for the default upload host. 0x0.st is public and unauthenticated.
Fine for a landing page, wrong for a screen with a customer record on it.

### code-review-loop and code-review-loop-large

**Costs** Greptile (a paid service on most plans) and whatever the review cycles
take in wall clock time.

**Returns** the boring review comments handled before a human sees the PR.
Naming, error handling, missing null checks, forgotten edge cases. Your
reviewer spends their attention on whether the approach is right instead of
whether you handled an empty array.

The iteration cap matters. Default 10, and hitting it usually means the PR is
too large, not that the loop needs more rounds.

**Skip them** if you do not have Greptile. Neither skill degrades gracefully;
without the service they have nothing to talk to.

### prose-cleanup

**Costs** nothing. No tools, no runtime.

**Returns** the highest-frequency benefit here, because it applies to every
commit message, PR body, doc edit, and comment you and your agent write. Text
that reads machine-made makes readers trust the work less, whether or not that
is fair.

The 31 patterns are specific enough to be checkable rather than aspirational.
"Avoid em dashes" is a rule. "Write clearly" is not.

### skill-authoring

**Returns** the answer to the question that wastes the most time in this space:
why is my skill not firing? Nearly always the description, because the agent
never reads the body until the description convinces it to.

Directly relevant to you now that you maintain an eighteen-skill package.

### package-release

**Returns** the npm facts that are expensive to learn by making the mistake.
Scoped packages need `--access public` or the first publish fails with an error
that reads like a billing problem. A published version can never be
republished. Renaming a skill folder is a breaking change even though it looks
cosmetic.

### cross-platform-shell

**Returns** the difference between a repo that works on your machine and one
that works on everyone's. Most agent skills are written on macOS and assume
bash, coreutils, and forward slashes.

Concretely relevant to you: you are on Windows 11, and half the skills in this
package assume POSIX. The `.gitattributes` file in this repo exists because of
this skill, and it prevents the `bad interpreter: /bin/sh^M` failure that hits
every cross-platform repo without one.

## The v3 skills

These pay off later than the v2 ones. A worktree helps on the first task. A
ledger helps once it has a few weeks of runs in it.

### issue-triage

**Returns** fewer wrong PRs. A vague issue that goes straight to code comes
back as the wrong change; a duplicate fixed twice costs both. Triage is also
the cheapest step to run on a small model.

**Costs** a few minutes per issue, and a triage label nobody reads is wasted.
Worth it once issues arrive faster than one person reads them.

### spec-writing

**Returns** misunderstandings caught in a two-page document instead of a
finished implementation. The open-questions-at-the-top format turns review
into "1 yes, 2 no".

**Costs** a round trip with a human before code starts. Wrong for anything
unambiguous; triage decides which tasks need one.

### release-monitoring

**Returns** regressions found by the factory instead of by users, and a
regression issue already linked to the PR that caused it.

**Costs** little with no deploy or error tracker to check, and it tells less
there too: CI on the merge commit is then the whole check.

### run-ledger

**Returns** numbers. Review rounds by class of work, how often a person had
to correct the agent and at which beat, tokens per shipped PR. Without these,
"is the factory working?" is an opinion.

**Costs** a few commands per task, and it only measures what agents record.
The Stop hook catches the most common gap (a shipped run left open) in Claude
Code only.

### agent-memory

**Returns** root causes not rediscovered, and corrections not repeated. Each
memory is reviewed in a PR, so a wrong fact does not spread quietly.

**Costs** discipline about what not to save. A memory folder full of task
logs is noise that every task pays to read. The index budget and `prune`
keep it honest.

### model-routing

**Returns** the biggest cost lever in the factory: triage, docs, and small
fixes on a fast model, specs and migrations on a frontier one.

**Costs** an eval before any rule change you want to trust, and evals spend
real tokens. Without evals, routing is a documented guess, which still beats
an undocumented one.

### skill-feedback-loop

**Returns** skills that improve from how they fail, through PRs a person can
reject. The follow-up check flags a change that did not help, so the skills
do not collect dead rules.

**Costs** weeks of data before it says anything, and local transcripts for
its best signal. Regex patterns misfire; reading the samples is part of the
job.

### factory-setup

**Returns** a working `.factory/` and `AGENTS.md` in one command, and a
validator for CI.

**Costs** nothing to run. The workflow templates cost API credits once
enabled.

## What publishing gets you

**A canonical copy.** One `npx skills add` and any machine has your setup. No
copying folders between projects, no wondering which version is current.

**Version history.** Right now, changing a skill means editing a file and
hoping you remember why. With releases you get a changelog, tags, and the
ability to pin a working version when a change breaks something.

**CI that catches your mistakes.** The linter and the three-OS discovery check
run on every push. A skill with broken YAML is invisible to the agent with no
error message anywhere. That failure mode is why the linter exists.

**A public artifact.** An eighteen-skill package with CI, licensing done properly,
and real documentation is a better demonstration of how you work than a resume
bullet. It shows an opinion about how software gets shipped, backed by tooling.

**Contributions, maybe.** Public repos occasionally get issues and PRs from
people who hit the same problem. Do not count on it. Most skills repos get
installs and silence.

## What it does not get you

**Not a large audience by default.** skills.sh ranks by install count and there
is no submit form. Discovery comes from people actually using it and telling
others. Publishing is necessary for reach; it is not sufficient.

**Not a maintenance-free package.** The skills drive external tools, and those
tools change flags. `compatibility` fields go stale. Vendored skills drift from
upstream. Budget an hour a quarter or it rots.

**Not agent-proof.** A skill is instructions. An agent can read them and still
do something else. These raise the floor; they do not guarantee an outcome.

## Where it pays off, ranked

1. **Multiple agents, one repo.** `worktree-isolation` is close to mandatory here. The
   alternative fails badly.
2. **Work another person reviews.** Evidence and before/after tables change
   review from an audit into a check.
3. **UI work.** Screenshots and recordings communicate what a diff cannot.
4. **Long-lived codebases.** `service-layer` is a bet on repeated change, and
   long-lived code collects.
5. **Anything with your name on it.** `prose-cleanup` on every commit message and PR.

## Where it costs more than it returns

- One-line typo fixes. Go straight to commit.
- Prototypes you will delete this week.
- Solo work nobody reviews, where evidence has no audience.
- Repos without Greptile, for the two code-review-loop skills specifically.

A process you resent is a process you abandon. Run the full inner loop on work
that deserves it and skip to the useful skill otherwise. `AGENTS.md` describes
the maximum, not the mandatory minimum.
