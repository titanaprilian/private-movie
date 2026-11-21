#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <workspace-directory>" >&2
  exit 2
}

[[ $# -eq 1 && -d $1 ]] || usage
WORKSPACE=$(realpath -- "$1")
SETTINGS=${ANTIGRAVITY_SETTINGS_FILE:-"$HOME/.gemini/antigravity-cli/settings.json"}

if [[ ! -f $SETTINGS ]]; then
  echo "Antigravity settings file not found: $SETTINGS" >&2
  exit 1
fi

case "$WORKSPACE" in
  "$HOME"|"$HOME"/*) ;;
  *) echo "Refusing to trust workspace outside $HOME: $WORKSPACE" >&2; exit 1 ;;
esac

node - "$SETTINGS" "$WORKSPACE" <<'NODE'
const fs = require('node:fs');
const [settingsPath, workspace] = process.argv.slice(2);
let settings;
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
} catch (error) {
  console.error(`Cannot read Antigravity settings ${settingsPath}: ${error.message}`);
  process.exit(1);
}
if (settings.trustedWorkspaces !== undefined && !Array.isArray(settings.trustedWorkspaces)) {
  console.error(`Invalid trustedWorkspaces in ${settingsPath}: expected an array`);
  process.exit(1);
}
settings.trustedWorkspaces ??= [];
if (settings.trustedWorkspaces.includes(workspace)) process.exit(0);
settings.trustedWorkspaces.push(workspace);
const temporary = `${settingsPath}.${process.pid}.tmp`;
try {
  fs.writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, { mode: fs.statSync(settingsPath).mode });
  fs.renameSync(temporary, settingsPath);
} catch (error) {
  try { fs.unlinkSync(temporary); } catch {}
  console.error(`Cannot update Antigravity settings ${settingsPath}: ${error.message}`);
  process.exit(1);
}
NODE
