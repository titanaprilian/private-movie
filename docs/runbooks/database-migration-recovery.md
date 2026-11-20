# Database Migration Recovery Runbook

Operational recovery procedures for failed database schema deployments in `private-movie`.

---

## 1. Governance & Core Invariants

Database reliability depends on strict separation between automated agent development and human-owned production operations.

> [!IMPORTANT]
> **Human Approval Boundary**: All database restore actions, rollbacks, and manual SQL executions on staging or production environments are strictly reserved for **human operators**.
>
> **Agent Migration Prohibition**: AI agents must **never** execute `db:push`, `db:migrate`, or apply generated SQL migrations directly to any shared, staging, or production database. Schema changes by agents are restricted to authoring schema definitions in `packages/db/src/schema/`, generating migration files via `bun run db:generate`, and committing them for human review.

### Core Architecture Context

- **ORM & Dialect**: Drizzle ORM on PostgreSQL 16.
- **Migration Strategy**: Forward-only SQL migrations located in `packages/db/drizzle/`.
- **Zero-Downtime Design**: Schema evolution follows the [Expand-and-Contract Protocol](../../packages/db/AGENTS.md#expand-and-contract-protocol).
- **Automated Deployment**: `scripts/deploy.sh` executes migrations using `docker compose run --rm db-migrate` prior to pulling or starting updated application containers.

---

## 2. Pre-Deployment Safeguards

Before initiating any deployment containing schema changes (new SQL files in `packages/db/drizzle/`), operators must ensure a verified pre-migration snapshot exists.

### Mandatory Pre-Migration Snapshot

On the production host, capture a full binary snapshot of the PostgreSQL database:

```bash
# Capture timestamped pre-migration snapshot
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="/var/backups/private-movie/pre_deploy_${TIMESTAMP}.dump"
mkdir -p /var/backups/private-movie

docker compose exec -T db pg_dump \
  -U postgres \
  -d private_movie \
  -F c \
  -b \
  -v > "${BACKUP_FILE}"

# Verify backup file size and validity
ls -lh "${BACKUP_FILE}"
test -s "${BACKUP_FILE}" && echo "Backup verified successfully."
```

---

## 3. Failure Mode 1: Migration Failure Before Application Rollout (Pre-Deploy)

### Trigger & Symptoms

In `scripts/deploy.sh`, Step 4 executes database migrations:

```bash
docker compose run --rm db-migrate sh -c "bun install --frozen-lockfile && bunx turbo run db:migrate --filter=@repo/db"
```

If the migration container exits with a non-zero exit code (e.g. syntax error, lock timeout, constraint violation, or disk space exhaustion), `scripts/deploy.sh` aborts immediately due to `set -euo pipefail`.

### State Assessment

1. **Application Containers (`backend`, `web`)**: Unaffected. They continue running their prior versions (`PREV_SHA`) because Steps 5-7 never ran.
2. **Database State**: PostgreSQL DDL statements within the failing migration file aborted. Drizzle kit records applied migrations in `drizzle.__drizzle_migrations`. Migrations preceding the failing file remain committed; the failing migration is not recorded.

### Decision Tree & Operator Action

```
Did the failing migration abort cleanly without partial uncommitted DDL?
  │
  ├── YES: Can the underlying error be fixed immediately via roll-forward?
  │     │
  │     ├── YES (Option 1A: Roll-Forward):
  │     │     1. Identify root cause from migration container logs.
  │     │     2. Prepare and verify targeted fix on local disposable DB.
  │     │     3. Commit fix, pull to host, and re-run deploy script.
  │     │
  │     └── NO (Option 1B: Abort Deployment):
  │           1. Leave existing application containers running.
  │           2. Reset repository on host: git reset --hard <PREV_SHA>
  │           3. Verify application health: curl http://localhost:3000/api/health
  │
  └── NO (DDL left corrupted or locked state):
        └── Execute Snapshot Restore (Option 1C):
              1. Restore DB from pre-migration snapshot.
              2. Reset repository to <PREV_SHA>.
```

#### Detailed Steps for Option 1B (Abort Deployment):

```bash
# 1. Reset host repository back to previous stable SHA
git reset --hard "${PREV_SHA}"

# 2. Confirm current application containers remain healthy
docker compose ps
curl -f http://localhost:3000/api/health || echo "Check container logs immediately!"
```

---

## 4. Failure Mode 2: Application Failure After Migration Rollout (Post-Deploy)

### Trigger & Symptoms

The migration succeeded in Step 4, updated containers were pulled and recreated in Steps 5-6, but:

- Step 7 failed backend health check (`http://localhost:3000/api/health`), OR
- Application crashes, logs uncaught runtime errors, or severe performance regressions occur post-deployment.

### State Assessment

- **Database**: The new migration has been applied and recorded in `drizzle.__drizzle_migrations`.
- **Application**: The newly deployed backend/web containers are unhealthy or failing.

### Decision Tree based on Migration Phase

```
What type of migration was applied?
  │
  ├── Phase 1 (Expand - Additive Schema Evolution):
  │     │  (e.g., nullable column, column with DEFAULT, new table)
  │     │
  │     └── FAST ZERO-DOWNTIME ROLLBACK (Option 2A):
  │           1. Roll back application containers only to PREV_SHA.
  │           2. DO NOT ROLL BACK DATABASE SCHEMA.
  │           3. Additive columns do not break legacy queries.
  │
  └── Phase 3 (Contract - Destructive Schema Evolution) OR Data Write Corruption:
        │  (e.g., dropped column/table, corrupted data rows)
        │
        └── FULL RECOVERY & SNAPSHOT RESTORE (Option 2B):
              1. Place application in maintenance mode.
              2. Stop backend container to halt writes.
              3. Restore database from pre-migration snapshot.
              4. Roll back application containers to PREV_SHA.
              5. Bring containers up and verify health.
```

#### Detailed Steps for Option 2A: Fast Zero-Downtime Rollback (Additive Changes)

Because `@repo/db` enforces the Expand-and-Contract protocol, Phase 1 migrations add columns as nullable or with defaults. Deployed application code from `PREV_SHA` remains 100% compatible with the expanded schema:

```bash
# 1. Roll back application code and containers to previous SHA
git checkout "${PREV_SHA}"
docker compose pull backend web
docker compose up -d --remove-orphans backend web

# 2. Verify backend health
curl -f http://localhost:3000/api/health

# 3. Note: The new database column/table remains safely in PostgreSQL.
# Do NOT run drop statements manually. Prepare a roll-forward fix in git.
```

#### Detailed Steps for Option 2B: Full Recovery via Pre-Migration Snapshot (Contract / Destructive Changes)

When a destructive migration removed columns/tables or corrupted existing records:

```bash
# 1. Stop backend writes immediately
docker compose stop backend web

# 2. Restore PostgreSQL from the pre-migration snapshot
docker compose exec -T db pg_restore \
  -U postgres \
  -d private_movie \
  -c \
  --if-exists \
  -v < "${BACKUP_FILE}"

# 3. Checkout previous stable application revision
git checkout "${PREV_SHA}"

# 4. Recreate and restart previous application containers
docker compose up -d backend web

# 5. Verify service health
curl -f http://localhost:3000/api/health
```

---

## 5. Infrastructure & Responsibility Matrix

| Operation              | Environment        | Responsible Actor     | Permitted Tools / Commands                      |
| :--------------------- | :----------------- | :-------------------- | :---------------------------------------------- |
| Schema Authoring       | Local dev / PR     | AI Agent & Developer  | `packages/db/src/schema/*.ts`                   |
| Migration Generation   | Local dev / PR     | AI Agent & Developer  | `bun run db:generate`                           |
| Migration Safety Lint  | Local / CI         | Automated Gate        | `bun run lint:migrations`, `bun run gate:check` |
| Disposable DB Testing  | Test / CI          | Automated Test Suite  | Isolated disposable PostgreSQL / Vitest         |
| Migration Deployment   | Staging / Prod     | Human Operator        | `scripts/deploy.sh`                             |
| Pre-Deploy Backup      | Staging / Prod     | Human Operator        | `pg_dump`                                       |
| Database Restore       | Staging / Prod     | Human Operator        | `pg_restore`, `psql`                            |
| Automated Direct Push  | **Any**            | **FORBIDDEN (Never)** | `db:push` (Permanently banned)                  |
| Direct Agent Migration | **Staging / Prod** | **FORBIDDEN (Never)** | `db:migrate` (Human/CI deployer only)           |

---

## 6. Verification & Dry-Run Checklist

When validating recovery procedures on a disposable test instance:

1. `pg_dump` produces a non-empty, restorable snapshot format (`-F c`).
2. Migration failure terminates execution without running application container updates.
3. Additive changes allow previous application container revisions to query successfully without schema rollback.
4. Database restore restores table definitions and data to the exact pre-migration state.
