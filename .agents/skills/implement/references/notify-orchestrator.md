# Notify the orchestrator

You were launched by an orchestrator in a tmux split pane below the orchestrator. The launcher gave you two environment variables:

- `ORCH_PANE` — the tmux pane ID of the orchestrator.
- `IMPL_PANE` — your own implementor tag/pane (informational).

If `ORCH_PANE` is unset or the pane no longer exists, skip the notification silently and rely on your final message.

## When

- After the commit (step 4), or after deciding to stop. Never before.
- Exactly one notification per run. Do not retry if it seems to have no effect.
- Also when you stop on a blocker: do not commit partial work, but still report.

## Status values

- `DONE` — committed and all mandatory checks passed.
- `BLOCKED` — a "Stop and report if" condition, a conflict, a wrong-worktree start, or an unclosed blocker stopped you.
- `NEEDS-DECISION` — a ticket decision looks wrong or impossible.

## 1. Write the full report to a file

The whole hand-back message (everything listed in step 4, or the blocker report) goes into a file inside your worktree's root directory (`.implement-report.md`) or directly inline in your prompt response. Writing to `.implement-report.md` at the worktree root is gitignored and guarantees you never write outside your worktree directory:

```bash
REPORT="$(git rev-parse --show-toplevel)/.implement-report.md"
# write the hand-back content to "$REPORT"
```

If you were stopped by the wrong-worktree check in step 1 and are not inside a worktree, write the report to `/tmp/implement-report-<id>.md` instead.

## 2. Send one single-line notification

It must be one line: a newline in the text would submit it early. Keep it under ~300 characters, and include the ticket, status, outcome and report path:

```bash
if [ -n "${ORCH_PANE:-}" ] && tmux has-session -t "$ORCH_PANE" 2>/dev/null; then
  msg="[implementor #<id>] <DONE|BLOCKED|NEEDS-DECISION>: <one-sentence outcome>. Mode=<own|shared>, commit=<sha or none>. Full report: $REPORT"
  tmux send-keys -t "$ORCH_PANE" -l -- "$msg"
  sleep 0.5
  tmux send-keys -t "$ORCH_PANE" Enter
fi
```

`-l` types the text literally; Enter is sent separately after a short sleep so the TUI submits instead of treating text+Enter as one paste. If the orchestrator doesn't submit, increase the sleep.
