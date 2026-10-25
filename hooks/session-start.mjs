#!/usr/bin/env node
// SessionStart hook: puts the factory's memory index, routing default, and
// the open run for this branch into context, so reading memory no longer
// depends on the agent remembering to. It also keeps the marked factory block
// in AGENTS.md at this plugin's version. Fails open: any error prints nothing.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { currentBranch, listFiles, readJson, repoRoot } from "./lib/factory.mjs";
import { loadTemplates, planAgentsMd } from "./lib/agents-md.mjs";

const BUDGET = 4096;
const SETUP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "skills", "factory-setup");

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

/**
 * Brings an existing factory block up to date. Never creates AGENTS.md or
 * adds a block to one without it: that is factory-setup's job, run on purpose.
 * config.json agents_md: "auto" (default) writes, "notify" only says so, "off" skips.
 */
function syncAgentsMd(root, mode) {
  const file = join(root, "AGENTS.md");
  if (mode === "off" || !existsSync(file) || !existsSync(join(SETUP_DIR, "assets"))) return null;
  const r = planAgentsMd(readFileSync(file, "utf8"), loadTemplates(join(SETUP_DIR, "assets")));
  const cmd = `node "${join(SETUP_DIR, "scripts", "setup.mjs")}" --agents-only`;
  if (r.action === "update" || r.action === "migrate") {
    if (mode !== "auto") return `AGENTS.md: the software factory block is ${r.from}; ${r.to} is installed. To update it, run: ${cmd}`;
    writeFileSync(file, r.text);
    return (
      `AGENTS.md: updated the software factory block from ${r.from} to ${r.to}; nothing outside the markers changed. ` +
      `Tell the user, and commit it on its own ("chore: sync factory section in AGENTS.md"), never on main.`
    );
  }
  if (r.action === "edited" || r.action === "legacy-edited")
    return (
      `AGENTS.md: the software factory block was edited by hand, so it stays at ${r.from} (${r.to} is installed). ` +
      `Tell the user to move repo rules outside the block, then run: ${cmd} --replace-edited`
    );
  return null;
}

try {
  const input = readStdin();
  const root = repoRoot(input.cwd || process.cwd());
  const dir = join(root, ".factory");
  if (!existsSync(dir)) process.exit(0);

  const out = ["Software factory: this repo has .factory/. Follow AGENTS.md; record the run with run-ledger."];

  try {
    const config = existsSync(join(dir, "config.json")) ? readJson(join(dir, "config.json")) : {};
    const note = syncAgentsMd(root, config.agents_md || "auto");
    if (note) out.push(note);
  } catch {
    // A sync problem must not cost the session its memory index.
  }

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
