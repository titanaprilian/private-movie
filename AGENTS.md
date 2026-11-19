# AGENTS.md

Deep Modules monorepo. Before working inside `apps/<x>/`, also read `apps/<x>/AGENTS.md`; on conflict, the app file wins within its directory.

Process (planning, tickets, review, verification) is owned by pstack skills — this file holds only repo rules agents cannot discover from the code.

## Canonical docs

Read before non-trivial features or bug fixes:

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — system boundaries, monorepo codemap
- [`docs/DOMAIN.md`](docs/DOMAIN.md) — domain models, entity invariants, job lifecycle

## Module boundaries

- A module's only export point is `src/modules/<feature>/index.ts` (backend/web) or the feature package directory (android-tv).
- Never import from or edit another feature's `internal/` directory. ESLint enforces this.

## Contracts first

- Any API shape change (endpoint, request/query/response payload) starts in `packages/contracts/src/` before backend or frontend implementation.
- `packages/contracts` stays pure TypeScript — no Elysia, Drizzle, or React imports.
- Backend envelopes, frontend callers, and native clients all import canonical types from `@repo/contracts`.

## Database & migrations

- **Never** run `db:push` or `db:migrate`, or apply generated SQL yourself.
- Schema changes: edit the schema, run `bun run db:generate`, leave the `.sql` for the human to review and apply.
- If asked for `db:push`, warn that it can cause immediate data loss without generating reviewable SQL.
- Follow the safe migration lifecycle and Expand-and-Contract protocol documented in [`packages/db/AGENTS.md`](packages/db/AGENTS.md); destructive changes (`DROP TABLE`, `DROP COLUMN`, unhedged `ADD COLUMN ... NOT NULL`) require `-- allow-destructive: <rationale>`.

## Testing

- Tests live in `test/unit/<feature>/` and `test/integration/<feature>/`, mirroring module structure; Vitest via `packages/config-vitest`.
- E2E smoke tests: `bun run test:e2e` (runs Playwright web + API suite against seeded Postgres).
- **Never** run bare `bun test` or `bun --filter=<pkg> test` — Bun's built-in runner ignores filters and runs the whole monorepo. Use `bun run test:<pkg> -- -- <file>` for targeted runs.
- TDD: tests first; targeted runs only during red→green. The full suite (`bun run test`) is a reviewer/orchestrator action.

## Commits

- One app per commit: at most one of `apps/web`, `apps/backend`, `apps/android-tv`. `packages/**` and root/tooling files ride along free (producer first, consumer second).
- Husky hooks (scope check, lint-staged, `bun run verify` on push) enforce this — never `--no-verify` on final commits.
- Multi-app commits require an explicit human grant plus a `Multi-App:` trailer. Never set `ALLOW_MULTI_APP=1` or write the trailer on your own initiative; if the work needs it, stop and ask.

## Quality gates

- `bun run gate:check` (knip + jscpd) must stay green; baselines only tighten, never loosen.
- Baseline file changes require a `Baseline-Rationale:` commit trailer.
- If `gate:check` blocks you mid-feature, report the violation to the human before fixing.
