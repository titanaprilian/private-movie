---
name: implement
description: "Implement a single ticket inside a pre-created git worktree (the agent must be started in that directory), following the decisions already written into the ticket, then commit locally and hand back. Two modes, read from the ticket: own (the ticket has its own worktree and its own branch named after the ticket number) or shared (the whole ticket set is worked in one worktree directly on the delivery branch, one commit per ticket). Refuses to work anywhere else."
disable-model-invocation: true
---

# Implement

Implement the work described by one ticket. You are launched by hand. The worktree you work in is created for you before you start (by `/to-tickets`, or by `bash scripts/wt-init.sh`), and you must be started inside it: you never create, enter, or switch to a worktree yourself, and you never work in the main checkout.

The ticket's **Worktree** section says which of two modes applies (a ticket without one is **own**):

- **own** — the ticket has its own worktree and a branch `ticket/<id>`, branched from the ticket's **Base** (a local spec branch) and merged back into it after review.
- **shared** — the whole ticket set is worked in **one** worktree sitting directly on the **Base** (the delivery branch). One commit per ticket, in order. No ticket branch, nothing to merge.

## Files in this skill

Read each one when its step says so, not before.

- `modes/own.md`, `modes/shared.md` — everything that differs between the modes. Read the one for your mode as soon as step 0 has told you which it is.
- `references/testing.md` — test commands. Read before running any test.
- `references/schema-changes.md` — read when the ticket changes the database schema.

## Hard rules (both modes)

- Work only inside your worktree `WT`. Every command runs from inside it, every file you read, create or edit is under it. Never `cd` out to work, never check out another branch in it, never touch an absolute path pointing at the main checkout or another worktree.
- Never push, open a pull request, merge into the spec branch or main, close or edit the GitHub issue, or remove the worktree or its test database.
- Never run `db:push`. Run `db:migrate` only against TESTDB, after confirming `DATABASE_URL` ends in TESTDB. Never run integration tests against a shared database.
- Never run bare `bun test` (see `references/testing.md`).
- Never resolve rebase conflicts yourself, and never hand-edit migration files or the migrations journal.
- When you stop because of a "Stop and report if" condition, a conflict, a missing blocker or any other blocker, do not commit partial work. Leave the worktree as it is and report what you found.

## 0. Get the ticket (read-only)

This skill runs in a fresh agent with no memory of the conversation that created the ticket: you start with nothing but a reference (an issue number or URL). Get the ticket number from it (an issue number, or the last number in an issue URL), then fetch the actual ticket from GitHub. This step only reads: don't edit, create, or check out anything until step 1 has passed.

```bash
gh issue view <number-or-url> --json title,body,labels,url,comments
```

Consult the **gh-cli** skill if you hit auth/repo-targeting issues or aren't sure which repo to point at — don't guess.

If a comment on the ticket holds a review report with the verdict **Request changes**, you are continuing earlier work: that report's blocking findings are your first job, before anything else in the ticket.

Read the ticket in full. It should contain these sections, and you must follow them:

- **Decisions already made** — design choices fixed by the ticket author. Do not revisit them. If you believe one is wrong or impossible, stop and report instead of deviating.
- **Out of scope** — adjacent work you must not do, even if it looks broken or tempting.
- **Stop and report if** — conditions under which you stop instead of improvising.
- **Touches** — the shared hotspots (e.g. the DB migrations directory) this ticket is allowed to change. If you need to change a shared hotspot that is not listed, stop and report: in own mode another ticket running in parallel may be changing it, and in both modes the reviewer rejects a change to a hotspot the ticket didn't list.
- **Location** — anchor docs and directories to read first. Read them before writing code.
- **Base** — the branch this work belongs to (what that means per mode is in the mode file). Every ticket has one. If the ticket has none, stop and report: never guess between main and a spec branch.
- **Worktree** — `own` or `shared`. Note which one.

If the ticket is missing the other sections (an older ticket format), you may proceed, but treat any ambiguity as a reason to stop and ask rather than guess.

**Now read `modes/<mode>.md` for your mode.** The rest of this skill refers to it.

Check every blocker listed in the ticket's **"Blocked by"** section:

```bash
gh issue view <blocker-number> --json state,title
```

A blocker counts as done only when it is **closed** (the mode file says what closing means). If any blocking ticket isn't closed yet, stop and tell the user rather than implementing out of order.

If the ticket references a **Parent** issue (the spec), fetch that too (`gh issue view <parent-number>`) for full context before starting.

## 1. Check where you are

Run:

```bash
git rev-parse --show-toplevel
git branch --show-current
echo "$(cd "$(git rev-parse --git-dir)" && pwd -P)|$(cd "$(git rev-parse --git-common-dir)" && pwd -P)"
```

You are in the right place only if **both** hold:

- the two paths in the last line are **different** (you are in a linked worktree, not the main checkout), and the top-level directory is not the main checkout (the first entry of `git worktree list`);
- the branch is the one your mode file requires.

**If they hold**, that top-level directory is your worktree, `WT`. Apply the hard rules above from here on.

**If they don't hold** (you are in the main checkout, on the wrong branch, or not in a worktree), **stop immediately**. Don't edit anything, don't switch branches, don't create a worktree yourself, and don't work on this ticket from outside its worktree by using absolute paths: that is exactly how the main checkout gets modified by mistake. Report this to the user, in these words or close to them:

> I was started in `<pwd>` on branch `<branch>`, but ticket #<id> has to be worked in its own worktree.

followed by the instruction in your mode file's "Where you must be" section.

Your mode file also defines **TESTDB**, which later steps refer to.

## 2. Check the worktree is ready

The worktree was prepared before you started, but it may have been sitting for a while. Follow "Get ready" in your mode file.

If `scripts/wt-setup.sh` does not exist (or doesn't support the mode you are in) and the ticket needs integration tests (backend endpoints, middleware, CORS, auth guards), stop and report. Do **not** run integration tests against any shared database. Tickets that need only unit tests may proceed without it, but run `bun install` yourself first and say in your hand-back that no isolated database was set up.

## 3. Implement

Use the `/tdd` skill where possible, at pre-agreed seams.

Stay inside the directories named in the ticket's Location. Follow the pattern the ticket tells you to imitate.

Run typechecking regularly and single test files regularly during development. Test commands are in `references/testing.md`. If the ticket touches backend HTTP endpoints (routes, middleware, CORS, auth guards), also write and run integration tests under `test/integration/`, not just unit tests.

If the ticket changes the database schema, read `references/schema-changes.md` and follow it.

**Before the final checks, bring the work up to date**, as described in "Bring the work up to date" in your mode file.

**Mandatory pre-handoff quality checks (non-negotiable).** After that, and before handing back, you **MUST** run the root verification checks across the monorepo, regardless of which application or package was modified (`apps/android-tv`, `apps/backend`, `apps/web`, or `packages/*`):

1. `bun run typecheck` — **MANDATORY**. Confirms TypeScript compilation and Android Kotlin compilation (`./gradlew compileDebugKotlin`) pass cleanly across the monorepo.
2. `bun run lint` — **MANDATORY**. Confirms ESLint and Android Gradle lint pass with zero errors across all workspaces.
3. The full unit test suite for the touched package(s), or `bun run test`, so Turbo caches passing results in this worktree for the reviewer (commands in `references/testing.md`).

Then check each acceptance criterion in the ticket against what you actually ran. You will report the evidence for each one.

## 4. Hand back

Commit your work as described in "Commit" in your mode file. The commit is local only.

Your hand-back message must include:

- **Mode, branch and worktree:** own or shared, the branch name, and the absolute worktree path.
- **Base** and **Commit:** exactly as your mode file's "Hand-back fields" section says.
- **What you did:** a short summary, in terms of behavior.
- **Acceptance criteria:** each criterion, and the command or observation that proves it, with the result.
- **Checks run:** `typecheck`, `lint`, and the test commands, each passed or failed.
- **Out-of-scope observations:** anything wrong you noticed nearby but deliberately left alone.
- **Deviations or tripwires:** any decision you could not follow, or any "Stop and report if" condition you hit.
- **Schema note:** if you generated a migration, the reminder from `references/schema-changes.md`.
