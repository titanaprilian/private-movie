# Agent Context Protocol (Deep Modules Architecture)

> **Read application-specific rules too.** When working inside a specific application directory under `apps/` (e.g. `apps/backend`), you **must** also read the `AGENTS.md` file located in that application's root for framework-specific instructions (routing, HTTP layers, test setups, etc.). If no such file exists, this root document governs. When the two documents conflict, the application-specific document takes precedence within that application's directory.

Welcome! This monorepo uses a **Deep Modules** architecture tailored for AI agents. This document defines the generic rules of engagement shared across all applications in the monorepo. Framework-specific details live in each application's own `AGENTS.md`.

## Feature Delivery Pipeline

When implementing a feature or fixing a bug, follow this strict execution sequence:

1. **grill-me** → Establish shared understanding of requirements. Before interviewing, the agent estimates how many tickets the work will likely break into and recommends one of two paths:
   - **Direct-to-ticket path**: estimated ≤2 tickets, and no `packages/contracts` or DB schema changes involved.
   - **Full spec path**: estimated ≥3 tickets, OR the work touches `packages/contracts` or a DB schema (this override applies regardless of estimated size).

   The agent states its recommendation and reasoning, then the user confirms or overrides. This decision is never made unilaterally by the agent.

2. **to-spec** (conditional) → Create a specification document. Skipped when the direct-to-ticket path was confirmed in step 1.

   **Escalation guard**: if `/to-tickets` (step 3) ends up producing 3 or more tickets after a direct-to-ticket path was chosen, the agent must pause before any implementation begins and ask the user whether to back up and write a spec, or continue as-is.

3. **to-tickets** → Break into tickets (test-writing tickets are priority #1, unblocked first)
4. **implement** → Agents pick up tickets, write tests first (TDD), then implement
5. **code-review** → Orchestrator reviews each completed ticket
6. **push-to-github** → Orchestrator pushes when all tickets are complete
7. **deploy** → Deploy services to VPS, manage Caddy domains, or sync database

---

## Core Rules & Constraints

- **Strict Isolation**: You are explicitly forbidden from reading or modifying the internal implementation details (`/internal/` directories) of any module unrelated to your current target feature.
- **Import Restrictions**: ESLint/tooling enforces strict boundaries. You must never import from a module's `/internal/` folder from outside that module.
- **Entry Points**: The only allowed export point for a module is `[app_root]/src/modules/<feature>/index.ts`. It must export a concrete implementation adhering to a strict interface.

---

## API Contracts & Canonical Types (`packages/contracts`)

- **Contract-First Design**: Whenever an API endpoint is created, modified, or has its request/query/response payload shape altered, you **must** define or update the canonical TypeScript interfaces and DTOs in `packages/contracts/src/` first before implementing or consuming them in `apps/backend` or `apps/web`.
- **Framework Independence**: `packages/contracts` must remain pure TypeScript contracts free of framework-specific dependencies (no Elysia, no Drizzle, no React).
- **Single Source of Truth**: All backend response envelopes, frontend API callers, and native client mappings must import and adhere to canonical domain types exported from `@repo/contracts`.
- **Spec required regardless of estimated ticket count**: any change touching `packages/contracts` or involving a DB schema migration always goes through the full grill → spec → tickets path. The grill-me triage step must not offer the direct-to-ticket path for this kind of change, even if the change looks small.

---

## Testing Conventions

Tests use a conventional folder-based structure with Vitest as the test runner via `packages/config-vitest/`.

**Test locations:**

- `test/unit/<feature>/<name>.test.ts` — Unit tests for a single module/function in isolation
- `test/integration/<feature>/<name>.test.ts` — Integration tests (backend only, HTTP layer against real database)
- `test/utils/` — Per-app shared test helpers
- `test/global-setup.ts` — One-time setup per target (e.g., ensure test DB exists, run migrations)
- `test/setup.ts` — Per-test setup (e.g., truncate database tables before each test)

**Naming:**

- Plain `.test.ts` suffix — no tier suffixes, no human/agent ownership restrictions
- Tests are organized by feature, mirroring the module structure without the `modules/` prefix

**Agent permissions:**

- AI agents have full permission to create, modify, and delete all test files
- All tests are code subject to the same review process as source code

**TDD-first workflow:**

- Write tests before implementing features
- **During the red → green loop, always use targeted test runs for fast feedback.** Pass the specific test file through the double `--` separator so it reaches Vitest:
  - `bun run test:web -- -- test/unit/<feature>/<name>.test.ts`
  - `bun run test:backend -- -- test/unit/<feature>/<name>.test.ts`
  - `bun run test:seed-cli -- -- test/unit/<feature>/<name>.test.ts`
  - `bun run test:media-service -- -- test/unit/<feature>/<name>.test.ts`
  - `bun run test:media-scraper -- -- test/unit/<feature>/<name>.test.ts`
  - `bun run test:db -- -- test/unit/<feature>/<name>.test.ts`
  - `bun run test:contracts -- -- test/unit/<feature>/<name>.test.ts`
  - Equivalently: `bunx turbo run test --filter=@repo/<pkg> -- test/unit/<feature>/<name>.test.ts`
  - This completes in ~2–5 seconds. Never run the full suite in a tight TDD loop.
- **Before handing back**, run the full suite once so Turbo caches results for the orchestrator:
  - `bun run test:web`, `bun run test:backend`, `bun run test:seed-cli`, `bun run test:media-service`, `bun run test:media-scraper`, `bun run test:db`, or `bun run test:contracts` (or `bunx turbo run test --filter=<pkg>`)
  - `bun run test` (or `turbo run test`) from the monorepo root executes all unit tests
- Run `bun run test:integration` (or `turbo run test:integration`) to execute integration tests (requires a running Postgres database)

**⚠️ Bun CLI Test Constraint (Mandatory):**

- **NEVER** run bare `bun test` or `bun --filter=<pkg> test`. In Bun, `test` is a built-in top-level command that ignores `--filter`, scans the entire monorepo, and executes backend tests without Vitest/Node environment flags.
- **ALWAYS** use the Turbo-cached scripts:
  - `bun run test:web` (or `bunx turbo run test --filter=@repo/web`)
  - `bun run test:backend` (or `bunx turbo run test --filter=@repo/backend`)
  - `bun run test:seed-cli` (or `bunx turbo run test --filter=@repo/seed-cli`)
  - `bun run test:media-service` (or `bunx turbo run test --filter=@repo/media-service`)
  - `bun run test:media-scraper` (or `bunx turbo run test --filter=@repo/media-scraper`)
  - `bun run test:db` (or `bunx turbo run test --filter=@repo/db`)
  - `bun run test:contracts` (or `bunx turbo run test --filter=@repo/contracts`)
  - Avoid raw `bun --filter=<pkg> run test` which bypasses Turbo's build cache and forces slow uncached re-runs.

**Silent mode & debugging:**

- Vitest base config (`packages/config-vitest/vitest.base.ts:10`) enables `silent: true` with `onConsoleLog` filtering and `setup.ts` JSDOM stubs — console `log`/`warn`/`error` noise (React warnings, JSDOM stubs, expected catch-block stderr) is suppressed during `bun run test` runs, while pass/fail reporters remain fully visible.
- Android TV tests silence Gradle task lifecycle logs via `./gradlew test -q` (`apps/android-tv/package.json:8`).
- To inspect verbose logs for a targeted debugging run, pass `--silent=false` through to Vitest:
  - `bun run test:web -- -- --silent=false test/unit/<feature>/<name>.test.ts`
  - `bun run test:backend -- -- --silent=false test/unit/<feature>/<name>.test.ts`
  - `bunx turbo run test --filter=@repo/web -- --silent=false test/unit/<feature>/<name>.test.ts`
- For full-suite verbose output: `bun run test -- -- --silent=false` (or per-package `bun run test:<pkg> -- -- --silent=false`).

---

## Platform Mappings

The Deep Modules architecture maps onto each framework in the monorepo as follows. Consult the application-specific `AGENTS.md` (if present) for authoritative details within that application.

| Environment             | Public seam                                                 | Internal logic                                                          | Routing / adapter                                               | Composition root                                  |
| ----------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| **Elysia (Backend)**    | `src/modules/<feature>/index.ts`                            | `src/modules/<feature>/internal/`                                       | `src/modules/<feature>/http.ts` (Elysia plugin)                 | `src/app.ts` (`createApp` factory)                |
| **Next.js (Frontend)**  | `src/modules/<feature>/index.ts` exporting components/hooks | `src/modules/<feature>/internal/` (UI components, local state, mappers) | Page / Layout components                                        | Page / Layout components (thin composition roots) |
| **Android TV (Kotlin)** | `src/main/java/com/privatemovie/tv/modules/<feature>/`      | `src/main/java/com/privatemovie/tv/modules/<feature>/internal/`         | `src/main/java/com/privatemovie/tv/navigation/AppNavigation.kt` | `MainActivity.kt`                                 |

## Database & Migrations (Strict Safety Rule)

- You (the AI agent) are **STRICTLY FORBIDDEN** from running `turbo run db:push`, `bun run db:push`, or any equivalent direct-push migration commands.
- **Workflow:** When a ticket requires database schema changes, you may modify the schema files and run `turbo run db:generate` (or `bun run db:generate`) to create the `.sql` migration files.
- **Do not apply:** You must **never** run `db:migrate` or attempt to apply the generated `.sql` files yourself.
- **Warn the user:** If the user asks you to modify schema, generate the SQL, leave the files uncommitted, and instruct the user to manually review the SQL for structural data loss (e.g., `DROP TABLE`) before they apply it themselves. If the user explicitly mentions or requests `db:push`, WARN them that it can result in immediate data loss without SQL file generation.
