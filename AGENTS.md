# Agent Context Protocol (Deep Modules Architecture)

> **Read application-specific rules too.** When working inside a specific application directory under `apps/` (e.g. `apps/backend`), you **must** also read the `AGENTS.md` file located in that application's root for framework-specific instructions (routing, HTTP layers, test setups, etc.). If no such file exists, this root document governs. When the two documents conflict, the application-specific document takes precedence within that application's directory.

Welcome! This monorepo uses a **Deep Modules** architecture tailored for AI agents. This document defines the generic rules of engagement shared across all applications in the monorepo. Framework-specific details live in each application's own `AGENTS.md`.

## Architectural & Domain Navigation (Essential References)

Before starting any feature or bug fix, consult the canonical system and domain documentation:

- **System Architecture & Monorepo Codemap**: [`ARCHITECTURE.md`](ARCHITECTURE.md) (diagram: [`docs/diagrams/architecture-codemap.png`](docs/diagrams/architecture-codemap.png) / [interactive HTML](docs/diagrams/architecture-codemap.html))
- **Domain Models & Glossary**: [`docs/DOMAIN.md`](docs/DOMAIN.md) (context map: [`docs/diagrams/domain-context-map.png`](docs/diagrams/domain-context-map.png) / ingest lifecycle: [`docs/diagrams/ingest-lifecycle.png`](docs/diagrams/ingest-lifecycle.png))

These documents define application boundaries, shared package constraints, entity invariants, and asynchronous job state transitions.

---

## Feature Delivery Pipeline

When implementing a feature or fixing a bug, follow this strict execution sequence:

1. **grill-me** → Establish shared understanding of requirements. Before interviewing, the agent estimates how many tickets the work will likely break into and recommends one of two paths:
   - **Direct-to-ticket path**: estimated ≤2 tickets, and no `packages/contracts` or DB schema changes involved.
   - **Full spec path**: estimated ≥3 tickets, OR the work touches `packages/contracts` or a DB schema (this override applies regardless of estimated size).

   The agent states its recommendation and reasoning, then the user confirms or overrides. This decision is never made unilaterally by the agent.

2. **to-spec** (conditional) → Create a specification document. Skipped when the direct-to-ticket path was confirmed in step 1.

   **Escalation guard**: if `/to-tickets` (step 3) ends up producing 3 or more tickets after a direct-to-ticket path was chosen, the agent must pause before any implementation begins and ask the user whether to back up and write a spec, or continue as-is.

3. **to-tickets** → Break into tickets (test-writing tickets are priority #1, unblocked first)

- 4. **implement** → Agents pick up tickets, write tests first (TDD), then implement in an isolated git worktree (`../wt/ticket-<id>`). Editing in the main checkout is strictly forbidden.

5. **code-review** → Orchestrator reviews each completed ticket
6. **push-to-github** → Orchestrator pushes when all tickets are complete
7. **deploy** → Deploy services to VPS, manage Caddy domains, or sync database

---

## Core Rules & Constraints

- **Mandatory Worktree Isolation**: All ticket implementation (`implement`) **MUST** occur inside an isolated git worktree located at `../wt/ticket-<id>` on branch `ticket/<id>`. You are strictly forbidden from modifying or inspecting application code in the main checkout during implementation. Bootstrapping must use `scripts/wt-init.sh <id>` before any edits.
- **Strict Isolation**: You are explicitly forbidden from reading or modifying the internal implementation details (`/internal/` directories) of any module unrelated to your current target feature.
- **Import Restrictions**: ESLint/tooling enforces strict boundaries. You must never import from a module's `/internal/` folder from outside that module.
- **Entry Points**: The only allowed export point for a module is `[app_root]/src/modules/<feature>/index.ts`. It must export a concrete implementation adhering to a strict interface.
- **Commits must pass local hooks**: never bypass `pre-commit`/`commit-msg`/`pre-push` on the final commits of a ticket (see Local Git Hooks).
- **One app per commit**: a commit touches at most one of `apps/web`, `apps/backend`, `apps/android-tv`; shared packages and root/tooling files may ride along. Crossing that boundary requires an explicit human grant (see Commit Scope).

---

## Local Git Hooks (pre-commit / commit-msg / pre-push)

Husky + `lint-staged` gate every commit locally so scope creep, formatting, lint and type errors never reach remote CI.

| Hook         | Command                                                   | Scope                                                                                                                                        |
| ------------ | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | `bash scripts/check-commit-scope.sh` → `bunx lint-staged` | One-app commit gate, then `prettier --write` on everything Prettier understands and `eslint --fix` on `apps/web` / `apps/backend` TypeScript |
| `commit-msg` | trailer check                                             | Requires a `Multi-App:` trailer on any commit that spans apps                                                                                |
| `pre-push`   | `bun run verify`                                          | `turbo run typecheck lint --filter=!@repo/android-tv --continue`                                                                             |

- **Auto-install**: the root `prepare` script runs `husky` on every `bun install`, so a fresh clone or a new worktree (`scripts/wt-init.sh` runs `bun install`) gets hooks automatically.
- **Formatting is auto-fixed, not rejected**: an unformatted staged file is rewritten and re-staged, and the commit proceeds. Only a scope violation, ESLint error, missing trailer, or pre-push type error aborts.
- **Formatting is a ratchet**: only staged files are formatted; hundreds of pre-existing files are still unformatted. Never run a repo-wide `prettier --write` sweep inside a feature ticket — it collides with in-flight worktrees.
- Android TV is **not** hook-wired: Gradle `compileDebugKotlin`/`lint` cost tens of seconds to minutes, `apps/android-tv/local.properties` is gitignored and machine-specific (not provisioned by `scripts/wt-init.sh`), and `~/.gradle` is cold on a fresh machine. Run the equivalent checks explicitly when you touch Kotlin: `bun run verify:android` (`turbo run typecheck lint --filter=@repo/android-tv`). CI's `android` job is the automatic gate.
- **Not all packages are linted**: `packages/contracts`, `packages/db`, `packages/media-service`, `packages/media-scraper` and `packages/config-vitest` have `typecheck` only. Never assume `lint` covered them.
- **CI stays authoritative**: hooks are a fast local pre-filter; `turbo run typecheck lint test test:integration build --filter=!@repo/android-tv` remains the source of truth.

**Escape hatch (WIP only):** `git commit --no-verify` and `git push --no-verify` are allowed only for work-in-progress commits that will be rewritten. The final commit(s) of a ticket — anything handed to `code-review` — must pass both hooks. History showing `--no-verify` on a ticket's final commits is grounds for rejection. `--no-verify` never authorizes a multi-app commit; it only hides that the check was skipped.

**Troubleshooting:**

- Hooks silently not running → run `bun install` (re-runs `prepare`), then confirm `git config core.hooksPath` prints `.husky/_`.
- `'bunx' not found` → Bun is not on `PATH` for your git client (common with GUI clients launched from a desktop launcher). Add Bun's install directory to that `PATH`.
- Docker and CI installs have no `.git` directory; Husky prints `.git can't be found` and exits 0, so image builds are unaffected.

---

## Commit Scope (one app per commit)

A commit may touch **at most one** of `apps/web`, `apps/backend`, `apps/android-tv`.

Shared packages (`packages/**`) and root/tooling files (`package.json`, `turbo.json`, `AGENTS.md`, `docs/**`, `.github/**`, `scripts/**`, `README.md`) never count toward that limit and may ride along with the single app commit — that is what makes contract-first work possible: `packages/contracts` + `apps/backend` in one commit is correct.

- **Why**: scoped review diffs, one type-aware ESLint invocation per commit (~2–6s instead of ~10s), meaningful `git bisect`/revert, and no silent scope creep.
- **How to split**: producer first, consumer second. Example for a full-stack feature: commit 1 = `packages/contracts` + `apps/backend`; commit 2 = `apps/web`. Intermediate commits may be temporarily red — the **pushed tip must be green** (`bun run verify`).
- **Ticket planning**: one app per ticket is the default. A feature that genuinely needs producer + consumer declares _both_ apps in the ticket up front and uses the producer-first commit ordering. Never widen scope mid-implementation.
- **Enforcement**: `scripts/check-commit-scope.sh` runs first in `pre-commit` (also runnable via `bun run scope:check`). `.husky/commit-msg` additionally requires the trailer below.
- **History rewrites are exempt**: rebase, cherry-pick, revert and merge conflict commits skip both checks so existing cross-app history replays cleanly.

**Granting an exception (human only)**

1. The human authorizes multi-app scope explicitly — in chat or in the approved plan/ticket (e.g. "this change may span web + backend in one commit").
2. The agent then commits with the env var **and** the trailer:

   ```bash
   ALLOW_MULTI_APP=1 git commit -m "feat(web,backend): ..." \
     -m "Multi-App: #748 — contract, endpoint and UI must land atomically"
   ```

3. `git log --grep='^Multi-App:'` lists every authorized cross-app commit.

Rules for agents:

- **Never** set `ALLOW_MULTI_APP=1` or write a `Multi-App:` trailer on your own initiative. If a task requires crossing the app boundary, stop and ask the human.
- A `Multi-App:` trailer without a grant is a review failure and grounds for rejecting the ticket.

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
- **Implementer test restriction (Targeted runs only):**
  - Implementers are strictly restricted to running targeted test files covering their changes (`bun run test:<pkg> -- -- <file>` or `bun --filter=@repo/backend run test:integration <file>`).
  - **NEVER** run the full test suite (`bun run test` or package-wide `bun run test:<pkg>`) inside an implementer worktree. Running full test suites concurrently during parallel ticket implementation spikes host CPU usage to 100%.
  - The full test suite (`bun run test`) is executed exclusively by the orchestrator / reviewer during the review phase.
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

### Coverage

- `bun run test:coverage` runs unit tests with V8 coverage; filter with `bun run test:coverage --filter=@repo/backend`.
- Universe is the whole `src/**` tree — an untested file counts as 0%, so new features move the number.
- Thresholds are per-package ratchets in each `vitest.config.ts` and are enforced in CI. Raising a threshold when a package improves is encouraged; lowering one to make a PR pass is a review failure — delete the dead code or write the test instead.
- `test:coverage` is non-cacheable by design. Never wire it into `test`, `verify`, `pre-push`, or `lint-staged`.
- Reports land in `coverage/` per package (gitignored), as the `coverage-reports` CI artifact, and as a table in the PR job summary.
- Backend HTTP/persistence coverage comes from the integration suite, which is NOT part of these thresholds yet (follow-up).
- Running the full `bun run test:coverage` across all packages is a reviewer/orchestrator action, not an implementer TDD loop action (see the implementer test restriction above).

---

## Structural Quality Gates (`gate:check`)

The repository enforces **Level L4 Quality Gate maturity**: existing technical debt is baselined, new or worsening structural debt (unused exports, unused dependencies, or copy-paste code duplication) will immediately fail CI, gate evaluation is rigorously covered by automated unit tests, and baselines are protected by governance rules.

### Running Quality Gates Locally

- `bun run gate:check` — Runs both structural duplication (`jscpd`) and unused code/dependency audits (`knip`) against checked-in baselines (`.jscpd-baseline.json` and `.knip-baseline.json`). Aligned with CI.
- `bun run test:gate` — Runs the fast (<1s) unit test suite for gate checking, comparison, and ratchet logic (`test/unit/scripts/gate-check.test.ts`).
- `bun run gate:knip` — Direct Knip check (identifies specific unused exports, types, or dependencies).
- `bun run gate:jscpd` — Direct JSCPD check (identifies duplicated source blocks across packages and apps).
- `bun run gate:update-baseline` — Safely tightens the ratchet by pruning resolved findings from `.knip-baseline.json` and updating `.jscpd-baseline.json`.

### Ratchet Rules & Governance

- **Strict Ratchet Enforcement**: `bun run gate:update-baseline` will fail and abort if any new violations are present. It only permits tightening (pruning resolved debt), never loosening or suppressing new debt.
- **Protected Gate Files**: Gate scripts (`scripts/gate-check.ts`, `scripts/internal/gate-checker.ts`) and baselines (`.knip-baseline.json`, `.jscpd-baseline.json`, `.jscpd.json`, `knip.jsonc`) are governed via `.github/CODEOWNERS` and require human sign-off.
- **Commit Trailer Requirement**: Any commit modifying `.knip-baseline.json` or `.jscpd-baseline.json` must include a `Baseline-Rationale: <reason>` trailer in its commit message, explaining the justification for updating the baseline. Commits lacking this trailer are blocked by `.husky/commit-msg`.

### When Quality Gate Blocks CI or Local Check

If `gate:check` fails, follow this remediation runbook:

1. **Unused Exports / Dead Code (`knip`)**:
   - If an export is only used within its own file/module, remove the `export` keyword.
   - If the code is dead/obsolete, delete it.
   - If the export was intended to be hooked up to a caller or test, wire it up.
   - If an export is an intentional public API or dynamic plugin entrypoint, document it in `knip.jsonc`.
2. **Unused / Unlisted Dependencies (`knip`)**:
   - Unused: remove it from `package.json` (`bun remove <pkg> --filter <workspace>`).
   - Unlisted: add it explicitly to the workspace `package.json` so the module does not rely on hoisted dependencies.
3. **Code Duplication (`jscpd`)**:
   - Refactor duplicated logic into shared utilities (`internal/` within module, or `@repo/contracts` / shared package across modules/apps).
   - If the duplication is unavoidable generated code or boilerplate, configure the path ignore in `.jscpd.json`.
4. **Ratchet Rule**:
   - Baselines and thresholds can only be tightened (updated to reflect reductions in tech debt), never loosened to bypass checks.
   - If `gate:check` blocks CI during feature implementation, **report the violation to the human before proceeding with fixes**.

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

<!-- CODEGRAPH_START -->

## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->
