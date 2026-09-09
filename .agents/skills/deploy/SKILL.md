---
name: deploy
description: "Deploy services to the production VPS via SSH, manage Caddy domains/reverse-proxy, verify deployment health, and sync databases between local and VPS."
disable-model-invocation: true
---

# Deploy Skill

Deploy and manage services on the production VPS over SSH (`hostdataid`).

## 0. VPS & Environment Overview

- **SSH Host**: `hostdataid` (configured in SSH config, run `ssh hostdataid <command>`)
- **Project Directory on VPS**: `/home/titanic/project/private-movie`
- **Caddy Directory on VPS**: `/home/titanic/config/caddy` (contains `Caddyfile` and `docker-compose.yml`)
- **GHCR Image Registry**:
  - Backend: `ghcr.io/titanaprilian/private-movie-backend:latest`
  - Web (Frontend): `ghcr.io/titanaprilian/private-movie-web:latest`
- **Ports (Host)**:
  - Backend: `${BACKEND_HOST_PORT:-3000}` (default: `3000`)
  - Web: `${WEB_HOST_PORT:-80}` (default: `80`)

---

## 1. Deployment Workflow (Full or Selective)

### Step 1: Verify GitHub Actions Build
Before deploying to VPS, verify that the GitHub Actions `Docker Publish` workflow has completed successfully for the latest commit on `main`:

```bash
gh run list --workflow=docker-publish.yml --branch=main --limit=1 --json status,conclusion,headSha,url
```

- If `status` is `in_progress` or `queued`, wait for it to complete or notify the user.
- If `conclusion` is `failure`, stop immediately and report the build failure to the user. Do not deploy failed builds.

### Step 2: Determine Deployment Scope
Ask the user (or confirm if already requested):
- **Full deployment**: deploy both `backend` and `web`.
- **Selective deployment**: deploy only `backend` or only `web`.

### Step 3: Pull Latest Project Files on VPS
Synchronize `docker-compose.yml` and repository configs on the VPS:

```bash
ssh hostdataid "cd /home/titanic/project/private-movie && git pull origin main"
```

### Step 4: Pull New Images from GHCR
Pull the updated Docker images on the VPS:

- For full deployment:
  ```bash
  ssh hostdataid "cd /home/titanic/project/private-movie && docker compose pull backend web"
  ```
- For selective deployment (e.g. backend only):
  ```bash
  ssh hostdataid "cd /home/titanic/project/private-movie && docker compose pull backend"
  ```

### Step 5: Database Migrations Check (Backend Only)
If the deployment includes backend changes:
- Check if new migration files exist in `packages/db/src/migrations/`.
- If new migrations exist, ask the user for explicit confirmation before running migration.
- **NEVER** run `db:seed` against production data.
- Run migrations safely using:
  ```bash
  ssh hostdataid "cd /home/titanic/project/private-movie && docker compose run --rm db-migrate bunx turbo run db:migrate --filter=@repo/db"
  ```

### Step 6: Start & Recreate Containers
Start the updated containers:

- For full deployment:
  ```bash
  ssh hostdataid "cd /home/titanic/project/private-movie && docker compose up -d --remove-orphans backend web"
  ```
- For selective deployment:
  ```bash
  ssh hostdataid "cd /home/titanic/project/private-movie && docker compose up -d --remove-orphans <service>"
  ```

### Step 7: Post-Deployment Verification
Verify the deployment succeeded:

1. **Check container status**:
   ```bash
   ssh hostdataid "cd /home/titanic/project/private-movie && docker compose ps"
   ```
2. **HTTP health check**:
   ```bash
   ssh hostdataid "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health" # or relevant endpoint
   ```
3. **If container failed or returned error**:
   Immediately retrieve recent logs:
   ```bash
   ssh hostdataid "cd /home/titanic/project/private-movie && docker compose logs --tail=50 <service>"
   ```
   Report the issue to the user.

---

## 2. Caddy & Domain Configuration Workflow

When pointing an existing domain or adding a new domain for frontend or backend:

### Step 1: Inspect Remote Caddyfile
```bash
ssh hostdataid "cat /home/titanic/config/caddy/Caddyfile"
```

### Step 2: Prepare Proposed Change
Generate the Caddy block. For example:
```caddyfile
your-domain.com {
    reverse_proxy localhost:80
}

api.your-domain.com {
    reverse_proxy localhost:3000
}
```

### Step 3: Confirm with User
Show the proposed diff or additions to the user and request explicit confirmation before applying.

### Step 4: Apply & Reload Caddy
Update the Caddyfile on the VPS and reload Caddy:

```bash
# Reload Caddy inside its container
ssh hostdataid "cd /home/titanic/config/caddy && docker compose exec caddy caddy reload"
```

### Step 5: Verify Domain
Run a test request to confirm Caddy routes traffic properly:
```bash
curl -I https://<domain>
```

---

## 3. Database Sync Workflow (Local ⇄ VPS)

### VPS → Local (Pull Database)
Use this to bring production/staging data from VPS down to local development.

1. **Safety Backup Local First**:
   ```bash
   docker compose exec db pg_dump -U postgres private_movie > /tmp/local_backup_$(date +%s).sql
   ```
2. **Dump Database on VPS**:
   ```bash
   ssh hostdataid "cd /home/titanic/project/private-movie && docker compose exec db pg_dump -U postgres private_movie" > /tmp/vps_dump.sql
   ```
3. **Restore Locally**:
   Ask user confirmation before executing:
   ```bash
   docker compose exec -T db psql -U postgres private_movie < /tmp/vps_dump.sql
   ```
4. **Clean up**:
   Remove temporary dump file `/tmp/vps_dump.sql`.

### Local → VPS (Push Database)
Use with extreme caution when seeding or restoring data up to the VPS.

1. **Safety Backup Remote VPS Database (MANDATORY)**:
   ```bash
   ssh hostdataid "cd /home/titanic/project/private-movie && docker compose exec db pg_dump -U postgres private_movie > /home/titanic/project/private-movie/db_backup_\$(date +%s).sql"
   ```
2. **Dump Local Database**:
   ```bash
   docker compose exec db pg_dump -U postgres private_movie > /tmp/local_to_vps_dump.sql
   ```
3. **Copy Dump to VPS**:
   ```bash
   scp /tmp/local_to_vps_dump.sql hostdataid:/home/titanic/project/private-movie/restore_temp.sql
   ```
4. **Mandatory Explicit Confirmation**:
   Ask the user:
   > "You are about to overwrite the remote VPS database. A backup was saved on the VPS. Are you sure you want to proceed with importing `/home/titanic/project/private-movie/restore_temp.sql`?"
5. **Restore on VPS**:
   Upon user confirmation:
   ```bash
   ssh hostdataid "cd /home/titanic/project/private-movie && docker compose exec -T db psql -U postgres private_movie < restore_temp.sql && rm restore_temp.sql"
   ```

---

## 4. Safety Guardrails & "Never" Rules

- **Never** overwrite `/home/titanic/project/private-movie/.env.docker` on the VPS with local values.
- **Never** run `db:push` or direct unversioned DDL commands against the production database.
- **Never** run `turbo run db:seed` or `bun run db:seed` on the VPS.
- **Never** modify `/home/titanic/config/caddy/Caddyfile` without presenting the diff and receiving explicit user approval.
- **Never** push a database dump to the VPS without taking a safety backup on the VPS first and obtaining user confirmation.
- **Never** deploy if GitHub Actions CI/Publish has failed for the commit.
