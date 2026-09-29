import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { renderIndex } from "../../skills/agent-memory/scripts/memory.mjs";
import { run, skillScript, tempDir, tempRepo } from "./helpers.mjs";

const MEM = skillScript("agent-memory", "memory.mjs");
const LEDGER = skillScript("run-ledger", "ledger.mjs");
const CHECK = skillScript("factory-setup", "check-factory.mjs");
const env = () => ({ FACTORY_CLAUDE_DIR: tempDir(), FACTORY_CODEX_DIR: tempDir() });

const addArgs = (name, extra = []) => [
  "add", "--name", name, "--type", "pitfall",
  "--description", "macOS CI times out on the first npx call",
  "--source", "https://github.com/o/r/pull/41",
  "--body", "The macos-latest runner downloads for 90s on first npx use. Warm the cache in a setup step.",
  ...extra,
];

test("add writes a valid memory, regenerates the index, and refuses duplicates", () => {
  const repo = tempRepo();
  const M = (...a) => run(MEM, a, { cwd: repo, env: env() });
  const r = M(...addArgs("macos-npx-timeout"));
  assert.equal(r.code, 0, r.err);
  const file = join(repo, ".factory", "memory", "macos-npx-timeout.md");
  assert.match(readFileSync(file, "utf8"), /^---\nname: macos-npx-timeout\n/);
  assert.match(readFileSync(join(repo, ".factory", "memory", "INDEX.md"), "utf8"), /\[macos-npx-timeout\]\(macos-npx-timeout\.md\) pitfall, used 0x/);

  const dup = M(...addArgs("macos-npx-timeout"));
  assert.equal(dup.code, 1);
  assert.match(dup.err, /exists.*--update/);
  assert.equal(M(...addArgs("macos-npx-timeout", ["--update"])).code, 0);

  const similar = M(...addArgs("npx-warmup"));
  assert.equal(similar.code, 0);
  assert.match(similar.out, /similar to "macos-npx-timeout"/);
  assert.equal(run(CHECK, [join(repo, ".factory")]).code, 0);
});

test("add refuses missing provenance, bad names, and secrets", () => {
  const repo = tempRepo();
  const M = (...a) => run(MEM, a, { cwd: repo, env: env() });
  assert.match(M("add", "--name", "x-y", "--type", "fact", "--description", "long enough text", "--body", "b").err, /source/);
  assert.match(M(...addArgs("Bad Name")).err, /lowercase slug/);
  const leak = M("add", "--name", "token", "--type", "reference", "--description", "the deploy token for CI", "--source", "https://x.test/1", "--body", "use ghp_" + "b".repeat(36));
  assert.equal(leak.code, 1);
  assert.match(leak.err, /looks like a secret/);
  assert.ok(!existsSync(join(repo, ".factory", "memory", "token.md")));
});

test("replay: run 2 finds and uses what run 1 learned, and the ledger shows it", () => {
  const repo = tempRepo("agent/ci-timeout");
  const e = env();
  const L = (...a) => run(LEDGER, a, { cwd: repo, env: e });
  const M = (...a) => run(MEM, a, { cwd: repo, env: e });

  // Run 1 debugs the timeout and saves the root cause.
  L("start", "--class", "ci-fix", "--size", "small", "--title", "first timeout");
  assert.equal(M(...addArgs("macos-npx-timeout", ["--run", "current"])).code, 0);
  L("finish", "current", "--outcome", "merged");

  // Run 2 hits the same error and searches before debugging.
  execFileSync("git", ["switch", "-q", "-c", "agent/ci-timeout-again"], { cwd: repo });
  L("start", "--class", "ci-fix", "--size", "small", "--title", "second timeout");
  const hit = M("search", "npx", "timeout");
  assert.match(hit.out.split("\n")[0], /^macos-npx-timeout/);
  assert.equal(M("use", "macos-npx-timeout", "--run", "current").code, 0);
  L("finish", "current", "--outcome", "merged");

  const report = JSON.parse(L("report", "--since", "all", "--json").out);
  assert.equal(report.runs, 2);
  assert.equal(report.memories_written, 1);
  assert.equal(report.runs_using_memory, 1);
  assert.match(readFileSync(join(repo, ".factory", "memory", "INDEX.md"), "utf8"), /used 1x/);
  assert.equal(run(CHECK, [join(repo, ".factory")]).code, 0);
});

test("prune marks stale without deleting; use revives; graduate lists heavy users", () => {
  const repo = tempRepo();
  const M = (...a) => run(MEM, a, { cwd: repo, env: env() });
  M(...addArgs("old-fact"));
  const file = join(repo, ".factory", "memory", "old-fact.md");
  writeFileSync(file, readFileSync(file, "utf8").replace(/created: .*/, "created: 2020-01-01"));
  assert.match(M("prune", "--unused-days", "90", "--dry-run").out, /would mark stale: old-fact/);
  assert.match(readFileSync(file, "utf8"), /status: observed/);
  assert.match(M("prune").out, /marked stale: old-fact/);
  assert.match(readFileSync(file, "utf8"), /status: stale/);
  assert.match(M("search", "npx").out, /no matching memories/);
  assert.match(M("search", "npx", "--all").out, /old-fact/);

  for (let i = 0; i < 3; i++) M("use", "old-fact");
  assert.match(readFileSync(file, "utf8"), /status: observed/);
  assert.match(M("graduate").out, /old-fact {2}used 3x/);
});

test("index is deterministic and lists stale memories separately", () => {
  const mk = (name, status, uses = 0) => ({ data: { name, type: "fact", uses, status, description: `about ${name}` } });
  const text = renderIndex([mk("b", "observed"), mk("a", "confirmed", 2), mk("z", "stale")]);
  assert.ok(text.indexOf("[a]") < text.indexOf("[b]"));
  assert.ok(text.indexOf("## Stale") < text.indexOf("[z]"));
  assert.equal(renderIndex([]).includes("(no memories yet)"), true);
});
