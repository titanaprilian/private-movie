# Review checklist (Phase 1)

## Step 1: Establish scope and verify the checks

1. **Find the ticket.** `gh issue view <n>`. Read the acceptance criteria, `Decisions already made`, `Out of scope`, `Touches`, `Base`, and `Worktree`. Note whether it is own or shared.
2. **Go to the worktree.** Use the path the implementer gave you.
   - own: `../wt/ticket-<id>`. Confirm `git branch --show-current` is `ticket/<id>`.
   - shared: `../wt/<Base minus spec/>`. Confirm the branch equals `Base`.
3. **Find the change.**
   - own: `git diff <base>...ticket/<id>` (the work committed as `#<id> — <title>`; if the implementer left it as `WIP` or uncommitted, note that as a finding).
   - shared: the implementer reports a review range. If they did not, find the commits with `git log --oneline --grep='^#<id>' <base>`. Review only those commits (`git diff <first>^..<last>`), not earlier tickets.
4. **Verify the checks yourself.** In the worktree, run `bun run typecheck`, `bun run lint`, and the tests (`bun run test`, never bare `bun test`). Do not take the implementer's word. The worktree's own test database is already isolated.
5. **Read beyond the diff.** For each changed file, read enough of the surrounding code and its callers to judge whether the change fits.

## Step 2: Check the ticket first

Answer these plainly before hunting smells:

- Does the change satisfy **every** acceptance criterion? Note any that are missing, partial, or only accidentally satisfied.
- Does it respect `Decisions already made` and stay inside `Out of scope`?
- Is there **scope creep**: unrelated refactors, extra features, speculative options the ticket never asked for?
- Did it touch files outside `Touches` in a way that could collide with parallel tickets?
- Are there **tests** proportionate to the change, asserting behaviour rather than implementation?
- Do typecheck, lint, and tests pass?

Unmet acceptance criteria and failing checks are automatically blocking.

## Step 3: Diagnose against the principles

Classify every smell under **one** principle so the implementer knows what rule is violated.

| Principle                           | What to look for                                                                                                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DRY (knowledge duplication)**     | Same _knowledge_ expressed in two places (not just copy-pasted text): duplicated validation rules, duplicated business logic across a route and a component, schema drift between Drizzle models and TanStack types |
| **Orthogonality**                   | Changing one thing forces changes elsewhere; tight coupling; a UI change that requires touching the DB layer                                                                                                        |
| **Deep Modules / shallow modules**  | Wide interfaces, leaky abstractions, a "God" module/hook/component doing too much or exposing too much; new code that bypasses an existing module's public interface                                                |
| **Broken windows**                  | Dead code, stale TODOs, inconsistent patterns, one hacky exception that invites more hacks, especially ones the change **introduced**                                                                               |
| **Programming by coincidence**      | Code that works but nobody can explain why; magic values; untested assumptions about ordering/timing                                                                                                                |
| **Tracer bullets / reversibility**  | Big-bang changes with no incremental path; decisions that are expensive to undo (baked-in schema choices, hard framework lock-in)                                                                                   |
| **YAGNI / good-enough software**    | Speculative abstraction, config for hypothetical futures, over-engineering relative to the ticket's actual need                                                                                                     |
| **Design by contract / assertions** | Missing input validation, no pre/post-condition checks, silent failure paths, swallowed errors                                                                                                                      |
| **Stack conventions**               | Elysia route handlers doing DB + validation + business logic inline instead of delegating to deep modules; Drizzle queries scattered instead of centralized; TanStack Router loaders bypassing the module boundary  |

### Calibrating what to flag

- **Blame the change, not the history.** A smell the diff _introduced or worsened_ is a finding. A smell in untouched code is a **follow-up**, never a reason to block this ticket.
- **Prefer few, real findings over many nitpicks.** If you cannot name the concrete cost (bug risk, change friction, onboarding cost), drop it.
- **Respect "good enough."** Flagging under-engineering is as valid as flagging over-engineering.
- **Verify before asserting.** Every finding points at a specific file and line or symbol you actually read.

When done, return to the workflow: next is Phase 2 (write the report).
