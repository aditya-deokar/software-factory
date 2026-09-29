---
description: Run the outer loop once, collecting signals and opening at most one skill-improvement PR
argument-hint: "[--since 14d]"
---

Use the `skill-feedback-loop` skill. Options for `collect-signals.mjs`:
$ARGUMENTS

Work in a fresh worktree (`worktree-isolation`) and record the run with
`run-ledger --class loop`. If `Next:` says nothing qualifies, report the
signals table and stop. Otherwise diagnose the owning skill, write the
proposal file, make the smallest change to one skill, and open one PR labeled
`factory:skill-loop`. Never merge it.
