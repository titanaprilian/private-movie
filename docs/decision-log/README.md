# Architecture Decision Records (ADRs)

This directory maintains Architecture Decision Records (ADRs) documenting critical technology selections, structural patterns, and architectural trade-offs across the Private Movie platform.

## Decision Index

| Record                                         | Title                                                                              | Scope                                 | Status   | Date       |
| :--------------------------------------------- | :--------------------------------------------------------------------------------- | :------------------------------------ | :------- | :--------- |
| [ADR 01](01-bun-and-elysia.md)                 | [Backend Runtime & Framework: Bun + Elysia](01-bun-and-elysia.md)                  | `apps/backend`                        | Accepted | 2026-11-14 |
| [ADR 02](02-drizzle-and-postgresql.md)         | [PostgreSQL Schema Design & Drizzle ORM](02-drizzle-and-postgresql.md)             | `@repo/db`, `apps/backend`            | Accepted | 2026-11-14 |
| [ADR 03](03-media-ingestion-and-s3-storage.md) | [Media Ingestion & S3/B2 Storage Resolution](03-media-ingestion-and-s3-storage.md) | `@repo/media-service`, `apps/backend` | Accepted | 2026-11-14 |

---

## Decision Summaries

### [ADR 01: Backend Runtime & Framework (Bun + Elysia)](01-bun-and-elysia.md)

Details the selection of Bun + Elysia over Node.js + Express / NestJS. Key architectural drivers: predictable ~120MB RSS memory footprint on a 2GB VPS, native Web Streams (`fetch`, `ReadableStream`) for zero-adapter video segment relaying, and end-to-end type safety with Eden Treaty.

### [ADR 02: PostgreSQL Schema Design & Drizzle ORM](02-drizzle-and-postgresql.md)

Details the selection of Drizzle ORM over Prisma / TypeORM / Kysely. Key architectural drivers: single-source TypeScript schema definitions with raw SQL migrations, 4-tier normalized catalog (`series` → `seasons` → `episodes` → `video_sources`), strict decoupling of canonical metadata from volatile streaming sources, and zero-tolerance database migration governance.

### [ADR 03: Media Ingestion & S3/B2 Storage Resolution](03-media-ingestion-and-s3-storage.md)

Details zero-byte server playback delivery and multi-provider storage abstraction (S3 / Backblaze B2 / MinIO). Key architectural drivers: control-plane vs data-plane separation offloading video streaming bandwidth to object storage, sequential extract-stream-and-delete state machine for storage-safe archive ingestion on a 25GB SSD, and AES-256-GCM encryption for storage credentials.
