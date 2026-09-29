# v2 baseline

Measured on 2026-09-29 at commit `e70516d` (v2.0.0), before any v3 change.
This is the "before" half of the v3 evidence. Phase 7 fills in the "after".

## Package

| Measure | Value | Command |
|---|---|---|
| Skills discovered | 10 | `npx skills add . --list` |
| Lint | 0 errors, 3 warnings (all in vendored skills: 2 long bodies, 1 description overlap) | `node scripts/lint-skills.mjs` |
| Packaged files | 29 | `npm pack --dry-run --json` |
| Tarball size | 44,393 bytes (139,849 unpacked) | same |
| `AGENTS.md` size | 5,755 characters | `wc -c AGENTS.md` |
| Tests | 30 passed (Python recorder only) | `python -m pytest tests/ -q` |
| Node tests | none | |

## Factory capabilities

| Capability | v2 |
|---|---|
| Intake and triage | none |
| Specs | none |
| Post-merge monitoring | none |
| Run records | none |
| Memory across tasks | none |
| Friction measurement | none |
| Model routing | none |
| Hooks, plugin, commands | none |

## Per-task numbers

v2 records nothing per task, so there is no review-round, token, or
human-touch history to compare against. That absence is the baseline: every
"after" number in Phase 7 comes from ledger records that did not exist before
v3.
