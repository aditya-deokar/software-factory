import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { followUp, rank } from "../../skills/skill-feedback-loop/scripts/collect-signals.mjs";
import { frictionReport } from "../../skills/skill-feedback-loop/scripts/friction-report.mjs";
import { ROOT, run, skillScript, tempDir, tempRepo, write } from "./helpers.mjs";

const PATTERNS = JSON.parse(readFileSync(join(ROOT, "shared", "friction-patterns.json"), "utf8"));
const DAY = 86400e3;

test("every default friction pattern matches its examples and misses its counter-examples", () => {
  for (const p of PATTERNS) {
    const re = new RegExp(p.re, p.flags ?? "i");
    for (const s of p.examples.match) assert.ok(re.test(s), `${p.key} should match: ${s}`);
    for (const s of p.examples.miss) assert.ok(!re.test(s), `${p.key} should miss: ${s}`);
  }
});

test("every friction pattern owner is a skill in this repo or AGENTS.md", () => {
  const skills = new Set(readdirSync(join(ROOT, "skills")));
  for (const p of PATTERNS) assert.ok(p.owner === "AGENTS.md" || skills.has(p.owner), `${p.key} owner ${p.owner}`);
});

/** A Claude transcript for repo with user turns at the given ages (days ago). */
function plant(repo, turns, now = Date.now()) {
  const root = tempDir("sf-claude-");
  const lines = turns.map(([daysAgo, text], i) =>
    JSON.stringify({
      type: "user",
      uuid: `u${i}`,
      timestamp: new Date(now - daysAgo * DAY).toISOString(),
      cwd: repo,
      message: { role: "user", content: text },
    })
  );
  write(join(root, "proj", "s.jsonl"), lines.join("\n"));
  return root;
}

test("friction report counts a planted pattern per window and quotes samples", () => {
  const repo = tempDir("sf-repo-");
  const turns = [
    [1, "it's still broken on the settings page"],
    [2, "you said it was fixed, the test still fails"],
    [3, "still failing after your push"],
    [4, "that is not actually fixed"],
    [5, "still broken for admins"],
    [16, "still broken, check again"],
    [2, "please add a changelog entry"],
    [3, "why did you rename the helper"],
  ];
  process.env.FACTORY_CLAUDE_DIR = plant(repo, turns);
  process.env.FACTORY_CODEX_DIR = tempDir();
  try {
    const rep = frictionReport({ since: "14d", repoPath: repo, patterns: PATTERNS });
    const fd = rep.patterns.find((p) => p.key === "false-done");
    assert.deepEqual([fd.count, fd.previous, fd.trend, fd.owner], [5, 1, "up", "test-evidence"]);
    assert.equal(fd.samples.length, 3);
    assert.equal(rep.patterns[0].key, "false-done", "sorted by count");
    assert.equal(rep.patterns.find((p) => p.key === "unrequested-scope").trend, "new");
    assert.equal(rep.user_turns, 7);
    const other = frictionReport({ since: "14d", repoPath: tempDir(), patterns: PATTERNS });
    assert.equal(other.user_turns, 0, "other repos are excluded");
  } finally {
    delete process.env.FACTORY_CLAUDE_DIR;
    delete process.env.FACTORY_CODEX_DIR;
  }
});

test("friction report exits 2 when there are no transcripts at all", () => {
  const r = run(skillScript("skill-feedback-loop", "friction-report.mjs"), [], {
    cwd: tempRepo(),
    env: { FACTORY_CLAUDE_DIR: tempDir(), FACTORY_CODEX_DIR: tempDir() },
  });
  assert.equal(r.code, 2);
  assert.match(r.err, /Could not run/);
});

const loop = { window: "14d", min_occurrences: 2, max_open_prs: 1, cooldown_windows: 2 };
const friction = (rows) => ({ patterns: rows.map((r) => ({ samples: [], ...r })) });

test("rank picks the top climbing key and respects thresholds, open PRs, and cooldowns", () => {
  const f = friction([
    { key: "false-done", owner: "test-evidence", count: 5, previous: 1, trend: "up" },
    { key: "ai-prose", owner: "prose-cleanup", count: 4, previous: 4, trend: "flat" },
    { key: "stale-branch", owner: "worktree-isolation", count: 3, previous: 0, trend: "new" },
    { key: "status-chase", owner: "AGENTS.md", count: 1, previous: 0, trend: "new" },
  ]);
  const now = Date.parse("2026-10-20T00:00:00Z");
  let r = rank({ friction: f, proposals: [], graduation: [], loop, now });
  assert.equal(r.next.key, "false-done");
  assert.equal(r.next.target, "test-evidence");
  assert.deepEqual(r.candidates.map((c) => c.key), ["false-done", "stale-branch"]);
  assert.ok(r.skipped.some((s) => s.key === "ai-prose" && /flat/.test(s.reason)));

  r = rank({ friction: f, proposals: [{ key: "x", target: "test-evidence", status: "merged", date: "2026-10-10" }], graduation: [], loop, now });
  assert.equal(r.next.key, "stale-branch", "test-evidence is cooling down");

  r = rank({ friction: f, proposals: [{ key: "y", target: "agent-memory", status: "open", date: "2026-10-18" }], graduation: [], loop, now });
  assert.equal(r.next, null, "one proposal already open uses the whole budget");
});

test("followUp flags a merged proposal that did not move its number in two windows", () => {
  const f = friction([{ key: "false-done", owner: "test-evidence", count: 5, previous: 5, trend: "flat" }]);
  const merged = { key: "false-done", target: "test-evidence", status: "merged", baseline: 5 };
  const now = Date.parse("2026-11-30T00:00:00Z");
  assert.equal(followUp([{ ...merged, date: "2026-11-25" }], f, loop, now)[0].flag_for_revert, false, "too soon to judge");
  const old = followUp([{ ...merged, date: "2026-10-01" }], f, loop, now)[0];
  assert.deepEqual([old.moved, old.flag_for_revert], [false, true]);
  const better = friction([{ key: "false-done", owner: "test-evidence", count: 1, previous: 5, trend: "down" }]);
  assert.equal(followUp([{ ...merged, date: "2026-10-01" }], better, loop, now)[0].moved, true);
});

test("collect-signals end to end: transcripts, ledger, memory, no gh", () => {
  const repo = tempRepo();
  const claude = plant(repo, [[1, "still broken"], [2, "you said it was fixed"], [3, "it's still failing"]]);
  const env = { FACTORY_CLAUDE_DIR: claude, FACTORY_CODEX_DIR: tempDir() };
  const L = (...a) => run(skillScript("run-ledger", "ledger.mjs"), a, { cwd: repo, env });
  L("start", "--class", "bugfix", "--size", "small");
  L("touch", "current", "--beat", "prove", "--kind", "correction");
  write(
    join(repo, ".factory", "memory", "npx-warm.md"),
    "---\nname: npx-warm\ndescription: warm the npx cache on macOS CI\ntype: pitfall\nsource: https://x.test/1\ncreated: 2026-09-01\nuses: 4\nstatus: confirmed\n---\nbody\n"
  );
  const r = run(skillScript("skill-feedback-loop", "collect-signals.mjs"), ["--no-gh"], { cwd: repo, env });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /Next: friction "false-done" -> test-evidence \(3 this window, 0 before\)/);
  assert.match(r.out, /Memory ready to graduate: npx-warm/);
  assert.match(r.out, /corrections by beat \{"prove":1\}/);
  const cache = join(repo, ".factory", ".cache");
  assert.ok(existsSync(cache) && readdirSync(cache).some((f) => f.startsWith("signals-")));
});
