# Explore and slice

Phase 1 of `/to-tickets`: steps 1–3. Read the mode file named in step 2b when you reach it, and no other reference file until its phase.

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a reference (a spec path, an issue number or URL) as an argument, fetch it and read its full body and comments.

If the source is a spec issue, read these parts of it closely:

- **Implementation Decisions** — the source of each ticket's "Decisions already made". Carry over the ones that apply to a ticket, restated so they stand alone.
- **Hotspots** — the shared areas the spec as a whole will change.
- **Delivery** — the `Branch:` line naming the spec branch (see step 4).
- **Open questions** — decisions the spec left unsettled. Never guess these; raise them with the user in step 4.

### 2. Explore the codebase (mandatory)

Explore the codebase to understand its current state. For every area the plan touches, do all of the following before drafting slices:

- **Locate the nearest anchor docs** for that area — `AGENTS.md`, ADRs, domain glossary, package-level README — the stable references that state the conventions an agent must follow there.
- **Note the directory boundaries** for that area — the module or package root an agent will actually work in (e.g. `packages/dsa/`, `src/modules/auth/`), not individual files.
- **Find the pattern to imitate** — an existing module in the same codebase that already does something similar. A cheaper agent follows an example far more reliably than it invents a structure. Note it at module or directory level.
- **Note the hotspots** — shared resources that many tickets tend to edit and that merge badly when two branches change them at once: the DB schema and migrations directory, shared type or contract packages, generated files such as the router's route tree, lockfiles, and root config. Record them at directory level.

Ticket titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 2b. Propose the mode

Before slicing, propose a **mode** so you know which rules apply, then read the matching file now: `separate-mode.md` or `shared-mode.md`. Read only that one.

**Mode.** Recommend one, say why in a sentence, and let the user choose:

- Recommend **shared** when the work has no parent spec (it came from the direct-to-ticket path), or has two tickets or fewer, or when every ticket is chained to the previous one so nothing could run in parallel anyway.
- Recommend **separate** when at least two tickets could run in parallel (they share a wave) and the user wants that speed.
- The user's choice always wins. If they prefer a single worktree even for independent tickets, use shared mode and apply the shared-mode rules.

If the user picks the other mode in step 4, read the other mode file and redo only the blocking edges, the ordering (waves in separate mode, one line in order in shared mode) and the Touches check. Keep the slices, decisions, and Location lists as drafted, then present the revised breakdown for approval again.

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets.

<vertical-slice-rules>
- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests) — vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window of a cheaper agent: one focused behavior with few moving parts. When in doubt, split. This holds in both modes: sharing a worktree doesn't make a ticket any bigger than one agent session.
- Any prefactoring should be done first
</vertical-slice-rules>

Give each ticket its **blocking edges** — the other tickets that must complete before it can start. A ticket with no blockers can start immediately.

Give each ticket its own **Location** list, drawn from what step 2 found for the area(s) that ticket touches — don't point to a shared list elsewhere; a ticket may be picked up by an agent that never sees the other tickets or the parent issue, so it must be self-contained. Some overlap across tickets (e.g. the same `AGENTS.md` appearing in several) is expected and fine.

Give each ticket its own **Touches** list — the hotspots from step 2 that this ticket will change, at directory level, or "None". In separate mode, Touches is for the conflict check between tickets that run in parallel. In both modes the reviewer uses it to catch a ticket that changes a shared hotspot it was never meant to touch. It is not for the implementing agent's navigation (that is Location's job). If a ticket touches a hotspot the parent spec did not list, tell the user in step 4: the spec's check against other in-flight specs never considered it.

Apply the rules in the mode file you read in step 2b (`separate-mode.md` or `shared-mode.md`), together with the cheaper-agent rules below.

<cheaper-agent-rules>
- **Decide here, not there.** Every design choice the implementer would otherwise have to make — which pattern to follow, naming, where a new thing lives, how errors are surfaced — is made in the ticket and written under "Decisions already made". The implementing agent should never have to choose between two reasonable architectures.
- **Verifiable criteria.** Every acceptance criterion must be checkable by running something or observing a specific behavior, and should say which test tier(s) prove it. Avoid criteria like "works well" or "is clean".
- **Say what is out of scope.** Cheaper agents wander into adjacent problems. List the tempting neighbors explicitly — nearby code that looks wrong but belongs to another ticket, refactors that are not this ticket's job — under "Out of scope".
- **Plant tripwires.** Name the specific conditions under which the agent should stop and report instead of improvising — for example, a blocker's behavior not being present on the delivery branch, or a hotspot directory already containing unexpected changes. Write these under "Stop and report if".
- **Point at the example.** Name the existing module to imitate (from step 2) in Location or Decisions, at module or directory level.
</cheaper-agent-rules>

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change — rename a column, retype a shared symbol — whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**. First expand: add the new form beside the old so nothing breaks. Then migrate the call sites over in batches sized by blast radius (per package, per directory), each batch its own ticket blocked by the expand, keeping CI green batch to batch because the old form still exists. Finally contract: delete the old form once no caller remains, in a ticket blocked by every migrate batch. Every ticket is reviewed on its own and must stay green, so if even the batches can't stay green alone, don't spread the refactor across tickets: keep it as one deliberately large ticket and tell the user in step 4 that it is large and may need a stronger agent.
