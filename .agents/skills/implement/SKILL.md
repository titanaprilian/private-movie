---
name: implement
description: "Implement a single ticket inside a pre-created git worktree (the agent must be started in that directory), following the decisions already written into the ticket, then commit locally and hand back. Two modes, read from the ticket: own (the ticket has its own worktree and its own branch named after the ticket number) or shared (the whole ticket set is worked in one worktree directly on the delivery branch, one commit per ticket). Refuses to work anywhere else."
disable-model-invocation: true
---

# Implement

Implement the work described by one ticket. You are launched by hand. The worktree you work in is created for you before you start (by `/to-tickets`, or by `bash scripts/wt-init.sh`), and you must be started inside it: you never create, enter, or switch to a worktree yourself, and you never work in the main checkout.

The ticket's **Worktree** section says which of two modes applies:

- **own** — the ticket has a worktree and a branch `ticket/<id>` to itself, often alongside other agents working on other tickets at the same time. The branch starts from the ticket's **Base** (a shared spec branch, kept locally until the final push) and, after review, is merged back into it. Not into main.
- **shared** — the whole set of tickets is worked in **one** worktree that sits directly on the **Base** branch (the delivery branch). Tickets are done one at a time, in order. Each ticket is **one commit** on that branch, reviewed before the next ticket starts. There is no ticket branch and nothing to merge.

A ticket without a Worktree section (an older ticket format) is **own**.

## 0. Get the ticket (read-only)

This skill runs in a fresh agent with no memory of the conversation that created the ticket — you start with nothing but a reference (an issue number or URL). Get the ticket number from it (an issue number, or the last number in an issue URL), then fetch the actual ticket content from GitHub. This step only reads: don't edit, create, or check out anything until step 1 has passed.

```bash
gh issue view <number-or-url> --json title,body,labels,url,comments
```

Consult the **gh-cli** skill if you hit auth/repo-targeting issues or aren't sure which repo to point at — don't guess.

If a comment on the ticket holds a review report with the verdict **Request changes**, you are continuing earlier work: that report's blocking findings are your first job, before anything else in the ticket.

Read the ticket in full. It should contain these sections, and you must follow them:

- **Decisions already made** — design choices fixed by the ticket author. Do not revisit them. If you believe one is wrong or impossible, stop and report instead of deviating.
- **Out of scope** — adjacent work you must not do, even if it looks broken or tempting.
- **Stop and report if** — conditions under which you stop instead of improvising.
- **Touches** — the shared hotspots (e.g. the DB migrations directory) this ticket is allowed to change. If you find you need to change a shared hotspot that is not listed here, stop and report: in own mode another ticket running in parallel may be changing it, and in both modes the reviewer rejects a change to a hotspot the ticket didn't list.
- **Location** — anchor docs and directories to read first. Read them before writing code.
- **Base** — the branch this work belongs to. In own mode: the spec branch you branch from, rebase onto, and that your work is merged into after review. In shared mode: the delivery branch your worktree is already on. Every ticket has one. If the ticket has no Base, stop and report: never guess between main and a spec branch.
- **Worktree** — `own` or `shared`, as described above. Note which one; the rest of this skill depends on it.

If the ticket is missing the other sections (an older ticket format), you may proceed, but treat any ambiguity as a reason to stop and ask rather than guess.

Read the ticket's **"Blocked by"** section and check every blocker:

```bash
gh issue view <blocker-number> --json state,title
```

A blocker counts as done only when it is **closed**. In own mode a ticket is closed only after its branch has been merged into the spec branch (the Base). In shared mode it is closed only after the reviewer approved its commit on the delivery branch. If any blocking ticket isn't closed yet, stop and tell the user rather than implementing out of order.

If the ticket references a **Parent** issue (the spec), fetch that too (`gh issue view <parent-number>`) for full context before starting.

## 1. Check where you are

Run:

```bash
git rev-parse --show-toplevel
git branch --show-current
echo "$(cd "$(git rev-parse --git-dir)" && pwd -P)|$(cd "$(git rev-parse --git-common-dir)" && pwd -P)"
```

You are in the right place only if **all three** hold:

- the two paths in the last line are **different** (you are in a linked worktree, not the main checkout), and the top-level directory is not the main checkout (the first entry of `git worktree list`);
- in **own** mode, the branch is `ticket/<id>`;
- in **shared** mode, the branch is exactly the ticket's **Base** branch.

**If they hold**, that top-level directory is your worktree, `WT`. From here on:

- run every command from inside `WT`;
- every file you read, create or edit must be under `WT`. If an absolute path points anywhere else, including the main checkout or another worktree, don't touch it;
- never `cd` out of `WT` to work, and never check out another branch in it.

**If they don't hold** (you are in the main checkout, on the wrong branch, or not in a worktree), **stop immediately**. Don't edit anything, don't switch branches, don't create a worktree yourself, and don't work on this ticket from outside its worktree by using absolute paths: that is exactly how the main checkout gets modified by mistake. Report this to the user, in these words or close to them:

> I was started in `<pwd>` on branch `<branch>`, but ticket #<id> has to be worked in its own worktree.

and then, depending on the mode:

- own: "Run `bash scripts/wt-init.sh <id>` from the main checkout (it prints the worktree path; if the worktree already exists it is at `<path from git worktree list, if any>`), then start a new agent with that directory as its working directory and run `/implement <id>` there."
- shared: "Run `bash scripts/wt-init.sh --shared <base>` from the main checkout (it prints the shared worktree path; if the worktree already exists it is at `<path from git worktree list, if any>`), then start a new agent with that directory as its working directory and run `/implement <id>` there."

Define **TESTDB** now, because later steps refer to it: in own mode it is `test_ticket_<id>`; in shared mode it is the database name printed by `bash scripts/wt-setup.sh --shared` in step 2 (it starts with `test_`).

## 2. Check the worktree is ready

The worktree was prepared before you started, but it may have been sitting for a while. Inside `WT`:

**Own mode**

1. **Catch up with the spec branch.** The **local** Base branch is the source of truth: reviewers merge approved tickets into it locally, and origin is only updated at the very end, so never use `origin/<base>` (it is behind). Confirm the local branch exists (`git show-ref --verify --quiet refs/heads/<base>`); if not, stop and report. If you have no commits of your own yet (`git log <base>..HEAD` is empty) and the working tree is clean, fast-forward to the latest tip: `git merge --ff-only <base>`. If you already have commits or changes (you are resuming earlier work), leave them alone: you rebase before the final checks.
2. **Make sure the environment is set up.** Run `bash scripts/wt-setup.sh <id>` from inside `WT`. It is safe to re-run, and normally it has already run. It copies the untracked `.env` files, installs dependencies, creates an isolated test database named `test_ticket_<id>`, and points that worktree's `DATABASE_URL` at it (plus its own `PORT`, if your env files define one). Afterwards confirm that `DATABASE_URL` in the worktree's `.env` points at `test_ticket_<id>`.

**Shared mode**

1. **Check the starting state.** Run `git status --porcelain`: the working tree must be clean. If it isn't and you are not resuming after a "Request changes" review, stop and report what is there; don't stash, reset, or clean it, since it may be someone else's unfinished work. Run `git log --format=%s` and check what is already on the branch:
   - every blocker (every earlier ticket you depend on) must already have its commit, with a subject that starts `#<blocker-number> — `. If one is missing, stop and report: the ticket is closed but its work isn't in this worktree.
   - this ticket must not have a commit yet (a subject starting `#<id> — `). If it does and there is no "Request changes" report on the ticket, stop and report that it is already implemented and waiting for review. If it does and there is a "Request changes" report, you are continuing: your work is new commits on top, never an amend.
2. **Don't move the branch.** The delivery branch may exist only on this machine, and the earlier tickets' commits have already been reviewed. Never rebase, reset, merge, pull, or force anything in this worktree. Note the current commit (`git rev-parse HEAD`): this is where your ticket starts, and you report it at the end.
3. **Make sure the environment is set up.** Run `bash scripts/wt-setup.sh --shared` from inside `WT`. It is safe to re-run, and normally it has already run. It copies the untracked `.env` files, installs dependencies, creates the isolated test database for this worktree, points `DATABASE_URL` at it, and prints `database=<name>`: that name is your **TESTDB**. Afterwards confirm that `DATABASE_URL` in the worktree's `.env` ends in TESTDB.

If `scripts/wt-setup.sh` does not exist (or doesn't support the mode you are in) and the ticket needs integration tests (backend endpoints, middleware, CORS, auth guards), stop and report. Do **not** run integration tests against any shared database. Tickets that need only unit tests may proceed without it, but run `bun install` yourself first and say in your hand-back that no isolated database was set up.

## 3. Implement

Use the `/tdd` skill where possible, at pre-agreed seams.

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
  This executes against **your worktree's own test database** (TESTDB) in ~2–3 seconds instead of running the entire 54-file suite. Verify your targeted integration test passes before handing back.

**Before the final checks, bring the work up to date.**

_Own mode._ Rebase your branch so your final test run reflects the latest merged work, not a stale base:

```bash
git add -A && git commit -m "WIP #<id>"      # rebase needs a clean tree; you will tidy the message in step 5
git rebase <base>                             # the ticket's LOCAL Base branch, never origin/<base>
```

- If the rebase hits conflicts, **stop and report**. Do not resolve conflicts yourself, and never hand-edit migration files or the migrations journal.
- If the rebase changed the lockfile or any package manifest, run `bun install` again.
- If the rebase brought in new migration files from other tickets, run `bun run db:migrate` against your ticket database before running integration tests (confirm first that `DATABASE_URL` ends in TESTDB).
- A failing test after the rebase belongs to your ticket. Fix it; do not wait for other agents or assume someone else's work is the cause. If the failure is clearly in code your ticket never touched, stop and report with the failing output.

_Shared mode._ There is nothing to rebase: you are on the delivery branch itself and no one else is merging into it. Don't commit yet and don't run any `git` command that moves the branch. A failing test belongs to your ticket, because the earlier tickets passed their checks on exactly the code you started from. If the failure is clearly in code your ticket never touched, stop and report with the failing output.

**Mandatory Pre-Handoff Quality Checks (Non-Negotiable):**
After the step above (rebase in own mode) and before handing back, you **MUST** run the root verification checks across the monorepo regardless of which application or package was modified (whether `apps/android-tv`, `apps/backend`, `apps/web`, or `packages/*`):

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
3. **STOP** before applying anything to a real database. Do not run `db:push` or `db:migrate` against any database except your worktree's own isolated test database (TESTDB). Before running `db:migrate` for your integration tests, confirm that `DATABASE_URL` in your worktree's `.env` ends in TESTDB. If it does not, do not run it.
4. Include a note in your hand-back message reminding the user to review the generated `.sql` file for data-loss (like dropped tables/columns) and to run `db:migrate` manually on their end.
5. If the user explicitly asks you to run `db:push`, **DO NOT RUN IT**. Warn them that it bypasses SQL generation and can lead to immediate dataset loss, and ask them if they want to run it themselves (which they can do safely because it will be interactive).

## 5. Hand back

**Own mode.** Commit your work on your ticket branch inside the worktree, replacing the temporary message with `#<id> — <ticket title>`. This is a local commit on an isolated branch only.

**Shared mode.** Commit your work as **one commit** on the delivery branch, with the message `#<id> — <ticket title>`. If you are continuing after a "Request changes" review, make a new commit instead, `#<id> — address review: <short summary>`, and never amend, squash, or rewrite any commit that is already on the branch: the reviewed history stays as it is. The commit is local; the delivery branch is pushed only at the very end, by `/push-to-github`.

Do **not**:

- push the branch or open a pull request (that is a separate step),
- merge anything into the spec branch or main (the reviewer does that in own mode; in shared mode there is nothing to merge),
- close or edit the GitHub issue,
- remove the worktree or its test database. In own mode whoever merges the branch cleans them up; in shared mode they are used by every later ticket of the set,
- in shared mode, start the next ticket yourself, or touch the commits of earlier tickets.

If you stopped because of a "Stop and report if" condition, a rebase conflict, a missing blocker, or any other blocker, do not commit partial work. Leave the worktree as it is and report what you found.

Your hand-back message must include:

- **Mode, branch and worktree:** own or shared, the branch name, and the absolute worktree path.
- **Base:** the name of the ticket's Base branch and the commit of it you rebased onto (own mode), or the commit your ticket started from (shared mode, from step 2).
- **Commit:** the short hash and subject of your commit. In shared mode also the **review range**, `<starting commit>..<your commit>`, so the reviewer looks at exactly your ticket.
- **What you did:** a short summary, in terms of behavior.
- **Acceptance criteria:** each criterion, and the command or observation that proves it, with the result.
- **Checks run:** `typecheck`, `lint`, and the test commands, each passed or failed.
- **Out-of-scope observations:** anything wrong you noticed nearby but deliberately left alone.
- **Deviations or tripwires:** any decision you could not follow, or any "Stop and report if" condition you hit.
- **Schema note:** if you generated a migration, the reminder from section 4.
