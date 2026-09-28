# Software Factory - Video Script

Simple English script for a 10-12 minute explainer video.
It follows the reference script you shared, but every step points to your real code.

How to use this file:

- Read it as-is on camera. Sentences are short on purpose.
- Text in [BRACKETS] is an on-screen cue, not spoken.
- File paths are real. Show them when mentioned.

---

## 0:00 - Hook: what is a software factory?

What is a software factory? And why is everyone talking about it?

Here is the simple idea.

Think of a real factory. A car factory has stations. One station builds the frame. The next adds the engine. The next checks quality. The last ships the car.

A software factory is the same, but for code.

Instead of building cars, you build apps. Instead of workers, you use AI agents. And instead of hope, you have a fixed line: isolate, build, prove, ship.

That is why it is going viral. Anyone can ask AI to write code. But most AI code is messy. It breaks. No one can review it. A factory fixes that. It gives speed without losing quality.

Today I will show you my own software factory. By the end, you can set up yours.

[SHOW: README.md title + four beats table]

## 0:45 - What you will learn

In this video you will learn four things.

One, what a software factory is.
Two, why it matters now.
Three, how mine works, step by step.
Four, how to copy it into your project in two minutes.

No new product to buy. No special model. It works with Claude Code, Cursor, Codex, Copilot, and more.

Let us start.

## 1:30 - It is not a product. It is a workflow.

First, one big point.

A software factory is not a product. It is not a model. It is not one app.

It is just a workflow plus a few markdown files.

In my repo, the workflow lives in one file: `AGENTS.md`.

[SHOW: AGENTS.md lines 10-26]

That file says: every task goes through the same four beats.

Beat one is isolate. Beat two is build. Beat three is prove. Beat four is ship.

Each beat has a skill behind it. A skill is just a folder with a `SKILL.md` file that tells the agent what to do and when.

My repo has ten skills. But you only need four for the main line.

[SHOW: skills/ folder with 10 names]

Install is one command:

```bash
npx skills add aditya-deokar/software-factory
```

And then you copy `AGENTS.md` into your project. That is it. Now your agent knows the factory.

## 3:00 - Step 1: Isolate - give each task its own room

Step one is isolate. Skill name: `worktree-isolation`.

[SHOW: skills/worktree-isolation/SKILL.md]

The problem is simple. Most people run all agents on `main`. One agent fixes login. Another changes the landing page. They step on each other. Files get deleted. Work is lost.

It is like two teams building in the same small room.

Isolate fixes this. Every new task gets a fresh copy of the code. In git, this is called a worktree plus a branch.

The command looks like this:

```bash
git fetch origin
git worktree add ../wt/fix-login-4f2a -b agent/fix-login-4f2a origin/main
```

Now each agent has its own room. Three agents can work at the same time. No conflict.

There is one more smart part. Before it starts, the agent checks open PRs.

```bash
gh pr list --state open
gh pr diff <number> --name-only
```

If someone is already editing the same file, the agent stops and asks you. This saves a painful merge later. Thirty seconds now saves one hour later.

And a warning from my code: a worktree splits files, not everything. Ports, databases, and lockfiles are still shared. So we check ports and never hand-merge lockfiles. That is written in the skill.

When the PR merges, we delete the copy. Clean room, clean end.

So beat one means: one task, one branch, one folder. Always.

## 4:45 - Step 2: Build - clean code, not just working code

Step two is build. Skill name: `service-layer`.

[SHOW: skills/service-layer/SKILL.md]

AI is good at making code that runs. It is bad at making code that lasts. Logic gets copied in three places. You fix a bug in one place, but it is still alive in the other two.

This skill stops that with one simple rule. Ask two questions.

One: will this change if product rules change? If yes, it goes in the boundary. That is the route handler. Who can do it, when, what error the user sees.

Two: will this change if the vendor changes? If yes, it goes in the service. That is retry, SDK calls, timeouts, payload shape.

Boundary decides what and when. Service does how.

[SHOW: Boundary vs Service table from skill]

A service takes everything as input. It returns a clear result. It never touches user session or database directly. Example from my skill: `putObject()` for uploads. It checks size, calls storage, returns `{ ok: true }` or `{ ok: false, reason }`. The route handler then decides what message to show.

And we do not over-build. One caller means keep it inline. Two callers means extract. Throwaway script means skip this skill. That rule is in the skill too.

Result: a new developer, or a new agent with no context, can read the code fast. And one fix in the service fixes all callers at once.

So beat two means: working code is not enough. It must be placed right.

## 6:15 - Step 3: Prove - do not trust, show proof

Step three is prove. Skill name: `test-evidence`.

[SHOW: skills/test-evidence/SKILL.md + skills/test-evidence/scripts/record.py]

Agents love to say: I tested it, it works. You cannot check that sentence. So we replace words with proof.

The rule is: before you open a PR, you must attach an artifact.

What artifact depends on the change:

- UI change: a short video of you testing it, 60 to 90 seconds.
- Visual only: before and after screenshots, same size.
- Bug fix: first record the bug, then record the fix with the same steps.
- Speed fix: numbers before and after, same machine.
- API or CLI: request and response, before and after.

The key trick: capture before first. While the bug still exists. After you fix it, the old state is gone. It is costly to bring back. So record before, then fix, then record after.

For UI, my repo ships a recorder:

```bash
python skills/test-evidence/scripts/record.py doctor
python skills/test-evidence/scripts/record.py start --label "Cart totals with tax"
python skills/test-evidence/scripts/record.py annotate "NY tax shows 4.44" --kind pass
python skills/test-evidence/scripts/record.py stop
```

You get `evidence.mp4` with notes burned in, plus `report.md` and `manifest.json`.

No screen? Use Playwright screenshots. No UI at all? Use numbers and output diffs. But never skip with just trust me.

And be honest in the PR: what you tested, and what you did NOT test. That Risks section builds trust.

So beat three means: no claim without proof.

## 8:00 - Step 4: Ship - before/after + review to 5/5

Step four is ship. Two skills: `visual-diff` and `code-review-loop`.

First, `visual-diff`.

[SHOW: skills/visual-diff/SKILL.md]

It turns two pages or two images into a clean table for your PR:

```bash
visual-diff http://localhost:3000/pricing https://myapp.com/pricing --markdown
```

You paste that table in the PR body. A reviewer sees before and after in two seconds. No need to read 200 lines to know if the UI is right. Note: default upload is public, so use a private upload for customer data.

Second, `code-review-loop`.

[SHOW: skills/code-review-loop/SKILL.md]

This uses Greptile, an AI code reviewer. The loop is simple:

1. Push and ask Greptile to review.
2. Read score and comments.
3. Fix real issues, push again.
4. Repeat until 5/5 with zero open comments. Max 10 rounds.

If the PR is huge and Greptile says too many files, use the sister skill `code-review-loop-large`. It tags `@greptile-apps` to force a review.

This is like a senior engineer checking the work before a human does. Naming, null checks, edge cases get fixed early. You spend your time on design, not typos.

Plus one small skill runs everywhere: `prose-cleanup`. It cleans commit messages and PR text. No AI filler. Clear and human.

So beat four means: show the change, then earn a 5/5 before merge.

## 9:45 - The full line + how to start today

Let us put it together.

Think of the factory line again.

Isolate is the station. Each order gets its own space.
Build is the assembly line. Code goes in the right place.
Prove is quality check. Show video or numbers.
Ship is packing and exit. Before/after table plus 5/5 review.

If review fails, the item goes back to build. Fix, prove again, ship again. Loop until clean. Then merge. That loop is the factory.

And here is the honest part from my docs. This adds minutes per task. Worktree setup, recording, review loop, all cost time. Use the full line for real work: parallel agents, UI work, code others will review, code that must live long.

One-line typo? Just fix and commit. Do not run a factory to change one word.

To start today, do two steps:

```bash
npx skills add aditya-deokar/software-factory --global
cp AGENTS.md your-project/AGENTS.md
```

Then fill the bottom of `AGENTS.md`: install command, test command, lint, ports, DB. Vague docs give vague work. Write exact commands.

Full guide is in `docs/USAGE.md`. Honest tradeoffs are in `docs/BENEFITS.md`. Deep diagrams are in `docs/how-it-works.md`.

## 10:45 - Close

So that is a software factory.

Not magic. Not a new tool. Just isolate, build, prove, ship, every time, with proof attached.

Set it once. Reuse it on every app. Ship fast, keep quality, let agents work in parallel without fear.

Links are in the description. Try it, build something, and show me what you shipped. See you in the next one.
