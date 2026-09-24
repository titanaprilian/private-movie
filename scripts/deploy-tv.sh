#!/usr/bin/env bash
# Build the Android TV app and install it on the TV via ADB.
#
# Usage:
#   scripts/deploy-tv.sh [--release] [--reinstall] [--launch]
#
#   --release    Build the release variant (default: debug)
#   --reinstall  Uninstall first (WIPES app data; use on signature conflicts)
#   --launch     Start the app after installing
#
# Env:
#   ANDROID_TV_IP   TV IP address (e.g. 192.168.1.50). Optional if a device
#                   is already attached via `adb devices`.
#
# Exit codes:
#   0 ok | 1 generic failure | 2 signature conflict | 3 no device | 4 build failed

set -euo pipefail

PKG="com.privatemovie.tv"
ACTIVITY="$PKG/.MainActivity"
VARIANT="debug"
REINSTALL=0
LAUNCH=0

for arg in "$@"; do
  case "$arg" in
    --release)   VARIANT="release" ;;
    --reinstall) REINSTALL=1 ;;
    --launch)    LAUNCH=1 ;;
    -h|--help)   sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT/apps/android-tv"
OUT_DIR="$APP_DIR/app/build/outputs/apk/$VARIANT"

# ---- 1. Connect ------------------------------------------------------------
if [[ -n "${ANDROID_TV_IP:-}" ]]; then
  adb connect "${ANDROID_TV_IP}:5555" >/dev/null || true
  TARGET=(-s "${ANDROID_TV_IP}:5555")
else
  TARGET=()
fi

STATE="$(adb "${TARGET[@]}" get-state 2>&1 || true)"
if [[ "$STATE" != "device" ]]; then
  echo "No usable device (state: $STATE)." >&2
  echo "- Set ANDROID_TV_IP, or attach a device so \`adb devices\` lists it." >&2
  echo "- If 'unauthorized': accept 'Always allow' on the TV screen." >&2
  echo "- If 'offline': wake the TV and enable Network Debugging." >&2
  exit 3
fi

# ---- 2. Build --------------------------------------------------------------
TASK="assemble$(tr '[:lower:]' '[:upper:]' <<<"${VARIANT:0:1}")${VARIANT:1}"
echo "Building $VARIANT..."
"$APP_DIR/gradlew" -p "$APP_DIR" "$TASK" || { echo "Build failed." >&2; exit 4; }

APK="$OUT_DIR/app-$VARIANT.apk"
if [[ ! -f "$APK" ]]; then
  echo "Expected APK not found: $APK" >&2
  echo "(For release, check that a signingConfig is set; an unsigned APK can't be installed.)" >&2
  exit 4
fi

# ---- 3. Install ------------------------------------------------------------
if [[ "$REINSTALL" -eq 1 ]]; then
  echo "Uninstalling $PKG (app data will be wiped)..."
  adb "${TARGET[@]}" uninstall "$PKG" >/dev/null || true
fi

echo "Installing $(basename "$APK")..."
if ! OUTPUT="$(adb "${TARGET[@]}" install -r -d -t "$APK" 2>&1)"; then
  echo "$OUTPUT" >&2
  if grep -q "INSTALL_FAILED_UPDATE_INCOMPATIBLE" <<<"$OUTPUT"; then
    echo "Signature conflict. Re-run with --reinstall (wipes app data)." >&2
    exit 2
  fi
  exit 1
fi

# ---- 4. Optional launch ----------------------------------------------------
if [[ "$LAUNCH" -eq 1 ]]; then
  adb "${TARGET[@]}" shell am start -S -W -n "$ACTIVITY" >/dev/null
fi

echo "Installed $VARIANT build on TV."
