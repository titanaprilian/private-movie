---
name: to-tickets
description: Break a plan, spec, or the current conversation into a set of tracer-bullet tickets written for cheaper implementing agents — each ticket declares its blocking edges, the hotspots it touches, the decisions already made, its delivery branch, how it is worked (its own worktree, or one worktree shared by the whole set), and the location context a fresh agent needs to avoid wandering — then create the ready-to-use git worktree(s) and report where to launch each agent. Two modes: separate (one worktree per ticket, merged into a shared spec branch, tickets can run in parallel) or shared (one worktree on the delivery branch, tickets done in order, one commit each). Published to the configured tracker — edges, base, worktree mode, touches, and location as text in one file per ticket locally, or native blocking links plus Base, Worktree, Touches and Location sections on a real tracker.
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

## Process

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

<parallel-safety-rules>
These apply to **separate** mode. (Shared mode has its own rules, below.)

- **Done means merged into the spec branch.** A ticket is done only when it is closed, and a ticket is closed only after the reviewer has merged its branch into the spec branch. A blocked ticket therefore always starts from a spec branch that already contains the work of everything blocking it.
- **Green on its own.** Each ticket must pass its tests against the spec branch plus its own changes alone. It must never rely on a sibling's unmerged work. If a slice cannot go green without another ticket's output, add a blocking edge.
- **Shared Touches need an edge.** If two tickets list the same hotspot and no edge connects them (directly or through a chain), they can be launched in parallel and will collide when the second one merges. Resolve every such pair one of two ways: add an edge to serialize them (the default), or pull the shared hotspot change into its own earlier ticket (a prefactor) that both are blocked by.
- **Chain migrations.** Any two tickets that touch the DB migrations directory must be connected by an edge. Migrations are ordered, and the second must be regenerated after the first merges.
- **Two kinds of edge.** Mark each edge as _needs output_ (the blocker produces something this ticket builds on) or _ordering only_ (conflict avoidance). Both are valid, but ordering-only edges cost parallelism, so the user should see which is which.
- **Waves.** Compute the waves: wave 1 is every ticket with no blockers, wave 2 is every ticket whose blockers are all in wave 1, and so on. Tickets in the same wave can be launched together. Only wave 1 gets worktrees when the tickets are published (step 7); later waves get theirs as their blockers merge.
  </parallel-safety-rules>

<shared-mode-rules>
These apply to **shared** mode. The tickets never run side by side, so none of the parallel-safety rules above are needed: no wave computation, no conflict analysis between tickets.

- **One line, in order.** Number the tickets in the order they will be done, so that each builds on the ones before it. Every ticket after the first is blocked by the one before it. Mark that edge _needs output_ when it genuinely builds on it, otherwise _ordering only_. This is what makes the order enforceable: an implementing agent refuses to start a ticket whose blocker isn't closed.
- **Done means reviewed and committed on the delivery branch.** Each ticket ends as one commit on the delivery branch (`#<issue> — <title>`), and the ticket is closed only after the reviewer has approved it. A ticket is never started before the previous one is closed.
- **Green on its own.** Each ticket must pass its tests with the previous tickets' commits plus its own changes. It must never rely on a later ticket.
- **Independent tickets are still sequential.** Two tickets that could have run in parallel are done one after the other here. That is the point of the mode: don't try to preserve their independence.
  </shared-mode-rules>

<cheaper-agent-rules>
- **Decide here, not there.** Every design choice the implementer would otherwise have to make — which pattern to follow, naming, where a new thing lives, how errors are surfaced — is made in the ticket and written under "Decisions already made". The implementing agent should never have to choose between two reasonable architectures.
- **Verifiable criteria.** Every acceptance criterion must be checkable by running something or observing a specific behavior, and should say which test tier(s) prove it. Avoid criteria like "works well" or "is clean".
- **Say what is out of scope.** Cheaper agents wander into adjacent problems. List the tempting neighbors explicitly — nearby code that looks wrong but belongs to another ticket, refactors that are not this ticket's job — under "Out of scope".
- **Plant tripwires.** Name the specific conditions under which the agent should stop and report instead of improvising — for example, a blocker's behavior not being present on the delivery branch, or a hotspot directory already containing unexpected changes. Write these under "Stop and report if".
- **Point at the example.** Name the existing module to imitate (from step 2) in Location or Decisions, at module or directory level.
</cheaper-agent-rules>

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change — rename a column, retype a shared symbol — whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**. First expand: add the new form beside the old so nothing breaks. Then migrate the call sites over in batches sized by blast radius (per package, per directory), each batch its own ticket blocked by the expand, keeping CI green batch to batch because the old form still exists. Finally contract: delete the old form once no caller remains, in a ticket blocked by every migrate batch. Every ticket is reviewed on its own and must stay green, so if even the batches can't stay green alone, don't spread the refactor across tickets: keep it as one deliberately large ticket and tell the user in step 4 that it is large and may need a stronger agent.

### 4. Quiz the user

First, settle the **mode** and the **delivery branch**.

**Mode.** Recommend one, say why in a sentence, and let the user choose:

- Recommend **shared** when the work has no parent spec (it came from the direct-to-ticket path), or has two tickets or fewer, or when every ticket is chained to the previous one so nothing could run in parallel anyway.
- Recommend **separate** when at least two tickets could run in parallel (they share a wave) and the user wants that speed.
- The user's choice always wins. If they prefer a single worktree even for independent tickets, use shared mode and apply the shared-mode rules.

**Delivery branch.** The branch every ticket uses as its Base:

- If the work comes from a spec issue, use the `Branch:` recorded in the spec's Delivery section. If an older spec has none, derive it as `spec/<issue-number>-<slug>` (slug: the spec title in lowercase ASCII, words joined by hyphens, at most five words) and say that you derived it.
- If there is no parent spec, propose a short slug and ask the user to confirm or change it; the branch is `spec/<slug>`.

Then present the proposed breakdown as a numbered list. In separate mode group it by wave; in shared mode list it in the order the tickets will be done. For each ticket, show:

- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first, each marked _needs output_ or _ordering only_
- **What it delivers**: the end-to-end behavior this ticket makes work
- **Decisions already made**: the design choices fixed up front, in one line each
- **Touches**: the hotspots this ticket changes
- **Location**: the anchor docs and directories this ticket points to

If the spec listed **Open questions**, put each one to the user now, one at a time, with your recommended answer. Don't publish tickets that rest on an unsettled decision.

Ask the user:

- Is the mode right (separate worktrees, or one shared worktree)?
- Is the delivery branch name right?
- Does the granularity feel right for a cheaper agent? (too coarse / too fine)
- Are the blocking edges correct — does each ticket only depend on tickets that genuinely gate it? (Shared mode: is the order right?)
- Separate mode only: are the ordering-only edges worth their cost in parallelism, or should the shared hotspot be split into its own prefactor ticket instead? Within each wave, do any two tickets still share a Touches entry without an edge between them?
- Could a cheaper agent finish each ticket without making a design decision? Is any decision still open that you want to settle now?
- Should any tickets be merged or split further?
- Is the Location list for each ticket accurate and sufficient — anything missing that a fresh agent would still have to go hunt for?

Iterate until the user approves the breakdown.

### 5. Prepare the delivery branch

- **Separate mode:** every ticket is built from, and merged into, the delivery branch, so it must exist before any ticket is published. It is a **local** branch: reviewers merge approved tickets into it locally, and nothing is pushed until `/push-to-github` does it at the end. That is also why worktrees are always cut from the local branch, never from `origin/<delivery-branch>`. Create it from the latest default branch (usually `main`) if it isn't there yet. This needs no checkout and does nothing if the branch already exists locally:

  ```bash
  git fetch origin
  git show-ref --verify --quiet refs/heads/<delivery-branch> \
    || if git show-ref --verify --quiet refs/remotes/origin/<delivery-branch>; then
         git branch --no-track <delivery-branch> origin/<delivery-branch>
       else
         git branch --no-track <delivery-branch> origin/<default-branch>
       fi
  ```

  Never reset or force an existing delivery branch: other tickets may already be merged into it.

- **Shared mode:** the branch is created together with the shared worktree in step 7 and stays local until `/push-to-github` pushes it at the end. Only check that the name is free:

  ```bash
  git fetch origin
  git ls-remote --exit-code --heads origin <delivery-branch> >/dev/null 2>&1 && echo "exists on origin"
  git show-ref --verify --quiet refs/heads/<delivery-branch> && echo "exists locally"
  ```

  If the branch already exists, tell the user and ask whether to continue on it (earlier work may already be on it) or pick another name. Never reset or force-push it.

### 6. Publish the tickets to the configured tracker

Publish the approved tickets to GitHub, one issue per ticket, in dependency order (blockers first), using the `gh` CLI. Consult the **gh-cli** skill for the mechanics (auth/repo preflight, safe `--body-file` heredocs, duplicate checks, capturing the returned URL) — don't hand-roll `gh` invocations here. Use the `<issue-template>` below for each body.

**CRITICAL RULES FOR TICKET CREATION:**

1. **Numbering suffix:** You MUST explicitly prefix the title of each ticket issue with its sequential number from the breakdown so the user can easily identify the order in the issue tracker (e.g., `1 — Scaffold Foundation`, `2 — Wire State Management`).
2. **Labeling:** Each generated ticket issue MUST have exactly **two labels** applied to it:
   - The `"ticket"` label (do not omit this!).
   - Exactly ONE of the following category labels based on the work:
     - `"Bug Reports 🐛"` (fixing something that isn't working)
     - `"Feature Requests ✨"` (building new features)
     - `"Enhancements 🚀"` (improving existing features)
     - `"Chores / Tech Debt 🧹"` (maintenance, refactoring, prefactoring)
       _(Example CLI usage: `gh issue create ... --label "ticket" --label "Bug Reports 🐛"`)_.
3. **Blocking edges must be easy for an agent to check.** Use native GitHub sub-issue/blocking relationships where available, AND always write the "Blocked by" section as one `#<issue-number>` reference per line (or the literal line "None — can start immediately"). An implementing agent can then verify with `gh` that every blocker is closed before it starts, without depending on the native links. Because tickets are published blockers-first, every blocker's issue number already exists when you write the ticket that references it. In shared mode this includes the edge from each ticket to the one before it.
4. **Every ticket names its delivery branch** in the "Base" section, the same branch for every ticket in the set.
5. **Every ticket states its worktree mode** in the "Worktree" section, using exactly one of these two lines, the same for every ticket in the set (the first word is what the implementing agent and the reviewer read):
   - `own — a worktree and branch ticket/<issue-number> for this ticket alone; merged into the Base branch after review`
   - `shared — the shared worktree, working directly on the Base branch; one commit per ticket, no merge`

Work the **frontier**: any ticket whose blockers are all done. In separate mode "done" means closed, which means merged into the spec branch, and every ticket on the frontier can be launched in parallel in its own worktree. In shared mode "done" means closed, which means reviewed and committed on the delivery branch, and the frontier is only ever the next ticket in line. For a purely linear chain that means top to bottom.

Do NOT close or modify any parent issue.

### 7. Create and fully set up the worktree(s) (Mandatory)

An agent works in whatever directory it was started in, and an implementor agent should never have to fiddle with worktree initialization, missing databases, or uncopied env files. You MUST create the worktree AND verify that `wt-setup.sh` successfully sets up the environment (copied `.env`, isolated database created, `bun install` completed, and migrations applied) before handing off.

First check that the helper scripts are available on the default branch:

```bash
git fetch origin
git cat-file -e origin/<default-branch>:scripts/wt-init.sh && git cat-file -e origin/<default-branch>:scripts/wt-setup.sh
# shared mode only: wt-init.sh and wt-setup.sh must both support --shared
git show origin/<default-branch>:scripts/wt-init.sh | grep -q -e '--shared'
git show origin/<default-branch>:scripts/wt-setup.sh | grep -q -e '--shared'
```

If a check fails, report which script is missing or too old, fix/commit the missing script capability, and ensure the worktree setup can run cleanly.

Run the setup command from the main checkout:

**Separate mode.** Create one worktree for every ticket on the frontier, and only those: a ticket with an open blocker must start from a spec branch that contains its blocker's work, so its worktree is created later, when the blocker has been merged and closed.

```bash
bash scripts/wt-init.sh <issue-number>
```

The script reads the ticket's Base and Blocked by from the issue, refuses if a blocker is still open, creates `../wt/ticket-<issue-number>` on branch `ticket/<issue-number>` from the spec branch, and automatically prepares it with `scripts/wt-setup.sh`.

**Shared mode.** Create and set up the single worktree for the whole set:

```bash
bash scripts/wt-init.sh --shared <delivery-branch>
```

The script creates the delivery branch from the latest default branch (or reuses it if it exists), links a worktree on it next to the main checkout, and runs `scripts/wt-setup.sh --shared` to create the isolated test database, copy `.env` files, run `bun install`, and execute `db:migrate`.

**Mandatory setup verification:**

- Verify that `wt-setup.sh` ran inside the target worktree and completed with exit code 0, printing `done. ...: database=<name> branch=<branch>`.
- If `wt-setup.sh` failed or was skipped during `wt-init.sh`, do NOT leave it for the implementing agent! Diagnose the root cause, fix it, and execute `bash scripts/wt-setup.sh` (or `bash scripts/wt-setup.sh --shared`) directly inside the worktree so the environment is 100% prepared.
- Verify the worktree's `.env` files point to the isolated database and that the database migrations have completed.
- The implementor must be able to start `/implement` immediately without debugging environment or database setup.
- Never use `FORCE=1` on `wt-init.sh` (it skips the blocker check).
### 8. Report the launch plan

After publishing and creating the worktree(s), give the user a short launch plan so they know what to start and when. Don't write it into the tickets (it goes stale when edges change). Print it in the reply:

- **Mode and delivery branch:** which mode was used, the branch name, and whether you created it or it already existed (the branch is local until the final push, in both modes).
- **Separate mode, launch now, in parallel:** one line per frontier ticket: issue number, title, and the absolute path of its worktree. Tell the user to start a new agent with that directory as its working directory (for example `cd <path>` and then start the agent there) and run `/implement <issue>`. Mention that an agent started in the main checkout would edit the main checkout, so each agent must be started inside its own worktree.
- **Separate mode, not created yet:** every ticket that is still blocked, with the tickets blocking it. When a blocker has been merged and closed, create the worktree with `bash scripts/wt-init.sh <issue-number>` from the main checkout. The review report lists which tickets just became ready.
- **Shared mode, how to run it:** the absolute path of the one worktree, and the tickets in order. Tell the user to start a new agent with that directory as its working directory and run `/implement <first issue>`; when the review has approved and closed it, run `/implement <next issue>` in the same directory (a fresh agent for each ticket is fine). Mention that an agent started in the main checkout would edit the main checkout.
- **If worktree creation was skipped or failed:** the exact command for each affected ticket (or the one `--shared` command), and the reason.
- **When every ticket is closed:** run `/push-to-github` to open the single pull request from the delivery branch to main. That is also the first time the delivery branch is pushed, in both modes.

<local-ticket-template>
# <NN> — <Ticket title>

**What to build:** the end-to-end behavior this ticket makes work, from the user's perspective — not a layer-by-layer implementation list.

**Blocked by:** the numbers/titles of the tickets that gate this one, or "None — can start immediately". In shared mode, always includes the previous ticket.

**Base:** <delivery branch, e.g. spec/42-admin-sidebar-redesign>

**Worktree:** <own — a worktree and branch ticket/<issue-number> for this ticket alone; merged into the Base branch after review | shared — the shared worktree, working directly on the Base branch; one commit per ticket, no merge>

**Decisions already made:**

- <design choice the implementer must not revisit, e.g. which module to imitate, naming, where the new thing lives>

**Out of scope:**

- <tempting adjacent work that belongs to another ticket or to no ticket>

**Stop and report if:**

- <specific condition under which the agent should stop instead of improvising>

**Touches:**

- <shared hotspot directory this ticket changes, e.g. the DB migrations directory>, or "None"

**Location:**

- <anchor doc, e.g. AGENTS.md / ADR / glossary entry relevant to this ticket>
- <directory or module this ticket works in>

**Status:** ticket

- [ ] Acceptance criterion 1 (checkable, names the test tier that proves it)
- [ ] Acceptance criterion 2
      </local-ticket-template>

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

In either form, avoid specific file paths or code snippets in the body, acceptance criteria, or "What to build" — they go stale fast. The **Location** and **Touches** sections are the exceptions by design: Location holds directories and anchor-doc references so a fresh agent doesn't have to wander, and Touches names the shared hotspot directories so tickets can be checked for conflicts. Directories and docs are coarse and stable enough to survive normal churn. Do not put individual file paths even there — point to the containing directory or doc, not the file. **Base** names a branch, not a file, and **Worktree** is one of the two fixed lines. "Decisions already made", "Out of scope", and "Stop and report if" are written as prose statements about choices and conditions, not as paths or code.

Exception to the no-snippets rule: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.
