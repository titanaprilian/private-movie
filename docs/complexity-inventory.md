# Cyclomatic Complexity Baseline & Inventory

## Overview

As part of Level L3/L5 structural quality gates (Issue #993), TypeScript CI enforces cyclomatic complexity limits using ESLint's native `complexity` rule.

- **Standard Threshold**: `max: 25` across all source code in `apps/backend/src/**/*.{ts,tsx}` and `apps/web/src/**/*.{ts,tsx}`.
- **Legacy Hotspot Threshold**: `max: 50` for pre-existing legacy files that exceed 25, allowing green CI without inline disables while strictly capping debt from expanding further.
- **Enforcement Pipeline**: Verified in `turbo run lint`, `bun run verify` pre-push hooks, and GitHub Actions CI.

---

## Calibrated Legacy Inventory

### Backend (`apps/backend`)

| File Path                                                                | Function / Scope          | Cyclomatic Complexity | Calibrated Override |
| ------------------------------------------------------------------------ | ------------------------- | :-------------------: | :-----------------: |
| `src/modules/series/internal/archive-ingest/services/upload-pipeline.ts` | `executeUploadPhase`      |          48           |         50          |
| `src/modules/series/internal/archive-ingest/services/job.ts`             | `executeJobPipeline`      |          42           |         50          |
| `src/lib/errors.ts`                                                      | `getDomainErrorStatus`    |          32           |         50          |
| `src/modules/storage/http.ts`                                            | `storageHandlers` (arrow) |          27           |         50          |

### Web Frontend (`apps/web`)

| File Path                                                                        | Function / Scope            | Cyclomatic Complexity | Calibrated Override |
| -------------------------------------------------------------------------------- | --------------------------- | :-------------------: | :-----------------: |
| `src/components/media/VideoPlayer.tsx`                                           | `VideoPlayer`               |          48           |         50          |
| `src/modules/videos/internal/ingestion/bulk/hooks/useArchiveIngestSources.ts`    | `useArchiveIngestSources`   |          39           |         50          |
| `src/modules/storage/internal/components/providers/ProviderForm.tsx`             | `ProviderForm`              |          38           |         50          |
| `src/modules/videos/internal/ingestion/bulk/hooks/useBulkIngestSources.ts`       | `useBulkIngestSources`      |          31           |         50          |
| `src/modules/videos/internal/ingestion/bulk/components/archive/ArchiveStep1.tsx` | `ArchiveStep1`              |          28           |         50          |
| `src/modules/videos/internal/seasons/utils/formatEpisodeDuration.ts`             | `formatEpisodeDuration`     |          28           |         50          |
| `src/modules/watch/internal/utils/formatDuration.ts`                             | `formatDuration`            |          28           |         50          |
| `src/components/media/useVideoShortcuts.ts`                                      | `useVideoShortcuts` (arrow) |          27           |         50          |
| `src/modules/videos/internal/ingestion/bulk/components/archive/ArchiveStep3.tsx` | `ArchiveStep3`              |          27           |         50          |
| `src/modules/watch/internal/hooks/useSeriesWatchView.ts`                         | `useSeriesWatchView`        |          27           |         50          |
| `src/modules/storage/internal/components/dialogs/DeleteConfirmDialog.tsx`        | `DeleteConfirmDialog`       |          26           |         50          |

---

## Verification

- **Automated Rule Tests**:
  - `apps/backend/test/unit/rules/complexity.test.ts`
  - `apps/web/test/unit/rules/complexity.test.ts`
- **Focused Fixture Failure Test**:
  - `apps/backend/test/fixtures/complexity/high-complexity.ts`
  - `apps/web/test/fixtures/complexity/high-complexity.ts`
- **Lint Verification**:
  - `cd apps/backend && bun run lint`
  - `cd apps/web && bun run lint`
