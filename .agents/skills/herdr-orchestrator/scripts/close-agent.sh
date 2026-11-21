#!/usr/bin/env bash
set -euo pipefail

# close-agent.sh: Closes a worker agent pane or tab with strict verification
TARGET=""
PANE_ID=""
TAB_ID=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --pane)
      PANE_ID="$2"
      shift 2
      ;;
    --tab)
      TAB_ID="$2"
      shift 2
      ;;
    *)
      echo "Unknown flag: $1" >&2
      exit 1
      ;;
  esac
done

# 1. Close tab if specified
if [ -n "$TAB_ID" ]; then
  herdr tab close "$TAB_ID"
  echo "Closed tab: $TAB_ID"
  exit 0
fi

if [ -z "$TARGET" ] && [ -z "$PANE_ID" ]; then
  echo "Usage: $0 --target <agent-name-or-pane> [--pane <pane_id>] [--tab <tab_id>]" >&2
  exit 1
fi

# 2. Resolve target to a pane_id and tab_id if not explicitly provided
if [ -z "$PANE_ID" ]; then
  # Check if TARGET is an active agent name
  AGENT_INFO=$(herdr agent get "$TARGET" 2>/dev/null || true)
  if [ -n "$AGENT_INFO" ]; then
    PANE_ID=$(echo "$AGENT_INFO" | jq -r '.result.agent.pane_id // empty')
    TAB_ID=$(echo "$AGENT_INFO" | jq -r '.result.agent.tab_id // empty')
  fi

  # Check if TARGET itself is a valid pane_id in pane list
  if [ -z "$PANE_ID" ]; then
    FOUND_PANE=$(herdr pane list 2>/dev/null | jq -r --arg p "$TARGET" '.result.panes[]? | select(.pane_id == $p) | .pane_id')
    if [ -n "$FOUND_PANE" ]; then
      PANE_ID="$FOUND_PANE"
    fi
  fi
fi

if [ -z "$PANE_ID" ]; then
  echo "Warning: Target '${TARGET:-unknown}' does not match any running agent or pane. It may already be closed."
  exit 0
fi

# 3. If agent has a dedicated tab separate from orchestrator, close the tab
ORCHESTRATOR_TAB=$(herdr agent get orchestrator 2>/dev/null | jq -r '.result.agent.tab_id // empty')
if [ -n "$TAB_ID" ] && [ -n "$ORCHESTRATOR_TAB" ] && [ "$TAB_ID" != "$ORCHESTRATOR_TAB" ]; then
  echo "Closing dedicated tab $TAB_ID (target: ${TARGET:-$PANE_ID})..."
  herdr tab close "$TAB_ID" 2>&1 || true
fi

# 4. Close pane if still present
if herdr pane list 2>/dev/null | jq -e --arg p "$PANE_ID" '.result.panes[]? | select(.pane_id == $p)' >/dev/null; then
  echo "Closing pane $PANE_ID (target: ${TARGET:-$PANE_ID})..."
  CLOSE_OUT=$(herdr pane close "$PANE_ID" 2>&1 || true)
fi

# 5. Verify pane is actually closed
sleep 0.5
REMAINING=$(herdr pane list 2>/dev/null | jq -r --arg p "$PANE_ID" '.result.panes[]? | select(.pane_id == $p) | .pane_id')
if [ -n "$REMAINING" ]; then
  echo "Error: Failed to close pane $PANE_ID. It is still present in herdr pane list: $CLOSE_OUT" >&2
  exit 1
fi

echo "Successfully closed and verified pane $PANE_ID"
