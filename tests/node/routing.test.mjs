import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { recommend } from "../../skills/model-routing/scripts/route-eval.mjs";
import { resolveRoute } from "../../skills/model-routing/scripts/route.mjs";
import { ROOT, run, skillScript, tempDir, tempRepo, write } from "./helpers.mjs";

const DEFAULT_ROUTING = JSON.parse(
  readFileSync(join(ROOT, "skills", "factory-setup", "assets", "factory", "routing.json"), "utf8")
);

test("the shipped default routing resolves every beat, class, and size", () => {
  const cases = [
    [{ beat: "triage", class: "bugfix", size: "large" }, "fast", "triage"],
    [{ beat: "spec", class: "feature", size: "medium" }, "frontier", "spec"],
    [{ beat: "build", class: "docs", size: "large" }, "fast", "docs"],
    [{ beat: "build", class: "ci-fix", size: "small" }, "fast", "chore-small"],
    [{ beat: "build", class: "ci-fix", size: "medium" }, "balanced", "default"],
    [{ beat: "build", class: "migration", size: "small" }, "frontier", "migration"],
    [{ beat: "build", class: "feature", size: "large" }, "frontier", "large"],
    [{ beat: "build", class: "bugfix", size: "small" }, "balanced", "default"],
    [{}, "balanced", "default"],
  ];
  for (const [task, tier, rule] of cases) {
    const r = resolveRoute(DEFAULT_ROUTING, task, "claude-code");
    assert.deepEqual([r.tier, r.rule], [tier, rule], JSON.stringify(task));
  }
  assert.equal(resolveRoute(DEFAULT_ROUTING, { beat: "triage" }, "claude-code").model, "haiku");
  assert.equal(resolveRoute(DEFAULT_ROUTING, { beat: "triage" }, "codex").model, null);
});

test("route CLI prints ledger flags, and exits 2 without routing rules", () => {
  const repo = tempRepo();
  write(join(repo, ".factory", "routing.json"), DEFAULT_ROUTING);
  const r = run(skillScript("model-routing", "route.mjs"), ["--beat", "build", "--class", "docs", "--harness", "claude-code"], { cwd: repo });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /ledger flags: --tier fast --model haiku --rule docs/);
  assert.equal(run(skillScript("model-routing", "route.mjs"), ["--beat", "build"], { cwd: tempRepo() }).code, 2);
});

test("recommend picks the cheapest tier within the margin, in routing order", () => {
  const order = ["fast", "balanced", "frontier"];
  const s = (fast, balanced, frontier) => ({
    fast: { attempts: 5, pass_rate: fast },
    balanced: { attempts: 5, pass_rate: balanced },
    frontier: { attempts: 5, pass_rate: frontier },
  });
  assert.equal(recommend(s(0.9, 1, 1), order).tier, "fast", "0.9 is within 10 points of 1.0");
  assert.equal(recommend(s(0.8, 0.8, 1), order).tier, "frontier");
  assert.equal(recommend(s(0.6, 1, 0.6), order).tier, "balanced");
  assert.equal(recommend(s(0.8, 0.8, 1), order, 0.25).tier, "fast");
  assert.equal(recommend(s(0, 0, 0), order).tier, null);
  assert.equal(recommend({ fast: { attempts: 0, pass_rate: 0 } }, order).tier, null);
});

test("route-eval runs k attempts per tier in throwaway worktrees and recommends", () => {
  const repo = tempRepo();
  write(join(repo, ".factory", "routing.json"), DEFAULT_ROUTING);
  // A fake agent: succeeds only on tiers other than "fast".
  const agent = join(tempDir(), "agent.cjs");
  write(agent, `const fs=require("fs");const [tier,prompt]=process.argv.slice(2);if(tier!=="fast")fs.writeFileSync("out.txt",fs.readFileSync(prompt,"utf8"));`);
  const tasks = join(repo, ".factory", "evals", "demo");
  write(join(tasks, "t1.md"), `---\ncheck: node -e "process.exit(require('fs').existsSync('out.txt')?0:1)"\n---\nWrite out.txt.\n`);
  write(join(tasks, "t2.md"), `---\ncheck: node -e "process.exit(require('fs').readFileSync('out.txt','utf8').includes('two')?0:1)"\n---\nWrite two.\n`);
  execFileSync("git", ["add", "-A"], { cwd: repo });
  execFileSync("git", ["commit", "-q", "-m", "evals"], { cwd: repo });

  const E = (...a) => run(skillScript("model-routing", "route-eval.mjs"), a, { cwd: repo, env: { FACTORY_CLAUDE_DIR: tempDir(), FACTORY_CODEX_DIR: tempDir() } });
  const common = ["--tasks", tasks, "--tiers", "fast,balanced", "--k", "2", "--harness", "claude-code", "--agent-cmd", `node "${agent}" {tier} {prompt_file}`];

  const dry = E(...common, "--dry-run");
  assert.equal(dry.code, 0, dry.err);
  assert.match(dry.out, /Would run 8 attempts \(2 tasks x 2 tiers x k=2\)/);

  const r = E(...common);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /\| fast \| haiku \| 0\/4 \|/);
  assert.match(r.out, /\| balanced \| sonnet \| 4\/4 \|/);
  assert.match(r.out, /Recommendation: balanced/);
  const files = readdirSync(join(repo, ".factory", "evals")).filter((f) => f.endsWith(".json"));
  assert.equal(files.length, 1);
  const worktrees = execFileSync("git", ["worktree", "list"], { cwd: repo, encoding: "utf8" }).trim().split("\n");
  assert.equal(worktrees.length, 1, "attempt worktrees are removed");
  const routingAfter = JSON.parse(readFileSync(join(repo, ".factory", "routing.json"), "utf8"));
  assert.deepEqual(routingAfter, DEFAULT_ROUTING, "the eval never edits routing.json");
});
