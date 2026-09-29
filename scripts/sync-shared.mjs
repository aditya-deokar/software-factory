#!/usr/bin/env node
/**
 * Copies shared/lib and shared/schemas into every skill that needs them.
 *
 * Skills install one at a time (npx skills add --skill x), so a script inside
 * one skill cannot import from another skill's folder. Each skill carries its
 * own copy; this script keeps the copies identical to shared/.
 *
 * Usage: node scripts/sync-shared.mjs          write the copies
 *        node scripts/sync-shared.mjs --check  exit 1 if any copy drifted
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

const ALL_SCHEMAS = ["run", "memory", "routing", "friction-patterns", "config", "proposal"];

// Destination directory -> what it needs. Keep in step with each script's imports.
export const TARGETS = {
  "skills/run-ledger/scripts": { lib: ["factory", "transcripts", "schema"], schemas: ["run"] },
  "skills/agent-memory/scripts": {
    lib: ["factory", "frontmatter", "schema", "secrets"],
    schemas: ["memory", "run"],
  },
  "skills/skill-feedback-loop/scripts": {
    lib: ["factory", "transcripts", "frontmatter", "schema"],
    schemas: ["friction-patterns", "proposal"],
  },
  "skills/model-routing/scripts": { lib: ["factory", "schema", "transcripts", "frontmatter"], schemas: ["routing"] },
  "skills/factory-setup/scripts": {
    lib: ["factory", "frontmatter", "schema", "secrets"],
    schemas: ALL_SCHEMAS,
  },
  hooks: { lib: ["factory"], schemas: [] },
};

// Data files copied verbatim: [source, destination].
export const COPIES = [
  ["AGENTS.md", "skills/factory-setup/assets/AGENTS.md"],
  ["shared/friction-patterns.json", "skills/factory-setup/assets/factory/friction-patterns.json"],
  ["shared/friction-patterns.json", "skills/skill-feedback-loop/assets/friction-patterns.json"],
];

const header = (src) =>
  `// GENERATED from ${src} by scripts/sync-shared.mjs. Edit the source, then run it.\n`;

function expected() {
  const files = new Map();
  for (const [dest, need] of Object.entries(TARGETS)) {
    for (const name of need.lib) {
      const src = `shared/lib/${name}.mjs`;
      files.set(`${dest}/lib/${name}.mjs`, header(src) + readFileSync(join(ROOT, src), "utf8"));
    }
    for (const name of need.schemas) {
      const src = `shared/schemas/${name}.schema.json`;
      files.set(`${dest}/schemas/${name}.schema.json`, readFileSync(join(ROOT, src), "utf8"));
    }
  }
  for (const [src, dest] of COPIES) files.set(dest, readFileSync(join(ROOT, src), "utf8"));
  return files;
}

const files = expected();
const problems = [];

for (const [rel, content] of files) {
  const abs = join(ROOT, rel);
  const current = existsSync(abs) ? readFileSync(abs, "utf8").replace(/\r\n/g, "\n") : null;
  if (current === content.replace(/\r\n/g, "\n")) continue;
  if (CHECK) problems.push(`${rel} ${current === null ? "is missing" : "differs from its source"}`);
  else {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    console.log(`wrote ${rel}`);
  }
}

// A copy left behind after a target stopped needing it is drift too.
for (const dest of Object.keys(TARGETS)) {
  for (const sub of ["lib", "schemas"]) {
    const dir = join(ROOT, dest, sub);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const rel = relative(ROOT, join(dir, f)).replace(/\\/g, "/");
      if (!files.has(rel)) problems.push(`${rel} is not produced by sync-shared (stale copy?)`);
    }
  }
}

if (problems.length) {
  for (const p of problems) console.log(`  ERROR  ${p}`);
  console.log(`\n${problems.length} shared-copy problem(s). Run: node scripts/sync-shared.mjs`);
  process.exit(1);
}
console.log(CHECK ? `Shared copies OK (${files.size} files).` : `Synced ${files.size} files.`);
