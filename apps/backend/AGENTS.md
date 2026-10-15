# Agent Context Protocol (Elysia Backend)

This document defines the Elysia-specific rules of engagement for agents working in `apps/backend`. Read it **in addition to** the root `AGENTS.md`, which covers the generic monorepo "Deep Modules" architecture. When rules conflict, this app-specific document takes precedence within this directory.

## Deep Modules & Internal Organization

This application strictly follows the monorepo Deep Modules architecture, mapped to Elysia and Node/Bun.

### Module Boundaries & Root Cleanliness

- **Public Seam (`src/modules/<feature>/index.ts`)**: The ONLY allowed export point for inter-module consumers, background jobs, schedulers, and CLI tools. Strictly protocol-agnostic (never exports Elysia plugins, routes, or HTTP types).
- **HTTP Adapter (`src/modules/<feature>/http.ts`)**: The ONLY allowed HTTP entry point per module. Builds and exports an Elysia plugin mounting the feature's routes. Must remain a thin transport coordinator.
- **Validation & Schemas (`src/modules/<feature>/schemas.ts`)**: Extracted TypeBox request/response schemas and OpenAPI documentation metadata. Lives at the module root alongside `http.ts` to keep `http.ts` readable as a route table.
- **Internal Logic (`src/modules/<feature>/internal/`)**: All services, repositories, query builders, external clients, extractors, and utilities specific to the feature MUST reside in `internal/`.
- **Clean Module Root**: The root of `src/modules/<feature>/` MUST contain ONLY `index.ts`, `http.ts` (if an HTTP surface exists), `schemas.ts` (if schemas are extracted), and `internal/`. Placing background jobs, schedulers (`scheduler.ts`), subsystems (`archive-subsystem.ts`), or utility files at the module root is strictly forbidden — they belong inside `internal/`.
- **Strict Isolation**: A module must never import from the `internal/` directory of another module.
- **Module Data Ownership**: Each module must own its database queries and domain logic directly in its own `internal/` files. Never create artificial workspace packages (like `@repo/media-service`) that are only consumed by backend modules.

### Layered Responsibilities: Thin Adapters vs Domain Internals

Backend code is organized into three distinct layers to ensure clear separation of concerns:

1. **Transport / HTTP Adapter (`http.ts` & sub-router `routes.ts`)**:
   - **Responsibilities**: Route declaration, request validation using TypeBox schemas, calling domain services or repositories, error translation, and returning formatted responses via `successResponse` / `errorResponse`.
   - **Forbidden in `http.ts`**: Direct database queries (`db.select`, etc.), third-party `fetch()` calls, streaming data pipes, cryptographic operations, HTML parsing/regex replacements, ad-blocking heuristics, or business logic. All such logic MUST be encapsulated in domain services or infrastructure clients inside `internal/`.

2. **Domain / Service Layer (`internal/...service.ts`)**:
   - **Responsibilities**: Business logic, workflow orchestration, transaction coordination, background jobs/schedulers, domain validation, and throwing domain errors.
   - **Protocol Independence**: Services must be completely decoupled from Elysia and HTTP concepts (no `set.status`, no Elysia context, no HTTP status codes).

3. **Data Access & Infrastructure Layer (`internal/...repository.ts`, clients, extractors)**:
   - **Responsibilities**: Database access queries (Drizzle), object storage operations (S3/MinIO), external API clients, extractors (e.g. 7-Zip), and streaming/proxy utilities.
   - **Repositories**: Must focus strictly on database queries and persistence. No third-party network calls, no encryption, no workflow orchestration.

4. **Stateless Utilities (`internal/.../utils/`)**:
   - **Responsibilities**: Pure, stateless helper functions (e.g. URL parsers, regex matchers, string sanitizers, date formatters).

### Internal Organization: Consistent on the Outside, Freedom on the Inside

The public seam is fixed (`index.ts` is the single export point, `internal/` stays private), but how files are arranged *inside* `internal/` scales proportionally with module complexity. Organize internals proportionally — small modules stay flat, larger ones earn structure:

- **Tier 1 — Flat Layout (Simple CRUD, 5 or fewer files)**:
  - Keep all files directly in `src/modules/<feature>/internal/`. No subdirectories.
  - Standard naming conventions (no redundant `{feature}-` prefixes):
    - `service.ts` — Orchestration and domain logic (introduced only when business workflows or external integrations exist).
    - `repository.ts` — Database queries and persistence via Drizzle.
    - `errors.ts` — Module-specific domain error classes.
    - `types.ts` — Internal DTOs and interfaces not covered by `@repo/contracts`.
  - Rule for `http.ts` in Tier 1: Inline TypeBox schemas (`t.Object(...)`) are allowed only if `http.ts` stays under ~120 lines. Once it exceeds that, extract schemas to `schemas.ts` at the module root.

- **Tier 2 — Role-Based Grouping (6 to 12 files)**:
  - Group by technical responsibility when a flat layout becomes hard to scan:
    - `internal/services/` — Business logic orchestrators, external clients, and background schedulers.
    - `internal/repositories/` — Drizzle data access layers.
    - `internal/utils/` — Pure helper functions and parsers.
    - `internal/errors.ts` — Domain error classes.
    - `internal/types.ts` — Module-internal types and interfaces.
  - `schemas.ts` is extracted at the module root alongside `http.ts` so `http.ts` reads cleanly as a route table of contents.

- **Tier 3 — Sub-Feature Clustering (13 or more files, or multi-subsystem modules)**:
  - Group by domain sub-feature/sub-system: `internal/<sub-feature>/` (e.g. for `series`: `internal/catalog/`, `internal/archive-ingest/`; for `media`: `internal/proxy/`, `internal/embed/`, `internal/crypto/`, `internal/probe/`, `internal/scheduler/`).
  - **Sub-Router Mounting in Tier 3**:
    - Each sub-feature cluster defines its own route plugin in `internal/<sub-feature>/routes.ts`.
    - The module root `http.ts` acts as a clean, high-level coordinator (~30 lines) that `.use()` mounts each sub-router:
      ```ts
      export const mediaRoutes = (options: MediaRoutesOptions) =>
        new Elysia({ name: "media-routes" })
          .use(embedRoutes(options))
          .use(proxyRoutes(options))
          .use(probeRoutes(options))
          .use(cryptoRoutes(options));
      ```
  - **Colocation Principle**: A dedicated service, repository, utility, or sub-router used by only one sub-feature lives inside that sub-feature's cluster — never in a shared top-level folder. Only genuinely shared code earns a shared location in `internal/`.
  - **Recursive Tier 2 inside Tier 3**: When an individual sub-feature cluster itself exceeds ~10–12 files or accumulates mixed responsibilities, apply Tier 2 role grouping inside that sub-feature folder (e.g. `internal/<sub-feature>/services/`, `internal/<sub-feature>/repositories/`, `internal/<sub-feature>/utils/`).

- **Modules between Tier 2 and Tier 3 size (13–14 files)**: Use whichever layout best fits domain cohesion; do not churn directory structures for a one-file difference.

## HTTP Layer & Routing

Transport concerns live **inside** each domain module but must never leak out of it. Routes are built as Elysia plugins and composed at a single root. Follow this protocol whenever you add or modify any HTTP surface.

- **Colocated HTTP Adapters (`src/modules/<feature>/http.ts`)**: Every module that exposes an API contains an `http.ts` file that builds and exports an Elysia plugin containing only that feature's routes (or mounting sub-routers from `internal/<sub-feature>/routes.ts`). Import the feature's domain services/repositories from the module's `/internal/` directory, or accept them via the plugin's options object (e.g. `{ db }`, `{ authService }`), so the adapter stays self-contained and testable.
- **Response Helpers (`src/lib/response.ts`)**: All route handlers MUST build responses through the `successResponse` and `errorResponse` helpers. `successResponse<T>(data)` returns the success envelope `{ data: T }`. `errorResponse(set, status, error)` sets `set.status` for you and returns `{ error: { code, message } }`, deriving `code` automatically from the error class name (e.g. `EmailAlreadyRegisteredError` → `EMAIL_ALREADY_REGISTERED`). Manual `set.status` + inline `{ error: ... }` construction is forbidden in route handlers — every success and error branch must go through the helpers.
- **Never Export Adapters Through Public Barrels**: A module's `index.ts` must **never** export `http.ts`, its route builders, or their types. The module's public boundary is strictly protocol-agnostic; background jobs and CLI scripts importing the module must not gain a dependency on Elysia.
- **Composition Root (`src/app.ts`)**: All feature plugins are chained onto a single Elysia instance in `src/app.ts` through a `createApp(deps)` factory. The factory takes dependencies explicitly (e.g. `{ db, auth }`) for dependency injection and testing, applies global plugins and error handling (CORS, `.onError`, etc.) inside the factory, and exports `type App = ReturnType<typeof createApp>`. It must **never** call `.listen()`.
- **Process-Only Entry Point (`src/index.ts`)**: `src/index.ts` is strictly the process boundary. It imports `createApp` from `src/app.ts`, constructs and wires the real dependencies, reads environment variables (e.g. `PORT`), binds the server via `app.listen()`, and handles process lifecycle (e.g. startup logging). Never define routes here.

### Explicitly Forbidden

- Putting business logic, database queries, crypto operations, third-party network requests, or HTML transformations directly inside `http.ts`.
- Defining Elysia routes inside `internal/` outside of sub-feature `routes.ts` mounted by `http.ts` (e.g. `internal/health-http.ts` acting as an uncoordinated route builder is forbidden).
- Placing auxiliary files at the module root alongside `index.ts`, `http.ts`, and `schemas.ts` (e.g. `scheduler.ts`, `scheduler-config.ts`, `archive-subsystem.ts`). All internal implementations belong in `internal/`.
- Exporting a module's `http.ts` (or any HTTP adapter) from `src/modules/<feature>/index.ts`.
- Registering routes directly in `src/index.ts`, or anywhere other than a module's `http.ts` and the `app.ts` composition root.
- Calling `.listen()` anywhere except the process entry point (`src/index.ts`).
- Bypassing the `createApp` factory by composing feature plugins elsewhere. Feature `http.ts` files are imported by path (e.g. `import { authRoutes } from "./modules/authentication/http"`) only at the composition root.
## Testing

Tests live in `test/` at the app root:

- `test/unit/<feature>/<name>.test.ts` — Unit tests for services and internal logic
- `test/integration/<feature>/<name>.test.ts` — Integration tests for HTTP endpoints against the real `private_movie_test` database
- `test/utils/` — Shared test helpers (fixtures, factories, setup)
- `test/global-setup.ts` — Ensures `private_movie_test` exists, runs Drizzle migrations (runs once before all integration tests)
- `test/setup.ts` — Per-test setup: registers a global `beforeEach(truncateAll)` and installs a `Bun.password` polyfill under Node/Vitest

Use Vitest via `packages/config-vitest`. Run `turbo run test --filter=@repo/backend` for fast feedback on unit tests, `turbo run test:integration --filter=@repo/backend` for full integration tests (non-cacheable, requires a running Postgres database or CI service container), or `turbo run test` from the monorepo root to run all tests. For fast feedback on specific integration tests during development, target the file directly: `bun --filter=@repo/backend run test:integration test/integration/<feature>/<name>.test.ts` (~2–3s). Test scripts must be invoked via `bun run test` / `bun run test:integration`; bare `bun test` invokes Bun's own test runner and is not supported.

Test environment variables are loaded from a committed `.env.test` file in `apps/backend/` using `node --env-file=.env.test` in front of the Vitest invocation. This populates `NODE_ENV=test`, `DATABASE_URL`, and `JWT_SECRET` before any setup file or test runs. `test/utils/db.ts` holds a long-lived `postgres` + `drizzle` connection that is reused for the entire test process; its exported `truncateAll()` deletes from `users`, `refreshTokens`, `system`, and `videos` before each test.
