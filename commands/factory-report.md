---
description: Show how the factory is doing, from the run ledger and the friction report
argument-hint: "[14d | 30d | all]"
---

Report on the factory in this repo for the window `$ARGUMENTS` (default
`14d`).

1. Run the `run-ledger` report: `ledger.mjs report --since <window>`.
2. Run `skill-feedback-loop`'s `friction-report.mjs --since <window>` if local
   transcripts exist. If it exits 2, say transcripts are unavailable; do not
   report zeros.
3. Paste both tables as they print. Then give at most three observations,
   each pointing at a number in the tables, and name the skill that owns it.

Do not change any files.
