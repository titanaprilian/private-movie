# Private Movie

A self-hosted private media streaming platform and catalog with web and Android TV clients, built as a high-performance monorepo using Bun, Elysia, and React.

## Tech Stack

- **Runtime & Monorepo**: [Bun](https://bun.sh), [Turborepo](https://turbo.build/)
- **Backend (`apps/backend`)**: [Elysia](https://elysiajs.com), [Drizzle ORM](https://orm.drizzle.team/), PostgreSQL, S3/B2 Object Storage
- **Web Client (`apps/web`)**: React 19, [Vite](https://vite.dev), [TanStack Router](https://tanstack.com/router), [TanStack Query](https://tanstack.com/query), Tailwind CSS, Radix UI, Zustand
- **TV Client (`apps/android-tv`)**: Kotlin, Jetpack Compose for TV, AndroidX Leanback (API 30–35)
- **Scraping & Ingestion (`packages/media-scraper`, `packages/seed-cli`)**: Cheerio, Playwright, TMDB API
- **Testing**: Vitest, React Testing Library

## Architecture

This monorepo strictly follows the **Deep Modules** architecture to keep context boundaries clean and prevent tight coupling:

- **Elysia Backend**: Modules expose domain services via `src/modules/<feature>/index.ts` and HTTP plugins via colocated `http.ts`. Routes are composed through a central `createApp(deps)` factory in `src/app.ts`. Module internals (`internal/`) remain strictly private.
- **React Frontend**: Feature modules expose UI components and custom hooks via public entrypoints (`src/modules/<feature>/index.ts`). Local state (Zustand stores) and UI subcomponents stay in `internal/`. Routes under `src/routes/` serve as thin composition roots.
- **Android TV**: Features map to screen composables and view models in `src/main/java/com/privatemovie/tv/modules/<feature>/` with subcomponents in `internal/`, composed via `AppNavigation.kt`.

See [`AGENTS.md`](./AGENTS.md) for the full architecture, constraints, and platform mappings.

## Project Structure

```
├── apps/
│   ├── android-tv/    # Android TV client (Kotlin + Jetpack Compose for TV)
│   ├── backend/       # Elysia HTTP API server (auth, streaming, media, storage)
│   └── web/           # React 19 web application (Vite + TanStack Router)
├── packages/
│   ├── config-vitest/ # Shared Vitest base configurations
│   ├── contracts/     # Shared DTOs, schemas, and OpenAPI contracts
│   ├── db/            # Drizzle schema, migrations, and database client
│   ├── media-scraper/ # Cheerio and Playwright scraper utilities
│   ├── media-service/ # Media processing, S3/B2 storage, and stream resolution
│   └── seed-cli/      # Data ingestion and TMDB enrichment CLI scripts
├── docker-compose.yml # Docker deployment configuration
└── AGENTS.md          # Architecture and agent development protocol
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (`>=1.3.14 <2`)
- [PostgreSQL](https://www.postgresql.org/) (v17 recommended, or via Docker)
- [Android Studio / Android SDK](https://developer.android.com/studio) (API 30+, optional for Android TV client)

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your configuration:

```bash
cp .env.example .env
```

Key environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret key for authentication tokens
- `PORT`: Backend server port (default: `3000`)
- `CORS_ORIGIN`: Allowed origins (e.g. `http://localhost:5173`)
- `VITE_API_URL`: Backend URL for the web client (default: `http://localhost:3000`)
- `TMDB_API_KEY`: The Movie Database API Bearer token for metadata enrichment
- `S3_*`: (Optional) S3 / Backblaze B2 credentials for direct video uploads and streaming

### 3. Setup Database

Apply migrations and seed initial data:

```bash
bun run db:migrate
bun run db:seed
```

To sync episode data or enrich titles with TMDB metadata:

```bash
bun run db:fill-tmdb-ids
bun run db:sync-episodes
```

### 4. Run Development Servers

Start all applications concurrently:

```bash
bun run dev
```

Or start specific apps individually:

```bash
bun run dev:backend   # Starts Elysia backend on port 3000
bun run dev:web       # Starts Vite dev server on port 5173
```

For the Android TV app, open `apps/android-tv` in Android Studio or compile debug APK via:

```bash
cd apps/android-tv && ./gradlew assembleDebug
```

## Testing

Tests use Vitest across workspaces.

> **Note**: Never run bare `bun test` as Bun invokes its own test runner without Vitest configuration. Always run tests using the workspace-aware scripts:

```bash
# Run all unit tests across the monorepo
bun run test

# Run tests for specific workspaces
bun run test:backend
bun run test:web
bun run test:android-tv
bun run test:media-service
bun run test:media-scraper
bun run test:db
bun run test:contracts
bun run test:seed-cli

# Run backend integration tests (requires running PostgreSQL)
bun run test:integration
```

For targeted TDD test runs:

```bash
bun run test:web -- -- test/unit/<feature>/<name>.test.ts
bun run test:backend -- -- test/unit/<feature>/<name>.test.ts
```

Refer to [`AGENTS.md`](./AGENTS.md) for full testing conventions, silent mode flags, and debugging options.

## Build & Code Quality

```bash
bun run build        # Build all applications and packages
bun run typecheck    # Typecheck all TypeScript code
bun run lint         # Lint all workspaces
bun run clean        # Clean build outputs
```
