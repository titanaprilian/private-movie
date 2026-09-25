---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

# Implement

Implement the work described by the user in the spec or tickets.

## 0. Get the ticket

This skill runs in a fresh agent with no memory of the conversation that created the ticket — you start with nothing but a reference (an issue number or URL). Before doing anything else, fetch the actual ticket content from GitHub:

```bash
gh issue view <number-or-url> --json title,body,labels,url
```

Consult the **gh-cli** skill if you hit auth/repo-targeting issues or aren't sure which repo to point at — don't guess.

Read the ticket's **"Blocked by"** section. If any blocking ticket isn't closed yet, stop and tell the user rather than implementing out of order.

If the ticket references a **Parent** issue (the spec), fetch that too (`gh issue view <parent-number>`) for full context before starting.

## 1. Implement

Use /tdd where possible, at pre-agreed seams.

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

**Mandatory Pre-Handoff Quality Checks (Non-Negotiable):**
Before handing back, you **MUST** run the root verification checks across the monorepo regardless of which application or package was modified (whether `apps/android-tv`, `apps/backend`, `apps/web`, or `packages/*`):
1. `bun run typecheck` — **MANDATORY**. Confirms TypeScript compilation and Android Kotlin compilation (`./gradlew compileDebugKotlin`) pass cleanly across the monorepo.
2. `bun run lint` — **MANDATORY**. Confirms ESLint and Android Gradle lint pass with zero errors across all workspaces.
3. Run the full unit test suite for the touched package(s) or `bun run test` so Turbo caches passing results for the orchestrator.

**Package test commands for caching:**
- `bun run test:web` (or `bunx turbo run test --filter=@repo/web`)
- `bun run test:backend` (or `bunx turbo run test --filter=@repo/backend`)
- `bun run test:seed-cli` (or `bunx turbo run test --filter=@repo/seed-cli`)
- `bun run test:media-service` (or `bunx turbo run test --filter=@repo/media-service`)
- `bun run test:media-scraper` (or `bunx turbo run test --filter=@repo/media-scraper`)
- `bun run test:db` (or `bunx turbo run test --filter=@repo/db`)
- `bun run test:contracts` (or `bunx turbo run test --filter=@repo/contracts`)
- `bun run test` (runs all unit tests via Turbo)
If the ticket touches backend HTTP endpoints (e.g., routes, middleware, CORS, auth guards), also write and run integration tests under `test/integration/` — not just unit tests.
- **Fast Feedback (Targeted Integration Testing):** Run ONLY the integration test file(s) relevant to your change:
  `bun --filter=@repo/backend run test:integration test/integration/<feature>/<name>.test.ts`
  This executes against the live test database in ~2–3 seconds instead of running the entire 54-file suite. Verify your targeted integration test passes before handing back.

## 2. Safe Schema Changes

If the ticket involves database schema changes (e.g., modifying `src/schema/index.ts` in the DB package):
1. Make the necessary typescript changes.
2. Run the command to generate the migration file locally (e.g., `bun run db:generate`).
3. **STOP.** Do not run `db:push` or `db:migrate`. 
4. Include a note in your hand-back message reminding the orchestrator/user to review the generated `.sql` file for data-loss (like dropped tables/columns) and to run `db:migrate` manually on their end.
5. If the user explicitly asks you to run `db:push`, **DO NOT RUN IT**. Warn them that it bypasses SQL generation and can lead to immediate dataset loss, and ask them if they want to run it themselves (which they can do safely because it will be interactive).

## 3. Hand back

Don't commit any changes that you made. The orchestrator agent is the one who does it. Don't close or edit the GitHub issue yourself — report back what was done and let the orchestrator handle ticket state.
