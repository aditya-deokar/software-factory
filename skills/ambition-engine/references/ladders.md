# Ladders for common task shapes

Starting points, not answers. Each gives the goal beyond the goal, three
rungs, the Depth move that matters most, and a judge. Take the highest rung
that fits the triaged size and has a judge you can run now. File the rest.

## Slow page

"The settings page takes 8 seconds to load."

- **Goal beyond the goal:** nobody leaves because the product feels slow.
- **Rungs:** (1) this page under a set time, measured before and after;
  (2) every page over budget, ranked by real-user impact and fixed at the
  cause; (3) a performance budget checked on every deploy that fails the
  build when it slips.
- **Depth:** start from a trace (browser performance panel, Lighthouse,
  the network waterfall, a bundle analyzer), not a guess. Target the time
  to first useful content in hundreds of milliseconds, not "faster".
- **Judge:** repeated runs on the same machine with the spread reported,
  then real-user timings after deploy.

## Flaky test

"`checkout.spec` fails about one run in ten."

- **Goal beyond the goal:** a red build always means a real failure.
- **Rungs:** (1) this test deterministic, with the cause named; (2) every
  test that failed then passed on retry in the last 30 days, grouped by
  cause; (3) CI that quarantines a newly flaky test and opens an issue with
  its failure history.
- **Depth:** rerun it 200 times under load and read the failures, rather
  than adding a retry. Retries hide the cause; a timing log shows it.
- **Judge:** N consecutive green runs at the rate that used to fail, and
  the CI retry count trending to zero.

## Feature request

"Add CSV export to the reports page."

- **Goal beyond the goal:** ask what the person does with the CSV. Often it
  is "get this data into the finance spreadsheet every Monday".
- **Rungs:** (1) the export, correct for every column type, quoting, and
  locale; (2) the export matched to the real downstream use (the columns
  finance actually needs, opened cleanly in Excel and Sheets); (3) the
  scheduled delivery or live connection that removes the Monday chore.
  Rung 3 usually replaces what was asked, so it needs a person (rule 4).
- **Range:** a spreadsheet power user checks it the way they work: open the
  file, sort, pivot, paste into the existing workbook.
- **Judge:** the file round-trips through both spreadsheet apps with the
  sample data unchanged, including commas, quotes, unicode, and dates.

## Dependency upgrade

"Bump the ORM to the next major."

- **Goal beyond the goal:** the dependency stops being a source of
  surprise.
- **Rungs:** (1) the upgrade with the suite green; (2) every deprecation the
  release notes list, found in the code and fixed, plus behavior changes
  covered by a test; (3) an automated weekly upgrade PR with the suite and a
  smoke run as its gate.
- **Depth:** read the changelog and the migration guide in full, then grep
  the code for each changed API, rather than upgrading and waiting for
  failures.
- **Judge:** the suite, plus an output pair from the riskiest queries before
  and after.

## Docs

"The install section of the README is out of date."

- **Goal beyond the goal:** a new user gets from zero to a working install
  without asking anyone.
- **Rungs:** (1) the section corrected; (2) every command in the docs
  checked by running it on a clean machine; (3) CI that runs the documented
  commands so the docs fail the build when they drift.
- **Range:** a technical writer cuts it to what a newcomer needs; a support
  lead adds the three questions people actually ask.
- **Judge:** a fresh container where the documented steps, pasted in order,
  produce a working install.

## Migration

"Move sessions from Redis to Postgres."

- **Goal beyond the goal:** nobody is logged out, and session storage stops
  being a second system to run.
- **Rungs:** (1) the new store with a dual-write and read-fallback path;
  (2) the backfill with counts reconciled and a rollback rehearsed; (3) the
  old store retired, with the runbook and alert for the new one.
- **Depth:** measure the real session read and write rates and the size
  distribution first; design for those, not for the docs' defaults.
- **Judge:** row counts and a sample matched between stores, logout rate
  unchanged through the cutover, and a rollback run end to end on staging.
  This is always `spec`, never `implement`.
