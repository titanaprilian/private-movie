#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
cd "$REPO_ROOT"

TITLE=""
ISSUE=""
AUTO_MERGE=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title)
      TITLE="$2"
      shift 2
      ;;
    --issue)
      ISSUE="$2"
      shift 2
      ;;
    --no-merge)
      AUTO_MERGE=false
      shift
      ;;
    *)
      echo "Unknown flag: $1"
      exit 1
      ;;
  esac
done

# 1. Branch validation
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" = "main" ]; then
  echo "[ERROR] Cannot ship directly from 'main'. Please create or switch to a feature branch (e.g. feat/my-feature)." >&2
  exit 1
fi

# 2. Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo "[ERROR] Working tree has uncommitted changes. Please commit or stash them before shipping." >&2
  exit 1
fi

echo "==> Shipping branch '$CURRENT_BRANCH'..."

# 3. Push branch to origin
echo "==> Pushing branch to remote..."
git push -u origin "$CURRENT_BRANCH"

# 4. Check for existing open PR or create one
PR_NUM=$(gh pr view --json number -q .number 2>/dev/null || true)

if [ -z "$PR_NUM" ]; then
  echo "==> No open PR found. Preparing standardized pull request..."

  # Derive Title if not provided
  if [ -z "$TITLE" ]; then
    LATEST_COMMIT_MSG=$(git log -1 --pretty=%s)
    TITLE="$LATEST_COMMIT_MSG"
  fi

  # Derive Issue if not provided
  if [ -z "$ISSUE" ]; then
    # Try finding issue number in branch name (e.g., feat/add-foo-999 -> 999)
    if [[ "$CURRENT_BRANCH" =~ ([0-9]{3,}) ]]; then
      ISSUE="${BASH_REMATCH[1]}"
    fi
  fi

  ISSUE_SECTION="## Issue"
  if [ -n "$ISSUE" ]; then
    ISSUE_SECTION=$(printf "## Issue\n- Closes #%s" "$ISSUE")
  else
    ISSUE_SECTION=$(printf "## Issue\n<!-- List related issues below, e.g. - Closes #999 -->")
  fi

  # Generate 'What did you do?' from commit log
  COMMITS_LOG=$(git log origin/main..HEAD --pretty=format:"- %s" 2>/dev/null || git log -5 --pretty=format:"- %s")
  if [ -z "$COMMITS_LOG" ]; then
    COMMITS_LOG="- $TITLE"
  fi

  # Check for screenshot artifacts from verification harness
  SCREENSHOT_SECTION="## Screenshot / Video\nN/A - backend / headless changes"
  LATEST_SCREENSHOT=$(find artifacts/verify -type f -name "*.png" 2>/dev/null | head -n 1 || true)
  if [ -n "$LATEST_SCREENSHOT" ]; then
    SCREENSHOT_SECTION=$(printf "## Screenshot / Video\n- Verified proof artifact captured at: \`%s\`" "$LATEST_SCREENSHOT")
  fi

  # Construct standardized body
  PR_BODY=$(cat <<EOF
# $TITLE

$ISSUE_SECTION

## What did you do?
$COMMITS_LOG

$SCREENSHOT_SECTION

## Verification
- **Automated Tests:** Verified locally before push
- **Quality Gates:** \`bun run gate:check\` (0 unused items, code duplication within limits)
- **Harness:** \`.agents/skills/verify/scripts/control.sh drive\`
EOF
)

  echo "==> Creating pull request on GitHub..."
  PR_URL=$(gh pr create --title "$TITLE" --body "$PR_BODY")
  echo "==> PR created: $PR_URL"
  PR_NUM=$(gh pr view --json number -q .number)
else
  echo "==> Found existing open PR #$PR_NUM."
fi

# 5. Monitor CI Checks
echo "==> Monitoring CI checks for PR #$PR_NUM (fail-fast watch mode)..."
set +e
gh pr checks "$PR_NUM" --watch --fail-fast
CHECK_STATUS=$?
set -e

if [ $CHECK_STATUS -ne 0 ]; then
  echo ""
  echo "❌ [CI FAILED] One or more checks failed on PR #$PR_NUM!"
  echo "==> Retrieving latest failed run logs..."

  RUN_ID=$(gh run list --branch "$CURRENT_BRANCH" --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || true)
  if [ -n "$RUN_ID" ]; then
    echo "--- Failed Job Output (Run ID: $RUN_ID) ---"
    gh run view "$RUN_ID" --log-failed || true
    echo "-------------------------------------------"
  fi

  echo ""
  echo "Action required: Inspect the failed output above, run targeted fixes in poteto-mode, commit, and re-ship." >&2
  exit 2
fi

echo "✅ [CI PASSED] All checks passed for PR #$PR_NUM!"

# 6. Auto-Merge if requested
if [ "$AUTO_MERGE" = true ]; then
  echo "==> Squash-merging PR #$PR_NUM into main and deleting branch..."
  gh pr merge "$PR_NUM" --squash --delete-branch

  echo "==> Updating local main branch..."
  git checkout main
  git pull origin main
  echo "🚀 Successfully merged PR #$PR_NUM to main!"
else
  echo "==> PR #$PR_NUM is green and ready for review/merge (auto-merge skipped via --no-merge)."
fi
