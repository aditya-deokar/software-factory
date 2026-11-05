---
name: local-code-review
description: >
  Use when reviewing a pull request locally with Pi CLI without Greptile, when
  the repository lacks a paid Greptile bot, or when running an autonomous
  two-agent review and self-healing loop directly from the terminal with zero API keys.
license: MIT
compatibility: Requires git, gh (GitHub CLI) authenticated, and pi CLI installed. Optionally uses dev-loops for formal GitHub Pull Request Reviews.
metadata:
  author: software-factory
  version: "1.0"
allowed-tools: Bash(gh:*) Bash(git:*) Bash(pi:*) Bash(dev-loops:*) Bash(bash:*)
---

# Local code review loop

An autonomous, Greptile-style Pull Request review and self-healing loop executed locally on your machine using Pi CLI.

Unlike `code-review-loop` which requires a paid Greptile SaaS subscription, `local-code-review` runs entirely through your local `pi` environment (using your existing local OAuth session in `~/.pi/agent/auth.json`), requiring **zero paid subscriptions** and **zero API keys**.

## When to use

| Situation | Recommended skill |
|---|---|
| Repo has paid Greptile bot installed | `code-review-loop` or `code-review-loop-large` |
| Repo lacks Greptile, or zero-cost local review wanted | `local-code-review` |
| Review large PRs locally with automatic repair | `local-code-review` |

## How it works

The skill enforces a strict two-agent separation:
1. **Agent 1 (Read-Only Reviewer):** Inspects the PR diff with read-only tools (`read`, `grep`, `find`, `ls`). Generates inline issue annotations and awards a score (`RATING: X/5`).
2. **Gatekeeper:** Parses `RATING: X/5`. If `5/5`, posts approval and exits cleanly. If `< 5/5`, hands findings to Agent 2.
3. **Agent 2 (Coding Agent):** Separate `pi` process with write tools (`read`, `edit`, `write`, `bash`). Resolves findings, commits, pushes to the PR branch, and resolves review comment threads.
4. **Loop:** Repeats until a clean `5/5` rating is achieved or max iterations (default: 5) are reached.

See [architecture details](references/pi-review-architecture.md) for sequence flow and safety guardrails.

## Execution

### Run against current PR

To run the review loop against the current branch's PR:

```bash
# Locate the skill directory and execute the orchestrator
SKILL_DIR="$(dirname "$(find . -name "local-code-review" -type d | head -n 1)")/local-code-review"
bash "$SKILL_DIR/scripts/run-review-loop.sh"
```

### Run against a specific PR number

```bash
# Execute against a specific PR number (e.g. PR #42)
SKILL_DIR="$(dirname "$(find . -name "local-code-review" -type d | head -n 1)")/local-code-review"
bash "$SKILL_DIR/scripts/run-review-loop.sh" 42
```

### Optional environment overrides

- `MAX_LOOPS=3`: Limits maximum repair cycles (default: 5).
- If `dev-loops` is installed (`npm i -g dev-loops` or `pi install npm:dev-loops`), reviews are posted as official GitHub Pull Request Reviews (`COMMENTED` state with clean vs findings verdict). If not present, falls back to `gh pr comment`.

## Integration with Factory Loop (Beat 6: Ship)

When completing Beat 6 (Ship) in repositories that do not have Greptile:
1. Open the PR with before/after evidence in the description.
2. Run `local-code-review` to reach `5/5`.
3. Record the review rounds in `.factory/runs/` via `run-ledger`:
   Run the ledger CLI to record the beat:
   `beat current ship --set pr=<PR_NUMBER> --set review_rounds=<ROUNDS> --set final_score=5/5`
