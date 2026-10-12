# Create the worktree(s) and report

Phase 4 of `/to-tickets`: steps 7–8. Only start after the tickets are published.

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
