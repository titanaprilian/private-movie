# @repo/db

Shared PostgreSQL database layer and Drizzle ORM schema definitions for the monorepo.

## Overview

- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Driver**: `postgres` (PostgreSQL client)
- **Migrations Directory**: `drizzle/`
- **Schema Source**: `src/schema/`

## Available Scripts

| Command                   | Description                                                   |
| :------------------------ | :------------------------------------------------------------ |
| `bun run db:generate`     | Generates SQL migration files in `drizzle/` from schema diffs |
| `bun run lint:migrations` | Validates migration files against destructive schema changes  |
| `bun run test`            | Runs unit tests for database models and utilities             |
| `bun run typecheck`       | Checks TypeScript types without emitting output               |
| `bun run build`           | Compiles TypeScript sources to `dist/`                        |

> [!CAUTION]
> Never run `db:push` or `db:migrate` directly. Schema changes must produce reviewable `.sql` migrations via `bun run db:generate` to be applied by controlled deployment processes.

## Migration Safety & Linter

Every pull request and commit must pass automated migration safety checks before merging. The linter enforces zero-downtime database deployment practices.

### Linter Rules

The migration linter (`scripts/migration-lint.ts`) evaluates newly added and modified SQL migrations against three zero-tolerance rules:

1. **`drop-table`**: Prohibits dropping tables (`DROP TABLE`). Running app instances will fail if an in-use table is removed.
2. **`drop-column`**: Prohibits dropping columns (`ALTER TABLE ... DROP COLUMN`). Older app instances will fail if queried columns vanish.
3. **`unhedged-add-column`**: Prohibits adding `NOT NULL` columns to existing tables without a `DEFAULT` clause (`ALTER TABLE ... ADD COLUMN ... NOT NULL`). This locks the table or fails when rows already exist.

### Bypassing Linter for Verified Safe Changes

When performing deliberate cleanup (such as the Contract phase of an Expand-and-Contract migration), annotate the statement with an explicit inline rationale:

```sql
-- allow-destructive: Dropping deprecated avatar_url after contract phase completion
ALTER TABLE "users" DROP COLUMN "avatar_url";
```

Rationale requirements:

- Must directly precede the destructive statement or breakpoint.
- Must provide at least 3 non-whitespace characters explaining the safety context.
- Empty or placeholder comments (e.g. `-- allow-destructive:`) are rejected.

## Expand-and-Contract Protocol

When evolving existing tables without downtime, follow the three-phase lifecycle:

1. **Phase 1 (Expand)**: Add the new column/table as nullable or with a sensible `DEFAULT`. Deploy code that writes to both columns.
2. **Phase 2 (Migrate)**: Backfill historical rows. Switch application reads and writes to the new column. Deploy code.
3. **Phase 3 (Contract)**: After verifying zero traffic reaches the legacy column, remove it from the schema, generate the migration, annotate with `-- allow-destructive: <rationale>`, and apply.

## Deployment Recovery

For operational runbooks on recovering from schema migration failures before or after application rollout, see the [Database Migration Recovery Runbook](../../docs/runbooks/database-migration-recovery.md).

For detailed guidelines and rules for AI agents, see [`AGENTS.md`](./AGENTS.md).
