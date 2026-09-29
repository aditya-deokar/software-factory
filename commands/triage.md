---
description: Triage an issue into exactly one decision (implement, spec, duplicate, needs-info, decline)
argument-hint: "<issue number, URL, or pasted report>"
---

Use the `issue-triage` skill on: $ARGUMENTS

Search memory and existing issues (including closed ones) before deciding.
Make exactly one decision, apply its `factory:*` label, and post one comment
with the reason. If the repo has `.factory/`, record the run with
`run-ledger`. Do not start fixing anything during triage.
