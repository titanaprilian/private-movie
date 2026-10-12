# Shared mode

Rules for the **shared** mode (one worktree on the delivery branch, tickets done one at a time in order). Read this at step 2b only when the mode is shared.

<shared-mode-rules>
These apply to **shared** mode. The tickets never run side by side, so none of the parallel-safety rules in `separate-mode.md` are needed: no wave computation, no conflict analysis between tickets.

- **One line, in order.** Number the tickets in the order they will be done, so that each builds on the ones before it. Every ticket after the first is blocked by the one before it. Mark that edge _needs output_ when it genuinely builds on it, otherwise _ordering only_. This is what makes the order enforceable: an implementing agent refuses to start a ticket whose blocker isn't closed.
- **Done means reviewed and committed on the delivery branch.** Each ticket ends as one commit on the delivery branch (`#<issue> — <title>`), and the ticket is closed only after the reviewer has approved it. A ticket is never started before the previous one is closed.
- **Green on its own.** Each ticket must pass its tests with the previous tickets' commits plus its own changes. It must never rely on a later ticket.
- **Independent tickets are still sequential.** Two tickets that could have run in parallel are done one after the other here. That is the point of the mode: don't try to preserve their independence.

</shared-mode-rules>
