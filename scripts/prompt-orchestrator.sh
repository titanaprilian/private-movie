#!/usr/bin/env bash
set -euo pipefail

# prompt-orchestrator.sh: Allows any worker agent to send a prompt/message back to the orchestrator
MESSAGE=""
NOTIFY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --message|-m)
      MESSAGE="$2"
      shift 2
      ;;
    --notify)
      NOTIFY=true
      shift
      ;;
    *)
      if [ -z "$MESSAGE" ]; then
        MESSAGE="$1"
        shift
      else
        echo "Unknown flag: $1" >&2
        exit 1
      fi
      ;;
  esac
done

if [ -z "$MESSAGE" ]; then
  echo "Usage: $0 --message \"<message text>\" [--notify]" >&2
  exit 1
fi

# 1. Target the orchestrator agent registered in Herdr
TARGET="orchestrator"

# Verify target exists, fallback to first pane if necessary
if ! herdr agent get "$TARGET" >/dev/null 2>&1; then
  FIRST_PANE=$(herdr pane list 2>/dev/null | jq -r '.result.panes[0].pane_id // empty' || true)
  if [ -n "$FIRST_PANE" ]; then
    TARGET="$FIRST_PANE"
  fi
fi

# 2. Optionally trigger desktop/Herdr notification
if [ "$NOTIFY" = true ]; then
  herdr notification show "Worker Notification" --body "$MESSAGE" --sound request 2>/dev/null || true
fi

# 3. Deliver prompt to the orchestrator agent
herdr agent prompt "$TARGET" "$MESSAGE"
