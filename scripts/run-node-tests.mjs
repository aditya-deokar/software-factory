#!/usr/bin/env node
// Runs tests/node/*.test.mjs with the built-in runner. Listing files
// explicitly works on Node 18, which has no glob support in `node --test`,
// and keeps the runner out of unrelated folders that happen to hold tests.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "node");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort()
  .map((f) => join(dir, f));

if (!files.length) {
  console.error("No tests found in tests/node. Could not run.");
  process.exit(2);
}
const r = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(r.status ?? 1);
