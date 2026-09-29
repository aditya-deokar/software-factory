#!/usr/bin/env node
// Stop hook: if this branch's run has reached the ship beat but was never
// finished, ask the agent to finish it before stopping. Runs still in
// progress are left alone, so multi-turn tasks are not nagged every turn.
// Blocks at most once per stop (stop_hook_active) and fails open.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { currentBranch, listFiles, readJson, repoRoot } from "./lib/factory.mjs";

try {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    process.exit(0);
  }
  if (input.stop_hook_active) process.exit(0);

  const root = repoRoot(input.cwd || process.cwd());
  const runs = join(root, ".factory", "runs");
  if (!existsSync(runs)) process.exit(0);
  const branch = currentBranch(root);
  const pending = listFiles(runs, ".json")
    .map((f) => readJson(f))
    .find((r) => r.branch === branch && !r.finished_at && r.beats?.ship);
  if (!pending) process.exit(0);

  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason:
        `Run ${pending.id} reached the ship beat but is not finished. ` +
        `Record review rounds (ledger.mjs beat current ship --set review_rounds=N) and run ` +
        `"ledger.mjs finish current --outcome shipped", or end with "BLOCKED: <what> - unblock: <action>" ` +
        `and finish with --outcome blocked.`,
    })
  );
} catch {
  process.exit(0);
}
