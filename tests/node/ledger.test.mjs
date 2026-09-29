import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { computeReport, detectHarness, renderReport } from "../../skills/run-ledger/scripts/ledger.mjs";
import { run, skillScript, tempDir, tempRepo, write } from "./helpers.mjs";

const LEDGER = skillScript("run-ledger", "ledger.mjs");
const noTranscripts = () => ({ FACTORY_CLAUDE_DIR: tempDir(), FACTORY_CODEX_DIR: tempDir() });

test("start, beats, touch, finish produce a valid record on the current branch", () => {
  const repo = tempRepo("agent/fix-login");
  const env = { ...noTranscripts(), FACTORY_HARNESS: "claude-code" };
  const L = (...a) => run(LEDGER, a, { cwd: repo, env });

  const start = L("start", "--class", "bugfix", "--size", "small", "--title", "Fix login", "--tier", "fast");
  assert.equal(start.code, 0, start.err);
  const id = start.out.trim();
  assert.match(id, /^\d{4}-\d{2}-\d{2}-fix-login-[0-9a-f]{4}$/);
  assert.equal(L("current").out.trim(), id);

  assert.equal(L("beat", "current", "triage", "--set", "decision=implement").code, 0);
  assert.equal(L("beat", "current", "prove", "--add", "evidence=recording", "--add", "evidence=recording", "--set", "before_captured=true").code, 0);
  assert.equal(L("beat", "current", "ship", "--set", "pr=7", "--set", "review_rounds=3").code, 0);
  assert.equal(L("touch", "current", "--beat", "prove", "--kind", "correction", "--ref", "https://x.test/1").code, 0);
  const fin = L("finish", "current", "--outcome", "shipped");
  assert.equal(fin.code, 0, fin.err);
  assert.match(fin.out, /tokens unknown/);

  const rec = JSON.parse(readFileSync(join(repo, ".factory", "runs", `${id}.json`), "utf8"));
  assert.equal(rec.branch, "agent/fix-login");
  assert.equal(rec.harness, "claude-code");
  assert.deepEqual(rec.beats.prove, { evidence: ["recording"], before_captured: true });
  assert.equal(rec.beats.ship.review_rounds, 3);
  assert.equal(rec.human_touches[0].kind, "correction");
  assert.equal(rec.outcome, "shipped");
  assert.equal(rec.cost, null);
  assert.equal(L("current").code, 3, "finished run is no longer current");
});

test("invalid writes are refused and leave the record untouched", () => {
  const repo = tempRepo();
  const L = (...a) => run(LEDGER, a, { cwd: repo, env: noTranscripts() });
  assert.equal(L("start", "--class", "nonsense", "--size", "small").code, 1);
  const id = L("start", "--class", "docs", "--size", "small").out.trim();
  const before = readFileSync(join(repo, ".factory", "runs", `${id}.json`), "utf8");
  const bad = L("beat", id, "prove", "--add", "evidence=vibes");
  assert.equal(bad.code, 1);
  assert.match(bad.err, /evidence\[0\]: must be one of/);
  assert.equal(L("beat", id, "deploy").code, 1);
  assert.equal(L("finish", id, "--outcome", "great").code, 1);
  assert.equal(readFileSync(join(repo, ".factory", "runs", `${id}.json`), "utf8"), before);
});

test("finish pulls token usage from a transcript for this repo only", () => {
  const repo = tempRepo();
  const claude = tempDir();
  const env = { FACTORY_CLAUDE_DIR: claude, FACTORY_CODEX_DIR: tempDir() };
  const id = run(LEDGER, ["start", "--class", "feature", "--size", "medium"], { cwd: repo, env }).out.trim();
  const ts = new Date(Date.now() + 500).toISOString();
  const line = (cwd, msgId, input, output) =>
    JSON.stringify({
      type: "assistant",
      timestamp: ts,
      cwd,
      message: { id: msgId, role: "assistant", usage: { input_tokens: input, cache_read_input_tokens: 10, output_tokens: output } },
    });
  write(
    join(claude, "proj", "s.jsonl"),
    [line(repo, "m1", 100, 5), line(repo, "m1", 100, 5), line(repo + "-other", "m2", 999, 999), line(repo, "m3", 50, 5)].join("\n")
  );
  // Let "now" pass the event timestamp so it falls inside the run window.
  const wait = Date.now() + 700;
  while (Date.now() < wait);
  const fin = run(LEDGER, ["finish", id, "--outcome", "shipped"], { cwd: repo, env });
  assert.equal(fin.code, 0, fin.err);
  const rec = JSON.parse(readFileSync(join(repo, ".factory", "runs", `${id}.json`), "utf8"));
  assert.deepEqual(
    [rec.cost.input_tokens, rec.cost.cached_input_tokens, rec.cost.output_tokens],
    [150, 20, 10]
  );
});

test("report exits 2 when there is nothing to report", () => {
  const repo = tempRepo();
  const r = run(LEDGER, ["report"], { cwd: repo, env: noTranscripts() });
  assert.equal(r.code, 2);
  assert.ok(!existsSync(join(repo, ".factory", "runs")));
});

test("computeReport aggregates a fixture of runs", () => {
  const base = (i, extra) => ({
    schema: 1,
    id: `2026-10-0${i}-r-000${i}`,
    task: { class: i % 2 ? "bugfix" : "docs", size: "small" },
    harness: "claude-code",
    model: { tier: i < 3 ? "fast" : "balanced", id: null, rule: null },
    beats: {},
    memories: { used: [], written: [] },
    human_touches: [],
    cost: null,
    started_at: `2026-10-0${i}T10:00:00Z`,
    finished_at: `2026-10-0${i}T10:30:00Z`,
    outcome: "merged",
    ...extra,
  });
  const runs = [
    base(1, { beats: { ship: { review_rounds: 1 }, prove: { evidence: ["recording"], before_captured: true } }, cost: { input_tokens: 100, cached_input_tokens: 0, output_tokens: 0, usd: null, source: "x" } }),
    base(2, { beats: { ship: { review_rounds: 3 }, prove: { evidence: ["none"] } }, human_touches: [{ beat: "ship", kind: "correction" }, { beat: "spec", kind: "approval" }] }),
    base(3, { beats: { ship: { review_rounds: 2 } }, memories: { used: ["m"], written: ["n", "o"] }, cost: { input_tokens: 300, cached_input_tokens: 0, output_tokens: 0, usd: null, source: "x" } }),
    base(4, { outcome: null, finished_at: null, beats: { monitor: { status: "regression" } } }),
  ];
  const rep = computeReport(runs);
  assert.equal(rep.runs, 4);
  assert.equal(rep.open, 1);
  assert.equal(rep.merged, 3);
  assert.equal(rep.median_review_rounds, 2);
  assert.equal(rep.human_touches, 2);
  assert.equal(rep.corrections, 1);
  assert.deepEqual(rep.corrections_by_beat, { ship: 1 });
  assert.equal(rep.evidence_rate, 1 / 3);
  assert.equal(rep.before_captured_rate, 1 / 3);
  assert.equal(rep.median_tokens_per_shipped, 200);
  assert.equal(rep.tokens_known_for, "2/3");
  assert.equal(rep.median_minutes, 30);
  assert.equal(rep.runs_using_memory, 1);
  assert.equal(rep.memories_written, 2);
  assert.equal(rep.monitor_regressions, 1);
  assert.deepEqual(rep.by_tier, { fast: 2, balanced: 2 });
  assert.equal(computeReport(runs, { sinceMs: Date.parse("2026-10-03T00:00:00Z") }).runs, 2);
  assert.match(renderReport(rep, "all time"), /\| Median review rounds \| 2 \|/);
});

test("harness detection reads the environment", () => {
  assert.equal(detectHarness({ CLAUDECODE: "1" }), "claude-code");
  assert.equal(detectHarness({ CODEX_SANDBOX: "seatbelt" }), "codex");
  assert.equal(detectHarness({ FACTORY_HARNESS: "cursor", CLAUDECODE: "1" }), "cursor");
  assert.equal(detectHarness({}), "unknown");
});
