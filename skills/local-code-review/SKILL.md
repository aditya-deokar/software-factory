---
name: local-code-review
description: >
  Use when reviewing a pull request locally with Pi CLI without Greptile, when
  the repository lacks a paid Greptile bot, or when you want a strictly read-only
  code reviewer that posts structured Greptile-style PR reviews and ratings to GitHub.
license: MIT
compatibility: Requires git, gh (GitHub CLI) authenticated, and pi CLI installed. Optionally uses dev-loops for formal GitHub Pull Request Reviews.
metadata:
  author: software-factory
  version: "1.1"
allowed-tools: Bash(gh:*) Bash(git:*) Bash(pi:*) Bash(dev-loops:*) Bash(bash:*)
---

# Local code review

A strictly read-only, Greptile-style Pull Request code review agent executed locally on your machine using Pi CLI.

Unlike `code-review-loop` which requires a paid Greptile SaaS subscription, `local-code-review` runs entirely through your local `pi` environment (using your existing local OAuth session in `~/.pi/agent/auth.json`), requiring **zero paid subscriptions** and **zero API keys**.

It performs a **strictly read-only review**: it never modifies code, commits, or pushes. Your own coding agent or developer authors the code and pushes the PR, and `local-code-review` provides high-confidence review feedback, line-by-line annotations, ratings (`RATING: X/5`), and formal GitHub PR reviews.

## When to use

| Situation | Recommended skill |
|---|---|
| Repo has paid Greptile bot installed | `code-review-loop` or `code-review-loop-large` |
| Repo lacks Greptile, or zero-cost local review wanted | `local-code-review` |
| Your own agent writes/pushes code and needs Greptile-quality review | `local-code-review` |

## How it works

1. **Diff Extraction:** Captures the full PR diff (`gh pr diff`) and head commit SHA.
2. **Strictly Read-Only Reviewer:** Runs `pi --no-session --approve --tools read,grep,find,ls` with senior staff reviewer instructions. It is forbidden from modifying files.
3. **Structured Findings & Score:** Produces file/line annotations with severity (High/Med/Low) and ends with `RATING: X/5`.
4. **Formal GitHub Review:** Posts the review via `dev-loops gate upsert-verdict` (`verdict: clean` if 5/5, else `findings_present`) or `gh pr comment`.
5. **Developer Handoff:** Displays findings in the terminal for your coding agent to inspect and resolve. In `--watch` mode, it automatically re-reviews whenever your agent pushes a new commit.

See [architecture details](references/pi-review-architecture.md) for sequence flow.

## Execution

### Single Review Pass

To review the current PR or a specific PR number:

```bash
# Review current branch's PR:
SKILL_DIR="$(dirname "$(find . -name "local-code-review" -type d | head -n 1)")/local-code-review"
bash "$SKILL_DIR/scripts/run-review-loop.sh"

# Review a specific PR number:
bash "$SKILL_DIR/scripts/run-review-loop.sh" 42
```

### Watch Mode (Continuous Review Loop with Your Agent)

If your coding agent is iterating on the branch, run with `--watch` to automatically trigger a new review pass whenever your agent pushes a new commit to the PR branch:

```bash
bash "$SKILL_DIR/scripts/run-review-loop.sh" 42 --watch
```

## Integration with Factory Loop (Beat 6: Ship)

When completing Beat 6 (Ship) in repositories that do not have Greptile:
1. Your coding agent pushes the PR with before/after evidence.
2. Run `local-code-review` to inspect the PR and post review feedback.
3. Your coding agent addresses any findings and pushes updates.
4. Once `5/5` is reached, record the result in `.factory/runs/` via `run-ledger`:
   Run the ledger CLI:
   `beat current ship --set pr=<PR_NUMBER> --set final_score=5/5`
