import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { run, skillScript, tempRepo } from "./helpers.mjs";

const SETUP = skillScript("factory-setup", "setup.mjs");
const CHECK = skillScript("factory-setup", "check-factory.mjs");
const MARKER = "<!-- factory-setup: software factory section -->";

test("setup on an empty repo creates a valid .factory and AGENTS.md, then is a no-op", () => {
  const repo = tempRepo();
  const dry = run(SETUP, ["--dry-run", "--workflows"], { cwd: repo });
  assert.equal(dry.code, 0, dry.err);
  assert.match(dry.out, /would create {2}\.factory\/config\.json/);
  assert.ok(!existsSync(join(repo, ".factory")), "dry run writes nothing");

  const first = run(SETUP, ["--workflows"], { cwd: repo });
  assert.equal(first.code, 0, first.out + first.err);
  assert.match(first.out, /\.factory\/ validates/);
  assert.ok(existsSync(join(repo, ".factory", ".gitignore")), "gitignore asset is renamed");
  assert.match(readFileSync(join(repo, ".factory", ".gitignore"), "utf8"), /\.cache\//);
  for (const d of ["runs", "proposals", "evals"]) assert.ok(existsSync(join(repo, ".factory", d, ".gitkeep")));
  assert.deepEqual(readdirSync(join(repo, ".github", "workflows")).sort(), ["factory-loop.yml", "factory-monitor.yml", "factory-triage.yml"]);
  const agents = readFileSync(join(repo, "AGENTS.md"), "utf8");
  assert.match(agents, /## Inner loop/);
  assert.ok(agents.includes(MARKER));

  const second = run(SETUP, ["--workflows"], { cwd: repo });
  assert.match(second.out, /No changes/);
  assert.equal(readFileSync(join(repo, "AGENTS.md"), "utf8"), agents);
  assert.equal(run(CHECK, [], { cwd: repo }).code, 0);
});

test("setup appends the factory section to an existing AGENTS.md exactly once", () => {
  const repo = tempRepo();
  writeFileSync(join(repo, "AGENTS.md"), "# Our rules\n\nUse pnpm.\n");
  run(SETUP, [], { cwd: repo });
  run(SETUP, [], { cwd: repo });
  const text = readFileSync(join(repo, "AGENTS.md"), "utf8");
  assert.ok(text.startsWith("# Our rules\n\nUse pnpm.\n"), "existing content is kept");
  assert.equal(text.split(MARKER).length - 1, 1);
  assert.match(text, /## Software factory/);
});

test("setup never overwrites an edited .factory file", () => {
  const repo = tempRepo();
  run(SETUP, ["--no-agents-md"], { cwd: repo });
  const routing = join(repo, ".factory", "routing.json");
  const edited = readFileSync(routing, "utf8").replace('"default": "balanced"', '"default": "fast"');
  writeFileSync(routing, edited);
  run(SETUP, ["--no-agents-md"], { cwd: repo });
  assert.equal(readFileSync(routing, "utf8"), edited);
});
