#!/usr/bin/env node
// SessionStart hook: puts the factory's memory index, routing default, and
// the open run for this branch into context, so reading memory no longer
// depends on the agent remembering to. Fails open: any error prints nothing.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { currentBranch, listFiles, readJson, repoRoot } from "./lib/factory.mjs";

const BUDGET = 4096;

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

try {
  const input = readStdin();
  const root = repoRoot(input.cwd || process.cwd());
  const dir = join(root, ".factory");
  if (!existsSync(dir)) process.exit(0);

  const out = ["Software factory: this repo has .factory/. Follow AGENTS.md; record the run with run-ledger."];

  const index = join(dir, "memory", "INDEX.md");
  if (existsSync(index)) {
    const text = readFileSync(index, "utf8").trim();
    out.push("", text.length > BUDGET ? `${text.slice(0, BUDGET)}\n...(index truncated; run memory.mjs prune)` : text);
  }

  const routing = join(dir, "routing.json");
  if (existsSync(routing)) {
    const r = readJson(routing);
    out.push("", `Routing: default tier ${r.default}, ${r.rules.length} rules in .factory/routing.json (model-routing).`);
  }

  const branch = currentBranch(root);
  const open = listFiles(join(dir, "runs"), ".json")
    .map((f) => readJson(f))
    .filter((run) => !run.finished_at && run.branch === branch);
  if (open.length) out.push(`Open run on ${branch}: ${open.map((r) => r.id).join(", ")}. Use "current" with ledger.mjs.`);

  process.stdout.write(out.join("\n") + "\n");
} catch {
  process.exit(0);
}
