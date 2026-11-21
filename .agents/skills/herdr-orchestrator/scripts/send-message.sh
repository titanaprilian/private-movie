#!/usr/bin/env bash
set -euo pipefail

# send-message.sh: Sends a prompt/message to a target agent in Herdr
TARGET=""
MESSAGE=""
WAIT=false
TIMEOUT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --message)
      MESSAGE="$2"
      shift 2
      ;;
    --wait)
      WAIT=true
      shift
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    *)
      echo "Unknown flag: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$TARGET" ] || [ -z "$MESSAGE" ]; then
  echo "Usage: $0 --target <agent-name-or-pane> --message <text> [--wait] [--timeout ms]" >&2
  exit 1
fi

ARGS=()
if [ "$WAIT" = true ]; then
  ARGS+=(--wait)
fi
if [ -n "$TIMEOUT" ]; then
  ARGS+=(--timeout "$TIMEOUT")
fi

herdr agent prompt "$TARGET" "$MESSAGE" "${ARGS[@]}"
