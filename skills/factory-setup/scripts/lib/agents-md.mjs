// GENERATED from shared/lib/agents-md.mjs by scripts/sync-shared.mjs. Edit the source, then run it.
// Keeps the software factory's section of a repo's AGENTS.md current. The
// section sits between two markers; the factory owns what is inside and
// replaces it on upgrade, the repo owns everything outside. The begin marker
// records a digest of what was written, so a block someone edited by hand is
// reported instead of overwritten.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const END = "<!-- software-factory:end -->";
export const LEGACY_MARKER = "<!-- factory-setup: software factory section -->";
const BEGIN_RE = /<!-- software-factory:begin kind=(full|section) version=(\S+) sha=([0-9a-f]{12})[^\n]*-->\n/;
const SPLIT_RE = /^#{2,3} Repo-specific\b/m;

// Digests of the factory-owned part of the v3.0.0 templates, which had only
// LEGACY_MARKER. A legacy section that still matches was never edited, so
// upgrading it loses nothing.
const PRISTINE_LEGACY = new Set(["782f076543ce", "8ffe4cac8e75"]);

const lf = (s) => s.replace(/\r\n/g, "\n");
export const digest = (s) => createHash("sha256").update(lf(s).trim()).digest("hex").slice(0, 12);

/** A template is the factory-owned part, then the repo-specific stub the repo fills in once. */
export function splitTemplate(text) {
  const t = lf(text);
  const m = t.match(SPLIT_RE);
  return m ? { owned: t.slice(0, m.index).trim(), stub: t.slice(m.index).trim() } : { owned: t.trim(), stub: "" };
}

export function managedBlock(kind, owned, version) {
  return (
    `<!-- software-factory:begin kind=${kind} version=${version} sha=${digest(owned)} ` +
    `(factory-setup replaces this block on upgrade; keep repo rules outside it) -->\n${owned.trim()}\n${END}`
  );
}

/** Reads the bundled templates from a factory-setup assets directory. */
export function loadTemplates(assets) {
  const version = existsSync(join(assets, "VERSION")) ? readFileSync(join(assets, "VERSION"), "utf8").trim() : "0.0.0";
  return {
    full: readFileSync(join(assets, "AGENTS.md"), "utf8"),
    section: readFileSync(join(assets, "agents-section.md"), "utf8"),
    version,
  };
}

/**
 * Plans the AGENTS.md change for one repo. `current` is the file's text, or
 * null when there is none. Returns { action, text, from, to }, where text is
 * the new file for create, append, update, and migrate. The other actions
 * leave the file alone: current (nothing to do), edited and legacy-edited
 * (the factory part was changed by hand; pass replaceEdited to take the new
 * version anyway), and broken (a begin marker with no end).
 */
export function planAgentsMd(current, { full, section, version, replaceEdited = false }) {
  const tpl = { full: splitTemplate(full), section: splitTemplate(section) };
  const to = version;
  if (current === null || !current.trim())
    return { action: "create", to, text: `${managedBlock("full", tpl.full.owned, version)}\n\n${tpl.full.stub}\n` };

  const eol = current.includes("\r\n") ? "\r\n" : "\n";
  const out = (t) => (eol === "\n" ? t : t.replace(/\n/g, eol));
  const text = lf(current);

  const m = text.match(BEGIN_RE);
  if (m) {
    const [, kind, from, sha] = m;
    const start = m.index + m[0].length;
    const end = text.indexOf(END, start);
    if (end < 0) return { action: "broken", from, to };
    const inner = text.slice(start, end).trim();
    const owned = tpl[kind].owned;
    if (inner === owned) return { action: "current", from, to };
    if (digest(inner) !== sha && !replaceEdited) return { action: "edited", from, to };
    const next = text.slice(0, m.index) + managedBlock(kind, owned, version) + text.slice(end + END.length);
    return { action: "update", from, to, text: out(next) };
  }

  const at = text.indexOf(LEGACY_MARKER);
  if (at >= 0) {
    const after = text.slice(at + LEGACY_MARKER.length);
    // v3.0.0 either appended the short section after the marker, or created
    // the whole file and put the marker at the end.
    const appended = /^\s*## Software factory/.test(after);
    const kind = appended ? "section" : "full";
    const old = appended ? after : text.slice(0, at);
    const cut = old.match(SPLIT_RE);
    const owned = cut ? old.slice(0, cut.index) : old;
    if (!PRISTINE_LEGACY.has(digest(owned)) && !replaceEdited) return { action: "legacy-edited", from: "3.0.0", to };
    const stub = cut ? old.slice(cut.index).trim() : tpl[kind].stub;
    const head = appended ? `${text.slice(0, at).trimEnd()}\n\n` : "";
    const tail = appended ? "" : after.trim() ? `\n${after.trim()}\n` : "";
    const next = `${head}${managedBlock(kind, tpl[kind].owned, version)}\n\n${stub}\n${tail}`;
    return { action: "migrate", from: "3.0.0", to, text: out(next) };
  }

  // A repo with its own AGENTS.md: add the short section, and the stub only
  // if the repo does not already have a repo-specific heading.
  const stub = SPLIT_RE.test(text) ? "" : `\n\n${tpl.section.stub}`;
  const next = `${text.trimEnd()}\n\n${managedBlock("section", tpl.section.owned, version)}${stub}\n`;
  return { action: "append", to, text: out(next) };
}
