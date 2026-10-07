---
name: cleanup
description: Clean up local branches, worktrees, and test databases after a spec's PR has been merged. Run manually after GitHub closes the spec issue.
disable-model-invocation: true
---

# Cleanup

After a spec's final PR is merged and its GitHub issue is closed, run this to reclaim disk space and avoid clutter.

## ⚠️ When to Run
- **ONLY** after:
  1. The spec's PR has been **merged to `main`**
  2. GitHub has **closed the spec issue** (e.g., via `Closes #<spec-id>` in the PR)
- Never run while tickets are still being implemented!

## Commands

```bash
/cleanup <spec-issue-number>    # clean up one spec
/cleanup --all                  # clean up all closed specs (dry-run first)
```

## Process

### 1. Preflight

Run these checks before any deletion:

```bash
gh auth status                              # confirm gh is authenticated
git rev-parse --show-toplevel               # confirm repo root
git worktree list                           # list all worktrees
```

If `gh auth status` fails, stop and report: cleanup needs GitHub access to verify spec status.

### 2. Resolve spec(s) to clean

**Single spec mode (`/cleanup <id>`):**

```bash
gh issue view <id> --json number,title,state,closedAt
```

- If state ≠ `CLOSED`, stop and report: "Spec #<id> is still open. Wait until the PR is merged and the issue is closed."
- Extract the delivery branch from the spec body: `spec/<issue-number>-<slug>`
- Extract ticket numbers from the spec: search for `Blocked by` sections in child tickets, or list all issues with label `ticket` that reference this spec

**All specs mode (`/cleanup --all`):**

```bash
gh issue list --label spec --state closed --limit 50 --json number,title,closedAt
```

For each closed spec, derive the branch name: `spec/<number>-<slug>`

### 3. Dry-run report

Before deleting anything, print what will be removed:

```
Cleanup plan for spec #<id>: <title>

Branches:
  - spec/<id>-<slug> (local)
  - origin/spec/<id>-<slug> (remote tracking)

Worktrees:
  - ../wt/ticket-<id1> (ticket mode)
  - ../wt/<slug> (shared mode, if exists)

Databases:
  - test_ticket_<id1>
  - test_ticket_<id2>
  - test_spec_<slug> (shared mode only)

Continue? (y/N)
```

Wait for explicit user confirmation before proceeding.

### 4. Execute cleanup

**Branches:**

```bash
# Delete local branch (refuses if not merged)
git branch -d spec/<id>-<slug>

# Delete remote tracking branch
git branch -dr origin/spec/<id>-<slug>
```

If `git branch -d` refuses (branch not merged), stop and report: "Branch not fully merged. Verify PR was merged to main, then re-run."

**Worktrees:**

```bash
# Remove each ticket worktree
git worktree remove ../wt/ticket-<id> --force

# Remove shared worktree (if exists)
git worktree remove ../wt/<slug> --force
```

If removal fails (dirty worktree), report: "Worktree has uncommitted changes. Resolve manually, then re-run."

**Databases:**

```bash
# Drop isolated test databases (own mode)
psql "$ADMIN_DATABASE_URL" -c 'DROP DATABASE IF EXISTS "test_ticket_<id>"'

# Drop shared test database (shared mode)
psql "$ADMIN_DATABASE_URL" -c 'DROP DATABASE IF EXISTS "test_spec_<slug>"'
```

Use the same Postgres credentials that `wt-setup.sh` uses (`BASE_DATABASE_URL` or main checkout's env files).

### 5. Report

After cleanup completes:

```
✅ Cleanup complete for spec #<id>

Deleted:
  - Branch: spec/<id>-<slug>
  - Remote tracking: origin/spec/<id>-<slug>
  - Worktrees: <count>
  - Databases: <count>
```

If anything was skipped (dirty worktree, unmerged branch), list it under "Skipped (manual cleanup required):"

## Safety Rules

- **Never** delete a branch that isn't merged (`git branch -d` refuses by design — don't force it).
- **Never** remove a worktree with uncommitted changes (report instead).
- **Never** drop a database that doesn't match the pattern `test_ticket_*` or `test_spec_*`.
- **Always** dry-run first in `--all` mode, showing what will be deleted.
- **Always** wait for explicit user confirmation before any destructive action.

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Worktree has uncommitted changes | Skip it, report path and changes, user resolves manually |
| Branch not merged | Stop, report which commit is missing from main |
| Database doesn't exist | Log "already dropped" and continue |
| Spec issue not found | Stop, report invalid issue number |
| gh CLI not authenticated | Stop, user must run `gh auth login` first |

## Example Session

```bash
/cleanup 42

→ Checking spec #42...
→ Status: CLOSED (merged 2 days ago)
→ Delivery branch: spec/42-admin-sidebar-redesign
→ Found 3 tickets: #101, #102, #103

Cleanup plan:
  Branches: spec/42-admin-sidebar-redesign, origin/spec/42-admin-sidebar-redesign
  Worktrees: ../wt/ticket-101, ../wt/ticket-102, ../wt/ticket-103
  Databases: test_ticket_101, test_ticket_102, test_ticket_103

Continue? (y/N)

→ Deleting branch spec/42-admin-sidebar-redesign... done
→ Deleting remote tracking branch... done
→ Removing worktree ../wt/ticket-101... done
→ Removing worktree ../wt/ticket-102... done
→ Removing worktree ../wt/ticket-103... done
→ Dropping database test_ticket_101... done
→ Dropping database test_ticket_102... done
→ Dropping database test_ticket_103... done

✅ Cleanup complete for spec #42
```
