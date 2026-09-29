import assert from "node:assert/strict";
import { test } from "node:test";
import { coerce, parseArgs, parseDuration, slugify, median } from "../../shared/lib/factory.mjs";
import { parseFrontmatter, stringifyFrontmatter } from "../../shared/lib/frontmatter.mjs";
import { validate } from "../../shared/lib/schema.mjs";
import { findSecrets } from "../../shared/lib/secrets.mjs";
import { ROOT, run } from "./helpers.mjs";
import { join } from "node:path";

test("parseArgs handles --k v, --k=v, flags, and repeats", () => {
  const a = parseArgs(["beat", "current", "--set", "a=1", "--set=b=2", "--dry-run", "--dir", "x"]);
  assert.deepEqual(a._, ["beat", "current"]);
  assert.deepEqual(a.set, ["a=1", "b=2"]);
  assert.equal(a["dry-run"], true);
  assert.equal(a.dir, "x");
});

test("parseDuration and coerce", () => {
  assert.equal(parseDuration("2d"), 2 * 86400e3);
  assert.equal(parseDuration("1w"), 7 * 86400e3);
  assert.throws(() => parseDuration("soon"));
  assert.equal(coerce("3"), 3);
  assert.equal(coerce("true"), true);
  assert.equal(coerce("5/5"), "5/5");
});

test("slugify and median", () => {
  assert.equal(slugify("Fix: login redirect (again)!"), "fix-login-redirect-again");
  assert.equal(slugify(""), "task");
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
});

test("schema validator covers the subset the schemas use", () => {
  const schema = {
    type: "object",
    required: ["id"],
    additionalProperties: false,
    properties: {
      id: { type: "string", pattern: "^[a-z]+$" },
      n: { type: "integer", minimum: 0 },
      when: { type: ["string", "null"], format: "date" },
      tags: { type: "array", items: { enum: ["a", "b"] } },
      v: { const: 1 },
    },
  };
  assert.deepEqual(validate(schema, { id: "ok", n: 2, when: null, tags: ["a"], v: 1 }), []);
  const errs = validate(schema, { id: "NO", n: -1, when: "Oct 1", tags: ["c"], v: 2, extra: true });
  assert.equal(errs.length, 6, errs.join("\n"));
  assert.match(validate(schema, {}).join(), /missing required field "id"/);
  assert.match(validate(schema, { id: 5 }).join(), /expected string, got integer/);
});

test("frontmatter round-trips and quotes risky values", () => {
  const data = { name: "x", description: "Has: a colon", uses: 3, tags: ["a", "b"], run: null, flag: "true" };
  const text = stringifyFrontmatter(data, "Body line.\n");
  const back = parseFrontmatter(text);
  assert.deepEqual(back.data, data);
  assert.equal(back.body.trim(), "Body line.");
  assert.equal(parseFrontmatter("no frontmatter").data, null);
  assert.deepEqual(parseFrontmatter("---\r\nname: y\r\n---\r\nbody").data, { name: "y" });
});

test("secret scan finds documented token shapes only", () => {
  assert.deepEqual(findSecrets("token ghp_" + "a".repeat(36)), ["GitHub token"]);
  assert.deepEqual(findSecrets("AKIA" + "A".repeat(16)), ["AWS access key"]);
  assert.deepEqual(findSecrets("-----BEGIN OPENSSH PRIVATE KEY-----"), ["Private key"]);
  assert.deepEqual(findSecrets("use the sk-learn library and a ghp token"), []);
});

test("shared copies in skills match shared/ (sync-shared --check)", () => {
  const r = run(join(ROOT, "scripts", "sync-shared.mjs"), ["--check"]);
  assert.equal(r.code, 0, r.out + r.err);
});
