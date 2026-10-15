# Module Refactoring Agent Prompts

This guide provides copy-paste prompts for AI agents to refactor `apps/backend` modules one-by-one into compliance with the 3-tier architecture defined in `apps/backend/AGENTS.md`.

---

## Universal Prompt Template

Copy and fill in `<MODULE_NAME>` and `<TARGET_TIER>`:

```markdown
I want you to refactor the `@apps/backend/src/modules/<MODULE_NAME>` module to strictly follow our 3-tier architecture and Deep Modules conventions documented in `apps/backend/AGENTS.md`.

### Requirements:
1. **Target Tier**: Refactor this module into **<TARGET_TIER>**.
2. **Root Cleanliness**: Ensure the module root contains ONLY:
   - `index.ts`: The public protocol-agnostic seam.
   - `http.ts`: The Elysia router adapter.
   - `schemas.ts`: Extracted TypeBox schemas and OpenAPI definitions (if extracted).
   - `internal/`: Private implementation.
   Move any stray root files (schedulers, subsystems, helpers) into `internal/`.
3. **Thin HTTP Adapter**:
   - `http.ts` must contain only routing declarations, schema validations, calls to services/repositories, and `successResponse`/`errorResponse` wrappers.
   - Forbid direct database queries, third-party `fetch` calls, streaming pipes, crypto, or HTML manipulation inside `http.ts`.
   - For Tier 3 modules: Extract sub-routers into `internal/<sub-feature>/routes.ts` and mount them in `http.ts` via `.use(...)`.
4. **File Naming & Roles**:
   - Drop redundant `{module}-` prefixes inside `internal/` (use `service.ts`, `repository.ts`, `errors.ts`, `types.ts`).
   - Group pure helper functions in `utils/`.
5. **Data Ownership**:
   - Database queries must be owned directly in `internal/repository.ts` rather than delegating to external workspace packages like `@repo/media-service`.
6. **Testing & Verification**:
   - Keep all existing unit and integration tests passing.
   - Do NOT run full-suite tests in tight loops; use targeted runs:
     `bun run test:backend -- -- test/unit/<MODULE_NAME>/<test-file>.test.ts`
   - Run integration tests if applicable:
     `bun --filter=@repo/backend run test:integration test/integration/<MODULE_NAME>/<test-file>.test.ts`

Please review `apps/backend/AGENTS.md` first, check the current module code, explain your refactoring plan, and execute it carefully while ensuring tests pass.
```

---

## Module-by-Module Pre-Filled Prompts

Below are ready-to-copy prompts tailored for each specific module in the backend.

---

### 1. Refactor `health` Module (Tier 1 — Flat Layout)

```markdown
I want you to refactor the `apps/backend/src/modules/health` module to follow the Tier 1 conventions in `apps/backend/AGENTS.md`.

### Context & Goals:
- Currently, `src/modules/health/http.ts` delegates to `src/modules/health/internal/health-http.ts`, where an Elysia router is defined inside `internal/`.
- Per `apps/backend/AGENTS.md`, defining Elysia routes inside `internal/` outside of sub-feature `routes.ts` is strictly forbidden.
- Move the Elysia route definition directly into `src/modules/health/http.ts`.
- If database connectivity check logic is kept separate, place it in `src/modules/health/internal/service.ts` or keep it minimal and inline in `http.ts` if under 50 lines.
- Remove `internal/health-http.ts`.
- Ensure `test/unit/app.test.ts` and any health-related integration tests pass:
  `bun run test:backend -- -- test/unit/app.test.ts`
```

---

### 2. Refactor `genres` Module (Tier 1 — Flat Layout)

```markdown
I want you to refactor the `apps/backend/src/modules/genres` module to follow the Tier 1 conventions in `apps/backend/AGENTS.md`.

### Context & Goals:
- The module has `internal/genres-repository.ts` and `internal/errors.ts`.
- Drop redundant prefixes: rename `internal/genres-repository.ts` to `internal/repository.ts`.
- Extract TypeBox schemas and OpenAPI definitions from `http.ts` into `schemas.ts` at the module root (`src/modules/genres/schemas.ts`) so `http.ts` stays under 100 lines as a clean routing table.
- Update `index.ts` public exports accordingly (`src/modules/genres/index.ts`).
- Verify with targeted test runs:
  `bun run test:backend -- -- test/unit/genres`
```

---

### 3. Refactor `dashboard` Module (Tier 1 — Flat Layout)

```markdown
I want you to refactor the `apps/backend/src/modules/dashboard` module to follow the Tier 1 conventions in `apps/backend/AGENTS.md`.

### Context & Goals:
- The module contains `internal/dashboard-service.ts` which executes direct SQL queries.
- Drop redundant prefixes: rename `internal/dashboard-service.ts` to `internal/service.ts` (or `internal/repository.ts` if purely Drizzle queries).
- Update imports in `http.ts` and `index.ts`.
- Verify with targeted tests:
  `bun run test:backend -- -- test/unit/dashboard`
```

---

### 4. Refactor `storage` Module (Tier 2 — Role-Based Grouping)

```markdown
I want you to refactor the `apps/backend/src/modules/storage` module to follow the Tier 2 conventions in `apps/backend/AGENTS.md`.

### Context & Goals:
- Currently, `internal/` contains `storage-service.ts`, `minio-orchestrator.ts`, and `minio-status.ts`.
- Group by technical role inside `internal/`:
  - `internal/services/` for business logic and MinIO orchestration (`storage-service.ts`, `minio-orchestrator.ts`, `minio-status.ts`).
  - `internal/repositories/` for Drizzle data queries.
  - `internal/errors.ts` for domain errors.
  - `internal/types.ts` for internal DTOs.
- Extract request validation schemas and OpenAPI definitions from `http.ts` into `src/modules/storage/schemas.ts` at the module root.
- Clean up `http.ts` so it acts as a thin routing table.
- Verify with targeted tests:
  `bun run test:backend -- -- test/unit/storage/storage-service.test.ts`
  `bun run test:backend -- -- test/unit/storage/minio-orchestrator.test.ts`
```

---

### 5. Refactor `authentication` Module (Tier 2 — Role-Based Grouping)

```markdown
I want you to refactor the `apps/backend/src/modules/authentication` module to follow the Tier 2 conventions in `apps/backend/AGENTS.md`.

### Context & Goals:
- Currently, `internal/` contains `authentication-service.ts`, `jwt.ts`, and `password.ts`.
- Group by technical role inside `internal/`:
  - `internal/services/` for `auth-service.ts`.
  - `internal/utils/` for pure crypto/token helpers (`jwt.ts`, `password.ts`).
  - `internal/repositories/` for user and refresh-token database queries (if separating repository from service).
- Extract TypeBox schemas from `http.ts` into `src/modules/authentication/schemas.ts`.
- Ensure `http.ts` remains a clean routing table under 100 lines.
- Verify with targeted tests:
  `bun run test:backend -- -- test/unit/authentication/jwt-security.test.ts`
  `bun run test:backend -- -- test/unit/authentication/verify-access-token.test.ts`
```

---

### 6. Refactor `series` Module (Tier 3 — Sub-Feature Clustering)

```markdown
I want you to refactor the `apps/backend/src/modules/series` module to follow the Tier 3 conventions in `apps/backend/AGENTS.md`.

### Context & Goals:
- Current problems:
  - `archive-subsystem.ts` sits at the module root outside `internal/`.
  - `http.ts` is 656 lines long, mixing catalog CRUD, TMDB preview/import, seasons creation, and archive ingest jobs.
  - Sibling sub-systems are mashed together in `internal/` (`archive-ingest-job-service.ts`, `google-drive-url.ts`, `seven-zip-extractor.ts`, `archive-ingest.ts`).
- Target Structure:
  - Cluster into sub-features:
    - `internal/catalog/`: Series metadata CRUD, home feed, repository queries. Sub-router in `catalog/routes.ts`.
    - `internal/tmdb/`: TMDB preview, sync, and import. Sub-router in `tmdb/routes.ts`.
    - `internal/archive-ingest/`: Archive jobs, 7-Zip extractor, Google Drive URL parser in `utils/`, job service, archive subsystem. Sub-router in `archive-ingest/routes.ts`.
  - Root `http.ts` becomes a clean ~35-line coordinator that mounts each sub-router via `.use()`.
  - Move `archive-subsystem.ts` into `internal/archive-ingest/` and re-export via `index.ts`.
  - Extract TypeBox schemas to `schemas.ts` at module root.
  - Own series Drizzle queries directly in `internal/catalog/repository.ts` rather than importing repository factories from `@repo/media-service`.
- Verify with targeted test runs:
  `bun run test:backend -- -- test/unit/series/repository.test.ts`
  `bun run test:backend -- -- test/unit/series/archive-subsystem.test.ts`
  `bun run test:backend -- -- test/unit/series/seven-zip-extractor.test.ts`
  `bun run test:backend -- -- test/unit/series/archive-ingest-resilience.test.ts`
  `bun run test:backend -- -- test/unit/series/google-drive-helper.test.ts`
```

---

### 7. Refactor `media` Module (Tier 3 — Sub-Feature Clustering)

```markdown
I want you to refactor the `apps/backend/src/modules/media` module to follow the Tier 3 conventions in `apps/backend/AGENTS.md`.

### Context & Goals:
- Current problems:
  - `scheduler.ts` and `scheduler-config.ts` sit at the module root outside `internal/`.
  - `http.ts` is an 800-line god file containing raw WebCrypto operations, reverse streaming proxies, relay proxies, HTML sanitization, and source reachability checks.
- Target Structure:
  - Sub-feature clusters in `internal/`:
    - `internal/embed/`: Server-rendered embed document, player asset proxy, ad-stripping utils. Sub-router in `embed/routes.ts`.
    - `internal/proxy/`: Reverse streaming proxy and relay logic with header sanitization. Sub-router in `proxy/routes.ts`.
    - `internal/crypto/`: WebCrypto subtle operations (AES-CBC, HMAC, digest, verify). Sub-router in `crypto/routes.ts`.
    - `internal/probe/`: Video source check (HEAD/GET fallback). Sub-router in `probe/routes.ts`.
    - `internal/scheduler/`: Background scheduler and config moved from module root. Re-exported via `index.ts`.
  - Extract pure string/HTML helpers into `internal/embed/utils/` or `internal/proxy/utils/`.
  - Root `http.ts` shrinks to a ~30-line coordinator chaining sub-routers with `.use()`.
  - Extract TypeBox schemas to `schemas.ts` at module root.
- Verify with targeted test runs:
  `bun run test:backend -- -- test/unit/media/scheduler.test.ts`
  `bun run test:backend -- -- test/unit/media/ad-suppression.test.ts`
  `bun run test:backend -- -- test/unit/media/proxy-base-href.test.ts`
  `bun run test:backend -- -- test/unit/media/relay-referer.test.ts`
```

---

### 8. Refactor `episodes` Module (Tier 3 — Sub-Feature Clustering)

```markdown
I want you to refactor the `apps/backend/src/modules/episodes` module to follow the Tier 3 conventions in `apps/backend/AGENTS.md`.

### Context & Goals:
- Currently, `internal/` mixes ingest orchestration, archive extraction, matching, and staging in a flat directory (`archive-extractor.ts`, `archive-matcher.ts`, `archive-staging.ts`, `ingest-service.ts`).
- Organize into sub-features:
  - `internal/catalog/`: Episode CRUD, ordering, repository queries. Sub-router in `catalog/routes.ts`.
  - `internal/ingest/`: Archive extraction, staging, matching, and ingest service. Sub-router in `ingest/routes.ts`.
- Move pure matching/extractor helpers into `utils/`.
- Own episode Drizzle queries directly in `internal/catalog/repository.ts` instead of importing from `@repo/media-service`.
- Top-level `http.ts` mounts sub-routers via `.use()`.
- Extract TypeBox schemas to `schemas.ts` at module root.
- Verify with targeted tests:
  `bun run test:backend -- -- test/unit/episodes/repository.test.ts`
  `bun run test:backend -- -- test/unit/episodes/archive-extractor.test.ts`
  `bun run test:backend -- -- test/unit/episodes/archive-matcher.test.ts`
  `bun run test:backend -- -- test/unit/episodes/archive-staging.test.ts`
  `bun run test:backend -- -- test/unit/episodes/preview-scrape.test.ts`
```
