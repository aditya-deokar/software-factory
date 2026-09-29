import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { collectEvents, inside, normPath, readEvents, sumUsage } from "../../shared/lib/transcripts.mjs";
import { FIXTURES, tempDir } from "./helpers.mjs";

const CLAUDE = join(FIXTURES, "transcripts", "claude-session.jsonl");
const CODEX = join(FIXTURES, "transcripts", "codex-rollout.jsonl");

test("Claude transcript: dedupes usage by message id, keeps only typed user text", () => {
  const events = readEvents({ harness: "claude-code", file: CLAUDE });
  const users = events.filter((e) => e.kind === "user").map((e) => e.text);
  assert.deepEqual(users, ["still broken after your fix", "please add evidence to the PR"]);
  const usage = sumUsage(events);
  assert.equal(usage.input_tokens, 115); // (10 + 100) + (5 + 0)
  assert.equal(usage.cached_input_tokens, 3000);
  assert.equal(usage.output_tokens, 70);
  assert.equal(usage.source, "claude-code transcript");
  assert.equal(events[0].branch, "agent/demo");
});

test("Codex rollout: per-turn usage, cached share removed from input", () => {
  const events = readEvents({ harness: "codex", file: CODEX });
  assert.deepEqual(
    events.filter((e) => e.kind === "user").map((e) => e.text),
    ["you said it was fixed but the test still fails"]
  );
  const usage = sumUsage(events);
  assert.deepEqual(
    [usage.input_tokens, usage.cached_input_tokens, usage.output_tokens],
    [700, 1000, 40] // (1200 - 1000) + 500
  );
  assert.equal(events.find((e) => e.kind === "usage").model, "gpt-5");
});

test("sumUsage returns null, not zeros, when there is no usage", () => {
  assert.equal(sumUsage([]), null);
  assert.equal(sumUsage([{ kind: "user", text: "hi" }]), null);
});

test("path matching survives drive letters, slashes, and Git Bash paths", () => {
  assert.equal(normPath("C:\\Work\\Demo\\"), "c:/work/demo");
  assert.equal(normPath("/c/Work/Demo"), "c:/work/demo");
  assert.ok(inside("c:\\work\\demo\\sub", "C:/work/demo"));
  assert.ok(inside("/c/work/demo", "C:\\work\\demo"));
  assert.ok(!inside("c:/work/demo-other", "c:/work/demo"));
  assert.ok(!inside(null, "c:/work/demo"));
});

let roots;
before(() => {
  roots = tempDir("sf-transcripts-");
  mkdirSync(join(roots, "claude", "C--work-demo"), { recursive: true });
  mkdirSync(join(roots, "codex", "2026", "10", "01"), { recursive: true });
  copyFileSync(CLAUDE, join(roots, "claude", "C--work-demo", "s1.jsonl"));
  copyFileSync(CODEX, join(roots, "codex", "2026", "10", "01", "rollout-c1.jsonl"));
  // Copies keep the fixture's mtime on Windows; the reader skips files last
  // modified before the window, so date them the way a live session would be.
  const written = new Date("2026-10-01T12:00:00Z");
  utimesSync(join(roots, "claude", "C--work-demo", "s1.jsonl"), written, written);
  utimesSync(join(roots, "codex", "2026", "10", "01", "rollout-c1.jsonl"), written, written);
  process.env.FACTORY_CLAUDE_DIR = join(roots, "claude");
  process.env.FACTORY_CODEX_DIR = join(roots, "codex");
});
after(() => {
  delete process.env.FACTORY_CLAUDE_DIR;
  delete process.env.FACTORY_CODEX_DIR;
});

test("collectEvents filters by repo and time window across harnesses", () => {
  const all = collectEvents({ repoPath: "C:/work/demo" });
  assert.equal(new Set(all.map((e) => e.harness)).size, 2);
  const onlyClaude = collectEvents({
    repoPath: "/c/work/demo",
    fromMs: Date.parse("2026-10-01T10:00:00Z"),
    toMs: Date.parse("2026-10-01T10:30:00Z"),
  });
  assert.ok(onlyClaude.length > 0 && onlyClaude.every((e) => e.harness === "claude-code"));
  assert.equal(collectEvents({ repoPath: "C:/elsewhere" }).length, 0);
  assert.equal(sumUsage(collectEvents({ repoPath: "c:/work/demo", kinds: ["usage"] })).source, "claude-code+codex transcript");
});
