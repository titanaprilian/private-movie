---
name: to-tickets
description: "Break a plan, spec, or the current conversation into a set of tracer-bullet tickets written for cheaper implementing agents — each ticket declares its blocking edges, the hotspots it touches, the decisions already made, its delivery branch, how it is worked (its own worktree, or one worktree shared by the whole set), and the location context a fresh agent needs to avoid wandering — then create the ready-to-use git worktree(s) and report where to launch each agent. Two modes: separate (one worktree per ticket, merged into a shared spec branch, tickets can run in parallel) or shared (one worktree on the delivery branch, tickets done in order, one commit each). Published as GitHub issues, one per ticket, with native blocking links plus Base, Worktree, Touches and Location sections."
disable-model-invocation: true
---

# To Tickets

Break a plan, spec, or conversation into a set of **tickets** — tracer-bullet vertical slices, each declaring the tickets that **block** it, the **hotspots** it touches, the **decisions already made**, its **delivery branch**, how it is **worked** (its worktree mode), and the **location context** a fresh agent needs to start without wandering.

You are a stronger agent, launched by hand to do the planning. The tickets you write will later be picked up by **cheaper agents**, also launched by hand. An agent works in whatever directory it was started in, so you create the git worktree(s) (step 7) and the user starts each agent inside the right one; an implementing agent never sets up or switches to its own worktree.

There are two **modes**, chosen with the user in step 4:

- **Separate** — every ticket gets its own worktree and branch (`ticket/<id>`). Tickets without blockers can be worked in parallel. Each ticket's branch is reviewed and then merged into one shared **spec branch** (the ticket's **Base**), never directly into main.
- **Shared** — the whole set is worked in **one** worktree that sits directly on the delivery branch (also the tickets' **Base**). Tickets are done one at a time, in order, one commit per ticket, each reviewed before the next starts. Nothing is merged per ticket, because the work is already on the delivery branch.

In both modes, when every ticket is done a single pull request from the delivery branch to main finishes the work; that is `/push-to-github`'s job, not this skill's.

Cheaper agents have less judgment and less patience for ambiguity, so the ticket has to carry the judgment: every design decision, boundary, and tripwire you can foresee gets written down here, so the implementing agent only has to execute. In separate mode, the blocking edges and Touches lists you write are also what keep parallel work from colliding.

## Rules of engagement (always apply, in every phase)

- **Never reset or force an existing delivery branch.** Other tickets may already be merged into it.
- **Never push the delivery branch and never open a PR.** Only `/push-to-github` talks to the remote, at the end.
- **Never close or modify the parent issue.**
- **Never use `FORCE=1` on `wt-init.sh`.** It skips the blocker check.
- **Never leave worktree setup for the implementing agent.** Create the worktree(s) and verify their setup yourself before handing off.
- **Never implement a ticket yourself.** You plan, publish, and prepare; cheaper agents implement.

## Workflow

Do the phases in order. Read each reference file **only when you reach its phase** (the mode file is read at step 2b), and follow it exactly. Do not read ahead.

### Phase 1: Explore and slice (steps 1–3)

**Read `explore-and-slice.md` now and follow it.** It covers gathering context, exploring the codebase, proposing the mode (step 2b), and drafting vertical slices. At step 2b it tells you which mode file to read: `separate-mode.md` or `shared-mode.md`. Read only that one.

### Phase 2: Quiz the user (step 4)

**Read `quiz-user.md` and follow it.** It settles the mode and delivery branch, presents the breakdown, and iterates until the user approves. If the user picks the other mode, `explore-and-slice.md` step 2b says how to redo the edges.

### Phase 3: Prepare the branch and publish (steps 5–6)

Only after the user approves the breakdown: **read `publish-tickets.md` and follow it.** It covers preparing the delivery branch and publishing one GitHub issue per ticket. **Read `templates.md` when you write the ticket bodies.**

### Phase 4: Create the worktree(s) and report (steps 7–8)

Only after the tickets are published: **read `worktrees-and-launch.md` and follow it.** It covers creating and verifying the worktree(s) and the launch plan you give the user.

## Reference files

| File                      | Read when                                                            |
| ------------------------- | -------------------------------------------------------------------- |
| `explore-and-slice.md`    | Phase 1, starting the work (steps 1–3)                               |
| `separate-mode.md`        | Step 2b, the mode is separate (or the user switches to it in step 4) |
| `shared-mode.md`          | Step 2b, the mode is shared (or the user switches to it in step 4)   |
| `quiz-user.md`            | Phase 2, presenting the breakdown (step 4)                           |
| `publish-tickets.md`      | Phase 3, the user approved the breakdown (steps 5–6)                 |
| `templates.md`            | Phase 3, writing the ticket bodies                                   |
| `worktrees-and-launch.md` | Phase 4, the tickets are published (steps 7–8)                       |
