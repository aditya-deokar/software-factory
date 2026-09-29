# v3 results

The "after" half of the evidence, against `v2-baseline.md`. Part of it can
be measured the day v3 lands; the rest needs two weeks of real use.

## Measured now (2026-09-29)

| Measure | v2 | v3 | Command |
|---|---|---|---|
| Skills discovered | 10 | 18 | `npx skills add . --list` |
| Lint | 0 errors, 3 warnings | 0 errors, the same 3 warnings (all vendored) | `node scripts/lint-skills.mjs` |
| Lint checks on repo files | frontmatter and layout only | + AGENTS.md budget and index, README links, friction ownership, plugin versions, hook scripts | same |
| Packaged files | 29 | 103 | `npm pack --dry-run --json` |
| Tarball size | 44,393 bytes | 105,122 bytes | same |
| `AGENTS.md` size | 5,755 chars | 4,189 chars | `wc -c AGENTS.md` |
| Python tests | 30 | 30 | `python -m pytest tests/ -q` |
| Node tests | 0 | 46 | `node scripts/run-node-tests.mjs` |
| Factory capabilities | none | triage, spec, monitor, ledger, memory, friction, routing, hooks | see `v2-baseline.md` |

`AGENTS.md` shrank while covering more. The skills index moved to the top,
depth moved into skills, and the source table moved to `NOTICE.md`.

Behavior verified with real runs, not only unit tests:

- Token extraction on this repo's own live Claude Code transcript: 39
  API responses deduplicated from repeated content-block lines.
- `route-eval.mjs` ran eight attempts in throwaway worktrees on Windows with
  a stub agent, recommended the tier that passed, and cleaned up every
  worktree.
- `factory-setup` on this repo: 8 files created, a second run printed
  "No changes", and the result validates.
- This task is itself a run record:
  `.factory/runs/2026-09-29-v3-factory-implementation-4e22.json`, routed
  `frontier` by the `large` rule, with the spec approval recorded as a human
  touch. It was started partway through the work, so its token count covers
  only the later part of the session.

## Pending (fill in after two weeks)

| Metric | v2 baseline | v3 after 2 weeks |
|---|---|---|
| Median review rounds to 5/5 | not recorded | |
| Human touches per merged PR | not recorded | |
| `false-done` corrections per 14 days | not recorded | |
| Tokens per merged PR | not recorded | |
| Share of runs on the `fast` tier | 0% | |
| Runs that used memory | 0% | |
| Skill-loop PRs opened / merged / reverted | n/a | |

Commands: `ledger.mjs report --since 14d` and
`friction-report.mjs --since 14d`, pasted here as they print.
