#!/usr/bin/env bash
# usage: wt-launch.sh [--shared] <issue> <worktree-abs-path>
set -euo pipefail

shared=0
[ "${1:-}" = "--shared" ] && { shared=1; shift; }
issue="${1:?issue number}"; dir="${2:?worktree path}"
harness="${IMPLEMENTOR_CMD:-opencode}"

[ -n "${TMUX:-}" ]            || { echo "not inside tmux" >&2; exit 2; }
[ -n "${TMUX_PANE:-}" ]       || { echo "no TMUX_PANE (run from the orchestrator's pane)" >&2; exit 2; }
[ -d "$dir" ]                 || { echo "no such dir: $dir" >&2; exit 2; }
command -v "$harness" >/dev/null || { echo "$harness not found" >&2; exit 2; }

session="$(tmux display-message -p '#S')"
# The orchestrator's own pane. Stable across window renames; the implementor
# uses it to send its completion notice back (see references/notify-orchestrator.md).
orch_pane="$TMUX_PANE"

# shared mode: one fixed tag, so a second implementor can't start
if [ "$shared" = 1 ]; then tag="impl-shared"; else tag="impl-$issue"; fi

existing_pane="$(tmux list-panes -t "$orch_pane" -F '#{pane_id} #{@ticket}' 2>/dev/null | awk -v t="$tag" '$2==t {print $1}')"
if [ -n "$existing_pane" ]; then
  if [ "$shared" = 1 ]; then
    echo "shared implementor still running in pane $existing_pane" >&2; exit 3
  fi
  echo "already running in pane: $existing_pane"; exit 0
fi

# -d keeps focus on the orchestrator pane. The wrapper keeps the pane open
# after the harness exits so a startup error stays readable. ORCH_PANE and
# IMPL_PANE are exported for the implementor; values are passed as
# positional args to avoid quoting problems.
prompt="${IMPLEMENTOR_PROMPT:-/implement $issue}"
impl_pane="$(tmux split-window -v -d -t "$orch_pane" -P -F '#{pane_id}' -c "$dir" \
  bash -c 'export ORCH_PANE="$3" IMPL_PANE="$4"; "$1" --prompt "$2"; rc=$?; echo "[implementor exited: $rc]"; exec bash' \
  _ "$harness" "$prompt" "$orch_pane" "$tag")"

tmux set-option -p -t "$impl_pane" @ticket "$tag"
tmux select-pane -T "$tag" -t "$impl_pane" 2>/dev/null || true
tmux select-layout -t "$orch_pane" main-horizontal 2>/dev/null || true

echo "launched pane $impl_pane ($tag) in $dir (orchestrator pane $orch_pane)"
