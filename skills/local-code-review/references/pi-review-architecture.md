# Local Pi Code Review Architecture

This reference explains the autonomous dual-agent review and self-healing engine executed locally through the Pi CLI.

---

## 1. Why Local Pi Review?

Traditional factory code review (`skills/code-review-loop`) relies on **Greptile**, an external commercial SaaS bot installed on GitHub/GitLab. When:
- A repository lacks a paid Greptile plan
- Team members work on private internal repositories without third-party bot access
- Cloud CI token or API key budget is zero
- Developers want instant offline/local reviews on their workstation

`local-code-review` runs directly on the developer's workstation using the installed `pi` CLI. It leverages existing local authentication (`~/.pi/agent/auth.json` or local Gemini/Antigravity sessions), requiring **zero API keys** and **zero paid SaaS subscriptions**.

---

## 2. Dual-Agent Separation

To guarantee integrity and prevent hallucinated self-approvals, the system strictly isolates the reviewer from the code modifier:

```
                  ┌───────────────────────────────┐
                  │       PR Git Diff (.diff)     │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │    Agent 1: Reviewer (pi)     │
                  │   --tools read,grep,find,ls   │  (Strictly Read-Only)
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │       Gatekeeper Check        │
                  │     Parse "RATING: X/5"       │
                  └──────────────┬────────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │ Score == 5/5                  │ Score < 5/5
                 ▼                               ▼
      ┌─────────────────────┐      ┌───────────────────────────────┐
      │  dev-loops gate     │      │     Agent 2: Coder (pi)       │
      │  upsert-verdict     │      │   --tools read,edit,write,    │
      │  (verdict: clean)   │      │           bash                │
      │  Exit 0             │      └──────────────┬────────────────┘
      └─────────────────────┘                     │
                                                  ▼
                                   ┌───────────────────────────────┐
                                   │ git add -A && git commit      │
                                   │ git push                      │
                                   │ dev-loops reply-resolve       │
                                   └──────────────┬────────────────┘
                                                  │
                                                  ▼
                                       (Next Pass / Re-review)
```

### Agent 1: The Read-Only Reviewer
- Invocation: `pi --no-session --approve --tools read,grep,find,ls --append-system-prompt ...`
- Scope: Deep inspection of security vulnerabilities, secret leaks, null pointer crashes, division by zero, and unhandled exceptions.
- Output: Structured markdown with `- [File: path:line] (Severity: High|Medium|Low)` annotations and a strict terminal rating line: `RATING: X/5`.

### Gatekeeper & dev-loops Bridge
- Extracts the integer score `X` from `RATING: X/5`.
- If `dev-loops` is installed, calls `dev-loops gate upsert-verdict` to post a formal GitHub Pull Request Review (`findings_present` vs `clean`).
- If `dev-loops` is absent, cleanly falls back to `gh pr comment`.

### Agent 2: The Coding Agent
- Invocation: `pi --no-session --approve --tools read,edit,write,bash --append-system-prompt ...`
- Scope: Fixes the flagged vulnerabilities, runs local test suites, formats code, and leaves the repository in a clean state.
- Guardrails: If `git status --porcelain` is empty, aborts immediately to prevent infinite loops.
- Thread Resolution: Calls `dev-loops gate reply-resolve --fix-commit <SHA>` to automatically resolve review comment threads.
