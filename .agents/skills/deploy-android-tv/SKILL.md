---
name: deploy-android-tv
description: Build the Android TV app and install it on the user's Android TV via ADB over Wi-Fi, using scripts/deploy-tv.sh. Trigger when the user asks to deploy, install, push, update, or publish the Android TV app to their TV (debug or release build). Do NOT use for testing, debugging, screenshots, or remote control.
---

# Deploy Android TV

Build `@repo/android-tv` and install it on the user's TV with one script. Nothing else: no launching, no screenshots, no log inspection, unless the user asks.

## Command

Run from the repo root:

```bash
scripts/deploy-tv.sh            # debug build (default)
scripts/deploy-tv.sh --release  # release build (minified, production-like)
```

The script connects to the TV using `$ANDROID_TV_IP`, builds, and installs. If `ANDROID_TV_IP` is unset and no device is attached, ask the user for the TV's IP once, then run:

```bash
ANDROID_TV_IP=<ip> scripts/deploy-tv.sh
```

## Choosing the variant

- Default to **debug** unless the user says "release", "production", or "final".
- Use **release** when the user wants the build to feel like production (smoother performance, no debug overhead).

## Handling failures

| Exit code | Meaning               | What to do                                                                                                                                                         |
| --------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0         | Installed             | Reply with one line: installed (debug/release). Stop.                                                                                                              |
| 2         | Signature conflict    | Ask the user first: reinstalling wipes app data. If they agree, re-run with `--reinstall`.                                                                         |
| 3         | No device             | `unauthorized`: tell the user to accept "Always allow" on the TV. `offline`: ask them to wake the TV and enable Developer Options → Network Debugging. Then retry. |
| 4         | Build failed          | Report the error and stop.                                                                                                                                         |
| 1         | Other install failure | Report the adb error and stop.                                                                                                                                     |

## Optional (only if the user asks)

Launch the app after installing:

```bash
scripts/deploy-tv.sh --launch
```

## App specs

- **App directory**: `apps/android-tv`
- **Package**: `com.privatemovie.tv`
- **Main activity**: `com.privatemovie.tv/.MainActivity`
- **APKs**: `apps/android-tv/app/build/outputs/apk/{debug,release}/app-{debug,release}.apk`
