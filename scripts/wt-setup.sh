#!/usr/bin/env bash
# scripts/wt-setup.sh <ticket-id>
#
# Prepares the CURRENT git worktree for ticket work. Run it from inside the
# worktree (branch ticket/<id>), never from the main checkout.
#
# What it does (safe to re-run):
#   1. Verifies you are in a linked worktree on branch ticket/<id>.
#   2. Copies untracked env files (.env, .env.local, .env.test) from the main checkout.
#   3. Creates an isolated Postgres database named test_ticket_<id>.
#   4. Points DATABASE_URL in the worktree's env files at that database. If an env file
#      also defines PORT, gives the worktree its own PORT (otherwise ports are untouched).
#   5. Runs `bun install`, then `bun run db:migrate` against the ticket database ONLY.
#
# Optional environment overrides:
#   BASE_DATABASE_URL   Postgres URL used to reach the server (host and credentials).
#                       Default: first DATABASE_URL found in the main checkout's env
#                       files (the root .env is checked first).
#   ADMIN_DATABASE_URL  URL used to CREATE the database. Default: BASE_DATABASE_URL
#                       with the database name replaced by "postgres".
#   DB_URL_KEYS         Space-separated env keys that hold the DB URL.
#                       Default: "DATABASE_URL"
#   PORT_BASE           Default 20000. The worktree PORT is PORT_BASE + (id % 10000).

set -euo pipefail

DB_URL_KEYS="${DB_URL_KEYS:-DATABASE_URL}"
PORT_BASE="${PORT_BASE:-20000}"

die() { echo "wt-setup: ERROR: $*" >&2; exit 1; }
log() { echo "wt-setup: $*"; }
warn() { echo "wt-setup: WARNING: $*" >&2; }

require() { command -v "$1" >/dev/null 2>&1 || die "'$1' is required but not installed"; }

# Prints the value of KEY from an env file (last assignment wins, quotes stripped).
read_env_var() {
  local file="$1" key="$2"
  { grep -E "^[[:space:]]*(export[[:space:]]+)?${key}=" "$file" || true; } \
    | tail -n1 \
    | sed -E "s/^[^=]*=//; s/^['\"]//; s/['\"][[:space:]]*$//"
}

has_env_var() {
  grep -qE "^[[:space:]]*(export[[:space:]]+)?${2}=" "$1"
}

# Replaces every assignment of KEY in FILE with KEY=VALUE (keeps the first position).
set_env_var() {
  local file="$1" key="$2" val="$3" tmp
  tmp="$(mktemp)"
  awk -v k="$key" -v v="$val" '
    BEGIN { done = 0 }
    $0 ~ "^[[:space:]]*(export[[:space:]]+)?" k "=" {
      if (!done) { print k "=" v; done = 1 }
      next
    }
    { print }
  ' "$file" > "$tmp"
  cat "$tmp" > "$file"
  rm -f "$tmp"
}

# with_db <postgres-url> <dbname>  -> same URL with the database name replaced.
with_db() {
  local url="$1" db="$2" query=""
  if [[ "$url" == *\?* ]]; then
    query="?${url#*\?}"
    url="${url%%\?*}"
  fi
  printf '%s/%s%s' "${url%/*}" "$db" "$query"
}

# NUL-separated list of candidate env files under DIR, sorted for determinism.
list_env_files() {
  find "$1" \
    \( -name node_modules -o -name .git -o -name .turbo -o -name dist -o -name build -o -name .next \) -prune -o \
    -type f \( -name '.env' -o -name '.env.local' -o -name '.env.test' \) -print0 \
    | sort -z
}

discover_base_url() {
  local main="$1" root="$2" f key val
  while IFS= read -r -d '' f; do
    [[ "$f" == "$root"/* ]] && continue
    for key in $DB_URL_KEYS; do
      val="$(read_env_var "$f" "$key")"
      if [[ -n "$val" ]]; then
        printf '%s' "$val"
        return 0
      fi
    done
  done < <(list_env_files "$main")
  return 1
}

main() {
  local MODE="ticket"
  local ID=""
  if [[ "${1:-}" == "--shared" ]]; then
    MODE="shared"
  else
    ID="${1:-}"
    [[ "$ID" =~ ^[0-9]+$ ]] || die "usage: scripts/wt-setup.sh <ticket-id> | --shared"
  fi
  require git
  require bun
  require psql

  local ROOT
  ROOT="$(git rev-parse --show-toplevel)" || die "not inside a git repository"
  cd "$ROOT"

  # --- 1. Must be a linked worktree on ticket/<id> ---------------------------
  local git_dir common_dir branch
  git_dir="$(cd "$(git rev-parse --git-dir)" && pwd -P)"
  common_dir="$(cd "$(git rev-parse --git-common-dir)" && pwd -P)"
  [[ "$git_dir" != "$common_dir" ]] \
    || die "this is the main checkout. Run this from inside the ticket's worktree (git worktree add ../wt/ticket-$ID -b ticket/$ID origin/main)"

  branch="$(git branch --show-current)"
  if [[ "$MODE" == "ticket" ]]; then
    [[ "$branch" == "ticket/$ID" ]] \
      || die "current branch is '$branch', expected 'ticket/$ID'. Wrong worktree?"
  fi
  local MAIN
  MAIN="$(git worktree list --porcelain | awk '/^worktree /{print substr($0, 10); exit}')"
  [[ -n "$MAIN" && -d "$MAIN" ]] || die "could not locate the main checkout"
  [[ "$MAIN" != "$ROOT" ]] || die "resolved main checkout equals this worktree; refusing to continue"

  log "worktree: $ROOT"
  log "main checkout: $MAIN"

  # --- 2. Copy untracked env files from the main checkout --------------------
  local src rel dest copied=0
  while IFS= read -r -d '' src; do
    [[ "$src" == "$ROOT"/* ]] && continue
    rel="${src#"$MAIN"/}"
    dest="$ROOT/$rel"
    [[ -e "$dest" ]] && continue
    mkdir -p "$(dirname "$dest")"
    cp "$src" "$dest"
    copied=$((copied + 1))
    log "copied $rel"
  done < <(list_env_files "$MAIN")
  log "env files copied: $copied"

  # --- 3. Isolated test database ----------------------------------------------
  local DB
  local PORT
  if [[ "$MODE" == "ticket" ]]; then
    DB="test_ticket_$ID"
    PORT=$((PORT_BASE + ID % 10000))
  else
    local slug
    slug="$(echo "$branch" | tr '/.-' '___' | sed 's/[^a-zA-Z0-9_]//g')"
    slug="${slug:0:50}"
    DB="test_shared_${slug}"
    local hash
    hash="$(cksum <<< "$branch" | awk '{print $1}')"
    PORT=$((PORT_BASE + hash % 10000))
  fi
  local base_url="${BASE_DATABASE_URL:-}"
  if [[ -z "$base_url" ]]; then
    base_url="$(discover_base_url "$MAIN" "$ROOT")" \
      || die "no DB URL found. Set BASE_DATABASE_URL, or define one of: $DB_URL_KEYS in the main checkout's env files"
  fi

  local ticket_url admin_url
  ticket_url="$(with_db "$base_url" "$DB")"
  admin_url="${ADMIN_DATABASE_URL:-$(with_db "$base_url" postgres)}"

  local exists
  exists="$(psql "$admin_url" -v ON_ERROR_STOP=1 -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB'")" \
    || die "could not connect to Postgres with the admin URL. Set ADMIN_DATABASE_URL if the default is wrong"
  if [[ "$exists" == "1" ]]; then
    log "database $DB already exists, reusing it"
  else
    psql "$admin_url" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$DB\"" >/dev/null
    log "created database $DB"
  fi

  # --- 4. Point this worktree's env files at it, and give it its own PORT -----
  local f key patched_db=0 patched_port=0
  while IFS= read -r -d '' f; do
    [[ "$f" == "$ROOT"/* ]] || continue
    for key in $DB_URL_KEYS; do
      if has_env_var "$f" "$key"; then
        set_env_var "$f" "$key" "$ticket_url"
        patched_db=$((patched_db + 1))
      fi
    done
    if has_env_var "$f" PORT; then
      set_env_var "$f" PORT "$PORT"
      patched_port=$((patched_port + 1))
    fi
  done < <(list_env_files "$ROOT")

  [[ "$patched_db" -gt 0 ]] \
    || die "no env file in the worktree defines any of: $DB_URL_KEYS. Nothing points at $DB, so I will not run migrations"
  log "pointed $patched_db DB URL setting(s) at $DB"
  if [[ "$patched_port" -gt 0 ]]; then
    log "set PORT=$PORT in $patched_port place(s)"
  else
    log "no PORT in any env file; leaving ports alone (fine if agents only run tests, not dev servers)"
  fi

  # --- 5. Dependencies and migrations -----------------------------------------
  log "running bun install"
  bun install

  # Hard guard: migrations may only ever run against this ticket's database.
  [[ "$ticket_url" == *"/$DB"* && ( "$DB" == "test_ticket_$ID" || "$DB" == "test_shared_"* ) ]] \
    || die "refusing to migrate: URL does not target $DB"
  if grep -q '"db:migrate"' package.json; then
    log "running db:migrate against $DB"
    (
      for key in $DB_URL_KEYS; do export "$key=$ticket_url"; done
      bun run db:migrate
    )
  else
    warn "no 'db:migrate' script in the root package.json; skipped migrations"
  fi

  if [[ "$MODE" == "ticket" ]]; then
    log "done. Ticket $ID: database=$DB branch=$branch"
  else
    log "done. Shared worktree: database=$DB branch=$branch"
  fi
}

# Only run when executed, not when sourced (so the helpers can be tested).
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
