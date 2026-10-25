# ADR 0002: an Aim beat, and an AGENTS.md section that upgrades itself

Status: proposed, 2026-10-25

## Context

The factory proves that a task was done, but nothing in it asks whether the
task was aimed well. Every beat takes the issue at the size it was typed.
Felix Rieseberg's [How to be more ambitious: a tutorial for humans with
models](https://felixrieseberg.com/how-to-be-more-ambitious-a-tutorial-for-humans-with-models/)
gives a method for that question (Altitude, Depth, Range, an outside judge),
and `robonuggets/be-ambitious` showed it works as a skill.

Separately, `factory-setup` wrote the `AGENTS.md` section once and never
touched it again, so every repo kept the workflow it was set up with.
Upgrading the skills changed nothing in `AGENTS.md` until someone edited it
by hand.

## Decisions

1. **Aim is its own beat, between triage and spec.** Triage decides whether
   to do the work, and has to stay cheap (`fast` tier) because it runs on
   every issue. Spec is only for ambiguous work. Aim runs on everything that
   triage passes, sets the target that spec writes down and that prove
   measures, and needs judgment (`frontier`, or `balanced` when small).
   Folding it into either neighbour would make triage expensive or leave
   `implement` tasks without an aim.
2. **The PR takes one rung; the rungs above become issues.** This keeps
   "better, not bigger" mechanical. Ambition raises the standard and the
   judge inside the task's scope. It never widens the diff, which still
   answers to "keep changes to the task" and the `unrequested-scope` key.
3. **The judge is named before code and the miss is reported.** The aim
   records what was set out; the prove beat records what happened. A target
   moved to fit the result counts as a false done.
4. **Two friction keys pull in opposite directions.** `aimed-low` is owned
   by `ambition-engine`, `unrequested-scope` by `AGENTS.md`. The outer loop
   can tune the skill toward more ambition or less, from evidence.
5. **AGENTS.md has a marked block the factory owns.** Begin and end markers,
   with the version and a digest of what was written. Every `setup.mjs` run
   replaces the block when the templates change. Text outside the markers is
   the repo's and is never touched. A block whose digest no longer matches
   was edited by hand, so it is reported, not overwritten. v3.0.0 sections
   (one marker) are upgraded when they match the v3.0.0 template exactly.
6. **Automatic where a trigger exists, a command where none does.** The
   plugin's session-start hook updates unedited blocks in repos with
   `.factory/`, and never adds a block to a repo without one. npm users get
   a `prepare` script line. `npx skills add` runs no install hooks (see
   `.factory/memory/skills-cli-no-install-hook.md`), so there it is one
   documented command. A `postinstall` that edits the consumer's repo was
   rejected: npm hides its output, and writing outside the package on
   install surprises people.
