import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { run, skillScript, tempDir, write } from "./helpers.mjs";

const CHECK = skillScript("factory-setup", "check-factory.mjs");

const validRun = {
  schema: 1,
  id: "2026-10-01-demo-abcd",
  task: { class: "bugfix", size: "small" },
  harness: "claude-code",
  beats: { ship: { pr: 3, review_rounds: 1 } },
  memories: { used: [], written: [] },
  human_touches: [],
  started_at: "2026-10-01T10:00:00Z",
};

function factory() {
  const dir = tempDir("sf-factory-");
  write(join(dir, "runs", `${validRun.id}.json`), validRun);
  write(join(dir, "routing.json"), {
    schema: 1,
    tiers: { fast: { "claude-code": "haiku" }, balanced: { "claude-code": "sonnet" } },
    default: "balanced",
    rules: [{ id: "docs", match: { class: "docs" }, tier: "fast" }],
  });
  write(
    join(dir, "friction-patterns.json"),
    [{ key: "false-done", label: "Not actually fixed", owner: "test-evidence", re: "still broken", examples: { match: ["it is still broken"], miss: ["it works"] } }]
  );
  write(
    join(dir, "memory", "flaky-ci.md"),
    "---\nname: flaky-ci\ndescription: The macOS runner times out on first npx call\ntype: pitfall\nsource: https://x.test/pr/1\ncreated: 2026-10-01\nuses: 0\nstatus: observed\n---\n\nRetry once.\n"
  );
  write(join(dir, "memory", "INDEX.md"), "# Memory\n\n- [flaky-ci](flaky-ci.md) - The macOS runner times out\n");
  return dir;
}

test("a valid .factory passes with exit 0", () => {
  const r = run(CHECK, [factory()]);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /1 run/);
  assert.match(r.out, /Factory data OK/);
});

test("problems are reported precisely with exit 1", () => {
  const dir = factory();
  write(join(dir, "runs", "2026-10-02-bad-0001.json"), { ...validRun, id: "2026-10-02-other-0001", harness: "" });
  write(join(dir, "routing.json"), {
    schema: 1,
    tiers: { fast: {} },
    default: "balanced",
    rules: [{ id: "a", match: {}, tier: "frontier" }],
  });
  write(
    join(dir, "friction-patterns.json"),
    [{ key: "k", label: "Label here", owner: "x", re: "broken", examples: { match: ["fine"], miss: ["broken"] } }]
  );
  write(join(dir, "memory", "orphan.md"), "---\nname: orphan\ndescription: short\ntype: fact\nsource: x\ncreated: 2026-10-01\nuses: 0\nstatus: observed\n---\nghp_" + "a".repeat(36) + "\n");
  const r = run(CHECK, [dir]);
  assert.equal(r.code, 1, r.out);
  for (const expected of [
    /id "2026-10-02-other-0001" does not match the file name/,
    /\$\.harness: shorter than 1/,
    /default tier "balanced" is not defined/,
    /rule "a" uses undefined tier "frontier"/,
    /"k" should match: "fine"/,
    /"k" should not match: "broken"/,
    /orphan\.md: \$\.description: shorter than 10/,
    /looks like it contains a secret/,
    /missing from memory\/INDEX\.md/,
  ])
    assert.match(r.out, expected);
});

test("missing or empty directory exits 2, never 0", () => {
  assert.equal(run(CHECK, [join(tempDir(), "nope")]).code, 2);
  const r = run(CHECK, [tempDir()]);
  assert.equal(r.code, 2);
  assert.match(r.out, /Could not run/);
});
