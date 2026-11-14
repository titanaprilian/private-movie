# Architecture Decision Log (ADR): PostgreSQL Schema Design & Drizzle ORM

> **Document Purpose**: Architectural reference and defense guidance for technical interviews, detailing the rationale for selecting **Drizzle ORM over Prisma/TypeORM/Kysely**, multi-tier relational catalog design, atomic transaction coordination, and database migration governance in `@repo/db` and `apps/backend/`.

---

## 1. Executive Summary & Narrative Anchor

When asked in an interview: _"How did you approach your database schema design, and why did you choose Drizzle ORM?"_, your primary narrative should bridge **prior production experience with real-world operational realities**:

> _"In past projects, I relied on **Kysely** because I prefer a SQL-first philosophy with zero runtime engine bloat over heavy ORMs like Prisma or TypeORM. When starting this project, **Drizzle ORM** was the natural evolution: it provides the exact same lightweight, zero-overhead execution as Kysely, but adds a crucial developer velocity upgrade: single-source-of-truth schema definitions in TypeScript that automatically infer types and generate raw PostgreSQL `.sql` migrations._
>
> _Architecturally, we designed a normalized 4-tier media catalog (`series` → `seasons` → `episodes` → `video_sources`). A critical design decision was **strictly decoupling canonical catalog metadata from volatile third-party streaming links**: TMDB acts as our stable catalog backbone, while video sources are scraped and resolved lazily._
>
> _To guarantee data consistency, multi-table ingestions are wrapped in atomic Drizzle transactions with explicit transaction handles passed down to repository factories, completely preventing orphaned records. Finally, after an early tooling mistake where an unversioned `db:push` caused catalog data loss, we established strict migration governance: direct schema pushes are permanently banned, all schema changes generate inspectable `.sql` files, and automated `pg_dump` snapshots run before any migration is applied."_

---

## 2. Decision Matrix: Drizzle vs. Alternatives

| Architectural Dimension         | Drizzle ORM (Chosen)                                                            | Kysely (Prior Background)                                          | Prisma                                                                      | TypeORM                                                                 |
| :------------------------------ | :------------------------------------------------------------------------------ | :----------------------------------------------------------------- | :-------------------------------------------------------------------------- | :---------------------------------------------------------------------- |
| **Runtime Overhead / Engine**   | **Zero runtime engine** (Thin TS wrapper compiling directly to SQL strings)     | **Zero runtime engine** (Pure TypeScript query builder)            | **Heavy Rust binary engine** (~30–60MB RSS per process + IPC latency)       | High (V8 reflection metadata + class instance mapping)                  |
| **VPS Memory Impact (2GB RAM)** | **Negligible** (Leaves maximum memory for Postgres buffer pools & Chromium)     | **Negligible**                                                     | **Severe** (Extra binary background process competing for RAM)              | Moderate to High (Decorator heap bloat)                                 |
| **Schema & Migrations**         | **Unified TS schema** (`pgTable`) generating raw, inspectable `.sql` migrations | Manual SQL migration files; TS types must be maintained separately | Proprietary `.prisma` DSL generating opaque migration scripts               | Decorator-based class entities generating migration files               |
| **Type Safety & Inference**     | **Automatic compile-time inference** (`$inferSelect`, `$inferInsert`)           | Strong query-level typing; manual table interface definitions      | Generated TS client (Requires running `prisma generate` codegen step)       | Clunky class typing; decorator reflection metadata (`reflect-metadata`) |
| **SQL Transparency**            | **SQL-first**: What you write maps 1:1 to SQL without hidden joins              | **SQL-first**: Direct mapping to SQL queries                       | Opaque query generation; nested includes can trigger N+1 or complex queries | ActiveRecord/DataMapper abstractions hiding underlying SQL execution    |
| **Transaction Ergonomics**      | Simple closure `db.transaction(async (tx) => ...)` with typed `tx` client       | Clean `db.transaction().execute(async (trx) => ...)`               | Interactive transactions require engine connection management               | Complex entity manager / query runner transaction management            |

---

## 3. Deep Dive: The Core Defense Pillars

### Pillar 1: Zero-Engine Footprint & The Kysely Evolution

#### The Reality:

- The backend runs on a **2GB RAM VPS** shared with PostgreSQL, MinIO, Caddy, and a headless Chromium scraper instance.
- Prior experience built deep familiarity with **Kysely**, appreciating its raw SQL transparency and zero-overhead performance.

#### The Architecture Tradeoff:

- **The Prisma Problem**: Prisma runs a separate, pre-compiled Rust query engine binary that handles query planning and execution via an internal IPC socket. On a constrained 2GB node, Prisma consumes 30MB–60MB of RAM just for the engine binary, slows down cold boot times, and locks schema definitions inside a proprietary `.prisma` domain-specific language.
- **The TypeORM Problem**: TypeORM relies heavily on experimental decorators and `reflect-metadata`. It brings the exact same runtime reflection debt and unpredictable initialization state that we rejected when passing on NestJS.
- **The Drizzle Sweet Spot**: Drizzle preserves the exact qualities that made Kysely great—raw SQL feel, zero binary dependencies, and near-zero memory footprint—while solving Kysely's main pain point: **single source of truth**. In `packages/db/src/schema/`, we declare tables once in TypeScript (`pgTable`), and Drizzle handles both static type inference and automated `.sql` migration file generation.

---

### Pillar 2: 4-Tier Normalized Media Schema & Decoupled Ingestion

#### The Schema Architecture:

The catalog models media as a normalized 4-tier relational hierarchy (`packages/db/src/schema/media.ts`):

```
series (id [PK], tmdb_id [Unique], title, type, poster_url, backdrop_url, tmdb_sync_status)
  │
  └── seasons (id [PK], series_id [FK->series.id], season_number, status, scraper_url)
        │     ↳ Composite Unique: (series_id, season_number)
        │
        └── episodes (id [PK], season_id [FK->seasons.id], order, title, air_date, tmdb_episode_number)
              │     ↳ Composite Unique: (season_id, order)
              │
              └── video_sources (id [PK], episode_id [FK->episodes.id], type, url, quality, storage_provider_id)
                    ↳ Composite Unique: (episode_id, url)
                    ↳ FK: storage_provider_id -> storage_providers.id (onDelete: "restrict")
```

#### Key Relational Invariants:

1. **Decoupling Canonical Metadata from Volatile Streaming Links**:
   - **The Fragility of Direct Scraping**: Scraping anime or drama sites directly into a flat structure makes catalog stability hostage to external websites. If an external site changes URL patterns or goes offline, the catalog breaks.
   - **The Decoupled Model**: TMDB provides the stable, canonical metadata backbone (`series` → `seasons` → `episodes`). Streaming sources (`video_sources`) are ingested lazily and independently from providers like Otakudesu or S3/MinIO buckets. If a streaming host deletes an asset or bans an IP, our core catalog, episode hierarchy, and watch progress remain completely intact.
2. **Composite Unique Constraints for Ordering Integrity**:
   - A show cannot have duplicate season numbers: `unique("seasons_series_id_season_number_unique").on(table.seriesId, table.seasonNumber)`.
   - A season cannot have duplicate episode orders: `unique("episodes_season_id_order_unique").on(table.seasonId, table.order)`.
   - An episode cannot register duplicate stream URLs: `unique("video_sources_episode_id_url_unique").on(table.episodeId, table.url)`.
3. **Targeted Referential Integrity (`cascade` vs. `restrict`)**:
   - Deleting a `series` cascades cleanly down through `seasons`, `episodes`, and join tables (`series_to_genres`).
   - But `video_sources.storage_provider_id` references `storage_providers` with **`onDelete: "restrict"`**. PostgreSQL physically forbids deleting an S3/MinIO bucket provider if video assets still rely on it, preventing accidental silent playback blackouts.

---

### Pillar 3: Multi-Table Ingestion & Atomic Transactions

#### The Reality:

- Syncing a series with its seasons, episodes, and stream sources is an all-or-nothing operation spanning four relational tables. External scrapers, S3 uploads, or TMDB API calls can fail or time out midway.

#### The Transaction Pattern:

Multi-step writes are wrapped in Drizzle transactions (`db.transaction(async (tx) => ...)`):

```ts
await db.transaction(async (tx) => {
  // Repositories accept the transactional client `tx` explicitly
  const seriesRepo = createSeriesRepository(tx);
  const seasonsRepo = createSeasonsRepository(tx);
  const episodeRepo = createEpisodeRepository(tx);

  const series = await seriesRepo.upsertSeries(seriesInput);
  const season = await seasonsRepo.upsertSeason(series.id, seasonInput);
  await episodeRepo.insertEpisodes(season.id, episodesInput);
});
```

#### Why This Matters (Preventing Transaction Leakage):

- In many Node/Bun codebases, developers write `db.transaction(...)` but accidentally call repository methods bound to the global connection pool. The queries run outside the transaction, and if a failure occurs, the rollback fails silently.
- In our codebase, all repository factories accept a unified `DbOrTx` handle (`PostgresJsDatabase | PgTransaction`). Queries execute strictly within the scoped transaction `tx`.
- **Zero Orphaned Records**: If stream asset registration fails on episode 12 of a 24-episode season, PostgreSQL rolls back the entire batch. The catalog never suffers from "ghost" series or empty, unplayable seasons.

---

### Pillar 4: Database Migration Governance & Post-Mortem Guardrails

#### The Incident (The 48-Hour Data Loss War Story):

- Early in development, continuous ingestion scraped an anime catalog directly into the database over 48 hours of non-stop VPS execution.
- Shortly after ingestion completed, an automated AI agent tooling run executed an unversioned schema sync command (`db:push`).
- Because the schema had diverged slightly, `db:push` dropped the existing tables without prompting, **instantly wiping two days of scraped production data**.

#### The Operational Guardrails Enforced:

That failure resulted in permanent governance protocols codified in the repository rules (`AGENTS.md`):

1. **Permanent Ban on Direct Schema Pushes**:
   - Commands like `turbo run db:push`, `bun run db:push`, or direct unversioned DDL are strictly forbidden in both development and production.
2. **Inspectable, Versioned SQL Migrations**:
   - Schema modifications in `packages/db/src/schema/` must only generate `.sql` migration files via `bun run db:generate`.
   - Generated SQL in `packages/db/drizzle/*.sql` must be manually reviewed by a human for destructive operations (`DROP TABLE`, `DROP COLUMN`, `ALTER TYPE`) before application.
3. **Mandatory Pre-Migration Database Snapshots**:
   - Automated deployment runbooks require running a `pg_dump` snapshot (`docker compose exec db pg_dump ... > backup.sql`) before applying any migration to remote staging or VPS environments.

---

## 4. Quick Interview Q&A Script (Cheat Sheet)

### Q: "Why did you choose Drizzle over Prisma or TypeORM?"

> **Answer**: "In past projects, I used Kysely because I value raw SQL transparency and zero runtime overhead. Prisma runs a separate Rust query engine binary that consumes 30–60MB of RAM per process—which is non-viable on our 2GB VPS co-located with Postgres, MinIO, and Chromium. TypeORM brings decorator reflection bloat (`reflect-metadata`).
> Drizzle was the natural evolution: it provides the exact same lightweight, SQL-first feel as Kysely, but with a major DX upgrade: a single TypeScript schema definition that automatically infers static types (`$inferSelect`) and generates pure PostgreSQL `.sql` migration files."

### Q: "How did you structure the schema to handle volatile third-party scraping?"

> **Answer**: "We modeled a normalized 4-tier hierarchy: `series` → `seasons` → `episodes` → `video_sources`.
> The key architectural decision was decoupling stable catalog metadata from ephemeral streaming links: TMDB provides the canonical metadata backbone, while video sources from third-party scrapers (like Otakudesu) or S3 storage are attached lazily. If an external streaming provider changes URL structures or goes offline, our core catalog structure, episode list, and user watch progress remain completely intact."

### Q: "Tell me about a database mistake you made and what you learned from it."

> **Answer**: "Early in development, I ran a 48-hour continuous ingestion job scraping video sources directly into the database. An automated tooling script then executed an unversioned `db:push`, which silently dropped tables and wiped the entire dataset.
> That failure taught me two permanent architectural lessons:
>
> 1. Decouple metadata ingestion from volatile stream scraping so data can always be reconstructed independently.
> 2. Enforce strict migration governance: direct schema pushes are permanently banned, all changes generate inspectable `.sql` migrations with human review, and deployment runbooks require an automated `pg_dump` snapshot before any migration runs."

### Q: "How do you handle multi-table consistency and transactions?"

> **Answer**: "Syncing a media title spans four relational tables: `series`, `seasons`, `episodes`, and `video_sources`. We wrap the ingestion pipeline in a Drizzle `db.transaction(async (tx) => ...)`.
> To prevent transaction leakage, our repository factories accept a unified `DbOrTx` handle, ensuring all writes execute strictly on the transactional client. If an external API blips or an S3 storage pointer fails midway through, PostgreSQL rolls back the entire transaction, guaranteeing we never leave orphaned records or broken empty seasons in our catalog."
