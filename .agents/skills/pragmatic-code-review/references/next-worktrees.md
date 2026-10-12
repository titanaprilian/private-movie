# Plan the next worktrees and hand back (Phase 5, after landing)

The ticket is now closed, so the tickets it blocked may have become ready. Look at the whole delivery, then create exactly the worktrees that are needed. Run from the main repository root:

```bash
bash scripts/wt-init.sh --ready <base>
```

Each output line is `number<TAB>state<TAB>mode<TAB>detail<TAB>title`, for the open tickets that belong to this `Base`:

- `ready`: every blocker is closed and no worktree exists yet.
- `active`: an implementer is already working (own worktree exists, or a shared commit is already on `Base`).
- `blocked`: still waiting on open tickets (listed in the detail).

Act on it:

| What you see                           | What to do                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Several `ready` tickets                | They can run in parallel (the ticket graph already guarantees ready tickets do not overlap). Create **one worktree per ready ticket**: `bash scripts/wt-init.sh <n>` for each. |
| Exactly one `ready` ticket             | Create **one** worktree: `bash scripts/wt-init.sh <n>`. This covers both "only one ticket was left" and "the others are still blocked".                                        |
| No `ready`, some `active` or `blocked` | Create **no** worktree. Say what is being waited on: which tickets are active, and which open tickets block the blocked ones.                                                  |
| No open tickets left                   | The delivery is complete. Create nothing. Tell the user to run `/push-to-github`.                                                                                              |

Notes:

- `wt-init.sh <n>` is idempotent and reads the ticket's own `Worktree` section. For an own ticket it creates `../wt/ticket-<n>` from the **local** `Base` and runs `wt-setup.sh`. For a shared ticket it links the existing shared worktree and runs `wt-setup.sh --shared`, so in a shared set the next ticket reuses the same worktree and only one ticket is ever `ready` at a time.
- Do not create a worktree for an `active` or `blocked` ticket, and do not use `FORCE=1`.
- If `wt-init.sh` fails for one ticket, report the error and continue with the others.
- Do not start implementing anything yourself.

## Hand back

End with the report, then a short **Next** block the user can act on:

- What landed: own tickets were fast-forwarded into the local `Base`; shared tickets were closed in place.
- For each worktree you created: its absolute path, the ticket number and title, and the line to run: open a fresh agent **inside that directory** and invoke `/implement <n>`.
- Or: "Nothing ready: #a, #b are in progress, #c waits on #a." Or: "All tickets are done. Run `/push-to-github`."

Do not push `Base` to origin: that is `/push-to-github`'s job. Do not fix review findings and do not open new tickets unless explicitly asked.
