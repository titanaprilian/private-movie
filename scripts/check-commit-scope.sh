#!/usr/bin/env bash
# Blocks commits spanning more than one app root (apps/web, apps/backend, apps/android-tv).
# Shared packages (packages/**) and root/tooling files never count as a scope.
#
# Escape hatch: ALLOW_MULTI_APP=1, set ONLY after the human authorized multi-app scope
# for this commit. .husky/commit-msg then requires a "Multi-App:" trailer.
set -euo pipefail

# History rewrites replay existing commits — never block them.
git_path() { git rev-parse --git-path "$1"; }
if [ -d "$(git_path rebase-merge)" ] \
  || [ -d "$(git_path rebase-apply)" ] \
  || [ -f "$(git_path CHERRY_PICK_HEAD)" ] \
  || [ -f "$(git_path REVERT_HEAD)" ] \
  || [ -f "$(git_path MERGE_HEAD)" ]; then
  exit 0
fi

staged=$(git diff --cached --name-only --diff-filter=ACMRD)
[ -z "$staged" ] && exit 0

apps=$(printf '%s\n' "$staged" \
  | sed -nE 's#^apps/(web|backend|android-tv)/.*#\1#p' \
  | sort -u)

count=$(printf '%s\n' "$apps" | grep -c . || true)
[ "$count" -le 1 ] && exit 0

if [ "${ALLOW_MULTI_APP:-0}" = "1" ]; then
  echo "check-commit-scope: multi-app commit (${apps//$'\n'/, }) allowed via ALLOW_MULTI_APP=1; commit-msg will require a 'Multi-App:' trailer."
  exit 0
fi

cat >&2 <<EOF
✖ Commit blocked: staged changes span multiple apps: $(printf '%s ' $apps)

This repo commits one app per commit (scope, review diffs, and one ESLint pass instead of two).
Split the work — producer first — for example:

  git reset
  git add <contracts/backend files> && git commit -m "..."
  git add <web files>              && git commit -m "..."

Shared packages and root/tooling files may ride along with either commit.

If this commit genuinely must span apps AND the human authorized it, re-run:
  ALLOW_MULTI_APP=1 git commit ...   # plus a 'Multi-App: <ref> — <reason>' trailer

Never set ALLOW_MULTI_APP=1 on your own initiative.
EOF
exit 1
