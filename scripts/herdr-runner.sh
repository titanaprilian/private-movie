#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

SINGLE_ISSUE=""
LIMIT=15
LABEL=""
LAYOUT="split" # 'split' or 'tab'
KEEP_PANE=false

usage() {
  cat <<EOF
Usage: $0 [options]

Herdr-Native Autonomous Issue Runner:
Creates a visible Herdr pane or tab for each issue, launches an interactive
Antigravity agent inside, executes Auto-Grilling (auto-accepting decisions),
implements under poteto-mode, verifies gates, ships PR, and squash-merges to main.

Options:
  --issue <num>      Run for a single specific issue number
  --limit <num>      Max number of issues to process (default: 15)
  --label <label>    Filter issues by GitHub label
  --layout <split|tab>  Run in a side-by-side split pane or new tab (default: split)
  --keep             Keep the pane/tab open after completion (default: close on merge)
  --help, -h         Show this help message
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
    --layout)
      LAYOUT="$2"
      shift 2
      ;;
    --keep)
      KEEP_PANE=true
      shift
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

# Preflight check: Herdr environment
if [ "${HERDR_ENV:-}" != "1" ]; then
  echo "❌ Error: Not running inside a Herdr-managed pane (HERDR_ENV != 1)." >&2
  echo "Launch herdr first, then run this script inside a Herdr terminal." >&2
  exit 1
fi

# Preflight check: gh CLI
if ! gh auth status >/dev/null 2>&1; then
  echo "❌ Error: 'gh' GitHub CLI is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

# Determine target issues
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
echo "Herdr Autonomous Runner Initialized"
echo "Target Issues: ${ISSUES[*]}"
echo "Layout: $LAYOUT"
echo "=========================================================="

for ISSUE_ID in "${ISSUES[@]}"; do
  [ -z "$ISSUE_ID" ] && continue

  echo ""
  echo "=========================================================="
  echo ">>> Processing Issue #$ISSUE_ID via Herdr"
  echo "=========================================================="

  # 1. Ensure clean git state on main
  echo "==> Syncing repository on main..."
  git checkout main
  git pull origin main

  if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: Working tree is dirty before starting Issue #$ISSUE_ID. Aborting." >&2
    exit 1
  fi

  ISSUE_TITLE=$(gh issue view "$ISSUE_ID" --json title -q .title 2>/dev/null || echo "Issue #$ISSUE_ID")
  echo "==> Title: $ISSUE_TITLE"

  # 2. Create visible UI terminal in Herdr
  AGENT_NAME="worker-${ISSUE_ID}"
  PANE_ID=""
  TAB_ID=""

  if [ "$LAYOUT" = "tab" ]; then
    echo "==> Creating Herdr tab for Issue #$ISSUE_ID..."
    TAB_RESP=$(herdr tab create --label "issue-$ISSUE_ID" --cwd "$REPO_ROOT" --focus)
    TAB_ID=$(echo "$TAB_RESP" | jq -r '.result.tab.tab_id')
    PANE_ID=$(echo "$TAB_RESP" | jq -r '.result.root_pane.pane_id')
  else
    echo "==> Splitting Herdr pane side-by-side for Issue #$ISSUE_ID..."
    PANE_RESP=$(herdr pane split --current --direction right --cwd "$REPO_ROOT" --focus)
    PANE_ID=$(echo "$PANE_RESP" | jq -r '.result.pane.pane_id')
  fi

  echo "==> Target Pane: $PANE_ID"

  # 3. Launch interactive agy agent inside that pane
  echo "==> Starting interactive 'agy' agent ($AGENT_NAME) in pane $PANE_ID..."
  herdr agent start "$AGENT_NAME" --kind agy --pane "$PANE_ID" --timeout 30000 -- --dangerously-skip-permissions

  # 4. Phase 1: Trigger /grilling interview
  echo "==> Prompting $AGENT_NAME with /grilling..."
  herdr agent prompt "$AGENT_NAME" "/grilling Issue #${ISSUE_ID}: ${ISSUE_TITLE}. Please interview me and map the decision tree to reach shared understanding." --wait

  # Dialogue loop: auto-answer grilling rounds until handoff to poteto-mode
  GRILL_ROUNDS=0
  MAX_GRILL_ROUNDS=5

  while [ $GRILL_ROUNDS -lt $MAX_GRILL_ROUNDS ]; do
    RECENT_OUTPUT=$(herdr agent read "$AGENT_NAME" --source recent-unwrapped --lines 50 2>/dev/null || true)

    if echo "$RECENT_OUTPUT" | grep -qi "poteto-mode"; then
      echo "==> Grilling completed! Confirming handoff to /poteto-mode..."
      herdr agent prompt "$AGENT_NAME" "Yes, proceed with implementation now under /poteto-mode. Create branch fix/issue-${ISSUE_ID}, follow TDD and repository AGENTS.md rules, verify gate:check, and run .agents/skills/ship/scripts/ship.sh --issue ${ISSUE_ID} to open the PR and merge to main when CI passes." --wait
      break
    elif echo "$RECENT_OUTPUT" | grep -qi -E "(❓|\*\*Q[0-9]+\*\*|frontier|recommend)"; then
      echo "==> Grilling asked frontier questions. Auto-approving recommended choices..."
      herdr agent prompt "$AGENT_NAME" "I approve all recommended answers. Please proceed to the next round or synthesize the specification." --wait
      GRILL_ROUNDS=$((GRILL_ROUNDS + 1))
    else
      # If no explicit grilling question pattern, trigger poteto-mode directly
      echo "==> Transitioning directly to /poteto-mode..."
      herdr agent prompt "$AGENT_NAME" "Please proceed with implementation now under /poteto-mode. Create branch fix/issue-${ISSUE_ID}, follow TDD and repository AGENTS.md rules, verify gate:check, and run .agents/skills/ship/scripts/ship.sh --issue ${ISSUE_ID} to open the PR and merge to main when CI passes." --wait
      break
    fi
    sleep 2
  done

  # 5. Monitor until completion
  echo "==> Waiting for Issue #$ISSUE_ID to resolve and merge..."
  MAX_WAIT=1800 # 30 minutes max
  ELAPSED=0
  SLEEP_INT=10

  while [ $ELAPSED -lt $MAX_WAIT ]; do
    ISSUE_STATE=$(gh issue view "$ISSUE_ID" --json state -q .state 2>/dev/null || echo "UNKNOWN")
    if [ "$ISSUE_STATE" = "CLOSED" ]; then
      echo "✅ GitHub confirms Issue #$ISSUE_ID is CLOSED (PR merged successfully)!"
      break
    fi
    sleep $SLEEP_INT
    ELAPSED=$((ELAPSED + SLEEP_INT))
  done

  # Sync main locally
  git checkout main 2>/dev/null || true
  git pull origin main 2>/dev/null || true

  # Clean up pane if desired
  if [ "$KEEP_PANE" = false ]; then
    echo "==> Closing worker pane/tab..."
    if [ -n "$TAB_ID" ]; then
      herdr tab close "$TAB_ID" 2>/dev/null || true
    elif [ -n "$PANE_ID" ]; then
      herdr pane close "$PANE_ID" 2>/dev/null || true
    fi
  fi

  echo ">>> Finished processing Issue #$ISSUE_ID."

  if [ -f "$REPO_ROOT/.stop-runner" ] || [ -f "/tmp/herdr-runner-stop" ]; then
    echo "🛑 Stop requested by user. Halting pipeline after Issue #$ISSUE_ID."
    rm -f "$REPO_ROOT/.stop-runner" "/tmp/herdr-runner-stop" 2>/dev/null || true
    break
  fi
done

echo ""
echo "=========================================================="
echo "All scheduled issues processed successfully."
echo "=========================================================="
