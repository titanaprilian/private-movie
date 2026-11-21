#!/usr/bin/env bash
set -euo pipefail

# receive-message.sh: Reads output or status from a target agent in Herdr
TARGET=""
LINES=40
SOURCE="recent-unwrapped"
STATUS_ONLY=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --lines)
      LINES="$2"
      shift 2
      ;;
    --source)
      SOURCE="$2"
      shift 2
      ;;
    --status-only)
      STATUS_ONLY=true
      shift
      ;;
    *)
      echo "Unknown flag: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$TARGET" ]; then
  echo "Usage: $0 --target <agent-name-or-pane> [--lines N] [--source recent-unwrapped] [--status-only]" >&2
  exit 1
fi

if [ "$STATUS_ONLY" = true ]; then
  herdr agent get "$TARGET" | jq -r '.result.agent.agent_status'
else
  herdr agent read "$TARGET" --source "$SOURCE" --lines "$LINES"
fi
