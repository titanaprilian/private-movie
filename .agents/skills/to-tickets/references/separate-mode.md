# Separate mode

Rules for the **separate** mode (one worktree and branch per ticket, tickets in the same wave can run in parallel). Read this at step 2b only when the mode is separate.

<parallel-safety-rules>
These apply to **separate** mode. (Shared mode has its own rules, in `shared-mode.md`.)

- **Done means merged into the spec branch.** A ticket is done only when it is closed, and a ticket is closed only after the reviewer has merged its branch into the spec branch. A blocked ticket therefore always starts from a spec branch that already contains the work of everything blocking it.
- **Green on its own.** Each ticket must pass its tests against the spec branch plus its own changes alone. It must never rely on a sibling's unmerged work. If a slice cannot go green without another ticket's output, add a blocking edge.
- **Shared Touches need an edge.** If two tickets list the same hotspot and no edge connects them (directly or through a chain), they can be launched in parallel and will collide when the second one merges. Resolve every such pair one of two ways: add an edge to serialize them (the default), or pull the shared hotspot change into its own earlier ticket (a prefactor) that both are blocked by.
- **Chain migrations.** Any two tickets that touch the DB migrations directory must be connected by an edge. Migrations are ordered, and the second must be regenerated after the first merges.
- **Two kinds of edge.** Mark each edge as _needs output_ (the blocker produces something this ticket builds on) or _ordering only_ (conflict avoidance). Both are valid, but ordering-only edges cost parallelism, so the user should see which is which.
- **Waves.** Compute the waves: wave 1 is every ticket with no blockers, wave 2 is every ticket whose blockers are all in wave 1, and so on. Tickets in the same wave can be launched together. Only wave 1 gets worktrees when the tickets are published (step 7); later waves get theirs as their blockers merge.

</parallel-safety-rules>
