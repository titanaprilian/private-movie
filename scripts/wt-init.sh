#!/usr/bin/env bash
# scripts/wt-init.sh <ticket-id-or-url> [base-branch]
#
# Bootstraps an isolated git worktree for a ticket:
#   1. Resolves ticket ID and fetches issue metadata (Base branch) from GitHub.
#   2. Verifies Base branch exists on origin.
#   3. Creates or links the worktree at ../wt/ticket-<id> on branch ticket/<id>.
#   4. Executes scripts/wt-setup.sh inside the worktree to provision env/test db.
#
# Safe to re-run if resuming work on an existing ticket.

set -euo pipefail

die() { echo "wt-init: ERROR: $*" >&2; exit 1; }
log() { echo "wt-init: $*"; }

require() { command -v "$1" >/dev/null 2>&1 || die "'$1' is required but not installed"; }
ARG="${1:-}"
BASE_OVERRIDE="${2:-}"

if [[ -z "$ARG" || "$ARG" == "-h" || "$ARG" == "--help" ]]; then
  echo "Usage: scripts/wt-init.sh <ticket-id-or-url> [base-branch]"
  echo ""
  echo "Automates worktree setup for ticket implementation:"
  echo "  1. Resolves ticket ID and reads Base branch from GitHub issue"
  echo "  2. Creates git worktree at ../wt/ticket-<id> on branch ticket/<id>"
  echo "  3. Runs scripts/wt-setup.sh to configure .env, dependencies, and test database"
  exit 0
fi

require git
require gh

# Extract numeric ID if URL or issue ref like #123 or 123
ID="$(echo "$ARG" | grep -oE '[0-9]+$' || true)"
[[ -n "$ID" ]] || die "could not parse numeric ticket ID from '$ARG'"

REPO_ROOT="$(git rev-parse --show-toplevel)" || die "not inside a git repository"
cd "$REPO_ROOT"

# Ensure we are running from the main repo or common repository root
MAIN_DIR="$(git worktree list --porcelain | awk '/^worktree /{print substr($0, 10); exit}')"
[[ -n "$MAIN_DIR" && -d "$MAIN_DIR" ]] || die "could not locate main checkout"

TARGET_DIR="$(cd "$MAIN_DIR/.." && pwd -P)/wt/ticket-$ID"
BRANCH="ticket/$ID"

log "Ticket ID: $ID"
log "Target worktree: $TARGET_DIR"
log "Target branch: $BRANCH"

# Determine Base branch
BASE="$BASE_OVERRIDE"
if [[ -z "$BASE" ]]; then
  log "Fetching issue #$ID details via gh..."
  ISSUE_BODY="$(gh issue view "$ID" --json body -q .body 2>/dev/null || true)"
  if [[ -n "$ISSUE_BODY" ]]; then
    # Look for **Base:** or Base: line
    PARSED_BASE="$(echo "$ISSUE_BODY" | grep -iE '^\s*[-*]?\s*\**Base\**\s*:' | head -n 1 | sed -E 's/^\s*[-*]?\s*\**Base\**\s*:\s*`?([^` ]+)`?.*$/\1/' || true)"
    if [[ -n "$PARSED_BASE" && "$PARSED_BASE" != *" "* ]]; then
      BASE="$PARSED_BASE"
      log "Detected Base branch from issue: $BASE"
    fi
  fi
fi

if [[ -z "$BASE" ]]; then
  die "Could not determine Base branch from ticket #$ID. Please specify manually: scripts/wt-init.sh $ID <base-branch>"
fi

log "Fetching remote references from origin..."
git fetch origin

# Check remote base branch exists
if ! git ls-remote --exit-code --heads origin "$BASE" >/dev/null 2>&1; then
  # Check if it exists locally at least
  if ! git show-ref --verify --quiet "refs/heads/$BASE"; then
    die "Base branch '$BASE' does not exist on origin or locally. Has /to-tickets published the branch?"
  fi
fi

mkdir -p "$(dirname "$TARGET_DIR")"

# Check if worktree already exists
if [[ -d "$TARGET_DIR" ]]; then
  log "Worktree directory already exists at $TARGET_DIR"
else
  # Check if branch ticket/<id> already exists
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    log "Branch '$BRANCH' already exists. Adding worktree linking to existing branch..."
    git worktree add "$TARGET_DIR" "$BRANCH"
  else
    log "Creating new branch '$BRANCH' from 'origin/$BASE'..."
    if git rev-parse --verify "origin/$BASE" >/dev/null 2>&1; then
      git worktree add --no-track -b "$BRANCH" "$TARGET_DIR" "origin/$BASE"
    else
      git worktree add --no-track -b "$BRANCH" "$TARGET_DIR" "$BASE"
    fi
  fi
fi

# Run wt-setup inside the worktree
log "Running scripts/wt-setup.sh inside $TARGET_DIR..."
(
  cd "$TARGET_DIR"
  if [[ -f "scripts/wt-setup.sh" ]]; then
    ./scripts/wt-setup.sh "$ID"
  else
    die "scripts/wt-setup.sh not found inside worktree $TARGET_DIR"
  fi
)

log "================================================================="
log "Worktree successfully prepared!"
log "PATH:   $TARGET_DIR"
log "BRANCH: $BRANCH"
log "ACTION REQUIRED: Move into the worktree before doing ANY work:"
log "  cd \"$TARGET_DIR\""
log "================================================================="
