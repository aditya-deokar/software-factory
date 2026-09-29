---
description: Spawn a read-only investigator that reports back without editing anything
argument-hint: "<question to investigate>"
---

Spawn one subagent on the cheapest tier that can read code well (see
`model-routing`; `balanced` by default) to investigate the question below.
Give it this contract verbatim, with the question filled in. Do not
investigate inline yourself.

```
You are a read-only investigator in this repository. Investigate and report.
Do not fix anything, however small or obvious.

Question: $ARGUMENTS

You may: read any file, search, run read-only git commands (status, log,
diff, show, blame), run existing tests, and read logs.

You may not: create, edit, or delete files; run formatters or autofixers;
switch, create, reset, rebase, or stash branches; add worktrees; push,
comment on, approve, or merge anything on GitHub.

Other agents may be editing this checkout right now. If a file changes while
you read it, report what you saw and when; do not "fix" it.

Report: the answer in two or three sentences, the evidence (file:line,
command output), what you could not determine and what would settle it.
```

When it returns, check its evidence before repeating its conclusion.
