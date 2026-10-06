/**
 * Canonical durable archive ingest job contracts.
 *
 * Framework-agnostic (pure TypeScript): no Drizzle, Elysia, or React imports.
 * Shared by backend persistence/polling and future frontend clients.
 */

export type ArchiveIngestJobStatus =
  | "queued"
  | "downloading"
  | "listing"
  | "ready"
  | "uploading"
  | "done"
  | "failed"
  | "cancelled"
  | "expired";

export type ArchiveIngestJobStage = ArchiveIngestJobStatus | string;

export const ARCHIVE_INGEST_ACTIVE_STATUSES: readonly ArchiveIngestJobStatus[] = [
  "queued",
  "downloading",
  "listing",
  "ready",
  "uploading",
] as const;

export interface ArchiveIngestJobEntry {
  filename: string;
  sizeBytes: number | null;
  detectedEpisodeNumber?: number | null;
  quality?: string | null;
  needsReview?: boolean;
}

export interface ArchiveIngestJobSelectionItem {
  filename: string;
  episodeId: string | null;
  label?: string | null;
  quality?: string | null;
  isIgnored?: boolean;
}

export interface ArchiveIngestJob {
  id: string;
  ownerId: string;
  seriesId: string | null;
  sourceKey: string;
  sourceUrl: string;
  status: ArchiveIngestJobStatus;
  stage: string;
  bytesDone: number;
  bytesTotal: number | null;
  stagingPath: string | null;
  archiveFilename: string | null;
  entries: ArchiveIngestJobEntry[];
  selection: ArchiveIngestJobSelectionItem[];
  storageProviderId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export interface ArchiveIngestJobCreateRequest {
  sourceUrl: string;
  seriesId?: string | null;
  storageProviderId?: string | null;
  password?: string | null;
}

export interface ArchiveIngestJobConfirmRequest {
  selection: ArchiveIngestJobSelectionItem[];
  storageProviderId?: string | null;
}

export type ArchiveIngestJobResponse = {
  data: ArchiveIngestJob;
};

export type ArchiveIngestJobListResponse = {
  data: ArchiveIngestJob[];
};
