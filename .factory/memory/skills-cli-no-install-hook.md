---
name: skills-cli-no-install-hook
description: npx skills add runs no install hook, so it can never write AGENTS.md; sync via plugin hook, npm prepare, or setup.mjs --agents-only
type: fact
source: https://github.com/vercel-labs/skills/blob/main/docs/commands.md#skills-experimental_sync
run: 2026-10-25-ambition-engine-skill-and-agents-e490
created: 2026-10-25
last_used: null
uses: 0
status: observed
---

The vercel-labs skills CLI (add, update, experimental_sync) copies or links skill folders and tracks them in skills-lock.json. It runs nothing from the package. Anything that must change project files after install (the AGENTS.md factory block) needs another trigger: the Claude Code plugin's SessionStart hook, a prepare script in the project's package.json, or the person running factory-setup's setup.mjs --agents-only. Checked 2026-10-25.
