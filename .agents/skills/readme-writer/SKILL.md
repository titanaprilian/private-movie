---
name: readme-writer
description: "Generate or improve the root README.md for a repository by actually exploring the codebase (entry points, package.json/workspace config, AGENTS.md, existing docs) rather than templating generic sections. Always defers to AGENTS.md as the source of truth for architecture claims. Use whenever the user asks to write, generate, improve, or fix up a README, or says the README is outdated/thin/generic."
---

# README Writer

Writes a root `README.md` that is accurate to the actual repository, not a
generic template. Scope is the **root README only** — do not create or edit
per-package READMEs (e.g. under `packages/*`) unless the user explicitly
asks for one.

## 1. Read before writing

Do this in order, and only write once you've done it:

1. **`AGENTS.md`** (or equivalent, e.g. `CONTRIBUTING.md`, `ARCHITECTURE.md`)
   — if present, this is the **source of truth** for architecture, patterns,
   and anti-patterns. Any architecture claim in the README must match it.
   If the README would otherwise contradict AGENTS.md, AGENTS.md wins —
   never write something you know conflicts with it.
2. **Existing `README.md`** (if any) — see what's already there, what's
   stale, what's worth keeping verbatim (badges, license text, links).
3. **Root `package.json` / workspace config** (`pnpm-workspace.yaml`,
   `turbo.json`, etc.) — real scripts, real workspace layout, real
   dependencies. Never invent a script name or command; quote only what's
   actually defined.
4. **Entry points** — `src/index.ts`, `src/app.ts`, or whatever AGENTS.md
   points to as the entry. Confirm the factory/module pattern in use (e.g.
   a `createApp(deps)` factory) by reading it, not assuming it from memory
   of past projects.
5. **`.env.example`** or similar — real required environment variables.

If AGENTS.md doesn't exist yet, say so and offer to still proceed by reading
the code directly — don't block on it.

## 2. What goes in the README

Include only sections that are true and useful for _this_ repo — skip any
section below that doesn't apply rather than padding with boilerplate:

- **Title + one-line description** — what the thing is, in plain language.
- **Stack** — the real stack, as found in package.json/lockfile, not a
  guess (e.g. "Elysia + Bun, Drizzle ORM, Postgres" only if that's actually
  what's there).
- **Architecture** — a short summary in your own words of what AGENTS.md
  describes (factory pattern, module layout, Deep Modules boundaries if
  applicable) — don't just copy AGENTS.md verbatim; link to it for depth
  instead: "See `AGENTS.md` for the full architecture and anti-patterns."
- **Getting started** — install, env setup, run dev, run tests — using the
  _actual_ commands from package.json scripts.
- **Project structure** — a short tree of top-level dirs with a one-line
  purpose each, only as deep as helps orientation (don't enumerate every
  file).
- **Testing** — if the repo has a named testing strategy (e.g. a tiered
  strategy documented in AGENTS.md), name it in one line and link out
  rather than re-explaining it.
- **License / contributing** — only if a LICENSE file or CONTRIBUTING doc
  exists; link, don't duplicate.

## 3. Writing style

- Prefer short, scannable sections over long prose. Use code blocks for
  every command.
- Never state something about the architecture that you haven't verified
  by reading AGENTS.md or the actual code in this pass.
- If something is genuinely ambiguous (e.g. no AGENTS.md, no clear entry
  point, no scripts defined), ask the user directly rather than guessing —
  but don't over-ask; most repos have enough signal from steps 1–5.
- Don't add a "Contributing" or "License" section if there's nothing to
  link — an absent section is better than an empty one.

## 4. Delivery

Write the file as `README.md` at the repo root (overwrite the existing one
after showing what changed, if one exists). This is a direct file edit in
the user's repo, not a chat artifact — use the file tools, not a document
artifact. After writing, give a short summary of what changed and why
(e.g. "removed the outdated Docker section since there's no Dockerfile;
added the real test command from package.json").
