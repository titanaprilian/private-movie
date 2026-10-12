# Ticket templates

Read this in phase 3 (`publish-tickets.md`, step 6) when you write the ticket bodies.

<issue-template>
## Parent
A reference to the parent issue on the tracker (if the source was an existing issue, otherwise omit this section).

## What to build

The end-to-end behavior this ticket makes work, from the user's perspective — not layer-by-layer implementation.

## Decisions already made

- A design choice the implementer must not revisit (which module to imitate, naming, where the new thing lives, how errors surface).

## Acceptance criteria

- [ ] Criterion 1 — checkable by running something or observing a specific behavior; names the test tier that proves it
- [ ] Criterion 2

## Out of scope

- Tempting adjacent work that belongs to another ticket or to no ticket.

## Stop and report if

- A specific condition under which the agent should stop and report instead of improvising.

## Blocked by

- #<issue-number> — one line per blocking ticket, or the single line "None — can start immediately". In shared mode, always includes the previous ticket.

## Base

<delivery branch, e.g. spec/42-admin-sidebar-redesign>

## Worktree

<exactly one of: "own — a worktree and branch ticket/<issue-number> for this ticket alone; merged into the Base branch after review" or "shared — the shared worktree, working directly on the Base branch; one commit per ticket, no merge">

## Touches

- <shared hotspot directory this ticket changes>, or "None".

## Location

- <anchor doc, e.g. AGENTS.md / ADR / glossary entry relevant to this ticket>
- <directory or module this ticket works in>
  </issue-template>

In the ticket body, avoid specific file paths or code snippets in the body, acceptance criteria, or "What to build" — they go stale fast. The **Location** and **Touches** sections are the exceptions by design: Location holds directories and anchor-doc references so a fresh agent doesn't have to wander, and Touches names the shared hotspot directories so tickets can be checked for conflicts. Directories and docs are coarse and stable enough to survive normal churn. Do not put individual file paths even there — point to the containing directory or doc, not the file. **Base** names a branch, not a file, and **Worktree** is one of the two fixed lines. "Decisions already made", "Out of scope", and "Stop and report if" are written as prose statements about choices and conditions, not as paths or code.

Exception to the no-snippets rule: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.
