---
name: verify
description: Drive the web app and backend API end-to-end, exercise user journeys (auth, catalog, playback, admin), and capture verifiable proof artifacts.
---

# Web App & Backend Verification

This skill drives the web application (`apps/web`), backend API (`apps/backend`), and Postgres database to prove user-facing behavior in a real browser environment.

## 1. Launch

The verification stack uses Playwright's automated `webServer` orchestration configured in `playwright.config.ts`, or can be driven against pre-running servers.

### Preconditions

- Postgres running on port `5432` (Docker container `postgres18` or local service).
- Test database `private_movie_test` seeded with deterministic fixtures:
  ```bash
  bun run test/e2e/fixtures/seed.ts
  ```

### Automated Launch via Playwright

When running verification specs, Playwright starts and manages:

1. **Backend API**: `bun run --filter=@repo/backend start` on `http://localhost:3000`
   - _Ready check_: `http://localhost:3000/api/health` returns `200 OK` with `{"status":"ok"}`.
2. **Web Frontend**: `bun run --filter=@repo/web preview` on `http://localhost:5173`
   - _Ready check_: `http://localhost:5173` returns HTML (`200 OK`).

### Manual Launch (if developing or debugging interactively)

```bash
# Terminal 1 - Backend:
PORT=3000 DATABASE_URL=postgres://postgres:root_password@localhost:5432/private_movie_test bun run --filter=@repo/backend start

# Terminal 2 - Web preview:
VITE_API_URL=http://localhost:3000 bun run --filter=@repo/web build && bun run --filter=@repo/web preview
```

## 2. Doctor

Run the doctor command to verify environment readiness before executing any tests:

```bash
.agents/skills/verify/scripts/control.sh doctor
```

The doctor check verifies:

1. Postgres connectivity on `localhost:5432`.
2. Whether backend (`http://localhost:3000/api/health`) and web frontend (`http://localhost:5173`) are already running. If they are not running, the verification harness will start them automatically via Playwright.

## 3. Drive

Execute verification journeys using the control script:

```bash
# Drive default playback journey
.agents/skills/verify/scripts/control.sh drive

# Drive a targeted test spec
.agents/skills/verify/scripts/control.sh drive test/e2e/web/playback.spec.ts

# Drive API smoke suite
.agents/skills/verify/scripts/control.sh drive test/e2e/api/smoke.spec.ts
```

### Key UI Selectors & Handles

- **Admin Login Card**: `[data-testid="admin-login-card"]`
- **Email Input**: `#admin-email` (Credentials: `test@example.com` / `password123`)
- **Password Input**: `#admin-password`
- **Submit Button**: `button:has-text("Enter Console")`
- **Hero Carousel**: `[data-testid="hero-slider"]`
- **Play Hero / Watch Button**: `[data-testid="hero-play"]`
- **Adblock Dialog Dismiss**: `button:has-text("Continue Anyway")` or localStorage `adblock_warning_dismissed = "true"`
- **Watch Player Container**: `[data-testid="watch-player-container"]`
- **Watch Player Frame**: `[data-testid="watch-player"]`

## 4. Evidence

All verification proofs must capture the real user-visible result and state.

- **Storage Location**: `artifacts/verify/<feature>/`
- **Screenshots**: High-resolution PNG captures of the mounted UI state (e.g. `artifacts/verify/playback/player-mounted.png`).
- **Reports**: Playwright test outcomes and logs in stdout.
- **Rule**: Teardown and cleanup must **never** delete files in `artifacts/verify/`.

## 5. Cleanup

Run the cleanup command after test execution to wipe transient test artifacts (temporary traces, raw Playwright reports) without removing captured proofs:

```bash
.agents/skills/verify/scripts/control.sh clean
```

## 6. Helpers

The primary entry point is `.agents/skills/verify/scripts/control.sh`:

```bash
# Verify environment readiness
.agents/skills/verify/scripts/control.sh doctor

# Reset and seed database
.agents/skills/verify/scripts/control.sh seed

# Run verification spec
.agents/skills/verify/scripts/control.sh drive [spec_path]

# Clean up scratch files
.agents/skills/verify/scripts/control.sh clean
```

For feature-specific journeys, consult the feature map in `features/`:

- [Feature Map Index](./features/README.md)
