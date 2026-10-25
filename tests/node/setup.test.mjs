import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { END, LEGACY_MARKER, managedBlock, planAgentsMd } from "../../shared/lib/agents-md.mjs";
import { FIXTURES, ROOT, run, skillScript, tempRepo } from "./helpers.mjs";

const SETUP = skillScript("factory-setup", "setup.mjs");
const CHECK = skillScript("factory-setup", "check-factory.mjs");
const BEGIN = "<!-- software-factory:begin";
const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;
const fixture = (name) => readFileSync(join(FIXTURES, "agents-md", name), "utf8");
const count = (text, s) => text.split(s).length - 1;

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
  assert.ok(agents.includes(`${BEGIN} kind=full version=${VERSION} `));
  assert.ok(agents.indexOf(END) < agents.indexOf("## Repo-specific"), "the repo-specific part sits outside the block");

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
  assert.equal(count(text, BEGIN), 1);
  assert.equal(count(text, "### Repo-specific"), 1);
  assert.match(text, /kind=section/);
  assert.match(text, /## Software factory/);
});

test("an upgrade replaces only the marked block and keeps the repo's text around it", () => {
  const repo = tempRepo();
  const file = join(repo, "AGENTS.md");
  const old = managedBlock("section", "## Software factory\n\nThe old workflow text.", "3.0.9");
  writeFileSync(file, `# Our rules\n\nUse pnpm.\n\n${old}\n\n### Repo-specific\n\n- **Commands:** pnpm test\n`);

  const r = run(SETUP, ["--agents-only"], { cwd: repo });
  assert.equal(r.code, 0, r.out + r.err);
  assert.match(r.out, /update factory section \(3\.0\.9 -> \d/);
  assert.ok(!existsSync(join(repo, ".factory")), "--agents-only leaves .factory alone");
  const text = readFileSync(file, "utf8");
  assert.ok(text.startsWith("# Our rules\n\nUse pnpm.\n\n"));
  assert.ok(text.endsWith("### Repo-specific\n\n- **Commands:** pnpm test\n"), "the filled-in section survives");
  assert.ok(!text.includes("The old workflow text."));
  assert.match(text, /`ambition-engine`/);
  assert.match(run(SETUP, ["--agents-only"], { cwd: repo }).out, /No changes/);
});

test("a block edited by hand is reported, not overwritten, until --replace-edited", () => {
  const repo = tempRepo();
  const file = join(repo, "AGENTS.md");
  run(SETUP, ["--agents-only"], { cwd: repo });
  const edited = readFileSync(file, "utf8").replace("## Inner loop", "## Inner loop\n\nOur own extra rule.");
  writeFileSync(file, edited);

  const kept = run(SETUP, ["--agents-only"], { cwd: repo });
  assert.match(kept.out, /edited by hand/);
  assert.equal(readFileSync(file, "utf8"), edited);

  const replaced = run(SETUP, ["--agents-only", "--replace-edited"], { cwd: repo });
  assert.equal(replaced.code, 0, replaced.out);
  assert.ok(!readFileSync(file, "utf8").includes("Our own extra rule."));
});

test("a pristine v3.0.0 section migrates to the marked block; an edited one waits", () => {
  const section = fixture("v3.0.0-section.md");
  const appended = `# Our rules\n\nUse pnpm.\n\n${LEGACY_MARKER}\n${section.replace("- **Commands:** install, dev, test, typecheck, lint, exactly as typed.", "- **Commands:** pnpm test")}`;
  const r = planAgentsMd(appended, { full: fixture("v3.0.0-AGENTS.md"), section, version: "9.9.9" });
  assert.equal(r.action, "migrate");
  assert.ok(r.text.startsWith("# Our rules\n\nUse pnpm.\n\n<!-- software-factory:begin kind=section version=9.9.9"));
  assert.ok(!r.text.includes(LEGACY_MARKER));
  assert.match(r.text, /- \*\*Commands:\*\* pnpm test/, "the filled-in section survives");

  const full = fixture("v3.0.0-AGENTS.md");
  const created = `${full}\n${LEGACY_MARKER}\n`;
  const c = planAgentsMd(created, { full, section, version: "9.9.9" });
  assert.equal(c.action, "migrate");
  assert.ok(c.text.startsWith("<!-- software-factory:begin kind=full version=9.9.9"));
  assert.equal(count(c.text, "## Repo-specific"), 1);

  const handEdited = created.replace("## Rules", "## Rules\n\n- Our own rule.");
  assert.equal(planAgentsMd(handEdited, { full, section, version: "9.9.9" }).action, "legacy-edited");
});

test("CRLF files stay CRLF, and a begin marker with no end is left alone", () => {
  const tpl = { full: "# F\n\nfull\n\n## Repo-specific\n\n- x\n", section: "## S\n\nsection\n\n### Repo-specific\n\n- x\n", version: "1.0.0" };
  const r = planAgentsMd("# Ours\r\n\r\nUse pnpm.\r\n", tpl);
  assert.equal(r.action, "append");
  assert.equal(r.text.replace(/\r\n/g, "").includes("\n"), false, "no bare LF in a CRLF file");

  const broken = `${managedBlock("section", "## S\n\nsection", "1.0.0").replace(END, "")}\n`;
  assert.equal(planAgentsMd(broken, tpl).action, "broken");
  assert.equal(planAgentsMd(r.text, tpl).action, "current");
  assert.equal(planAgentsMd("\n", tpl).action, "create", "an empty file is treated as missing");
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
