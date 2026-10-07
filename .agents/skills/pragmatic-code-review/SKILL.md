---
name: pragmatic-code-review
description: "Review the work another agent produced for one ticket, in its isolated git worktree. Validates acceptance criteria, re-runs typecheck, lint and tests, and hunts code smells with core Pragmatic Programmer principles. On approval it lands the work on the local spec branch (rebase, re-verify, fast-forward), closes the ticket, cleans up, then looks at what is now unblocked and creates the next worktrees: one per ready ticket when several can run in parallel, a single one when only one is ready, none when everything left is still blocked. Never pushes to the remote."
---

# Pragmatic Code Review

A non-interactive review workflow for **checking another agent's implementation of one ticket**, then moving the delivery forward. The implementer hands back work in an isolated worktree. You are the reviewer and the orchestrator: verify the checks, read the diff, judge it against Pragmatic Programmer principles, write the report, and, on approval, land the work and prepare the next worktrees.

There are two kinds of tickets. The ticket's `## Worktree` section says which one it is.

- **own**: the ticket has its own worktree `../wt/ticket-<id>` and branch `ticket/<id>`, cut from the local `Base` branch. On approval you merge it into `Base`.
- **shared**: the ticket was done directly on the `Base` branch inside the shared worktree `../wt/<Base minus spec/>`, as one commit per ticket. There is nothing to merge. On approval you only close the ticket.

Rules of engagement:

- **Do not modify the code under review.** Findings go in the report. Fixes are the implementer's job.
- **Do not interview the user or ask clarifying questions mid-review.** Record ambiguity as an assumption or open question in the report and keep going.
- **Review the change, not the whole codebase.** Stay anchored to the ticket.
- **Approval is automatic and complete.** Land, close, clean up, and create the next worktrees without asking for confirmation.
- **Never push, never force-push, never open a PR.** The local `Base` branch is the source of truth during the work. Only `/push-to-github` talks to the remote, at the end.
- **Never touch the main checkout's working tree or its checked-out branch.** All git work happens in worktrees or with ref operations.

## Step 1 — Establish scope and verify the checks

1. **Find the ticket.** `gh issue view <n>`. Read the acceptance criteria, `Decisions already made`, `Out of scope`, `Touches`, `Base`, and `Worktree`. Note whether it is own or shared.
2. **Go to the worktree.** Use the path the implementer gave you.
   - own: `../wt/ticket-<id>`. Confirm `git branch --show-current` is `ticket/<id>`.
   - shared: `../wt/<Base minus spec/>`. Confirm the branch equals `Base`.
3. **Find the change.**
   - own: `git diff <base>...ticket/<id>` (the work committed as `#<id> — <title>`; if the implementer left it as `WIP` or uncommitted, note that as a finding).
   - shared: the implementer reports a review range. If they did not, find the commits with `git log --oneline --grep='^#<id>' <base>`. Review only those commits (`git diff <first>^..<last>`), not earlier tickets.
4. **Verify the checks yourself.** In the worktree, run `bun run typecheck`, `bun run lint`, and the tests (`bun run test`, never bare `bun test`). Do not take the implementer's word. The worktree's own test database is already isolated.
5. **Read beyond the diff.** For each changed file, read enough of the surrounding code and its callers to judge whether the change fits.

## Step 2 — Check the ticket first

Answer these plainly before hunting smells:

- Does the change satisfy **every** acceptance criterion? Note any that are missing, partial, or only accidentally satisfied.
- Does it respect `Decisions already made` and stay inside `Out of scope`?
- Is there **scope creep**: unrelated refactors, extra features, speculative options the ticket never asked for?
- Did it touch files outside `Touches` in a way that could collide with parallel tickets?
- Are there **tests** proportionate to the change, asserting behaviour rather than implementation?
- Do typecheck, lint, and tests pass?

Unmet acceptance criteria and failing checks are automatically blocking.

## Step 3 — Diagnose against the principles

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

## Step 4 — Write the report

Write the report to a scratch file (for example `review-<id>.md` outside the repo) and also give it as your reply. Structure:

```
# Review: <ticket title / #number>

**Verdict:** Approve | Approve with follow-ups | Request changes
**Reviewed:** <branch or commit range>, <N files changed>
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
<same format; worth fixing but not worth holding the merge>

## Follow-ups (pre-existing or out of scope)
<smells in untouched code, candidates for separate tickets, one line each>

## What's good
<one to three specific things done well>
```

Verdict rules:

- **Request changes**: any unmet acceptance criterion, failing check, or blocking finding (correctness risk, contract/validation hole, a boundary violation that will be costly to undo).
- **Approve with follow-ups**: criteria met; only non-blocking findings and/or out-of-scope follow-ups remain.
- **Approve**: criteria met and nothing worth raising beyond "what's good."

Omit empty sections, except the verdict, acceptance criteria, and assumptions line.

## Step 5 — Request changes: stop here

If the verdict is **Request changes**, do not merge, close, or clean up. Post the report and leave the ticket open. The worktree, branch, and test database stay for the implementer to resume.

```bash
gh issue comment <id> --body-file <report.md>
```

Then stop. Do not create new worktrees: the ticket is not done, so nothing it blocks is unblocked.

## Step 5.5 — Block a ticket (external dependency)

If the ticket cannot proceed because it is waiting on external input (user decision, third-party response, another spec, etc.), do not merge, close, or clean up. Instead:

1. **Add the `blocked` label** to the ticket:
   ```bash
   gh issue edit <id> --add-label "blocked"
   ```
2. **Post a comment** explaining exactly what is needed and who/what it is waiting on.
3. **Stop.** Do not create new worktrees for tickets this one blocks until the dependency is resolved.

To unblock later, the user (or another agent) removes the `blocked` label and re-runs the workflow.

## Step 6 — Land, close, clean up (on approval)

Do this immediately, without confirmation. Run git commands from the main repository root unless a step says otherwise, and never leave the main checkout on a different branch than you found it.

### own tickets

1. **Take the merge lock.** Several reviewers may land tickets at the same time. Only one may advance `Base` at once.
   ```bash
   LOCK="$(git rev-parse --git-common-dir)/merge.lock"
   until mkdir "$LOCK" 2>/dev/null; do sleep 5; done
   trap 'rmdir "$LOCK" 2>/dev/null' EXIT
   ```
   If you waited more than 10 minutes and the lock directory is older than that, a previous reviewer crashed: remove it and continue.
2. **Rebase onto the latest local Base**, inside the ticket worktree. Another ticket may have landed since the implementer started.
   ```bash
   git -C ../wt/ticket-<id> status --porcelain   # must be empty
   git -C ../wt/ticket-<id> rebase <base>        # LOCAL base, never origin/<base>
   ```
   If the rebase conflicts, run `git rebase --abort`, release the lock, and treat the review as **Request changes**: add a blocking finding "conflicts with the base branch: rebase and resolve", post it (Step 5), and stop.
3. **Re-verify if the rebase moved anything.** If the branch tip changed, re-run `bun run typecheck`, `bun run lint`, and `bun run test` in the worktree. A failure here is **Request changes** with the failing output as the finding.
4. **Advance Base to the verified tip without touching the main checkout.** The result must be a fast-forward.
   ```bash
   OLD="$(git rev-parse <base>)"
   git merge-base --is-ancestor "$OLD" ticket/<id>   # must succeed, else go back to step 2
   git worktree list --porcelain                      # is <base> checked out anywhere?
   ```
   - If `Base` is **not** checked out in any worktree: `git update-ref refs/heads/<base> ticket/<id> "$OLD"` (compare-and-swap; it fails if someone moved `Base`, then go back to step 2).
   - If `Base` **is** checked out in some worktree: `git -C <that worktree> merge --ff-only ticket/<id>`.
5. **Release the lock.** `rmdir "$LOCK"`.
6. **Close the ticket with the report.**
   ```bash
   gh issue close <id> --reason completed --comment "$(cat <report.md>)"
   ```
7. **Clean up.** Use the same Postgres host and credentials that `scripts/wt-setup.sh` used (`BASE_DATABASE_URL` or the main checkout's env). Only ever drop the database named exactly `test_ticket_<id>`.
   ```bash
   psql "$ADMIN_DATABASE_URL" -c 'DROP DATABASE IF EXISTS "test_ticket_<id>"'
   git worktree remove ../wt/ticket-<id> --force
   git branch -d ticket/<id>          # lowercase -d: refuses if it was not merged
   ```
   If `git branch -d` refuses, something went wrong in step 4: stop and report it instead of forcing.

### shared tickets

Nothing to merge or rebase: the commit is already on `Base`. Close the ticket with the report.

```bash
gh issue close <id> --reason completed --comment "$(cat <report.md>)"
```

Leave the shared worktree and its database alone. The next ticket of the set uses them.

## Rollback (on request)

If a merged ticket is found to be faulty and needs reverting:

1. **Identify the commit** before the problematic ticket:
   ```bash
   git reflog spec/<slug>
   ```
   Find the commit hash just before the ticket's merge (look for `#<ticket-id> —` in commit messages).

2. **Rewind the spec branch**:
   ```bash
   git checkout spec/<slug>
   git reset --hard <commit-hash>
   ```
   This rewinds the branch to a clean state before the faulty ticket.

3. **Reopen the ticket** for rework:
   ```bash
   gh issue reopen <ticket-id>
   ```

⚠️ **Use with caution**: Only do this if the faulty ticket hasn't been built upon by other tickets. If subsequent tickets depend on it, coordinate with the team to revert multiple tickets in order.

## Step 7 — Plan the next worktrees

The ticket is now closed, so the tickets it blocked may have become ready. Look at the whole delivery, then create exactly the worktrees that are needed. Run from the main repository root:

```bash
bash scripts/wt-init.sh --ready <base>
```

Each output line is `number<TAB>state<TAB>mode<TAB>detail<TAB>title`, for the open tickets that belong to this `Base`:

- `ready`: every blocker is closed and no worktree exists yet.
- `active`: an implementer is already working (own worktree exists, or a shared commit is already on `Base`).
- `blocked`: still waiting on open tickets (listed in the detail).

Act on it:

| What you see                           | What to do                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Several `ready` tickets                | They can run in parallel (the ticket graph already guarantees ready tickets do not overlap). Create **one worktree per ready ticket**: `bash scripts/wt-init.sh <n>` for each. |
| Exactly one `ready` ticket             | Create **one** worktree: `bash scripts/wt-init.sh <n>`. This covers both "only one ticket was left" and "the others are still blocked".                                        |
| No `ready`, some `active` or `blocked` | Create **no** worktree. Say what is being waited on: which tickets are active, and which open tickets block the blocked ones.                                                  |
| No open tickets left                   | The delivery is complete. Create nothing. Tell the user to run `/push-to-github`.                                                                                              |

Notes:

- `wt-init.sh <n>` is idempotent and reads the ticket's own `Worktree` section. For an own ticket it creates `../wt/ticket-<n>` from the **local** `Base` and runs `wt-setup.sh`. For a shared ticket it links the existing shared worktree and runs `wt-setup.sh --shared`, so in a shared set the next ticket reuses the same worktree and only one ticket is ever `ready` at a time.
- Do not create a worktree for an `active` or `blocked` ticket, and do not use `FORCE=1`.
- If `wt-init.sh` fails for one ticket, report the error and continue with the others.
- Do not start implementing anything yourself.

## Step 8 — Hand back

End with the report, then a short **Next** block the user can act on:

- What landed: own tickets were fast-forwarded into the local `Base`; shared tickets were closed in place.
- For each worktree you created: its absolute path, the ticket number and title, and the line to run: open a fresh agent **inside that directory** and invoke `/implement <n>`.
- Or: "Nothing ready: #a, #b are in progress, #c waits on #a." Or: "All tickets are done. Run `/push-to-github`."

Do not push `Base` to origin: that is `/push-to-github`'s job. Do not fix review findings and do not open new tickets unless explicitly asked.
