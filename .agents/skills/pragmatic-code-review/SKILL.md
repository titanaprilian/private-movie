---
name: pragmatic-code-review
description: "Review the work another agent produced for one ticket, in its isolated git worktree. Validates acceptance criteria, re-runs typecheck, lint and tests, and hunts code smells with core Pragmatic Programmer principles. On approval it lands the work on the local spec branch (rebase, re-verify, fast-forward), closes the ticket, cleans up, then looks at what is now unblocked and creates the next worktrees: one per ready ticket when several can run in parallel, a single one when only one is ready, none when everything left is still blocked. Never pushes to the remote."
---

# Pragmatic Code Review

A non-interactive review workflow for **checking another agent's implementation of one ticket**, then moving the delivery forward. The implementer hands back work in an isolated worktree. You are the reviewer and the orchestrator: verify the checks, read the diff, judge it against Pragmatic Programmer principles, write the report, and, on approval, land the work and prepare the next worktrees.

There are two kinds of tickets. The ticket's `## Worktree` section says which one it is.

- **own**: the ticket has its own worktree `../wt/ticket-<id>` and branch `ticket/<id>`, cut from the local `Base` branch. On approval you merge it into `Base`.
- **shared**: the ticket was done directly on the `Base` branch inside the shared worktree `../wt/<Base minus spec/>`, as one commit per ticket. There is nothing to merge. On approval you only close the ticket.

## Rules of engagement (always apply, in every phase)

- **Do not modify the code under review.** Findings go in the report. Fixes are the implementer's job.
- **Do not interview the user or ask clarifying questions mid-review.** Record ambiguity as an assumption or open question in the report and keep going.
- **Review the change, not the whole codebase.** Stay anchored to the ticket.
- **Approval is automatic and complete.** Land, close, clean up, and create the next worktrees without asking for confirmation.
- **Never push, never force-push, never open a PR.** The local `Base` branch is the source of truth during the work. Only `/push-to-github` talks to the remote, at the end.
- **Never touch the main checkout's working tree or its checked-out branch.** All git work happens in worktrees or with ref operations.

## Workflow

Do the phases in order. Read each reference file **only when you reach its phase**, and follow it exactly. Do not read ahead.

### Phase 1: Review

**Read `review-checklist.md` now and follow it.** It covers finding the ticket and the change, re-running typecheck/lint/tests yourself, checking acceptance criteria, and diagnosing smells against the principles table.

### Phase 2: Report

When the review is done, **read `report-template.md`, then compose the report.** The report lives in a GitHub comment on the ticket, never in a file, so do not write it to disk or into the repo. Keep it ready and also give it as your reply. It gets posted in Phase 3 (Request changes) or in the closing comment in Phase 4 (Approve). consult /gh-cli for the safe mechanics.

### Phase 3: Verdict and branching

Verdict rules:

- **Request changes**: any unmet acceptance criterion, failing check, or blocking finding (correctness risk, contract/validation hole, a boundary violation that will be costly to undo).
- **Approve with follow-ups**: criteria met; only non-blocking findings and/or out-of-scope follow-ups remain.
- **Approve**: criteria met and nothing worth raising beyond "what's good."

Then branch:

**Request changes: stop here.** Do not merge, close, or clean up. Post the report and leave the ticket open. The worktree, branch, and test database stay for the implementer to resume.

```bash
gh issue comment <id> --body-file - <<'EOF'
<the full report>
EOF
```

Do not create new worktrees: the ticket is not done, so nothing it blocks is unblocked. Then stop.

**Waiting on something external** (user decision, third-party response, another spec): **read `exceptions.md`, section "Block a ticket"**, follow it, then stop. Do not merge, close, clean up, or create worktrees.

**Approve or Approve with follow-ups: continue to Phase 4.**

### Phase 4: Land, close, clean up (approval only)

Do this immediately, without confirmation. **Read `land-and-close.md` and follow it exactly.** Never leave the main checkout on a different branch than you found it. If landing fails (rebase conflict, failing re-verification), the review becomes **Request changes**: that file tells you how to post the finding. Then stop.

### Phase 5: Plan the next worktrees and hand back (after landing)

Only after the ticket is closed: **read `next-worktrees.md` and follow it.** It covers `scripts/wt-init.sh --ready`, which worktrees to create, and the final hand-back block. Do not start implementing anything yourself.

## Other situations

- **Rollback of a merged ticket (only on explicit request):** read `exceptions.md`, section "Rollback".

## Reference files

| File                  | Read when                                                   |
| --------------------- | ----------------------------------------------------------- |
| `review-checklist.md` | Phase 1, starting the review                                |
| `report-template.md`  | Phase 2, writing the report                                 |
| `land-and-close.md`   | Phase 4, verdict is Approve or Approve with follow-ups      |
| `next-worktrees.md`   | Phase 5, ticket is closed                                   |
| `exceptions.md`       | The ticket must be blocked, or the user asks for a rollback |

Do not push `Base` to origin: that is `/push-to-github`'s job. Do not fix review findings and do not open new tickets unless explicitly asked.
