# Web App Verification Map

This directory is the maintained source for verifying the user-facing behavior of the Private Movie web app and backend API. Read this index before driving the app, then follow the matching feature file for the exact driving recipe.

## Baseline Preconditions

- Postgres running on `localhost:5432` with database `private_movie_test`.
- Run `.agents/skills/verify/scripts/control.sh seed` to ensure deterministic seed state.
- Run `.agents/skills/verify/scripts/control.sh doctor` and confirm database accessibility.
- Servers launch automatically on demand via Playwright (Backend on `http://localhost:3000`, Web on `http://localhost:5173`).

## Driving Conventions

- Start every recipe from the baseline state unless preconditions state otherwise.
- Prefer stable data-testid handles (`data-testid="..."`), ARIA roles, and accessible names over CSS coordinates.
- Run web journeys via `.agents/skills/verify/scripts/control.sh drive <spec>`.
- Store all captured proof artifacts in `artifacts/verify/<feature>/`.
- Never delete captured proof artifacts during cleanup.

## Feature Entry Contract

Each feature file starts with an H1 title and one paragraph describing user-visible behavior, followed by exactly four H2 sections:

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with <harness>` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

## Features

- [Playback](./playback.md) covers catalog browsing, series detail navigation, and video player container mounting.
- [Authentication](./auth.md) covers admin login card, session tokens, and route protection.
- [Catalog](./catalog.md) covers home feed, hero carousel display, and genre ribbon browsing.
- [Admin Videos](./admin-videos.md) covers series catalog management and episode inspecting in the admin console.
- [Admin Storage](./admin-storage.md) covers storage overview, archive ingest queue, and capacity metrics.
