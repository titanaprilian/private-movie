# AGENTS.md (@repo/db)

Database schema and migration rules for `@repo/db`. Agents working on database schemas, migrations, or Drizzle ORM definitions must strictly follow these instructions.

## Absolute Rules

- **Never** execute `db:push` or `db:migrate`, or apply generated SQL yourself.
- Schema changes: modify Drizzle schema in `src/schema/`, run `bun run db:generate`, and commit the generated SQL file under `drizzle/` for human review and deployment.
- Destructive operations (`DROP TABLE`, `DROP COLUMN`, unhedged `ADD COLUMN ... NOT NULL` without `DEFAULT`) are blocked by quality gates (`bun run gate:check` and `bun run lint:migrations`).
- Never bypass the migration linter without a valid rationale (`-- allow-destructive: <rationale>` with >= 3 non-whitespace characters) and an explicit human grant or verified contract phase.
- In the event of a deployment or schema migration failure, follow the [Database Migration Recovery Runbook](../../docs/runbooks/database-migration-recovery.md). Recovery, restores, and production rollbacks are strictly human operator responsibilities; agents must never run migration or push commands.

## Expand-and-Contract Protocol

All schema evolutions (renaming columns, moving tables, dropping columns, making columns non-nullable) must execute across distinct deployment releases using the Expand-and-Contract pattern:

```
[Phase 1: Expand]  -->  [Phase 2: Migrate / Backfill]  -->  [Phase 3: Contract]
```

### 1. Phase 1: Expand (Additive Only)

Add the new column or table without breaking running application instances.

- New columns **must** either be nullable or define a `DEFAULT` clause.
- Never add a `NOT NULL` column without `DEFAULT` to an existing table with data.

#### Drizzle Schema Example:

```typescript
// packages/db/src/schema/users.ts
// Expanding: Adding new 'display_name' column while keeping legacy 'name'
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // Legacy column
  displayName: text("display_name"), // New column: nullable in Phase 1
});
```

#### Generated SQL Migration:

```sql
ALTER TABLE "users" ADD COLUMN "display_name" text;
```

#### Application Behavior:

- Writes: Dual-write to both `name` and `displayName`.
- Reads: Fallback reading `displayName ?? name`.

### 2. Phase 2: Migrate & Backfill

1. Run an asynchronous or background script to backfill existing records:
   ```sql
   UPDATE "users" SET "display_name" = "name" WHERE "display_name" IS NULL;
   ```
2. Once backfill is complete, update application code to read and write exclusively from `displayName`.
3. If `displayName` must become `NOT NULL`, set the constraint after all rows have values:
   ```sql
   ALTER TABLE "users" ALTER COLUMN "display_name" SET NOT NULL;
   ```
4. Deploy the application and confirm no running instance reads or writes `name`.

### 3. Phase 3: Contract (Cleanup)

Once all deployed application instances no longer access the legacy column `name`:

1. Remove `name` from the Drizzle schema.
2. Generate migration (`bun run db:generate`).
3. Annotate the generated SQL statement with `-- allow-destructive: <rationale>`.

#### Generated SQL Migration with Linter Bypass:

```sql
-- allow-destructive: Removed users.name; all services now use display_name (contract phase)
ALTER TABLE "users" DROP COLUMN "name";
```

## Migration Linter Rules

The migration linter checks all added and modified migration files in `packages/db/drizzle/*.sql`:

| Rule Name             | Trigger Condition                                             | Remediation                                                                                         |
| :-------------------- | :------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------- |
| `drop-table`          | Statement contains `DROP TABLE`                               | Ensure table is fully deprecated across all services. Use `-- allow-destructive: <rationale>`.      |
| `drop-column`         | Statement contains `DROP COLUMN`                              | Ensure column is no longer read or written by any service. Use `-- allow-destructive: <rationale>`. |
| `unhedged-add-column` | `ALTER TABLE ... ADD COLUMN` has `NOT NULL` without `DEFAULT` | Make column nullable or provide a `DEFAULT` clause. Backfill before adding `NOT NULL`.              |

## Linter Bypass Syntax

If a destructive migration is required and verified safe (e.g., Phase 3 of Expand-and-Contract, or cleanup of an unused temporary table):

Place `-- allow-destructive: <rationale>` immediately preceding the destructive statement:

```sql
--> statement-breakpoint
-- allow-destructive: Dropping legacy unused table verified 0 active queries
DROP TABLE "legacy_metrics";
```

Rationale requirements:

- Must contain at least 3 non-whitespace characters.
- Must explain why the destructive change is safe. Empty or whitespace-only rationales will fail the quality gate.

## Deployment Recovery & Operational Runbooks

For end-to-end failure handling procedures covering both pre-rollout migration errors and post-rollout application regressions, see [`docs/runbooks/database-migration-recovery.md`](../../docs/runbooks/database-migration-recovery.md).

- **Failure Before App Rollout**: Deploy script stops before container updates; prior app instances remain healthy; operator decides between roll-forward fix and deployment abort.
- **Failure After App Rollout**: Additive changes (Phase 1 Expand) allow instant application container rollback without database rollback; destructive changes (Phase 3 Contract) require restoring from the pre-migration `pg_dump` snapshot.
- **Human Approval Boundary**: All restore operations and production database commands are human-owned. Agents are prohibited from executing `db:migrate` or `db:push`.
