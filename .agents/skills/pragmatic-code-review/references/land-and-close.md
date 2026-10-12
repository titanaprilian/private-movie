# Land, close, clean up (Phase 4, approval only)

Do this immediately, without confirmation. Run git commands from the main repository root unless a step says otherwise, and never leave the main checkout on a different branch than you found it. Never push.

Use the section that matches the ticket kind (own or shared).

If any step below turns the review into **Request changes**, post the finding and stop. Do not continue to the next worktrees:

```bash
gh issue comment <id> --body-file - <<'EOF'
<the full report, including the new blocking finding>
EOF
```

## own tickets

1. **Take the merge lock.** Several reviewers may land tickets at the same time. Only one may advance `Base` at once.
   ```bash
   LOCK="$(git rev-parse --git-common-dir)/merge.lock"
   until mkdir "$LOCK" 2>/dev/null; do sleep 5; done
   trap 'rmdir "$LOCK" 2>/dev/null' EXIT
   ```
   If you waited more than 10 minutes and the lock directory is older than that, a previous reviewer crashed: remove it and continue.
2. **Rebase onto the latest local Base**, inside the ticket worktree. Another ticket may have landed since the implementer started.
   ```bash
   git -C ../wt/ticket-<id> status --porcelain   # must be empty
   git -C ../wt/ticket-<id> rebase <base>        # LOCAL base, never origin/<base>
   ```
   If the rebase conflicts, run `git rebase --abort`, release the lock, and treat the review as **Request changes**: add a blocking finding "conflicts with the base branch: rebase and resolve" to the report, post it (command above), and stop.
3. **Re-verify if the rebase moved anything.** If the branch tip changed, re-run `bun run typecheck`, `bun run lint`, and `bun run test` in the worktree. A failure here is **Request changes** with the failing output as the finding.
4. **Advance Base to the verified tip without touching the main checkout.** The result must be a fast-forward.
   ```bash
   OLD="$(git rev-parse <base>)"
   git merge-base --is-ancestor "$OLD" ticket/<id>   # must succeed, else go back to step 2
   git worktree list --porcelain                      # is <base> checked out anywhere?
   ```
   - If `Base` is **not** checked out in any worktree: `git update-ref refs/heads/<base> ticket/<id> "$OLD"` (compare-and-swap; it fails if someone moved `Base`, then go back to step 2).
   - If `Base` **is** checked out in some worktree: `git -C <that worktree> merge --ff-only ticket/<id>`.
5. **Release the lock.** `rmdir "$LOCK"`.
6. **Close the ticket with the report.**
   ```bash
   gh issue close <id> --reason completed --comment "$(cat <<'EOF'
   <the full report>
   EOF
   )"
   ```
7. **Clean up.** Use the same Postgres host and credentials that `scripts/wt-setup.sh` used (`BASE_DATABASE_URL` or the main checkout's env). Only ever drop the database named exactly `test_ticket_<id>`.
   ```bash
   psql "$ADMIN_DATABASE_URL" -c 'DROP DATABASE IF EXISTS "test_ticket_<id>"'
   git worktree remove ../wt/ticket-<id> --force
   git branch -d ticket/<id>          # lowercase -d: refuses if it was not merged
   ```
   If `git branch -d` refuses, something went wrong in step 4: stop and report it instead of forcing.

## shared tickets

Nothing to merge or rebase: the commit is already on `Base`. Close the ticket with the report.

```bash
gh issue close <id> --reason completed --comment "$(cat <<'EOF'
<the full report>
EOF
)"
```

Leave the shared worktree and its database alone. The next ticket of the set uses them.

When the ticket is closed, return to the workflow: next is Phase 5 (plan the next worktrees).
