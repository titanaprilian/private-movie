---
name: pragmatic-code-review
description: "Review the work produced by implementer agent(s) in isolated git worktrees. When multiple implementors run concurrently, waits for all tickets in the batch to complete before reviewing. If an implementor blocks or needs a decision, intervenes immediately. Validates acceptance criteria, re-runs typecheck, lint and tests, and hunts code smells with core Pragmatic Programmer principles. On Request changes, posts feedback and re-prompts the implementor window. On approval, lands the work, closes the ticket, kills the implementor tmux window, and at the end of the batch launches the next ready worktrees. Never pushes to the remote."
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

## Multi-implementor synchronization

Check running implementors in tmux (`tmux list-panes -F '#{@ticket}' | grep -E '^impl-'`):

- **Zero-token idle rule:** The orchestrator must NEVER poll, sleep, or loop checking on implementors. Every poll wastes tokens and tool calls. Once launched, the orchestrator sits completely idle until an implementor sends its completion or blocker notification.
- **Partial completion in parallel batch:** When a notification arrives from ticket #<id>, if other implementors in the batch are still running, acknowledge the completion, state which tickets are still running, and **immediately end your reply**. Do not sleep or poll. Wait to be woken by the remaining notifications.
- **Immediate blocker intervention:** If any implementor reports `BLOCKED` or `NEEDS-DECISION`, do **not** wait for the others. Intervene immediately to help that implementor resolve the issue, then end your reply and wait.
- **Batch review execution:** Once every running implementor in the batch has delivered its notification (`DONE`), execute the review workflow on each completed ticket sequentially (Phases 1–4). Phase 5 runs **only once at the very end of the batch**.

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

**Request changes: re-prompt the implementor and wait.** Do not merge, close, or clean up. Post the report on the ticket, then send the re-prompt message directly to the implementor's split pane (`impl-<id>` or `impl-shared`):

```bash
gh issue comment <id> --body-file - <<'EOF'
<the full report>
EOF

tag="impl-<id>" # or "impl-shared"
pane="$(tmux list-panes -F '#{pane_id} #{@ticket}' | awk -v t="$tag" '$2==t {print $1}')"
if [ -n "$pane" ]; then
  msg="Review feedback posted on #<id> (Request changes). Please address the blocking findings from the review comment and report back."
  tmux send-keys -t "$pane" -l -- "$msg"
  sleep 0.5
  tmux send-keys -t "$pane" Enter
fi
```

The worktree, branch, DB, and tmux pane stay open. Do not create new worktrees. **End your reply immediately and remain idle** until the implementor sends its revised notification. Do not poll or sleep.

**Waiting on something external** (user decision, third-party response, another spec): **read `exceptions.md`, section "Block a ticket"**, follow it, then stop. Do not merge, close, clean up, or create worktrees.

**Approve or Approve with follow-ups: continue to Phase 4.**

### Phase 4: Land, close, clean up (approval only)

Do this immediately, without confirmation. **Read `land-and-close.md` and follow it exactly.** It lands the work on `Base`, closes the ticket, cleans up the worktree and test DB, and kills the implementor's split pane. If landing fails (rebase conflict, failing re-verification), the review becomes **Request changes**: that file tells you how to post the finding.

In a multi-ticket batch, proceed to review the next completed ticket in the batch (repeat Phases 1–4).

### Phase 5: Plan the next worktrees and launch (end of batch)

Run Phase 5 **only once at the very end of the batch**, after all approved tickets have landed and their implementor panes are closed: **read `next-worktrees.md` and follow it.** It covers `scripts/wt-init.sh --ready`, creating new worktrees, and launching the next batch of implementors via `scripts/wt-launch.sh`. Do not start implementing anything yourself.

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
