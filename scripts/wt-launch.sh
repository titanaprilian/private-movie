#!/usr/bin/env bash
# usage: wt-launch.sh [--shared] <issue> <worktree-abs-path>
set -euo pipefail

shared=0
[ "${1:-}" = "--shared" ] && { shared=1; shift; }
issue="${1:?issue number}"; dir="${2:?worktree path}"
harness="${IMPLEMENTOR_CMD:-opencode}"

[ -n "${TMUX:-}" ]            || { echo "not inside tmux" >&2; exit 2; }
[ -d "$dir" ]                 || { echo "no such dir: $dir" >&2; exit 2; }
command -v "$harness" >/dev/null || { echo "$harness not found" >&2; exit 2; }

session="$(tmux display-message -p '#S')"
# shared mode: one fixed window name, so a second implementor can't start
if [ "$shared" = 1 ]; then win="impl-shared"; else win="impl-$issue"; fi

if tmux list-windows -t "$session" -F '#W' | grep -qx "$win"; then
  if [ "$shared" = 1 ]; then
    echo "shared implementor still running in $session:$win" >&2; exit 3
  fi
  echo "already running: $session:$win"; exit 0
fi

# -d keeps focus on the orchestrator tab. The wrapper keeps the window open
# after the harness exits so a startup error stays readable.
tmux new-window -d -t "$session:" -n "$win" -c "$dir" \
  bash -c '"$1" --prompt "$2"; rc=$?; echo "[implementor exited: $rc]"; exec bash' \
  _ "$harness" "/implement $issue"

echo "launched $session:$win in $dir"
