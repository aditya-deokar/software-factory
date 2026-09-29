# Moving from v2 to v3

Written for someone who already uses the v2 skills and `AGENTS.md` in a repo.

## What did not change

No skill was renamed or removed, so every v2 install keeps working. The four
v2 beats are still there, as beats 2 to 5 of the v3 inner loop. Vendored
skills are unchanged.

## What changed

| Area | v2 | v3 |
|---|---|---|
| Skills | 10 | 18: adds `issue-triage`, `spec-writing`, `release-monitoring`, `run-ledger`, `agent-memory`, `skill-feedback-loop`, `model-routing`, `factory-setup` |
| `AGENTS.md` | 4 beats | 7-beat inner loop, an outer loop, human gates, and a done-or-blocked rule |
| Data | none | `.factory/` in the repo: config, run records, memory, routing, friction patterns |
| PR body | evidence | evidence, plus a `Run:` line and "Memories used / written" |
| `test-evidence` | 2.0 | 3.0: done-or-blocked endings, proof scaled to change size, ledger recording |
| Install | `npx skills add` | the same, or as a Claude Code plugin with hooks and commands |

The version is 3.0.0 because the `AGENTS.md` contract changed. A repo that
copied the v2 file keeps working but does not get the new beats until it is
updated.

## Steps

1. Update the skills: `npx skills update`, or reinstall with
   `npx skills add aditya-deokar/software-factory`.
2. Dry-run the setup and read the plan:
   ```bash
   node <skills dir>/factory-setup/scripts/setup.mjs --dry-run
   ```
   Your repo already has an `AGENTS.md`, so setup appends one marked section
   instead of replacing it. To take the whole v3 file instead, copy the new
   `AGENTS.md` over yours and move your repo-specific section into it.
3. Run it for real, then commit `.factory/` and `AGENTS.md`.
4. Fill in the repo-specific section: commands, invariants, where failures
   show up after merge.
5. Optional: `--workflows` adds the triage, weekly loop, and monitor
   workflows. Read them first; the agent steps spend API credits.

## Adopting one piece at a time

Every part is a switch in `.factory/config.json`. A reasonable order:

1. `ledger` only. A week of run records shows where the time goes.
2. `memory`. It pays back the first time a root cause repeats.
3. `beats.triage` and `beats.monitor`.
4. `routing`, once the ledger shows which classes of work are cheap.
5. `loop.enabled`, once there are two windows of data to compare.

Switching everything off gives v2 behavior.
