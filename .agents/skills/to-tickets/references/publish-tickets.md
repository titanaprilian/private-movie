# Prepare the branch and publish

Phase 3 of `/to-tickets`: steps 5–6. Only start after the user has approved the breakdown.

### 5. Prepare the delivery branch

- **Separate mode:** every ticket is built from, and merged into, the delivery branch, so it must exist before any ticket is published. It is a **local** branch: reviewers merge approved tickets into it locally, and nothing is pushed until `/push-to-github` does it at the end. That is also why worktrees are always cut from the local branch, never from `origin/<delivery-branch>`. Create it from the latest default branch (usually `main`) if it isn't there yet. This needs no checkout and does nothing if the branch already exists locally:

  ```bash
  git fetch origin
  git show-ref --verify --quiet refs/heads/<delivery-branch> \
    || if git show-ref --verify --quiet refs/remotes/origin/<delivery-branch>; then
         git branch --no-track <delivery-branch> origin/<delivery-branch>
       else
         git branch --no-track <delivery-branch> origin/<default-branch>
       fi
  ```

  Never reset or force an existing delivery branch: other tickets may already be merged into it.

- **Shared mode:** the branch is created together with the shared worktree in step 7 and stays local until `/push-to-github` pushes it at the end. Only check that the name is free:

  ```bash
  git fetch origin
  git ls-remote --exit-code --heads origin <delivery-branch> >/dev/null 2>&1 && echo "exists on origin"
  git show-ref --verify --quiet refs/heads/<delivery-branch> && echo "exists locally"
  ```

  If the branch already exists, tell the user and ask whether to continue on it (earlier work may already be on it) or pick another name. Never reset or force-push it.

### 6. Publish the tickets to the configured tracker

Publish the approved tickets to GitHub, one issue per ticket, in dependency order (blockers first), using the `gh` CLI. Consult the **gh-cli** skill for the mechanics (auth/repo preflight, safe `--body-file` heredocs, duplicate checks, capturing the returned URL) — don't hand-roll `gh` invocations here. Use the issue template in `templates.md` (read it now) for each body.

**CRITICAL RULES FOR TICKET CREATION:**

1. **Numbering suffix:** You MUST explicitly prefix the title of each ticket issue with its sequential number from the breakdown so the user can easily identify the order in the issue tracker (e.g., `1 — Scaffold Foundation`, `2 — Wire State Management`).
2. **Labeling:** Each generated ticket issue MUST have exactly **two labels** applied to it:
   - The `"ticket"` label (do not omit this!).
   - Exactly ONE of the following category labels based on the work:
     - `"Bug Reports 🐛"` (fixing something that isn't working)
     - `"Feature Requests ✨"` (building new features)
     - `"Enhancements 🚀"` (improving existing features)
     - `"Chores / Tech Debt 🧹"` (maintenance, refactoring, prefactoring)
       _(Example CLI usage: `gh issue create ... --label "ticket" --label "Bug Reports 🐛"`)_.
3. **Blocking edges must be easy for an agent to check.** Use native GitHub sub-issue/blocking relationships where available, AND always write the "Blocked by" section as one `#<issue-number>` reference per line (or the literal line "None — can start immediately"). An implementing agent can then verify with `gh` that every blocker is closed before it starts, without depending on the native links. Because tickets are published blockers-first, every blocker's issue number already exists when you write the ticket that references it. In shared mode this includes the edge from each ticket to the one before it.
4. **Every ticket names its delivery branch** in the "Base" section, the same branch for every ticket in the set.
5. **Every ticket states its worktree mode** in the "Worktree" section, using exactly one of these two lines, the same for every ticket in the set (the first word is what the implementing agent and the reviewer read):
   - `own — a worktree and branch ticket/<issue-number> for this ticket alone; merged into the Base branch after review`
   - `shared — the shared worktree, working directly on the Base branch; one commit per ticket, no merge`

Work the **frontier**: any ticket whose blockers are all done. In separate mode "done" means closed, which means merged into the spec branch, and every ticket on the frontier can be launched in parallel in its own worktree. In shared mode "done" means closed, which means reviewed and committed on the delivery branch, and the frontier is only ever the next ticket in line. For a purely linear chain that means top to bottom.

Do NOT close or modify any parent issue.
