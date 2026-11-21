#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SINGLE_ISSUE=""
LIMIT=15
LABEL=""

usage() {
  cat <<EOF
Usage: $0 [options]

Autonomous GitHub Issue Runner:
Spawns an isolated, fresh Antigravity agent context for each issue,
runs Auto-Grilling (auto-accepting recommended decisions), executes
under poteto-mode, verifies gates, ships PR, and squash-merges to main.

Options:
  --issue <num>     Run for a single specific issue number
  --limit <num>     Max number of issues to process (default: 15)
  --label <label>   Filter issues by GitHub label
  --help, -h        Show this help message
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --issue)
      SINGLE_ISSUE="$2"
      shift 2
      ;;
    --limit)
      LIMIT="$2"
      shift 2
      ;;
    --label)
      LABEL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

# Preflight check: gh CLI authentication
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ Error: 'gh' GitHub CLI is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

# Preflight check: agy CLI availability
if ! command -v agy >/dev/null 2>&1; then
  echo "❌ Error: 'agy' command not found in PATH." >&2
  exit 1
fi

# Determine issue list
if [ -n "$SINGLE_ISSUE" ]; then
  ISSUES=("$SINGLE_ISSUE")
else
  echo "==> Fetching open issues from GitHub..."
  GH_ARGS=(issue list --state open --limit "$LIMIT" --json number -q '.[].number')
  if [ -n "$LABEL" ]; then
    GH_ARGS+=(--label "$LABEL")
  fi
  read -ra ISSUES <<< "$(gh "${GH_ARGS[@]}" | tr '\n' ' ')"
fi

if [ ${#ISSUES[@]} -eq 0 ]; then
  echo "No open issues found to process."
  exit 0
fi

echo "=========================================================="
echo "Autonomous Issue Pipeline Initialized"
echo "Target Issues: ${ISSUES[*]}"
echo "=========================================================="

for ISSUE_ID in "${ISSUES[@]}"; do
  [ -z "$ISSUE_ID" ] && continue

  echo ""
  echo "=========================================================="
  echo ">>> Processing Issue #$ISSUE_ID"
  echo "=========================================================="

  # 1. Reset working directory to clean main
  echo "==> Ensuring clean working tree on main..."
  git checkout main
  git pull origin main

  if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: Working tree is dirty before starting Issue #$ISSUE_ID. Aborting." >&2
    exit 1
  fi

  # 2. Fetch issue metadata for display
  ISSUE_TITLE=$(gh issue view "$ISSUE_ID" --json title -q .title 2>/dev/null || echo "Issue #$ISSUE_ID")
  echo "==> Title: $ISSUE_TITLE"

  # 3. Construct isolated autonomous prompt for the fresh agent session
  AGENT_PROMPT=$(cat <<EOF
You are executing an autonomous run for GitHub Issue #${ISSUE_ID}: "${ISSUE_TITLE}".

Read and strictly execute the following steps without pausing to ask the user questions:

### Phase 1: Issue Intake & Auto-Grilling
1. Fetch and read the full issue using the command: 'gh issue view ${ISSUE_ID}'.
2. Explore the codebase using read_file / search to investigate the relevant files and verify facts.
3. Construct the design tree and decision frontier.
4. AUTO-GRILLING DIRECTIVE: Automatically adopt and assume the '(Recommended)' decision for every open question on the frontier. Do NOT prompt the user or wait for input.
5. Synthesize the Specification:
   - Goal: Concise statement of behavior change or fix.
   - Constraints: Obey repo rules from AGENTS.md (one app per commit, deep module boundary rules, contracts first, NEVER run db:push or apply destructive schema changes).
   - Done Check: Exact targeted test commands and 'bun run gate:check'.

### Phase 2: Implementation (poteto-mode)
1. Create and switch to a new branch: 'git checkout -b fix/issue-${ISSUE_ID}' (or 'feat/issue-${ISSUE_ID}').
2. Apply poteto-mode principles:
   - Laziness Protocol: minimal necessary diff, avoid gratuitous abstractions.
   - Prove It Works & TDD: write/update tests first where applicable.
3. Validate locally:
   - Run targeted test suite: 'bun run test:<pkg> -- <file>'.
   - Run structural quality check: 'bun run gate:check'.
4. Commit your changes:
   - Follow AGENTS.md strictly: at most ONE app modified per commit (apps/web, apps/backend, or apps/android-tv; packages/* can ride along).
   - Use conventional commit messages referencing the change.

### Phase 3: Ship & Babysit
1. Run the shipping lifecycle script:
   '.agents/skills/ship/scripts/ship.sh --issue ${ISSUE_ID}'
2. If CI fails (exit code 2):
   - ship.sh outputs the failed job log.
   - Root-cause the failure, apply targeted fixes, commit, and re-run '.agents/skills/ship/scripts/ship.sh --issue ${ISSUE_ID}' (up to 3 attempts).
3. Once CI passes, ship.sh will automatically squash-merge to main, delete the branch, and sync local main.

Confirm the PR is merged and local main is updated before concluding.
EOF
)

  echo "==> Launching fresh Antigravity agent session for Issue #$ISSUE_ID..."
  # Run fresh agent session non-interactively
  set +e
  agy --dangerously-skip-permissions --mode auto --prompt "$AGENT_PROMPT"
  AGENT_EXIT=$?
  set -e

  if [ $AGENT_EXIT -ne 0 ]; then
    echo "⚠️ Agent process exited with code $AGENT_EXIT for Issue #$ISSUE_ID."
  fi

  # Post-execution sanity check
  git checkout main 2>/dev/null || true
  git pull origin main 2>/dev/null || true

  # Check if issue was closed or PR was merged
  ISSUE_STATE=$(gh issue view "$ISSUE_ID" --json state -q .state 2>/dev/null || echo "UNKNOWN")
  echo "==> Issue #$ISSUE_ID current state: $ISSUE_STATE"

  if [ "$ISSUE_STATE" = "CLOSED" ]; then
    echo "✅ Issue #$ISSUE_ID resolved and closed successfully!"
  else
    echo "ℹ️ Issue #$ISSUE_ID is still $ISSUE_STATE. Check recent PRs/logs for status."
  fi

done

echo ""
echo "=========================================================="
echo "All scheduled issues processed."
echo "=========================================================="
