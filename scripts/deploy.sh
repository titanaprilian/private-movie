#!/usr/bin/env bash
set -euo pipefail

# -----------------------------------------------------------------------------
# Production Deployment Script for private-movie
# -----------------------------------------------------------------------------
# Follows safety guardrails from deploy skill:
# - Pulls latest main branch
# - Checks packages/db/drizzle/ for new SQL migrations and executes db:migrate safely
# - NEVER runs db:seed on production
# - Pulls updated images from GHCR
# - Recreates containers
# - Verifies healthcheck on /api/health
# -----------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${REPO_DIR}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# 1. Determine target services
# Default: both backend and web
SERVICES=("${@:-backend web}")
if [ $# -eq 0 ]; then
  TARGET_SERVICES="backend web"
else
  TARGET_SERVICES="$*"
fi

# 2. Record current commit SHA
PREV_SHA="$(git rev-parse HEAD 2>/dev/null || echo '')"

# 3. Pull latest git changes
log "Pulling latest changes from origin main..."
git fetch origin main
git reset --hard origin/main

NEW_SHA="$(git rev-parse HEAD)"
log "Repository updated: ${PREV_SHA:0:7} -> ${NEW_SHA:0:7}"

# 4. Check for database migrations
# If DB schema changed in packages/db/drizzle/, run drizzle-kit migrate safely
RUN_MIGRATION=false
if [ -n "${PREV_SHA}" ] && [ "${PREV_SHA}" != "${NEW_SHA}" ]; then
  CHANGED_MIGRATIONS="$(git diff --name-only "${PREV_SHA}" "${NEW_SHA}" -- 'packages/db/drizzle/*.sql' || true)"
  if [ -n "${CHANGED_MIGRATIONS}" ]; then
    log "New database migrations detected:"
    echo "${CHANGED_MIGRATIONS}"
    RUN_MIGRATION=true
  fi
fi

if [ "${FORCE_MIGRATE:-0}" = "1" ]; then
  log "FORCE_MIGRATE=1 set, forcing migration run."
  RUN_MIGRATION=true
fi

if [ "${RUN_MIGRATION}" = "true" ]; then
  log "Running database migrations (turbo db:migrate --filter=@repo/db)..."
  # Guardrail: NEVER run db:seed on production. We override command to only run db:migrate.
  docker compose run --rm db-migrate sh -c "bun install --frozen-lockfile && bunx turbo run db:migrate --filter=@repo/db"
  log "Database migrations completed successfully."
else
  log "No database migrations detected."
fi

# 5. Pull new images from GHCR
log "Pulling updated Docker images: ${TARGET_SERVICES}..."
# shellcheck disable=SC2086
docker compose pull ${TARGET_SERVICES}

# 6. Recreate and start updated containers
log "Starting and recreating containers: ${TARGET_SERVICES}..."
# shellcheck disable=SC2086
docker compose up -d --remove-orphans ${TARGET_SERVICES}

# 7. Post-deployment verification
if [[ " ${TARGET_SERVICES} " =~ " backend " ]]; then
  log "Verifying backend health on http://localhost:3000/api/health..."
  HEALTH_PASSED=false
  MAX_ATTEMPTS=12
  ATTEMPT=1

  while [ "${ATTEMPT}" -le "${MAX_ATTEMPTS}" ]; do
    HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health || echo '000')"
    if [ "${HTTP_CODE}" = "200" ]; then
      HEALTH_PASSED=true
      log "Health check passed on attempt ${ATTEMPT} (HTTP 200)."
      break
    fi
    log "Attempt ${ATTEMPT}/${MAX_ATTEMPTS}: Backend returned HTTP ${HTTP_CODE}. Waiting 5s..."
    sleep 5
    ATTEMPT=$((ATTEMPT + 1))
  done

  if [ "${HEALTH_PASSED}" != "true" ]; then
    log "ERROR: Backend failed health check after ${MAX_ATTEMPTS} attempts!"
    log "Recent backend logs:"
    docker compose logs --tail=50 backend
    exit 1
  fi
fi

log "Container status:"
# shellcheck disable=SC2086
docker compose ps ${TARGET_SERVICES}

log "Deployment completed successfully for: ${TARGET_SERVICES}"
