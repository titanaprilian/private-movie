---
name: pragmatic-code-review
description: "Review the work another agent produced while implementing a ticket inside its isolated worktree. Validates acceptance criteria, runs checks (typecheck/lint/test), and hunts code smells using core Pragmatic Programmer principles. On approval, merges the ticket branch into the spec delivery branch locally, cleans up the worktree and test database, and closes the ticket. Never pushes to remote."
---

# Pragmatic Code Review

A non-interactive review workflow for **checking another agent's implementation of a ticket**. The implementer hands back a local branch (`ticket/<id>`) inside an isolated worktree (`wt/ticket-<id>`). You are the reviewer: verify the checks, read the diff against the spec branch, judge it against Pragmatic Programmer principles, and hand back a report.

Rules of engagement:

- **Do not modify the code under review.** Findings go in the report; fixes are the implementer's job (or a later ticket's).
- **Do not interview the user or ask clarifying questions mid-review.** If something is ambiguous, record it as an assumption or an open question in the report and keep going.
- **Review the change, not the whole codebase.** Stay anchored to the ticket.
- **Approval auto-merges and closes** (Step 5). If approved, you will locally merge the branch into the spec branch, clean up the worktree and database, and close the ticket automatically. You do **not** push to GitHub; pushing is handled separately.

## Step 1 — Establish scope & Verify checks

1. **Find the ticket.** Read its description and acceptance criteria (`gh issue view <n>`). This defines "done".
2. **Navigate to the worktree.** The implementer should have given you the absolute path to their worktree (e.g. `../wt/ticket-<id>`). Move into it.
3. **Verify the checks.** Do not just take the implementer's word. Inside their worktree, run:
   - `bun run typecheck`
   - `bun run lint`
   - The targeted tests or `bun run test` (as appropriate for the changes).
4. **Find the change.** Identify the `Base` branch from the ticket (usually `spec/<slug>`). Get the diff (`git diff <base>...ticket/<id>`).
5. **Read beyond the diff.** For each changed file, read enough of the surrounding code and its callers/importers to judge whether the change fits.

## Step 2 — Check the ticket first

Before hunting smells, answer these plainly:

- Does the change satisfy **every** acceptance criterion? Note any that are
  missing, partial, or only accidentally satisfied.
- Is there **scope creep** — unrelated refactors, extra features, speculative
  options the ticket never asked for?
- Are there **tests** proportionate to the change (following the repo's
  testing tiers), and do they assert behaviour rather than implementation?
- Do the repo's own checks pass (typecheck, lint, tests) if you can run them?

Unmet acceptance criteria and failing checks are automatically blocking.

## Step 3 — Diagnose against the principles

Classify every smell under **one** principle so the implementer knows what rule
is being violated, not just that something looks off.

| Principle                           | What to look for                                                                                                                                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **DRY (knowledge duplication)**     | Same _knowledge_ expressed in two places (not just copy-pasted text) — duplicated validation rules, duplicated business logic across a route and a component, schema drift between Drizzle models and TanStack types |
| **Orthogonality**                   | Changing one thing forces changes elsewhere; tight coupling; a UI change that requires touching the DB layer                                                                                                         |
| **Deep Modules / shallow modules**  | Wide interfaces, leaky abstractions, a "God" module/hook/component doing too much or exposing too much; new code that bypasses an existing module's public interface                                                 |
| **Broken windows**                  | Dead code, stale TODOs, inconsistent patterns, one hacky exception that invites more hacks — especially ones the change **introduced**                                                                               |
| **Programming by coincidence**      | Code that works but nobody can explain why; magic values; untested assumptions about ordering/timing                                                                                                                 |
| **Tracer bullets / reversibility**  | Big-bang changes with no incremental path; decisions that are expensive to undo (e.g. baked-in schema choices, hard framework lock-in)                                                                               |
| **YAGNI / good-enough software**    | Speculative abstraction, config for hypothetical futures, over-engineering relative to the ticket's actual need                                                                                                      |
| **Design by contract / assertions** | Missing input validation, no pre/post-condition checks, silent failure paths, swallowed errors                                                                                                                       |
| **Stack conventions**               | Elysia route handlers doing DB + validation + business logic inline instead of delegating to deep modules; Drizzle queries scattered instead of centralized; TanStack Router loaders bypassing the module boundary   |

### Calibrating what to flag

- **Blame the change, not the history.** A smell the diff _introduced or
  worsened_ is a finding. A smell that already existed in untouched code is a
  **follow-up** (see the report format), never a reason to block this ticket.
- **Prefer few, real findings over many nitpicks.** If you can't name the
  concrete cost (bug risk, change friction, onboarding cost), drop it.
- **Respect "good enough."** Don't demand abstraction the ticket doesn't need;
  flagging under-engineering is as valid as flagging over-engineering.
- **Verify before asserting.** Every finding must point at a specific file and
  line/symbol you actually read.

## Step 4 — Write the report

Deliver the report as the final reply (or as a PR review comment / file if the
invoking task says where it should go). Use this structure:

```
# Review: <ticket title / #number>

**Verdict:** Approve | Approve with follow-ups | Request changes
**Reviewed:** <branch/PR/commit range>, <N files changed>
**Assumptions / open questions:** <anything you couldn't resolve, or "none">

## Acceptance criteria
- [x] <criterion> — met (<where / how verified>)
- [ ] <criterion> — not met / partial (<why>)

## Blocking findings
### 1. <short title>
- **Where:** <file:line or symbol>
- **Principle violated:** <from the table>
- **Why it matters:** <concrete cost>
- **Suggested fix:** <specific enough for the implementer to act on>

## Non-blocking findings
<same format; things worth fixing but not worth holding the merge>

## Follow-ups (pre-existing or out of scope)
<smells noticed in untouched code — candidates for separate tickets, one line each>

## What's good
<one to three specific things done well, so they get repeated>
```

Verdict rules:

- **Request changes** — any unmet acceptance criterion, failing check, or
  blocking finding (correctness risk, contract/validation hole, a boundary
  violation that will be costly to undo).
- **Approve with follow-ups** — criteria met; only non-blocking findings and/or
  out-of-scope follow-ups remain.
- **Approve** — criteria met and nothing worth raising beyond "what's good."

Omit any empty section rather than writing "none," except the verdict,
acceptance criteria, and assumptions line, which are always present.

## Step 5 — Merge, Cleanup, and Close (on approval)

If the verdict is **Approve** or **Approve with follow-ups**, execute the merge and cleanup **immediately and without asking the user for confirmation**:

1. **Merge locally:**
   Checkout the ticket's Base branch (e.g., `spec/<slug>`) in the main repository checkout, and merge the ticket branch into it.
   ```bash
   cd <main-repo-root>
   git checkout <base>
   git merge ticket/<id>
   ```
2. **Close the ticket with the report:**
   Post the review report and close the ticket in one step:
   ```bash
   gh issue close <id> --reason completed --comment-file <report.md>
   ```
3. **Clean up the environment:**
   Drop the isolated test database and remove the worktree/branch.
   ```bash
   dropdb --if-exists test_ticket_<id>
   git worktree remove ../wt/ticket-<id> --force
   git branch -D ticket/<id>
   ```

**If the verdict is "Request changes":**
Do **not** merge, clean up, or close the ticket. Post the report as a comment leaving the ticket open, and leave the worktree, branch, and test database intact for the implementer to resume.

```bash
gh issue comment <id> --body-file <report.md>
```

## Step 6 — Stop

The review ends with the report and, on approval, the merged local branch and cleaned-up environment. Do not push the `spec/<slug>` branch to origin — remote pushing is handled by `/push-to-github`. Do not start implementing fixes or open new tickets unless explicitly asked.
