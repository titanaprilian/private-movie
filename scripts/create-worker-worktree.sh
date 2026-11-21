#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/create-worker-worktree.sh --branch <branch> [--base <ref>] [--path <directory>]

Create a separate worktree for a worker. Base defaults to main. Path defaults to
../wt/<repository>-<branch>, with slashes in the branch replaced by hyphens.
Prints the absolute worktree path. Repeating the same request returns that path;
conflicting branches or directories fail without resetting anything.
EOF
}

BRANCH=""
BASE=main
PATH_ARG=""

while (($#)); do
  case "$1" in
    --branch|--base|--path)
      if (($# < 2)) || [[ -z "$2" ]]; then
        echo "Missing value for $1" >&2
        exit 2
      fi
      case "$1" in
        --branch) BRANCH="$2" ;;
        --base) BASE="$2" ;;
        --path) PATH_ARG="$2" ;;
      esac
      shift 2
      ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ -z "$BRANCH" ]]; then
  echo "--branch is required" >&2
  exit 2
fi

git check-ref-format --branch "$BRANCH" >/dev/null
REPO_ROOT=$(git rev-parse --show-toplevel)
COMMON_DIR=$(git rev-parse --path-format=absolute --git-common-dir)

if [[ -z "$PATH_ARG" ]]; then
  PRIMARY_ROOT=$(git worktree list --porcelain | sed -n '1p')
  PRIMARY_ROOT=${PRIMARY_ROOT#worktree }
  PATH_ARG="$(dirname "$PRIMARY_ROOT")/wt/$(basename "$PRIMARY_ROOT")-${BRANCH//\//-}"
fi
WORKTREE=$(realpath -m -- "$PATH_ARG")

while IFS= read -r ENTRY; do
  [[ "$ENTRY" == worktree\ * ]] || continue
  EXISTING_ROOT=${ENTRY#worktree }
  case "$WORKTREE" in
    "$EXISTING_ROOT"|"$EXISTING_ROOT"/*)
      if [[ "$WORKTREE" != "$EXISTING_ROOT" ]]; then
        echo "Worker worktree must be outside existing checkouts: $WORKTREE" >&2
        exit 1
      fi
      ;;
  esac
done < <(git worktree list --porcelain)

if [[ -e "$WORKTREE" || -L "$WORKTREE" ]]; then
  if [[ "$(git -C "$WORKTREE" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)" == "$COMMON_DIR" &&
        "$(git -C "$WORKTREE" rev-parse --show-toplevel 2>/dev/null || true)" == "$WORKTREE" &&
        "$(git -C "$WORKTREE" symbolic-ref --quiet --short HEAD 2>/dev/null || true)" == "$BRANCH" ]]; then
    printf '%s\n' "$WORKTREE"
    exit 0
  fi
  echo "Directory is already in use: $WORKTREE" >&2
  exit 1
fi

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "Branch already exists at another path: $BRANCH" >&2
  exit 1
fi

if ! git rev-parse --verify --quiet "$BASE^{commit}" >/dev/null; then
  echo "Base does not resolve to a commit: $BASE" >&2
  exit 1
fi

mkdir -p -- "$(dirname "$WORKTREE")"
git worktree add -b "$BRANCH" "$WORKTREE" "$BASE" >&2
printf '%s\n' "$WORKTREE"
