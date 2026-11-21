---
name: herdr-orchestrator
description: Orchestrate GitHub issues through visible Herdr worker panes, isolated Git worktrees, an interview, implementation, and PR shipping.
---

# Herdr Issue Orchestrator

Use this skill when tasked with orchestrating one or more GitHub issues autonomously using visible Herdr terminal panes.

The current Herdr agent is the orchestrator and keeps the model the user selected for that session. It opens visible panes for workers. Each writing worker gets a separate Git worktree before its pane starts. Worker model settings live in `worker-models.json` beside this skill, not in the orchestrator's runtime settings.

```
[Orchestrator Agent]                                           [Worker Agent in Herdr Pane]
      │                                                                      │
      ├──── 1. Create worker worktree, then start agent in its pane ────────►│
      │                                                                      │
      ├──── 2. Interview worker on Issue #<id> ──────────────────────────────►│
      │                                                                      │ (Explores codebase,
      │                                                                      │  builds decision tree)
      │◄─── 3. Batched frontier questions (❓ Q1, Q2, Q3 in single chat) ────┤
      ├────    "I approve all recommended answers" ─────────────────────────►│
      │                                                                      │ (Reaches shared
      │                                                                      │  understanding)
      │◄─── 4. PUSH: "GRILLING_COMPLETE" ──────────────────────────────────────┤ (Worker prompts parent)
      ├──── 5. Implement specification, merge PR ───────────────────────────►│
      │                                                                      │ (TDD, gate checks,
      │                                                                      │  ship.sh & auto-merge)
      │◄─── 6. PUSH: "WORK_COMPLETE: PR merged and Issue #<id> closed" ──────┤ (Runs herdr agent prompt
      │                                                                      │  orchestrator ...)
      ├──── 7. Verify merge, close pane, remove clean worktree, sync main ───┤ (Orchestrator cleans up)
```

---

## Bundled Helper Scripts

This skill provides ready-to-use helper scripts located under `scripts/`:

- **`scripts/configure-worker.sh list | set <role> <agy|omp> <model>`**
  Lists worker assignments or validates and changes one assignment in `worker-models.json`. The running orchestrator keeps its own model; changing the file affects future workers.
- **`scripts/open-agent.sh --name <name> --role worker|coding|trivial --cwd <worktree> [--layout tab|split]`**
  Reads the selected role from `worker-models.json` and starts it in a visible pane or tab (defaults to `tab` to keep the orchestrator tab uncluttered). To choose a model for one launch without changing the configuration, use `--kind <agy|omp> --model <model>` instead of `--role`.
- **`scripts/send-message.sh --target <name> --message <text> [--wait]`**
  Sends a prompt/message to a target agent in Herdr.
- **`scripts/receive-message.sh --target <name> [--lines 40] [--status-only]`**
  Reads recent unwrapped terminal output or checks if the agent is `idle`, `blocked`, or `working`.
- **`scripts/prompt-orchestrator.sh --message <text> [--notify]`**
  Enables any worker agent to send a prompt/message back to the orchestrator.
- **`scripts/close-agent.sh --target <name>`**
  Closes the worker pane or tab once complete.
- **`scripts/create-worker-worktree.sh --branch <branch> [--base <ref>] [--path <directory>]`** (from the repository root)
  Creates a separate branch and worktree, or returns the path of a matching existing one. It does not reset existing work.

---

## Pure Event-Driven Communication Protocol

Worker agents and orchestrator communicate bidirectionally with **zero polling and zero token waste**:

### 1. Reverse Prompting (Worker Wakes Up Orchestrator)

The orchestrator pane is always registered in Herdr as `name: "orchestrator"`.
When the worker completes a major milestone, it executes:

```bash
herdr agent prompt orchestrator "GRILLING_COMPLETE: Issue #<id> spec settled. Ready for /poteto-mode."
```

or upon shipping and closing the issue:

```bash
herdr agent prompt orchestrator "WORK_COMPLETE: Issue #<id> closed and PR merged."
```

This delivers text to the current Herdr orchestrator agent, regardless of whether it runs OMP or another supported agent. The orchestrator does not poll for completion.

### 2. Batched Question Rounds (Single-Turn Approval)

Per the updated `grilling` skill, all frontier questions for a round are batched together into a single plain-Markdown chat response (no step-by-step `ask_question` menus).

- The worker presents `❓ Q1 ... ➡️ (Recommended)`, `❓ Q2 ... ➡️ (Recommended)` all in one turn.
- The orchestrator approves the entire batch with a single command:
  ```bash
  herdr agent prompt "worker-<issue_id>" "I approve all recommended answers. Please proceed."
  ```
- No arrow navigation or enter keypress loops needed!

---

## Prerequisites

1. Running inside Herdr (`test "${HERDR_ENV:-}" = 1`).
2. GitHub CLI authenticated (`gh auth status`).
3. A worker branch and directory that are free or already belong to the same worker. Preserve any existing changes.

---

## Step-by-Step Orchestration Protocol

### Step 1: Issue Intake & Environment Sync

1. Preserve local changes in the main checkout. Fetch the worker's base without checking out another branch:
   ```bash
   git fetch origin main
   ```
2. Fetch issue metadata:
   ```bash
   gh issue view <issue_id> --json number,title,body
   ```

### Step 2: Create Worker Worktree and Pane

1. Create or reuse the issue worker worktree. Run these commands from the repository root:
   ```bash
   WORKTREE=$(scripts/create-worker-worktree.sh --branch "fix/issue-<issue_id>" --base origin/main)
   .agents/skills/herdr-orchestrator/scripts/open-agent.sh --name "worker-<issue_id>" --role worker --cwd "$WORKTREE" --no-focus
   ```
   The worker owns issue intake, interview, specification, and orchestration. Its code changes are limited to small, mechanical edits that do not merit a dedicated implementation handoff. The worker must not implement substantive feature or bug-fix code itself.
2. Every writing agent gets a separate worktree and visible pane. Use `--role coding` for implementation and `--role trivial` only for mechanical work. Never launch a writer against another agent's worktree or shared branch. Inspect existing worker changes before resuming; never reset them.

### Step 3: Interview the Worker

1. Ask the worker to inspect the issue and interview you about unresolved decisions. Use `/grilling` if that skill is available in the selected agent; otherwise send the same request as a plain prompt:
   ```bash
   herdr agent prompt "worker-<issue_id>" \
     "Interview me about Issue #<issue_id>: <title>. Inspect the codebase, batch open questions with recommended answers, and synthesize the specification. When settled, run: herdr agent prompt orchestrator 'GRILLING_COMPLETE: Issue #<issue_id> spec synthesized. Ready for implementation.' Then pause for confirmation."
   ```
2. When the worker sends a batch of questions, answer that batch in one `herdr agent prompt` call. Do not use `send-keys` to approve an answer you have not read.
3. Once the worker delivers `GRILLING_COMPLETE`, proceed immediately to Step 4.

### Step 4: Delegate Implementation, Then Ship

1. After approving the specification, the worker must invoke `/poteto-mode` and keep it active for the implementation workflow. Do not replace or bypass `/poteto-mode`. Follow its playbooks, verification, and review requirements.
2. The worker creates a separate coding worktree based on the issue branch, then launches the visible coding pane:
   ```bash
   CODER_BRANCH="work/issue-<issue_id>-implementation"
   CODER_WORKTREE=$(scripts/create-worker-worktree.sh --branch "$CODER_BRANCH" --base "fix/issue-<issue_id>")
   .agents/skills/herdr-orchestrator/scripts/open-agent.sh --name "coding-<issue_id>" --role coding --cwd "$CODER_WORKTREE" --no-focus
   ```
   Before prompting the coder, resolve the installed `poteto-mode/worker.md` path from the active runtime's skill catalog. The coder prompt's first line must be `Read <resolved-absolute-skill-directory>/worker.md before anything else.` Require it to invoke `/poteto-mode` before editing, follow repository rules and the approved specification, and report changed files, commit hash, checks, and deviations. It must commit on the coder branch and must not push, open a PR, run `ship.sh`, or merge.
3. The worker reviews the coder report and diff, then integrates the coder commit into the issue branch from the worker worktree (for example, `git cherry-pick <commit>`). Never have the coder and worker edit the same worktree or branch concurrently. Resolve any conflicts in the issue worktree. If the coder reports an approved deviation or cannot finish, return to the user for specification approval before expanding scope.
4. In the issue worktree, run final focused tests, required repository gates, and `.agents/skills/ship/scripts/ship.sh --issue <issue_id>`. `ship.sh` owns PR creation, CI monitoring, and auto-merge; do not launch a separate CI babysitter. On CI failure, use `/poteto-mode` and a fresh coding worktree/branch for a bounded fix, integrate its commit, and rerun shipping. Maximum 3 repair iterations; after that leave the worker pane open for human inspection.
5. Only after `ship.sh` confirms merge and GitHub confirms the issue is closed, the worker must run:
   ```bash
   herdr agent prompt orchestrator 'WORK_COMPLETE: Issue #<issue_id> PR merged and issue closed.'
   ```
   Then end the turn. Do not poll with `sleep` or timers; rely on the reverse prompt.

### Step 5: Clean Up & Queue Advancement

When the orchestrator receives `WORK_COMPLETE`:

1. Confirm the PR merged and the issue closed. A closed issue alone does not prove that a PR merged.
2. Close the worker and coding panes with `scripts/close-agent.sh --target "worker-<issue_id>"` and `--target "coding-<issue_id>"`. Confirm both are absent from `herdr pane list`.
3. Remove the coder worktree only if it is clean and the coder commit is integrated. Remove the issue worktree only if clean and merged. Preserve dirty worktrees for inspection; never force-remove them.
4. Update local `main` with `git pull --ff-only origin main` only if the main checkout has no conflicting changes.
5. If more issues remain, return to Step 1.

---

## Safety Guardrails & Token Preservation

- **Strictly No Polling Loops or Guess Timers:** NEVER poll with `sleep` and terminal reads (`herdr agent read`), and do NOT use arbitrary wait timers. Rely exclusively on reverse prompts to wake up the orchestrator.
- **Immediate Pane Cleanup:** Always close completed worker/coding panes after verifying merge.
- **Stop Sentinel:** If `.stop-runner` or `/tmp/herdr-runner-stop` is present, or if the user requests a stop, complete the active issue, close its panes, and exit immediately.
- **Database Safety:** Obey `AGENTS.md` — never allow `db:push` or apply unreviewed destructive SQL migrations.
- **Commit Scopes:** Ensure changes obey the monorepo rule of at most one app per commit (`apps/web`, `apps/backend`, or `apps/android-tv`).
- **CI Retry Cap:** If CI fails on `ship.sh`, allow up to 3 repair iterations. If still failing, leave the worker pane open for human inspection.
