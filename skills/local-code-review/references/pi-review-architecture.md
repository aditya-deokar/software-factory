# Local Pi Code Review Architecture

## Overview

The `local-code-review` skill provides an autonomous, strictly read-only code review engine using the local Pi CLI. It replicates Greptile's PR review methodology without needing paid third-party bots or API keys.

```
                    ┌───────────────────────────────┐
                    │  Your Agent / Developer       │
                    │  (writes code & pushes PR)    │
                    └──────────────┬────────────────┘
                                   │ git push
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                     local-code-review                           │
│                                                                 │
│  1. Extract PR Diff & Commit SHA (gh pr diff)                   │
│                                                                 │
│  2. Read-Only Reviewer Agent (Strictly No Writes)               │
│     pi --approve --tools read,grep,find,ls                      │
│     - Inspects PR diff and repository files for context         │
│     - Generates file:line annotations & severity                │
│     - Computes RATING: X/5                                      │
│                                                                 │
│  3. Submit Formal GitHub Pull Request Review                     │
│     dev-loops gate upsert-verdict                               │
│     - clean (if 5/5)                                            │
│     - findings_present (if < 5/5)                               │
│                                                                 │
│  4. Output Findings to Terminal                                 │
│     (Your agent reads feedback, fixes issues, and pushes)       │
└─────────────────────────────────────────────────────────────────┘
```

## Security & Read-Only Safety

- The Reviewer agent is explicitly constrained with `--tools read,grep,find,ls`.
- The tools `edit`, `write`, and `bash` are **omitted entirely**.
- The agent cannot alter the git working tree, stage files, or push commits.

## Rating Scale

- `1/5`: Critical blockers (security vulnerabilities, secrets, crashes, broken functionality).
- `2/5`: Major issues (missing error handling, data loss risks, race conditions).
- `3/5`: Moderate issues (architectural friction, edge cases missing, lacking test coverage).
- `4/5`: Minor improvements (code smells, naming, readability), safe to ship with small tweaks.
- `5/5`: Flawless production readiness (correct, well-tested, clean, secure).
