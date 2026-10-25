#!/usr/bin/env node
// Bootstraps the software factory in a repository. Idempotent: it creates
// what is missing, never overwrites a .factory/ file, and prints what it did
// (or would do). The one thing it updates in place is the marked factory
// block in AGENTS.md, and only when nobody edited that block by hand.
// Usage: node setup.mjs [--target <repo>] [--workflows] [--agents-only]
//                       [--no-agents-md] [--replace-edited] [--dry-run]
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs, repoRoot } from "./lib/factory.mjs";
import { loadTemplates, planAgentsMd } from "./lib/agents-md.mjs";
import { checkFactory } from "./check-factory.mjs";

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
const WRITES = new Set(["create", "append", "update", "migrate"]);

function walk(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), base) : [relative(base, join(dir, e.name))]
  );
}

/** Returns the list of planned actions without touching the disk. */
export function plan(target, { workflows = false, agentsMd = true, factory = true, replaceEdited = false } = {}) {
  const actions = [];
  const create = (src, dest) => actions.push({ kind: existsSync(dest) ? "exists" : "create", src, dest });

  if (factory) {
    // npm strips files named .gitignore from packages, so the asset ships as "gitignore".
    for (const rel of walk(join(ASSETS, "factory")))
      create(join(ASSETS, "factory", rel), join(target, ".factory", rel === "gitignore" ? ".gitignore" : rel));
    for (const sub of ["runs", "proposals", "evals"]) create(null, join(target, ".factory", sub, ".gitkeep"));
  }

  if (agentsMd) {
    const dest = join(target, "AGENTS.md");
    const r = planAgentsMd(existsSync(dest) ? readFileSync(dest, "utf8") : null, { ...loadTemplates(ASSETS), replaceEdited });
    actions.push({ kind: r.action === "current" ? "exists" : r.action, dest, text: r.text, from: r.from, to: r.to });
  }
  if (workflows)
    for (const rel of walk(join(ASSETS, "workflows")))
      create(join(ASSETS, "workflows", rel), join(target, ".github", "workflows", rel));
  return actions;
}

export function apply(actions) {
  for (const a of actions) {
    if (!WRITES.has(a.kind)) continue;
    mkdirSync(dirname(a.dest), { recursive: true });
    if (a.text !== undefined) writeFileSync(a.dest, a.text);
    else if (a.src) copyFileSync(a.src, a.dest);
    else writeFileSync(a.dest, "");
  }
}

function verb(a) {
  return {
    create: "create",
    append: "append factory section to",
    update: `update factory section (${a.from} -> ${a.to}) in`,
    migrate: `upgrade factory section (${a.from} -> ${a.to}) in`,
    exists: "keep existing",
    edited: "keep, factory section edited by hand:",
    "legacy-edited": "keep, factory section edited by hand:",
    broken: "keep, factory begin marker has no end marker:",
  }[a.kind];
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = repoRoot(args.target || process.cwd());
  const factory = !args["agents-only"];
  const actions = plan(target, {
    workflows: factory && !!args.workflows,
    agentsMd: !args["no-agents-md"],
    factory,
    replaceEdited: !!args["replace-edited"],
  });
  const todo = actions.filter((a) => WRITES.has(a.kind));
  const rel = (p) => relative(target, p).replace(/\\/g, "/");

  console.log(`Software factory setup in ${target}${args["dry-run"] ? " (dry run)" : ""}`);
  for (const a of actions)
    console.log(`  ${args["dry-run"] && WRITES.has(a.kind) ? `would ${verb(a)}` : verb(a)}  ${rel(a.dest)}`);
  if (actions.some((a) => a.kind.endsWith("edited")))
    console.log(
      "\nThe factory section of AGENTS.md was changed by hand, so it was left alone. Move repo rules\n" +
        "outside the marked block, then rerun with --replace-edited to take the new version."
    );
  if (actions.some((a) => a.kind === "broken"))
    console.log("\nAGENTS.md has a software-factory:begin marker with no end marker. Restore <!-- software-factory:end --> by hand.");
  if (!todo.length) {
    console.log("\nNo changes. The factory is already set up here.");
    return;
  }
  if (args["dry-run"]) return;

  apply(actions);
  if (factory) {
    const { errors } = checkFactory(join(target, ".factory"));
    if (errors.length) {
      for (const e of errors) console.log(`  ERROR  ${e}`);
      process.exit(1);
    }
  }
  const next = actions.some((a) => a.kind === "create" || a.kind === "append")
    ? " Next: fill in the repo-specific section of AGENTS.md."
    : "";
  console.log(`\n${todo.length} change(s).${factory ? " .factory/ validates." : ""}${next}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
