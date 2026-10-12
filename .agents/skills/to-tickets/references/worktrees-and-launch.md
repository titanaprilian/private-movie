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

### 8. Launch the implementor(s) and report

Only after step 7's verification passed. Never launch into a worktree whose `wt-setup.sh` failed. Launching is `scripts/wt-launch.sh`; it needs the orchestrator to be running inside tmux.

- **Separate mode:** for every frontier ticket, run
  `bash scripts/wt-launch.sh <issue> <abs-worktree-path>`. Each ticket launches in a split pane (`impl-<issue>`) below the orchestrator, tiled side-by-side in the bottom half. Re-running is safe: an existing pane is left alone. Blocked tickets are NOT launched; their worktrees are created and launched when the blocker is merged and closed.
- **Shared mode:** run `bash scripts/wt-launch.sh --shared <first-issue> <abs-worktree-path>`. Exactly one pane (`impl-shared`) exists at a time. Do not launch the next
  ticket until review has approved and closed the current one; the reviewer kills the old pane on approval.
- **Check the launch:** after launching, `tmux list-panes -F '#{@ticket}'` must show each expected tag, and `tmux capture-pane -p -t "$pane" | tail -5` must not show a startup error. If a launch fails (exit code 2 or 3), do not retry in a loop; report the reason and the exact manual command.
- **Fallback:** if not inside tmux, or the script is missing, print the manual launch plan (path + `/implement <issue>` per ticket) as before.
- **Report & Idle (Zero Tokens):** In your reply, state the launched panes (issue numbers and titles), the tickets still blocked, and then **end your reply immediately**. Do NOT poll, sleep, or tail pane outputs in a loop. Remain completely idle. The implementors will automatically wake you by sending their notifications when they finish or hit a blocker.
