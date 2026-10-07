#!/usr/bin/env bash
# scripts/wt-init.sh <ticket-id-or-url> [base-branch]
# scripts/wt-init.sh --shared <delivery-branch>
# scripts/wt-init.sh --ready <delivery-branch>
#
# Bootstraps an isolated git worktree. Run it from the main checkout (or any worktree).
#
# The LOCAL delivery (spec) branch is the source of truth while the work is going on:
# reviewers merge approved tickets into it locally, and origin is only updated by
# /push-to-github at the end. So worktrees are always cut from the local branch, never
# from origin/<branch>, which may be behind. (If only origin has the branch, the local
# branch is created from it first.)
#
# Ticket mode (default), for a ticket whose Worktree is "own":
#   1. Resolves ticket ID and fetches issue metadata (Base, Worktree, Blocked by) from GitHub.
#   2. Refuses if a blocking ticket is still open (a blocked ticket must start from a Base
#      branch that already contains its blockers' work).
#   3. Verifies the Base branch exists (locally, or on origin).
#   4. Creates or links the worktree at ../wt/ticket-<id> on branch ticket/<id>.
#   5. Executes scripts/wt-setup.sh inside the worktree to provision env/test db.
#
# Shared mode (--shared <delivery-branch>), for a set of tickets worked in ONE worktree:
#   1. Creates or links the worktree at ../wt/<branch minus "spec/", "/" as "-"> directly
#      on the delivery branch. The branch is created from origin/<default branch> if it
#      does not exist yet (it stays local until /push-to-github pushes it).
#   2. Executes scripts/wt-setup.sh --shared inside the worktree.
#   If a ticket id is given and that ticket says "shared" in its Worktree section, the
#   script switches to shared mode on the ticket's Base branch by itself.
#
# Ready mode (--ready <delivery-branch>): creates nothing. Lists the open tickets whose
# Base is that branch, one per line, tab-separated:
#   <number>  <state>  <mode>  <detail>  <title>
# where state is "ready" (every blocker is closed and the ticket has no worktree/commit yet),
# "active" (its worktree exists, or in shared mode its commit is already on the branch)
# or "blocked" (detail lists the open blockers), and mode is "own" or "shared".
# Used by the reviewer to decide which worktrees to create next.
#
# Safe to re-run if resuming work.
#
# Optional environment:
#   FORCE=1   skip the blocker check (not for normal use).

set -euo pipefail

die() { echo "wt-init: ERROR: $*" >&2; exit 1; }
log() { echo "wt-init: $*"; }
warn() { echo "wt-init: WARNING: $*" >&2; }

require() { command -v "$1" >/dev/null 2>&1 || die "'$1' is required but not installed"; }

SHARED=0
READY=0
if [[ "${1:-}" == "--shared" ]]; then
  SHARED=1
  shift
elif [[ "${1:-}" == "--ready" ]]; then
  READY=1
  shift
fi
ARG="${1:-}"
BASE_OVERRIDE="${2:-}"

if [[ -z "$ARG" || "$ARG" == "-h" || "$ARG" == "--help" ]]; then
  echo "Usage: scripts/wt-init.sh <ticket-id-or-url> [base-branch]"
  echo "       scripts/wt-init.sh --shared <delivery-branch>"
  echo "       scripts/wt-init.sh --ready <delivery-branch>"
  echo ""
  echo "Automates worktree setup for ticket implementation:"
  echo "  ticket mode:  creates ../wt/ticket-<id> on branch ticket/<id> from the ticket's Base branch,"
  echo "                after checking that its blockers are closed"
  echo "  shared mode:  creates ONE worktree directly on the delivery branch, for all tickets of a set"
  echo "  ready mode:   lists the open tickets of a delivery branch as ready / active / blocked (creates nothing)"
  echo "  both create modes then run scripts/wt-setup.sh to configure .env, dependencies, and test database"
  exit 0
fi

require git

# issue_section <body> <heading>  -> the lines under "## <heading>" up to the next "## " heading
issue_section() {
  awk -v h="## $2" '
    $0 == h { f = 1; next }
    /^## /  { f = 0 }
    f
  ' <<<"$1"
}

# issue_field <body> <name> -> first non-empty line of the "## <name>" section, cleaned;
# falls back to a "<name>: value" line (the local ticket format, "**Base:** value").
issue_field() {
  local body="$1" name="$2" v
  v="$(issue_section "$body" "$name" | sed -E 's/^[[:space:]]*[-*][[:space:]]*//; s/[`_*]//g; s/^[[:space:]]+//; s/[[:space:]]+$//' | awk 'NF{print; exit}')"
  if [[ -z "$v" ]]; then
    v="$(grep -iE "^[[:space:]]*[-*]?[[:space:]]*\**${name}\**[[:space:]]*:" <<<"$body" | head -n 1 | sed -E 's/^[^:]*://; s/[*`_]//g; s/^[[:space:]]+//; s/[[:space:]]+$//' || true)"
  fi
  printf '%s' "$v"
}

REPO_ROOT="$(git rev-parse --show-toplevel)" || die "not inside a git repository"
cd "$REPO_ROOT"

# Ensure we are running from the main repo or common repository root
MAIN_DIR="$(git worktree list --porcelain | awk '/^worktree /{print substr($0, 10); exit}')"
[[ -n "$MAIN_DIR" && -d "$MAIN_DIR" ]] || die "could not locate main checkout"
WT_ROOT="$(cd "$MAIN_DIR/.." && pwd -P)/wt"

DEFAULT_BRANCH="$(git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||' || true)"
[[ -n "$DEFAULT_BRANCH" ]] || DEFAULT_BRANCH="main"

# worktree_of_branch <branch> -> path of the worktree that has it checked out (empty if none)
worktree_of_branch() {
  git worktree list --porcelain | awk -v b="refs/heads/$1" '
    /^worktree /{p = substr($0, 10)} $0 == "branch " b {print p; exit}'
}

# run_setup <dir> [args...] -> runs scripts/wt-setup.sh inside the worktree
run_setup() {
  local dir="$1"
  shift
  log "Running scripts/wt-setup.sh $* inside $dir..."
  (
    cd "$dir"
    if [[ -f "scripts/wt-setup.sh" ]]; then
      bash scripts/wt-setup.sh "$@"
    else
      die "scripts/wt-setup.sh not found inside worktree $dir"
    fi
  )
}

# init_shared <delivery-branch> -> creates or reuses the single worktree for the whole set
init_shared() {
  local branch="$1" target existing
  [[ "$branch" =~ ^[A-Za-z0-9._/-]+$ ]] || die "unexpected branch name '$branch'"
  [[ "$branch" != "$DEFAULT_BRANCH" && "$branch" != "main" && "$branch" != "master" ]] \
    || die "'$branch' is the default branch; the shared worktree must be on a delivery branch such as spec/<slug>"

  log "Shared mode, delivery branch: $branch"
  log "Fetching remote references from origin..."
  git fetch origin

  existing="$(worktree_of_branch "$branch")"
  if [[ -n "$existing" ]]; then
    target="$existing"
    log "Branch '$branch' is already checked out at $target, reusing it"
  else
    local name="${branch#spec/}"
    name="${name//\//-}"
    target="$WT_ROOT/$name"
    [[ ! -e "$target" ]] || die "$target already exists but is not a worktree on '$branch'. Move or remove it first"
    mkdir -p "$WT_ROOT"
    if git show-ref --verify --quiet "refs/heads/$branch"; then
      log "Branch '$branch' already exists locally. Adding worktree linking to it..."
      git worktree add "$target" "$branch"
    elif git ls-remote --exit-code --heads origin "$branch" >/dev/null 2>&1; then
      log "Branch '$branch' exists on origin. Creating the local branch from it..."
      git worktree add --no-track -b "$branch" "$target" "origin/$branch"
    else
      git rev-parse --verify --quiet "origin/$DEFAULT_BRANCH" >/dev/null \
        || die "origin/$DEFAULT_BRANCH not found; cannot create '$branch' from it"
      log "Creating new branch '$branch' from 'origin/$DEFAULT_BRANCH'..."
      git worktree add --no-track -b "$branch" "$target" "origin/$DEFAULT_BRANCH"
    fi
  fi

  run_setup "$target" --shared

  log "================================================================="
  log "Shared worktree successfully prepared!"
  log "PATH:   $target"
  log "BRANCH: $branch"
  log "ACTION REQUIRED: start the agent INSIDE this worktree before doing ANY work:"
  log "  cd \"$target\""
  log "================================================================="
}

# list_ready <delivery-branch> -> one line per open ticket of that branch (see the header)
list_ready() {
  local base="$1" num title b64 body tbase wtmode blockers open b state detail row
  [[ "$base" =~ ^[A-Za-z0-9._/-]+$ ]] || die "unexpected branch name '$base'"
  require gh
  gh issue list --label ticket --state open --limit 200 --json number,title,body \
    --jq '.[] | [.number, .title, (.body | @base64)] | @tsv' \
    | while IFS=$'\t' read -r num title b64; do
        body="$(printf '%s' "$b64" | base64 --decode | tr -d '\r')"
        tbase="$(issue_field "$body" "Base" | awk '{print $1; exit}')"
        [[ "$tbase" == "$base" ]] || continue
        wtmode="$(issue_field "$body" "Worktree" | awk '{print tolower($1); exit}')"
        [[ "$wtmode" == "shared" ]] || wtmode="own"

        open=""
        for b in $(issue_section "$body" "Blocked by" | grep -oE '#[0-9]+' | tr -d '#' | sort -un || true); do
          state="$(gh issue view "$b" --json state -q .state 2>/dev/null || echo UNKNOWN)"
          [[ "$state" == "CLOSED" ]] || open="${open:+$open,}#$b"
        done

        if [[ -n "$open" ]]; then
          row="blocked"; detail="$open"
        elif [[ "$wtmode" == "own" && -n "$(worktree_of_branch "ticket/$num")" ]]; then
          row="active"; detail="worktree exists"
        elif [[ "$wtmode" == "shared" ]] && git log "$base" --format=%s 2>/dev/null | grep -qF "#$num — "; then
          row="active"; detail="commit is on $base, awaiting review"
        else
          row="ready"; detail=""
        fi
        printf '%s\t%s\t%s\t%s\t%s\n' "$num" "$row" "$wtmode" "$detail" "$title"
      done
}

# ---------------------------------------------------------------- ready mode
if [[ "$READY" == "1" ]]; then
  list_ready "$ARG"
  exit 0
fi

# ---------------------------------------------------------------- shared mode, explicit
if [[ "$SHARED" == "1" ]]; then
  init_shared "$ARG"
  exit 0
fi

# ---------------------------------------------------------------- ticket mode
require gh

# Extract numeric ID if URL or issue ref like #123 or 123
ID="$(echo "$ARG" | grep -oE '[0-9]+$' || true)"
[[ -n "$ID" ]] || die "could not parse numeric ticket ID from '$ARG'"

TARGET_DIR="$WT_ROOT/ticket-$ID"
BRANCH="ticket/$ID"

log "Ticket ID: $ID"
log "Target worktree: $TARGET_DIR"
log "Target branch: $BRANCH"

log "Fetching issue #$ID details via gh..."
ISSUE_BODY="$(gh issue view "$ID" --json body -q .body 2>/dev/null | tr -d '\r' || true)"
[[ -n "$ISSUE_BODY" ]] || warn "could not read issue #$ID; the Base override is used as is, and the blocker and Worktree checks are skipped"

# Determine Base branch
BASE="$BASE_OVERRIDE"
if [[ -z "$BASE" && -n "$ISSUE_BODY" ]]; then
  BASE="$(issue_field "$ISSUE_BODY" "Base" | awk '{print $1; exit}')"
  [[ -z "$BASE" ]] || log "Detected Base branch from issue: $BASE"
fi

if [[ -z "$BASE" ]]; then
  die "Could not determine Base branch from ticket #$ID. Please specify manually: scripts/wt-init.sh $ID <base-branch>"
fi
[[ "$BASE" =~ ^[A-Za-z0-9._/-]+$ ]] || die "unexpected Base value '$BASE'; expected a branch name. Specify it manually: scripts/wt-init.sh $ID <base-branch>"

# Tickets of a shared set use the shared worktree, not a ticket worktree
WTMODE="own"
if [[ -n "$ISSUE_BODY" ]]; then
  WTMODE="$(issue_field "$ISSUE_BODY" "Worktree" | awk '{print tolower($1); exit}')"
  [[ "$WTMODE" == "shared" ]] || WTMODE="own"
fi

# Blockers must all be closed before this ticket's worktree is created
if [[ -n "$ISSUE_BODY" && "${FORCE:-0}" != "1" ]]; then
  BLOCKERS="$(issue_section "$ISSUE_BODY" "Blocked by" | grep -oE '#[0-9]+' | tr -d '#' | sort -un || true)"
  for b in $BLOCKERS; do
    state="$(gh issue view "$b" --json state -q .state)" || die "could not read blocker #$b"
    [[ "$state" == "CLOSED" ]] \
      || die "ticket #$ID is blocked by #$b, which is still $state. Wait until it is done and closed (FORCE=1 overrides)"
  done
fi

if [[ "$WTMODE" == "shared" ]]; then
  log "Ticket #$ID is a shared-mode ticket; using the shared worktree on $BASE"
  init_shared "$BASE"
  exit 0
fi

log "Fetching remote references from origin..."
git fetch origin || warn "could not fetch from origin; using what is already local"

# Own mode: the LOCAL Base branch is the source of truth (reviewers merge into it locally and
# origin is only updated at the very end), so ticket branches are cut from it, not from
# origin/<base>, which may be behind. If only origin has the branch, make the local one first.
if ! git show-ref --verify --quiet "refs/heads/$BASE"; then
  if git show-ref --verify --quiet "refs/remotes/origin/$BASE"; then
    log "Creating local branch '$BASE' from origin/$BASE..."
    git branch --no-track "$BASE" "origin/$BASE"
  else
    die "Base branch '$BASE' does not exist locally or on origin. Has /to-tickets created the branch?"
  fi
fi

mkdir -p "$WT_ROOT"

# Check if worktree already exists
if [[ -d "$TARGET_DIR" ]]; then
  [[ "$(git -C "$TARGET_DIR" branch --show-current 2>/dev/null || true)" == "$BRANCH" ]] \
    || die "$TARGET_DIR exists but is not the worktree for '$BRANCH'. Move or remove it first"
  log "Worktree directory already exists at $TARGET_DIR"
else
  # Check if branch ticket/<id> already exists
  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    log "Branch '$BRANCH' already exists. Adding worktree linking to existing branch..."
    git worktree add "$TARGET_DIR" "$BRANCH"
  else
    log "Creating new branch '$BRANCH' from the local '$BASE' ($(git rev-parse --short "$BASE"))..."
    git worktree add --no-track -b "$BRANCH" "$TARGET_DIR" "$BASE"
  fi
fi

# Run wt-setup inside the worktree
run_setup "$TARGET_DIR" "$ID"

log "================================================================="
log "Worktree successfully prepared!"
log "PATH:   $TARGET_DIR"
log "BRANCH: $BRANCH"
log "ACTION REQUIRED: Move into the worktree before doing ANY work:"
log "  cd \"$TARGET_DIR\""
log "================================================================="
