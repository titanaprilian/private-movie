---
name: test-android-tv
description: Build, install, launch, interact with, and visually test the Android TV app directly on a real Android TV or emulator via ADB over Wi-Fi or USB. Trigger whenever the user asks to test, deploy, run, remote control, take screenshots, or debug the Android TV app on their TV.
---

# Test Android TV Skill

This skill guides AI agents through building, installing, navigating, visually verifying, and debugging the `@repo/android-tv` application directly on an Android TV device or emulator using ADB.

## 0. Environment & App Specs

- **App Directory**: `apps/android-tv`
- **Application ID / Package**: `com.privatemovie.tv`
- **Main Activity**: `com.privatemovie.tv.MainActivity`
- **Full Component Name**: `com.privatemovie.tv/.MainActivity`
- **Debug APK Artifact**: `apps/android-tv/app/build/outputs/apk/debug/app-debug.apk`
- **Default Backend URL**: `https://anime.pylearn.my.id`
- **Architecture**: Jetpack Compose for TV (Leanback declared, API Level 30+).

---

## 1. Target Discovery & Wireless Connection

Before performing any build or install, verify target connectivity.

### Step 1.1: Check Connected Devices
```bash
adb devices
```

### Step 1.2: Connect via Wi-Fi (if not already attached)
If no device is listed or the TV is connected over LAN:
1. Check if the user already provided the TV IP or if it is in an environment variable. If unknown, ask the user for their Android TV IP address (e.g. `192.168.1.50`).
2. Run connection:
   ```bash
   adb connect <TV_IP>:5555
   ```
3. Re-run `adb devices` to confirm connection.

### Step 1.3: Target Device Targeting
If multiple devices are listed in `adb devices`, set the serial flag explicitly in all subsequent commands:
```bash
# Example: export TARGET="-s 192.168.1.50:5555"
# Or use TARGET="" if only one device is connected.
```

### Step 1.4: Device Status Check
- **`device`**: Connected and ready.
- **`unauthorized`**: The TV is waiting for user confirmation. Instruct the user:
  > "Please look at your TV screen and select 'Always allow from this computer' on the USB/Network debugging prompt."
- **`offline` / `refused`**: The TV may be in sleep mode or network debugging disabled. Ask user to wake the TV and confirm Developer Options → Network Debugging is enabled.

---

## 2. Build Debug APK

Build the debug APK using the project's Gradle wrapper:

```bash
./apps/android-tv/gradlew -p apps/android-tv assembleDebug
```

Alternatively, from within `apps/android-tv`:
```bash
./gradlew assembleDebug
```

Verify that the APK file was produced:
```bash
ls -la apps/android-tv/app/build/outputs/apk/debug/app-debug.apk
```

---

## 3. Install & Update on Android TV

Deploy the freshly built APK to the TV:

```bash
adb ${TARGET} install -r -d -t apps/android-tv/app/build/outputs/apk/debug/app-debug.apk
```

- `-r`: Reinstall existing app keeping data.
- `-d`: Allow version code downgrade if necessary.
- `-t`: Allow test packages.

### Clean Reinstall (Optional / Troubleshooting)
If installation fails due to signature conflicts or corrupted state:
```bash
adb ${TARGET} uninstall com.privatemovie.tv
adb ${TARGET} install -t apps/android-tv/app/build/outputs/apk/debug/app-debug.apk
```

---

## 4. App Lifecycle & Launch Control

### Launch Main Activity (Clean Start)
To force-stop any background instances and launch fresh while waiting for the display to settle:
```bash
adb ${TARGET} shell am start -S -W -n com.privatemovie.tv/.MainActivity
```
- `-S`: Force stops the target app before starting the activity.
- `-W`: Waits for launch to finish and outputs launch timing (`TotalTime`, `WaitTime`).

### Stop App
```bash
adb ${TARGET} shell am force-stop com.privatemovie.tv
```

### Clear App Data & Cache
```bash
adb ${TARGET} shell pm clear com.privatemovie.tv
```

---

## 5. D-Pad & Remote Control Navigation

Android TV apps are navigated via D-Pad keyevents. Use `adb shell input keyevent` to interact with the UI.

### Common TV Keycodes

| Button | Keycode | Purpose |
| --- | --- | --- |
| **DPAD_UP** | `19` | Move focus up |
| **DPAD_DOWN** | `20` | Move focus down |
| **DPAD_LEFT** | `21` | Move focus left |
| **DPAD_RIGHT** | `22` | Move focus right |
| **DPAD_CENTER** | `23` | Select / Click focused item |
| **ENTER** | `66` | Alternative select |
| **BACK** | `4` | Navigate back / dismiss overlay |
| **HOME** | `3` | Return to Android TV launcher |
| **MENU** | `82` | Options menu / secondary actions |
| **MEDIA_PLAY_PAUSE** | `85` | Toggle video playback |
| **MEDIA_PLAY** | `126` | Play video |
| **MEDIA_PAUSE** | `127` | Pause video |
| **FAST_FORWARD** | `90` | Seek forward |
| **REWIND** | `89` | Seek backward |

### Crucial Timing Rule for Agents
Jetpack Compose TV uses animated focus transitions. **Always allow a 300ms–500ms delay** between consecutive keyevents so the UI can settle:

```bash
# Example: Navigate down two rows, then select
adb ${TARGET} shell input keyevent 20 && sleep 0.5 && \
adb ${TARGET} shell input keyevent 20 && sleep 0.5 && \
adb ${TARGET} shell input keyevent 23
```

### Text Input
To input text (e.g. search queries or URLs):
```bash
adb ${TARGET} shell input text "<text_to_type>"
```

---

## 6. Visual Verification (Screenshots & AI Vision Loop)

The most effective way for an AI agent to verify the TV UI is capturing a screenshot and reading it with the `read` tool.

### Step 6.1: Capture Screenshot
Always use `screencap` on device and `adb pull` to avoid terminal carriage-return/CRLF binary corruption:
```bash
adb ${TARGET} shell screencap -p /sdcard/screen.png && adb ${TARGET} pull /sdcard/screen.png /tmp/android_tv_screen.png
```

### Step 6.2: Inspect Visually
Call the `read` tool:
```
read(filePath: "/tmp/android_tv_screen.png")
```

### Step 6.3: What to Verify
- **Focus Indicator**: Is a card or button visibly highlighted with a focus border/glow/scale?
- **Layout Integrity**: Are headers, posters, or carousels cut off at the TV screen edges?
- **Image Loading**: Are Coil async images and backdrops loading properly, or showing error placeholders?
- **Player State**: In the video player, is playback running? Are playback controls visible or properly hidden after timeout?
- **Error Dialogs**: Is there any ANR (Application Not Responding) dialog or crash warning?

---

## 7. Crash Logs & Diagnostics

### Step 7.1: Clear Logcat Buffer Before Test
```bash
adb ${TARGET} logcat -c
```

### Step 7.2: Check for Crashes / Fatal Exceptions
```bash
# Check crash buffer directly
adb ${TARGET} logcat -d -b crash

# Check AndroidRuntime and app-specific errors
adb ${TARGET} logcat -d -v time -s "AndroidRuntime:E" "com.privatemovie.tv:*"
```

### Step 7.3: Check Current Window Focus
To verify which activity or window currently owns focus on the TV:
```bash
adb ${TARGET} shell dumpsys window | grep -E 'mCurrentFocus|mFocusedApp'
```

---

## 8. Step-by-Step Test Procedure for Agents

When a user asks to "test the TV app on my TV":

1. **Check Target**: Run `adb devices`. If needed, prompt for TV IP and run `adb connect <TV_IP>:5555`.
2. **Build**: Run `./apps/android-tv/gradlew -p apps/android-tv assembleDebug`.
3. **Install**: Run `adb ${TARGET} install -r -d -t apps/android-tv/app/build/outputs/apk/debug/app-debug.apk`.
4. **Clean Logs**: Run `adb ${TARGET} logcat -c`.
5. **Launch**: Run `adb ${TARGET} shell am start -S -W -n com.privatemovie.tv/.MainActivity`.
6. **Capture Initial State**: Sleep 2 seconds for Compose initialization, capture screenshot, and call `read` on `/tmp/android_tv_screen.png`.
7. **Interact & Verify**:
   - Send D-pad keyevents to move between carousels.
   - Click an item (`keyevent 23`) to open DetailScreen.
   - Capture screenshot and inspect.
   - Click Play CTA to launch PlayerScreen.
   - Capture screenshot to verify video playback and controls.
   - Press Back (`keyevent 4`) to ensure navigation pop stack works properly.
8. **Health Check**: Run `adb ${TARGET} logcat -d -b crash` to ensure zero uncaught crashes.
