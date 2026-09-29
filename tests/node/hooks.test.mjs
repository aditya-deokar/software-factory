import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { test } from "node:test";
import { checkPush } from "../../hooks/guard-push.mjs";
import { ROOT, run, skillScript, tempDir, tempRepo, write } from "./helpers.mjs";

const hook = (name) => join(ROOT, "hooks", name);
const onBranch = (b) => ({ branchOf: () => b });

test("guard-push blocks pushes to the default branch and plain force", () => {
  const blocked = [
    "git push origin main",
    "git push origin HEAD:master",
    "git push origin refs/heads/main",
    "git push --force origin agent/x",
    "git push -f",
    "git push -uf origin agent/x",
    "git push origin +agent/x",
    "git push --all origin",
    "npm test && git push origin main",
    "GIT_TRACE=1 git push origin main",
  ];
  for (const cmd of blocked) assert.ok(checkPush(cmd, onBranch("agent/x")), `should block: ${cmd}`);
  assert.match(checkPush("git push", onBranch("main")), /you are on main/);
});

test("guard-push allows normal task-branch pushes and non-push commands", () => {
  const allowed = [
    "git push -u origin agent/x",
    "git push --force-with-lease origin agent/x",
    "git push --force-with-lease=agent/x:abc123 origin agent/x",
    "git -C ../repo push origin main-feature",
    "git commit -m 'push to main later'",
    "echo git push origin main",
    "git pull origin main",
  ];
  for (const cmd of allowed) assert.equal(checkPush(cmd, onBranch("agent/x")), null, `should allow: ${cmd}`);
  assert.equal(checkPush("git push", onBranch("agent/x")), null);
});

test("guard-push as a hook: exit 2 with a reason, exit 0 otherwise, fail open on junk", () => {
  const repo = tempRepo("agent/x");
  const call = (command) => run(hook("guard-push.mjs"), [], { input: JSON.stringify({ cwd: repo, tool_input: { command } }) });
  const bad = call("git push origin main");
  assert.equal(bad.code, 2);
  assert.match(bad.err, /pushing to main is not allowed/);
  assert.equal(call("git push -u origin agent/x").code, 0);
  assert.equal(call("ls -la").code, 0);
  assert.equal(run(hook("guard-push.mjs"), [], { input: "not json" }).code, 0);
  assert.equal(run(hook("guard-push.mjs"), [], { input: "" }).code, 0);
});

test("session-start prints the memory index and open run, and nothing without .factory", () => {
  const repo = tempRepo("agent/mem");
  run(skillScript("factory-setup", "setup.mjs"), ["--no-agents-md"], { cwd: repo });
  const env = { FACTORY_CLAUDE_DIR: tempDir(), FACTORY_CODEX_DIR: tempDir() };
  run(skillScript("agent-memory", "memory.mjs"), [
    "add", "--name", "ci-cache", "--type", "pitfall", "--description", "CI cache key must include the lockfile hash",
    "--source", "https://x.test/2", "--body", "Otherwise stale deps are restored.",
  ], { cwd: repo, env });
  const id = run(skillScript("run-ledger", "ledger.mjs"), ["start", "--class", "bugfix", "--size", "small"], { cwd: repo, env }).out.trim();

  const r = run(hook("session-start.mjs"), [], { input: JSON.stringify({ cwd: repo }) });
  assert.equal(r.code, 0);
  assert.match(r.out, /\[ci-cache\]\(ci-cache\.md\)/);
  assert.match(r.out, /Routing: default tier balanced/);
  assert.match(r.out, new RegExp(`Open run on agent/mem: ${id}`));

  const none = run(hook("session-start.mjs"), [], { input: JSON.stringify({ cwd: tempRepo() }) });
  assert.equal(none.code, 0);
  assert.equal(none.out, "");
});

test("stop-ledger blocks once when a shipped run is unfinished", () => {
  const repo = tempRepo("agent/ship");
  const env = { FACTORY_CLAUDE_DIR: tempDir(), FACTORY_CODEX_DIR: tempDir() };
  const L = (...a) => run(skillScript("run-ledger", "ledger.mjs"), a, { cwd: repo, env });
  const stop = (active = false) => run(hook("stop-ledger.mjs"), [], { input: JSON.stringify({ cwd: repo, stop_hook_active: active }) });

  L("start", "--class", "feature", "--size", "small");
  assert.equal(stop().out, "", "in-progress runs are not nagged");
  L("beat", "current", "ship", "--set", "pr=9");
  const blocked = JSON.parse(stop().out);
  assert.equal(blocked.decision, "block");
  assert.match(blocked.reason, /reached the ship beat but is not finished/);
  assert.equal(stop(true).out, "", "never blocks twice in a row");
  L("finish", "current", "--outcome", "shipped");
  assert.equal(stop().out, "");
});

test("ledger finish --scope repo counts sessions started in another worktree", () => {
  const main = tempRepo("master");
  const wt = join(tempDir(), "task");
  execFileSync("git", ["worktree", "add", "-q", "-b", "agent/task", wt], { cwd: main });
  const claude = tempDir();
  const env = { FACTORY_CLAUDE_DIR: claude, FACTORY_CODEX_DIR: tempDir() };
  const L = (...a) => run(skillScript("run-ledger", "ledger.mjs"), a, { cwd: wt, env });
  const id = L("start", "--class", "feature", "--size", "small").out.trim();
  // The session lives in the main checkout and works in the worktree.
  write(join(claude, "p", "s.jsonl"), JSON.stringify({
    type: "assistant", timestamp: new Date(Date.now() + 300).toISOString(), cwd: main,
    message: { id: "m1", usage: { input_tokens: 40, output_tokens: 2 } },
  }));
  const wait = Date.now() + 500;
  while (Date.now() < wait);
  assert.match(L("finish", id, "--outcome", "shipped").out, /tokens unknown/);
  // Re-finishing keeps a count, but an empty one is re-read with the wider scope.
  assert.match(L("finish", id, "--outcome", "shipped", "--scope", "repo").out, /tokens 40 in, 0 cached, 2 out/);
});
