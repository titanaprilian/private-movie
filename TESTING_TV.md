# Testing the Android TV App Locally

A step-by-step guide to spin up an Android TV emulator in Android Studio and test the app against your local backend.

## 1. Open the Project in Android Studio

Open Android Studio, then **File → Open** and navigate to:

```
apps/android-tv
```

Wait for Gradle sync to finish before proceeding.

## 2. Create an Android TV AVD (Virtual Device)

1. Go to **Tools → Device Manager** (or the device dropdown at the top toolbar → **Virtual** tab)
2. Click **+ Create Virtual Device**
3. In the **Category** column on the left, select **Television**
4. Pick a TV size — **Android TV (1080p)** is a solid default
5. Click **Next**
6. On the system image screen, pick an image with **API level 30** (Android 11) — this matches the app's `minSdk`
   - If it's not downloaded yet, click the **Download** link next to it and wait
7. Click **Next**, give the AVD a name (e.g. `TV API 30`), then **Finish**

## 3. Start the Emulator

In **Device Manager**, click the **▶ Play** button next to the AVD you just created. Give it a minute to boot — Android TV emulators can be slow on first launch.

## 4. Configure the Backend URL

The app needs to know where your backend is running. Since the emulator runs in its own network namespace, **`localhost` won't work** — you must use the special loopback alias:

```
http://10.0.2.2:<your-backend-port>
```

For example, if your backend runs on port `3000`, the URL is `http://10.0.2.2:3000`.

When the app first launches you will be prompted to enter a backend URL — type that in.

> **Make sure your backend is running first.** Start it from the monorepo root with:
> ```
> bun run dev:backend
> ```

## 5. Run the App

Back in Android Studio, select your TV emulator from the device dropdown at the top, then hit the **▶ Run** button (or `Shift+F10`). Android Studio will build and deploy the APK directly to the emulator.

## 6. Navigate with the D-Pad

The Android TV emulator uses keyboard shortcuts to simulate the remote control:

| Remote button | Keyboard key |
|---|---|
| D-pad up | Arrow Up |
| D-pad down | Arrow Down |
| D-pad left | Arrow Left |
| D-pad right | Arrow Right |
| OK / Select | Enter or Numpad 5 |
| Back | Escape |
| Home | F3 or Fn+F3 |
| Play / Pause | F8 |

## Tips

- **Hardware acceleration** — if the emulator is sluggish, enable hardware acceleration in Android Studio settings (HAXM on Intel, Hyper-V on AMD/Windows).
- **Logcat** — check the **Logcat** tab at the bottom of Android Studio to see network errors if the app can't reach your backend.
- **Network issues** — if you see connection errors, double-check that your backend URL uses `10.0.2.2` and not `localhost`, and that the backend is actually running.
