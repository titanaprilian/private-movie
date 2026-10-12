# Own mode

The ticket has a worktree and a branch `ticket/<id>` to itself, often alongside other agents working on other tickets at the same time. The branch starts from the ticket's **Base** (a shared spec branch, kept locally until the final push) and, after review, is merged back into it. Not into main.

A ticket without a **Worktree** section (an older ticket format) is own.

## Blockers (step 0)

In own mode a ticket is closed only after its branch has been merged into the spec branch (the Base). A blocker counts as done only when it is closed.

## Where you must be (step 1)

The branch must be `ticket/<id>`.

**TESTDB** is `test_ticket_<id>`.

If you are not in the right place, after the report from SKILL.md add:

> Run `bash scripts/wt-init.sh <id>` from the main checkout (it prints the worktree path; if the worktree already exists it is at `<path from git worktree list, if any>`), then start a new agent with that directory as its working directory and run `/implement <id>` there.

## Get ready (step 2)

Inside `WT`:

1. **Catch up with the spec branch.** The **local** Base branch is the source of truth: reviewers merge approved tickets into it locally, and origin is only updated at the very end, so never use `origin/<base>` (it is behind). Confirm the local branch exists (`git show-ref --verify --quiet refs/heads/<base>`); if not, stop and report. If you have no commits of your own yet (`git log <base>..HEAD` is empty) and the working tree is clean, fast-forward to the latest tip: `git merge --ff-only <base>`. If you already have commits or changes (you are resuming earlier work), leave them alone: you rebase before the final checks.
2. **Make sure the environment is set up.** Run `bash scripts/wt-setup.sh <id>` from inside `WT`. It is safe to re-run, and normally it has already run. It copies the untracked `.env` files, installs dependencies, creates an isolated test database named `test_ticket_<id>`, and points that worktree's `DATABASE_URL` at it (plus its own `PORT`, if your env files define one). Afterwards confirm that `DATABASE_URL` in the worktree's `.env` points at `test_ticket_<id>`.

## Bring the work up to date (before the final checks in step 3)

Rebase your branch so your final test run reflects the latest merged work, not a stale base:

```bash
git add -A && git commit -m "WIP #<id>"      # rebase needs a clean tree; you will tidy the message in step 4
git rebase <base>                             # the ticket's LOCAL Base branch, never origin/<base>
```

- If the rebase hits conflicts, **stop and report**. Do not resolve conflicts yourself, and never hand-edit migration files or the migrations journal.
- If the rebase changed the lockfile or any package manifest, run `bun install` again.
- If the rebase brought in new migration files from other tickets, run `bun run db:migrate` against your ticket database before running integration tests (confirm first that `DATABASE_URL` ends in TESTDB).
- A failing test after the rebase belongs to your ticket. Fix it; do not wait for other agents or assume someone else's work is the cause. If the failure is clearly in code your ticket never touched, stop and report with the failing output.

## Commit (step 4)

Commit your work on your ticket branch inside the worktree, replacing the temporary message with `#<id> — <ticket title>`. This is a local commit on an isolated branch only.

Whoever merges the branch removes the worktree and its test database, so leave both in place.

## Hand-back fields specific to own mode

- **Base:** the name of the ticket's Base branch and the commit of it you rebased onto.
- **Commit:** the short hash and subject of your commit.
