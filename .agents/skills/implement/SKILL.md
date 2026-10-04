--
name: implement
description: "Implement a single ticket in its own git worktree and branch, following the decisions already written into the ticket, then commit locally and hand back."
disable-model-invocation: true

---

# Implement

Implement the work described by one ticket. You are launched by hand, often alongside other agents working on other tickets at the same time. To keep your work isolated from theirs, you work in **your own git worktree on your own branch**, never in the main checkout. Your branch starts from the ticket's **Base**, a shared spec branch. After review, your branch is merged back into that spec branch (not into main), where later tickets pick it up.

## ⚠️ GATE 0: Mandatory Worktree Isolation Check

**DO NOT OPEN OR EDIT ANY APPLICATION CODE IN THE MAIN CHECKOUT.**
Before reading code files, running tests, or planning modifications, you **MUST** ensure you are running inside the ticket's isolated worktree:

```bash
git rev-parse --show-toplevel && git branch --show-current
```

1. **If already inside `../wt/ticket-<id>` on branch `ticket/<id>`**: Gate passed. Proceed to Section 1.
2. **If currently in the main checkout or any other branch**: **STOP IMMEDIATELY**.
   You MUST bootstrap your worktree first using the automated script:
   ```bash
   ./scripts/wt-init.sh <ticket-id>
   ```
   (If `wt-init.sh` asks for `<base>`, look up the ticket's `Base:` line or supply it: `./scripts/wt-init.sh <id> <base>`).
   Then switch your working directory into the worktree:
   ```bash
   cd ../wt/ticket-<id>
   ```
   All subsequent steps, reads, edits, and terminal commands **MUST** take place within this worktree.

## 1. Get the ticket & Verify Blockers

This skill runs in a fresh agent with no memory of the conversation that created the ticket — you start with nothing but a reference (an issue number or URL). Fetch the ticket content from GitHub:

```bash
gh issue view <number-or-url> --json title,body,labels,url,comments
```

Consult the **gh-cli** skill if you hit auth/repo-targeting issues or aren't sure which repo to point at — don't guess.

If a comment on the ticket holds a review report with the verdict **Request changes**, you are continuing earlier work: that report's blocking findings are your first job, before anything else in the ticket.

Read the ticket in full. It should contain these sections, and you must follow them:

- **Decisions already made** — design choices fixed by the ticket author. Do not revisit them. If you believe one is wrong or impossible, stop and report instead of deviating.
- **Out of scope** — adjacent work you must not do, even if it looks broken or tempting.
- **Stop and report if** — conditions under which you stop instead of improvising.
- **Touches** — the shared hotspots (e.g. the DB migrations directory) this ticket is allowed to change. If you find you need to change a shared hotspot that is not listed here, stop and report: another ticket running in parallel may be changing it.
- **Location** — anchor docs and directories to read first. Read them before writing code.
- **Base** — the spec branch you branch from, rebase onto, and that your work is merged into after review. Every ticket has one. If the ticket has no Base, stop and report: never guess between main and a spec branch.

If the ticket is missing the other sections (an older ticket format), you may proceed, but treat any ambiguity as a reason to stop and ask rather than guess.

Read the ticket's **"Blocked by"** section and check every blocker:

```bash
gh issue view <blocker-number> --json state,title
```

A blocker counts as done only when it is **closed**, and a ticket is closed only after its branch has been merged into the spec branch (the Base). If any blocking ticket isn't closed yet, stop and tell the user rather than implementing out of order.

If the ticket references a **Parent** issue (the spec), fetch that too (`gh issue view <parent-number>`) for full context before starting.

## 2. Worktree & Environment Verification

Verify your setup before writing any code:
1. Confirm current directory: `git rev-parse --show-toplevel` must point to `wt/ticket-<id>`.
2. Confirm current branch: `git branch --show-current` must be `ticket/<id>`.
3. Confirm database isolation: inspect `.env` to verify `DATABASE_URL` ends in `test_ticket_<id>`.

If `scripts/wt-setup.sh` did not run during `wt-init.sh`, or if you manually prepared the worktree, run:
```bash
scripts/wt-setup.sh <id>
```
If `scripts/wt-setup.sh` does not exist and the ticket needs integration tests (backend endpoints, middleware, CORS, auth guards), stop and report. Do **not** run integration tests against any shared database. Tickets that need only unit tests may proceed without it, but run `bun install` yourself first and say in your hand-back that no isolated database was set up.

## 3. Implement

Use /tdd where possible, at pre-agreed seams.

Stay inside the directories named in the ticket's Location. Follow the pattern the ticket tells you to imitate.

Run typechecking regularly, single test files regularly during development, and the test suite via Turbo before handing back so results are cached.

**Running Package Tests (Mandatory Rule):**

- **NEVER** run bare `bun test` or `bun --filter=<pkg> test` — in Bun, `test` is a built-in top-level command that ignores `--filter` and runs all monorepo tests natively without the required Vitest/Node environment.
- Avoid raw `bun --filter=@repo/web run test` as it bypasses Turbo's cache and forces an uncached 2-3 minute full re-run.

**During the TDD red → green loop — use targeted test runs (fast feedback):**

- Pass the specific test file path through the double `--` separator so it reaches Vitest:
  - `bun run test:web -- -- test/unit/<feature>/<name>.test.ts`
  - `bun run test:backend -- -- test/unit/<feature>/<name>.test.ts`
  - `bun run test:seed-cli -- -- test/unit/<feature>/<name>.test.ts`
  - `bun run test:media-service -- -- test/unit/<feature>/<name>.test.ts`
  - `bun run test:media-scraper -- -- test/unit/<feature>/<name>.test.ts`
  - `bun run test:db -- -- test/unit/<feature>/<name>.test.ts`
  - `bun run test:contracts -- -- test/unit/<feature>/<name>.test.ts`
- Equivalently with Turbo directly:
  - `bunx turbo run test --filter=@repo/<pkg> -- test/unit/<feature>/<name>.test.ts`
- This runs in ~2–5 seconds instead of the full suite (which can take 1–3 minutes).
- Example: `bun run test:web -- -- test/unit/auth/LoginForm.test.tsx`

If the ticket touches backend HTTP endpoints (e.g., routes, middleware, CORS, auth guards), also write and run integration tests under `test/integration/` — not just unit tests.

- **Fast Feedback (Targeted Integration Testing):** Run ONLY the integration test file(s) relevant to your change:
  `bun --filter=@repo/backend run test:integration test/integration/<feature>/<name>.test.ts`
  This executes against **your worktree's own test database** (`test_ticket_<id>`) in ~2–3 seconds instead of running the entire 54-file suite. Verify your targeted integration test passes before handing back.

**Rebase before the final checks.** Once the implementation is done, bring your branch up to date so your final test run reflects the latest merged work, not a stale base:

```bash
git add -A && git commit -m "WIP #<id>"      # rebase needs a clean tree; you will tidy the message in step 4
git fetch origin
git rebase origin/<base>                      # the ticket's Base branch
```

- If the rebase hits conflicts, **stop and report**. Do not resolve conflicts yourself, and never hand-edit migration files or the migrations journal.
- If the rebase changed the lockfile or any package manifest, run `bun install` again.
- If the rebase brought in new migration files from other tickets, run `bun run db:migrate` against your ticket database before running integration tests (confirm first that `DATABASE_URL` ends in `test_ticket_<id>`).
- A failing test after the rebase belongs to your ticket. Fix it; do not wait for other agents or assume someone else's work is the cause. If the failure is clearly in code your ticket never touched, stop and report with the failing output.

**Mandatory Pre-Handoff Quality Checks (Non-Negotiable):**
After rebasing and before handing back, you **MUST** run the root verification checks across the monorepo regardless of which application or package was modified (whether `apps/android-tv`, `apps/backend`, `apps/web`, or `packages/*`):

1. `bun run typecheck` — **MANDATORY**. Confirms TypeScript compilation and Android Kotlin compilation (`./gradlew compileDebugKotlin`) pass cleanly across the monorepo.
2. `bun run lint` — **MANDATORY**. Confirms ESLint and Android Gradle lint pass with zero errors across all workspaces.
3. Run the full unit test suite for the touched package(s) or `bun run test` so Turbo caches passing results in this worktree for the reviewer.

**Package test commands for caching:**

- `bun run test:web` (or `bunx turbo run test --filter=@repo/web`)
- `bun run test:backend` (or `bunx turbo run test --filter=@repo/backend`)
- `bun run test:seed-cli` (or `bunx turbo run test --filter=@repo/seed-cli`)
- `bun run test:media-service` (or `bunx turbo run test --filter=@repo/media-service`)
- `bun run test:media-scraper` (or `bunx turbo run test --filter=@repo/media-scraper`)
- `bun run test:db` (or `bunx turbo run test --filter=@repo/db`)
- `bun run test:contracts` (or `bunx turbo run test --filter=@repo/contracts`)
- `bun run test` (runs all unit tests via Turbo)

Then check each acceptance criterion in the ticket against what you actually ran. You will report the evidence for each one.

## 4. Safe Schema Changes

If the ticket involves database schema changes (e.g., modifying `src/schema/index.ts` in the DB package):

1. Make the necessary typescript changes.
2. Run the command to generate the migration file locally (e.g., `bun run db:generate`).
3. **STOP** before applying anything to a real database. Do not run `db:push` or `db:migrate` against any database except your worktree's own isolated test database (`test_ticket_<id>`). Before running `db:migrate` for your integration tests, confirm that `DATABASE_URL` in your worktree's `.env` ends in `test_ticket_<id>`. If it does not, do not run it.
4. Include a note in your hand-back message reminding the user to review the generated `.sql` file for data-loss (like dropped tables/columns) and to run `db:migrate` manually on their end.
5. If the user explicitly asks you to run `db:push`, **DO NOT RUN IT**. Warn them that it bypasses SQL generation and can lead to immediate dataset loss, and ask them if they want to run it themselves (which they can do safely because it will be interactive).

## 5. Hand back

Commit your work on your ticket branch inside the worktree, replacing the temporary message with `#<id> — <ticket title>`. This is a local commit on an isolated branch only.

Do **not**:

- push the branch or open a pull request (that is a separate step),
- merge anything into the spec branch or main (the reviewer does that),
- close or edit the GitHub issue,
- remove your worktree or its test database (whoever merges the branch cleans them up).

If you stopped because of a "Stop and report if" condition, a rebase conflict, a missing blocker, or any other blocker, do not commit partial work. Leave the worktree as it is and report what you found.

Your hand-back message must include:

- **Branch and worktree:** the branch name and the absolute worktree path.
- **Base:** the name of the ticket's Base branch and the commit of it you rebased onto.
- **What you did:** a short summary, in terms of behavior.
- **Acceptance criteria:** each criterion, and the command or observation that proves it, with the result.
- **Checks run:** `typecheck`, `lint`, and the test commands, each passed or failed.
- **Out-of-scope observations:** anything wrong you noticed nearby but deliberately left alone.
- **Deviations or tripwires:** any decision you could not follow, or any "Stop and report if" condition you hit.
- **Schema note:** if you generated a migration, the reminder from section 3.
