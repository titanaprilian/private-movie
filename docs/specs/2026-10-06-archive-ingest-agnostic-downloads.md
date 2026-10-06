# Spec: Provider-Agnostic Archive Ingest Downloads

**Date**: 2026-10-06
**Status**: Draft
**Author**: Agent (grill-me session)

## Problem

The archive ingest job system (`ArchiveIngestJobService`) crashes with a misleading error when downloading non-Google-Drive URLs:

```json
"errorMessage": "Google Drive confirmation download failed: HTTP 400"
```

**Root cause**: `executeJobPipeline` unconditionally checks every successful response for a Google Drive "interstitial" (HTML content-type). When a non-GDrive provider (MediaFire, Gofile, generic HTTP) returns an HTML landing/captcha page with 200 OK, the code misidentifies it as a GDrive interstitial, extracts a fake confirmation form, and POSTs to a nonsense URL → 400.

The fix is one line: gate `isInterstitial()` on the URL actually being from a Google Drive hostname.

**Secondary issue**: The frontend collects an `archiveReferer` value but never sends it to the backend. The referer header is required by some providers to accept downloads. The contracts, DB schema, and backend fetch logic all lack referer support.

## Goals

1. **Fix the crash**: Non-GDrive URLs with HTML responses must skip the GDrive interstitial logic entirely.
2. **Wire referer through the full stack**: Frontend → contracts → DB → backend fetch.
3. **Auto-default referer**: When admin doesn't provide one, auto-set to the URL's origin.
4. **Update legacy path**: `archive-ingest.ts` already sends referer but doesn't gate interstitial logic either.
5. **Test coverage**: Regression test for the bug + referer passthrough.

## Non-Goals

- Adding cookie/credential management for providers requiring session state.
- Link extraction from file-hosting landing pages (e.g., pasting a MediaFire page URL and extracting the direct download link).
- Concurrent multi-URL downloads.

## Design

### Bug Fix — Gate interstitial check on GDrive hostname

**File**: `apps/backend/src/modules/series/internal/archive-ingest-job-service.ts`

In `executeJobPipeline`, change line 471 from:
```javascript
if (GoogleDriveUrlHelper.isInterstitial(headOrInitialRes)) {
```
to:
```javascript
if (GoogleDriveUrlHelper.isGoogleDriveUrl(directUrl) && GoogleDriveUrlHelper.isInterstitial(headOrInitialRes)) {
```

Same fix in legacy `archive-ingest.ts` — search for any `isInterstitial` usage without hostname guard.

### Referer Support — Full Stack

#### 1. Contracts (`packages/contracts/src/archive-ingest-jobs.ts`)

Add `referer` field to `ArchiveIngestJobCreateRequest`:
```typescript
export interface ArchiveIngestJobCreateRequest {
  sourceUrl: string;
  seriesId?: string | null;
  storageProviderId?: string | null;
  password?: string | null;
  referer?: string | null;  // NEW
}
```

Add `referer` field to `ArchiveIngestJob` (so admin can see what was used):
```typescript
export interface ArchiveIngestJob {
  // ...existing fields
  referer: string | null;  // NEW
}
```

#### 2. DB Schema (`packages/db/src/schema/archive-ingest.ts`)

Add `referer` column:
```typescript
referer: text("referer"),
```

Migration: `ALTER TABLE "archive_ingest_jobs" ADD COLUMN "referer" text;`

#### 3. Backend Job Service (`archive-ingest-job-service.ts`)

- `submitJob`: persist `referer` from request into the job row.
- `executeJobPipeline`: include `Referer` header in fetch. Auto-default to `new URL(sourceUrl).origin` when referer is null/empty.
- `mapRowToJob`: include `referer` in the mapped response.

#### 4. Backend Legacy (`archive-ingest.ts`)

The legacy SSE preview module already sends `Referer` (line 321). Verify it also gates interstitial logic.

#### 5. Frontend API (`apps/web/src/modules/videos/internal/api.ts`)

`createArchiveIngestJob` must forward `referer`:
```javascript
body: JSON.stringify({
    sourceUrl: request.sourceUrl,
    ...(request.storageProviderId !== undefined ? { storageProviderId: request.storageProviderId } : {}),
    ...(request.password !== undefined ? { password: request.password } : {}),
    ...(request.referer !== undefined ? { referer: request.referer } : {}),  // NEW
}),
```

#### 6. Frontend Hook (`useArchiveIngestSources.ts`)

`startJob` callback must include `archiveReferer`:
```javascript
const created = await createArchiveIngestJob(seriesId, {
    sourceUrl: archiveUrl.trim(),
    storageProviderId: selectedStorageProviderId || null,
    password: archivePassword.trim() || null,
    referer: archiveReferer.trim() || null,  // NEW
});
```

#### 7. Backend HTTP Route (`series/http.ts`)

The route body schema for `POST /series/:id/archive-ingest/jobs` needs `referer`:
```typescript
body: t.Object({
    sourceUrl: t.String({ format: "uri" }),
    storageProviderId: t.Optional(t.Nullable(t.String())),
    password: t.Optional(t.Nullable(t.String())),
    referer: t.Optional(t.Nullable(t.String())),  // NEW
}),
```

## File Change Map

| File | Change |
|------|--------|
| `packages/contracts/src/archive-ingest-jobs.ts` | Add `referer` to `ArchiveIngestJobCreateRequest` and `ArchiveIngestJob` |
| `packages/db/src/schema/archive-ingest.ts` | Add `referer` column |
| `apps/backend/src/modules/series/internal/archive-ingest-job-service.ts` | Gate interstitial on GDrive hostname; persist/pass referer in submitJob + executeJobPipeline; map referer in mapRowToJob |
| `apps/backend/src/modules/series/internal/archive-ingest.ts` | Gate interstitial on GDrive hostname (legacy path) |
| `apps/backend/src/modules/series/http.ts` | Add `referer` to route body schema |
| `apps/web/src/modules/videos/internal/api.ts` | Forward `referer` in `createArchiveIngestJob` |
| `apps/web/src/modules/videos/internal/useArchiveIngestSources.ts` | Include `archiveReferer` in `startJob` call |
| `apps/backend/test/unit/series/archive-ingest-job-service.test.ts` | Add test: non-GDrive HTML response does NOT trigger interstitial logic |
| `apps/backend/test/integration/series/archive-ingest-job-service.test.ts` | Add test: referer is persisted and passed to fetch |

## Verification

1. **Unit test**: A mock fetch returning HTML with 200 OK for a non-GDrive URL must NOT enter the interstitial code path.
2. **Integration test**: Submit a job with `referer: "https://example.com"` and verify the row stores it, and the mock fetch receives it in headers.
3. **Manual smoke**: Submit a MediaFire direct download URL → job should download successfully (or fail with a meaningful error, not "Google Drive confirmation failed").
