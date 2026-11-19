#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$REPO_ROOT"

COMMAND="${1:-help}"

case "$COMMAND" in
  doctor)
    echo "==> Running Doctor Check..."
    # 1. Postgres connectivity
    if command -v pg_isready >/dev/null 2>&1; then
      if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
        echo "[ERROR] Postgres is not reachable on localhost:5432"
        exit 1
      fi
      echo "[OK] Postgres is reachable on localhost:5432"
    else
      echo "[INFO] pg_isready not in PATH; skipping direct port check"
    fi

    # 2. Check server status
    if curl -sSf http://localhost:3000/api/health >/dev/null 2>&1; then
      echo "[OK] Backend server is already running on port 3000"
    else
      echo "[INFO] Backend server is not running on port 3000 (Playwright webServer will launch it automatically)"
    fi

    if curl -sSf http://localhost:5173/ >/dev/null 2>&1; then
      echo "[OK] Web frontend is already running on port 5173"
    else
      echo "[INFO] Web frontend is not running on port 5173 (Playwright webServer will launch it automatically)"
    fi
    echo "[OK] Doctor check passed."
    ;;

  seed)
    echo "==> Seeding E2E test database..."
    bun run test/e2e/fixtures/seed.ts
    echo "[OK] E2E database seeded."
    ;;

  drive)
    shift || true
    SPEC="${1:-test/e2e/web/playback.spec.ts}"
    mkdir -p artifacts/verify
    echo "==> Driving verification spec: $SPEC"
    bun run test/e2e/fixtures/seed.ts
    bunx playwright test "$SPEC"
    ;;

  clean)
    echo "==> Cleaning temporary Playwright artifacts..."
    rm -rf test-results playwright-report
    echo "[OK] Cleanup complete. Proof artifacts in artifacts/verify/ preserved."
    ;;

  *)
    echo "Usage: $0 {doctor|seed|drive [spec]|clean}"
    exit 1
    ;;
esac
