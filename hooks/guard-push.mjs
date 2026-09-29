#!/usr/bin/env node
// PreToolUse hook for Bash: refuses a git push that would land on the default
// branch or force-push without a lease. AGENTS.md states both rules; this is
// the mechanism for the times the rule gets forgotten.
// Exit 2 blocks the call and shows stderr to the agent. Any internal error
// exits 0, so a bug here never blocks unrelated work.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { currentBranch } from "./lib/factory.mjs";

const PROTECTED = new Set(["main", "master"]);

/** Splits a shell command into simple commands, then into rough tokens. */
function commands(line) {
  return String(line)
    .split(/&&|\|\||[;|\n]/)
    .map((c) => (c.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) => t.replace(/^["']|["']$/g, "")));
}

/** Returns a reason string when the push must be blocked, else null. */
export function checkPush(line, { cwd = process.cwd(), branchOf = currentBranch } = {}) {
  for (const tokens of commands(line)) {
    // git must be the command itself (after any VAR=value prefixes), so
    // `echo git push origin main` or a commit message mentioning it passes.
    const g = tokens.findIndex((t) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(t));
    if (g < 0 || tokens[g] !== "git") continue;
    let i = g + 1;
    let dir = cwd;
    while (i < tokens.length && tokens[i].startsWith("-")) {
      if (tokens[i] === "-C") dir = resolve(cwd, tokens[++i] || ".");
      else if (tokens[i] === "-c") i++;
      i++;
    }
    if (tokens[i] !== "push") continue;
    const args = tokens.slice(i + 1);

    const hasLease = args.some((a) => a.startsWith("--force-with-lease"));
    const plainForce = args.some((a) => a === "--force" || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(a));
    if (plainForce && !hasLease) return "plain --force is not allowed. Use --force-with-lease, and only on your own task branch.";
    if (args.includes("--mirror") || args.includes("--all")) return "--all and --mirror push the default branch too. Push your task branch by name.";

    const positional = args.filter((a) => !a.startsWith("-"));
    const refspecs = positional.slice(1);
    for (const spec of refspecs) {
      if (spec.startsWith("+")) return `"${spec}" force-pushes. Use --force-with-lease on your own branch instead.`;
      const dest = (spec.includes(":") ? spec.split(":").pop() : spec).replace(/^refs\/heads\//, "");
      if (PROTECTED.has(dest)) return `pushing to ${dest} is not allowed. Push your task branch and open a PR.`;
    }
    if (!refspecs.length) {
      const branch = branchOf(dir);
      if (branch && PROTECTED.has(branch)) return `you are on ${branch}; a bare git push would update it. Create a task branch (worktree-isolation).`;
    }
  }
  return null;
}

function main() {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    process.exit(0);
  }
  const command = input.tool_input?.command;
  if (!command || !/\bgit\b[\s\S]*\bpush\b/.test(command)) process.exit(0);
  const reason = checkPush(command, { cwd: input.cwd || process.cwd() });
  if (reason) {
    process.stderr.write(`Blocked by software-factory guard-push: ${reason}\n`);
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch {
    process.exit(0);
  }
}
