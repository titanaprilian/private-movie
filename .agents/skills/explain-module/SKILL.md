---
name: explain-module
description: >
  Explain what a module, file, or folder does in this Elysia, React Tanstack, Android TV or packages
  codebase — its purpose, public API, dependencies, data flow, and where it's
  used. Use this whenever the user says "explain this module", "what does this
  file/folder do", "walk me through X", "how does this work", or "help me
  understand this code". Read-only: it never edits anything, only explains.
allowed-tools: Read, Grep, Glob, Bash(git log:*)
argument-hint: "<path to the file, module, or folder to explain>"
---

# Explain Module

Give the explanation you'd want when joining a team and being pointed at an
unfamiliar file: what it's _for_, how to _use_ it, and what to _watch out for_ —
not a line-by-line paraphrase of code the reader can already see.

## 1. Map it

- `Read` the target. If it's a folder, `Glob` it and read the entry point(s) (`index.ts(x)`, the main component, the barrel file) plus the most substantial files.
- Trace imports/exports to understand boundaries: what it depends on (internal modules vs third-party) and what it exposes.
- Find its **consumers**: `Grep` the repo for where the module is imported. Knowing who calls it explains why it's shaped the way it is.
- Optionally check `git log --oneline -- <path>` for recent intent/churn if history clarifies the "why".

## 2. Explain it

Structure the explanation like this (skip sections that don't apply):

```
## <module> — one-line purpose

**What it does** — 2–4 sentences in plain language. The job it owns.

**Public API** — the meaningful exports a consumer uses:
- `useThing(args) → ...` — what it's for
- `<Widget />` props — the important ones and what they control

**Key types** — the central interfaces/types and what they model.

**Data flow** — how data enters, transforms, and leaves. State, effects,
network calls, caching. A short numbered walkthrough of the main path.

**Dependencies** — notable internal modules and external libs it leans on.

**Used by** — where in the app it's consumed (from the grep).

**Gotchas** — non-obvious behavior, sharp edges, invariants, assumptions,
or anything a newcomer would trip on.
```

## Calibrate to the reader

Match depth to the request. "What does this do?" wants the top of the structure
(purpose + public API + one data-flow paragraph). "Walk me through how this
works in detail" wants the full breakdown including the data-flow walkthrough.
Use a small diagram or example call only when it genuinely clarifies. Lead with
the conclusion; don't make the reader assemble it from fragments.
