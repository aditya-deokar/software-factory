// Shared test helpers: temp git repos and paths into the shipped skill copies.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FIXTURES = join(ROOT, "tests", "fixtures");
export const skillScript = (skill, file) => join(ROOT, "skills", skill, "scripts", file);

export function tempDir(prefix = "sf-test-") {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** A fresh git repo on the given branch, with one commit. */
export function tempRepo(branch = "agent/test") {
  const dir = tempDir("sf-repo-");
  const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", branch);
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "test");
  writeFileSync(join(dir, "README.md"), "test\n");
  git("add", "-A");
  git("commit", "-q", "-m", "init");
  return dir;
}

export function write(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content, null, 2));
}

/** Runs a node script, returns { code, out, err }. */
export function run(script, args, { cwd, env } = {}) {
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
