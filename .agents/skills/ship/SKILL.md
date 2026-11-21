---
name: ship
description: Push branch, create standardized PR, monitor CI, extract logs on failure for poteto-mode auto-healing, and squash-merge when green.
---

# Ship Branch & PR Lifecyle

This skill automates the transition from a completed feature or bugfix branch to production main:

1. Pushes the branch.
2. Creates a pull request following the repository's standard PR template.
3. Monitors CI workflows (`gh pr checks --watch`).
4. If CI fails, automatically extracts failing logs to diagnose and fix in `poteto-mode`.
5. If CI passes, squash-merges into `main`. In a linked worktree, it leaves that worktree and its local branch for orchestrator cleanup; in a standalone checkout, it retains the existing branch-delete and local-main-sync behavior.

## Prerequisites

- Active branch is a feature branch (not `main`).
- Working directory is clean (all changes committed following `AGENTS.md` commit scope rules).
- `gh` GitHub CLI is installed and authenticated.

## Standard PR Schema Enforced

Every PR generated follows the repository standard:

```markdown
# <Title / Scope>

## Issue

- Closes #<issue_number>

## What did you do?

- Feat: ...
- Fix: ...
- Refactor: ...

## Screenshot / Video

<!-- Proof artifact from artifacts/verify/ or N/A -->

## Verification

- **Automated Tests:** Verified locally
- **Quality Gates:** `bun run gate:check` passed
- **Harness:** `.agents/skills/verify/scripts/control.sh drive`
```

## Usage

### 1. Fast Full Delivery (Auto-Merge on Green)

```bash
.agents/skills/ship/scripts/ship.sh --issue <issue_number>
```

Or directly from the chat:

```text
/ship
```

### 2. Create PR and Monitor without Auto-Merging

```bash
.agents/skills/ship/scripts/ship.sh --issue <issue_number> --no-merge
```

## CI Auto-Healing Flow

When CI fails (exit code `2`):

1. `ship.sh` outputs the exact failing test or step from GitHub Actions using `gh run view <run_id> --log-failed`.
2. The agent feeds the error trace back into `poteto-mode` (using the `fix-ci` skill).
3. The agent reproduces the failure locally (e.g. `bun run test:<pkg> -- <file>`), implements the minimal safe fix, and tests it.
4. The agent commits the fix and re-runs `.agents/skills/ship/scripts/ship.sh`.
5. Max 3 iterations to avoid infinite loops.
