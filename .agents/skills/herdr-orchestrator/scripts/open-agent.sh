#!/usr/bin/env bash
set -euo pipefail
SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

NAME=""
LAYOUT="split"
DIRECTION="right"
KIND=""
ROLE=""
MODEL=""
CWD="$PWD"
FOCUS=true
AGENT_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)
      NAME="$2"
      shift 2
      ;;
    --layout)
      LAYOUT="$2"
      shift 2
      ;;
    --direction)
      DIRECTION="$2"
      shift 2
      ;;
    --kind)
      KIND="$2"
      shift 2
      ;;
    --role)
      ROLE="$2"
      shift 2
      ;;
    --model)
      MODEL="$2"
      shift 2
      ;;
    --cwd)
      CWD="$2"
      shift 2
      ;;
    --no-focus)
      FOCUS=false
      shift
      ;;
    --)
      shift
      AGENT_ARGS=("$@")
      break
      ;;
    *)
      echo "Unknown flag: $1" >&2
      exit 1
      ;;
  esac
done

if [ -z "$NAME" ]; then
  echo "Usage: $0 --name <agent-name> [--role worker|coding|trivial | --kind <herdr-kind> [--model <model>]] [--cwd <worktree>] [-- agent-flags...]" >&2
  exit 2
fi

if [ -n "$ROLE" ]; then
  if [ -n "$KIND" ] || [ -n "$MODEL" ] || ((${#AGENT_ARGS[@]})); then
    echo "Error: --role cannot be combined with --kind, --model, or raw agent flags" >&2
    exit 2
  fi
  if ! ROLE_SETTINGS=$(jq -e --arg role "$ROLE" '.[$role] | select(.kind and .model)' "$SKILL_DIR/worker-models.json"); then
    echo "Error: Unknown or incomplete worker role: $ROLE" >&2
    exit 2
  fi
  KIND=$(jq -r '.kind' <<< "$ROLE_SETTINGS")
  MODEL=$(jq -r '.model' <<< "$ROLE_SETTINGS")
  if [ "$KIND" != agy ] && [ "$KIND" != omp ]; then
    echo "Error: Role $ROLE uses unsupported model adapter: $KIND" >&2
    exit 2
  fi
elif [ -n "$MODEL" ]; then
  if { [ "$KIND" != agy ] && [ "$KIND" != omp ]; } || ((${#AGENT_ARGS[@]})); then
    echo "Error: --model requires --kind agy or omp and no raw agent flags" >&2
    exit 2
  fi
elif [ -z "$KIND" ]; then
  echo "Error: Specify --role or --kind" >&2
  exit 2
fi

if [ "${HERDR_ENV:-}" != "1" ]; then
  echo "Error: Must run inside Herdr (HERDR_ENV != 1)" >&2
  exit 1
fi

if [ ! -d "$CWD" ]; then
  echo "Error: Working directory does not exist: $CWD" >&2
  exit 1
fi

if ! herdr agent get orchestrator >/dev/null 2>&1; then
  if [ -z "${HERDR_PANE_ID:-}" ]; then
    echo "Error: Cannot register the orchestrator without HERDR_PANE_ID" >&2
    exit 1
  fi
  herdr agent rename "$HERDR_PANE_ID" orchestrator >/dev/null
fi

PANE_ID=""
TAB_ID=""

FOCUS_FLAG="--focus"
if [ "$FOCUS" = false ]; then
  FOCUS_FLAG="--no-focus"
fi

if [ "$LAYOUT" = "tab" ]; then
  TAB_RESP=$(herdr tab create --label "$NAME" --cwd "$CWD" "$FOCUS_FLAG")
  TAB_ID=$(echo "$TAB_RESP" | jq -r '.result.tab.tab_id')
  PANE_ID=$(echo "$TAB_RESP" | jq -r '.result.root_pane.pane_id')
else
  PANE_RESP=$(herdr pane split --current --direction "$DIRECTION" --cwd "$CWD" "$FOCUS_FLAG")
  PANE_ID=$(echo "$PANE_RESP" | jq -r '.result.pane.pane_id')
fi

if [ -n "$MODEL" ]; then
  AGENT_ARGS=(--model "$MODEL")
fi

if ((${#AGENT_ARGS[@]})); then
  if ! START_RESP=$(herdr agent start "$NAME" --kind "$KIND" --pane "$PANE_ID" --timeout 30000 -- "${AGENT_ARGS[@]}"); then
    echo "Agent startup failed in pane $PANE_ID (worktree: $CWD). Inspect it before cleanup: $START_RESP" >&2
    exit 1
  fi
else
  if ! START_RESP=$(herdr agent start "$NAME" --kind "$KIND" --pane "$PANE_ID" --timeout 30000); then
    echo "Agent startup failed in pane $PANE_ID (worktree: $CWD). Inspect it before cleanup: $START_RESP" >&2
    exit 1
  fi
fi

jq -n --arg name "$NAME" --arg pane_id "$PANE_ID" --arg tab_id "$TAB_ID" --arg kind "$KIND" --arg model "$MODEL" '{name: $name, pane_id: $pane_id, tab_id: $tab_id, kind: $kind, model: $model}'
