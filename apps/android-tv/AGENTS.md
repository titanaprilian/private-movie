# Agent Context Protocol (Android TV Client)

This document defines the Android TV application rules for agents working in `apps/android-tv`. Read it **in addition to** the root `AGENTS.md`, which covers the monorepo Deep Modules architecture.

## Platform Architecture (Android TV)

The Android TV client uses Kotlin, Jetpack Compose for TV, and standard Android architecture conventions mapped to Deep Modules:

| Deep Module Layer | Android TV Mapping |
| --- | --- |
| **Public Seam** | `src/main/java/com/privatemovie/tv/modules/<feature>/` (Screen composable, view model interfaces, DTO handlers) |
| **Internal Logic** | `src/main/java/com/privatemovie/tv/modules/<feature>/internal/` (UI subcomponents, state holders, internal mappers) |
| **Navigation Shell** | `src/main/java/com/privatemovie/tv/navigation/AppNavigation.kt` (NavHost routing Home → Detail → Player) |
| **Developer Override** | `src/main/java/com/privatemovie/tv/modules/config/BackendUrlStore.kt` (Dynamic backend base URL override for emulator & LAN testing) |

## Android Target & Compatibility

- **Minimum SDK**: API Level 30 (Android 11+)
- **Target SDK**: API Level 35
- **Leanback / TV-Only**: Declared in `AndroidManifest.xml` with `android.software.leanback` required.

## Testing Conventions

Tests live in `app/src/test/java/com/privatemovie/tv/`:

- `modules/<feature>/<Name>Test.kt` — Kotlin unit tests for stores, state holders, and navigation routes.
- Execute unit tests using `./gradlew test` (or `bun run test` via turbo filter `@repo/android-tv`).

## Commands

- Build Debug APK: `./gradlew assembleDebug`
- Run Unit Tests: `./gradlew test`
- Typecheck Kotlin: `./gradlew compileDebugKotlin`
