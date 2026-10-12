# Exceptions

Read only the section that applies.

## Block a ticket (external dependency)

Use when the ticket cannot proceed because it is waiting on external input (user decision, third-party response, another spec, etc.). Do not merge, close, or clean up. Instead:

1. **Add the `blocked` label** to the ticket:
   ```bash
   gh issue edit <id> --add-label "blocked"
   ```
2. **Post a comment** explaining exactly what is needed and who/what it is waiting on.
3. **Stop.** Do not create new worktrees for tickets this one blocks until the dependency is resolved.

To unblock later, the user (or another agent) removes the `blocked` label and re-runs the workflow.

## Rollback (only on explicit request)

If a merged ticket is found to be faulty and needs reverting:

1. **Identify the commit** before the problematic ticket:

   ```bash
   git reflog spec/<slug>
   ```

   Find the commit hash just before the ticket's merge (look for `#<ticket-id> —` in commit messages).

2. **Rewind the spec branch**:

   ```bash
   git checkout spec/<slug>
   git reset --hard <commit-hash>
   ```

   This rewinds the branch to a clean state before the faulty ticket.

3. **Reopen the ticket** for rework:
   ```bash
   gh issue reopen <ticket-id>
   ```

⚠️ **Use with caution**: Only do this if the faulty ticket hasn't been built upon by other tickets. If subsequent tickets depend on it, coordinate with the team to revert multiple tickets in order.
