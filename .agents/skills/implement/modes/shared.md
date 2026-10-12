# Shared mode

The whole set of tickets is worked in **one** worktree that sits directly on the **Base** branch (the delivery branch). Tickets are done one at a time, in order. Each ticket is **one commit** on that branch, reviewed before the next ticket starts. There is no ticket branch and nothing to merge.

## Blockers (step 0)

In shared mode a ticket is closed only after the reviewer approved its commit on the delivery branch. A blocker counts as done only when it is closed.

## Where you must be (step 1)

The branch must be exactly the ticket's **Base** branch.

**TESTDB** is the database name printed by `bash scripts/wt-setup.sh --shared` in step 2 (it starts with `test_`).

If you are not in the right place, after the report from SKILL.md add:

> Run `bash scripts/wt-init.sh --shared <base>` from the main checkout (it prints the shared worktree path; if the worktree already exists it is at `<path from git worktree list, if any>`), then start a new agent with that directory as its working directory and run `/implement <id>` there.

## Get ready (step 2)

Inside `WT`:

1. **Check the starting state.** Run `git status --porcelain`: the working tree must be clean. If it isn't and you are not resuming after a "Request changes" review, stop and report what is there; don't stash, reset, or clean it, since it may be someone else's unfinished work. Run `git log --format=%s` and check what is already on the branch:
   - every blocker (every earlier ticket you depend on) must already have its commit, with a subject that starts `#<blocker-number> — `. If one is missing, stop and report: the ticket is closed but its work isn't in this worktree.
   - this ticket must not have a commit yet (a subject starting `#<id> — `). If it does and there is no "Request changes" report on the ticket, stop and report that it is already implemented and waiting for review. If it does and there is a "Request changes" report, you are continuing: your work is new commits on top, never an amend.
2. **Don't move the branch.** The delivery branch may exist only on this machine, and the earlier tickets' commits have already been reviewed. Never rebase, reset, merge, pull, or force anything in this worktree. Note the current commit (`git rev-parse HEAD`): this is where your ticket starts, and you report it at the end.
3. **Make sure the environment is set up.** Run `bash scripts/wt-setup.sh --shared` from inside `WT`. It is safe to re-run, and normally it has already run. It copies the untracked `.env` files, installs dependencies, creates the isolated test database for this worktree, points `DATABASE_URL` at it, and prints `database=<name>`: that name is your **TESTDB**. Afterwards confirm that `DATABASE_URL` in the worktree's `.env` ends in TESTDB.

## Bring the work up to date (before the final checks in step 3)

There is nothing to rebase: you are on the delivery branch itself and no one else is merging into it. Don't commit yet and don't run any `git` command that moves the branch. A failing test belongs to your ticket, because the earlier tickets passed their checks on exactly the code you started from. If the failure is clearly in code your ticket never touched, stop and report with the failing output.

## Commit (step 4)

Commit your work as **one commit** on the delivery branch, with the message `#<id> — <ticket title>`.

If you are continuing after a "Request changes" review, make a new commit instead, `#<id> — address review: <short summary>`, and never amend, squash, or rewrite any commit that is already on the branch: the reviewed history stays as it is.

The commit is local; the delivery branch is pushed only at the very end, by `/push-to-github`.

Also:

- Don't start the next ticket yourself, and don't touch the commits of earlier tickets.
- Leave the worktree and its test database in place: every later ticket of the set uses them.

## Hand-back fields specific to shared mode

- **Base:** the commit your ticket started from (noted in step 2).
- **Commit:** the short hash and subject of your commit, plus the **review range** `<starting commit>..<your commit>`, so the reviewer looks at exactly your ticket.
