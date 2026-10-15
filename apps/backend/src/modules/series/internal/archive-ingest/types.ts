import type {
  ArchiveIngestJob,
  ArchiveIngestJobCreateRequest,
  ArchiveIngestJobProgress,
  ArchiveIngestJobSelectionItem,
  ArchiveIngestJobStatus,
} from "@repo/contracts";
import type {
  ArchiveIngestJobRow,
  ArchiveIngestJobEntryRow,
  NewArchiveIngestJobRow,
} from "@repo/db";
import type {
  S3StorageService,
  StorageProviderRegistry,
  VideoSourceUpsertInput,
} from "@repo/media-service";
import type { ArchiveEntry, ArchiveExtractor } from "./services/extractor";

export type {
  ArchiveIngestJobRow,
  ArchiveIngestJobEntryRow,
  NewArchiveIngestJobRow,
};

/**
 * Partial column patch for updating an archive ingest job row.
 * Identity columns (`id`, `ownerId`, `sourceKey`) and `createdAt`
 * are never updatable through the repository.
 */
export type ArchiveIngestJobUpdatePatch = Partial<
  Omit<NewArchiveIngestJobRow, "id" | "ownerId" | "sourceKey" | "createdAt">
>;

/**
 * Slim projection returned when marking jobs as failed/expired:
 * everything the service layer needs to clean up staging directories
 * on the filesystem (which stays out of the repository).
 */
export interface ArchiveIngestJobStagingRef {
  id: string;
  stagingPath: string | null;
}

export type InterruptedArchiveIngestJob = ArchiveIngestJobStagingRef;
export type ExpiredArchiveIngestJob = ArchiveIngestJobStagingRef;

/**
 * Pure persistence contract for archive ingest jobs.
 * No filesystem I/O, no network calls, no orchestration —
 * staging directory cleanup stays in the service layer.
 */
export interface ArchiveIngestRepository {
  findActiveJob(
    ownerId: string,
    sourceKey: string,
  ): Promise<ArchiveIngestJob | null>;
  countActiveJobs(ownerId?: string): Promise<number>;
  createJob(input: NewArchiveIngestJobRow): Promise<ArchiveIngestJob>;
  findById(jobId: string): Promise<ArchiveIngestJob | null>;
  findFailedJob(
    ownerId: string,
    sourceKey: string,
  ): Promise<ArchiveIngestJob | null>;
  updateJob(
    jobId: string,
    patch: ArchiveIngestJobUpdatePatch,
  ): Promise<ArchiveIngestJob | null>;
  markInterruptedJobsAsFailed(): Promise<InterruptedArchiveIngestJob[]>;
  findExpiredReadyJobs(now?: Date): Promise<ArchiveIngestJob[]>;
  markJobsExpired(
    ids: string[],
    now?: Date,
  ): Promise<ExpiredArchiveIngestJob[]>;
  listJobsByOwner(ownerId: string, limit?: number): Promise<ArchiveIngestJob[]>;
  findQueuedJobs(limit: number): Promise<ArchiveIngestJob[]>;
  listActiveJobIds(): Promise<string[]>;
  listAllJobIds(): Promise<string[]>;
}

export type { ArchiveIngestJob, ArchiveIngestJobStatus };

export type ArchiveJobFetchFn = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;
/** Back-compat alias for the pre-refactor fetch hook name. */
export type ArchiveFetchFn = ArchiveJobFetchFn;
export type ArchiveJobStatfsFn = (
  path: string,
) => Promise<{ bavail: number; bsize: number }>;

export interface ArchiveIngestVideoSourceWriter {
  upsert(input: VideoSourceUpsertInput): Promise<{ id: string }>;
}

export interface ArchiveIngestJobManagerOptions {
  repository: ArchiveIngestRepository;
  stagingBaseDir: string;
  extractor?: ArchiveExtractor;
  fetchFn?: ArchiveJobFetchFn;
  statfsFn?: ArchiveJobStatfsFn;
  maxConcurrentJobs?: number;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  videoSourceRepository?: ArchiveIngestVideoSourceWriter;
}

export interface ConfirmArchiveIngestJobOptions {
  storageProviderId?: string | null;
  password?: string | null;
}

/**
 * Lifecycle contract for the archive ingest job manager.
 * Implemented by the `createArchiveIngestJobManager` factory closure in
 * `services/job.ts` (previously a class). Routes, subsystem startup, and
 * tests program against this interface.
 */
export interface ArchiveIngestJobManager {
  deriveSourceKey(url: string): string;
  extractFilename(url: string): string;
  resolveReferer(sourceUrl: string, referer?: string | null): string;
  findActiveJob(
    ownerId: string,
    sourceKey: string,
  ): Promise<ArchiveIngestJob | null>;
  countActiveJobs(ownerId?: string): Promise<number>;
  submitJob(
    ownerId: string,
    request: ArchiveIngestJobCreateRequest,
  ): Promise<ArchiveIngestJob>;
  getJob(jobId: string): Promise<ArchiveIngestJob | null>;
  toJobProgress(job: ArchiveIngestJob): ArchiveIngestJobProgress;
  listJobs(ownerId: string, limit?: number): Promise<ArchiveIngestJob[]>;
  cancelJob(jobId: string): Promise<ArchiveIngestJob | null>;
  executeJobPipeline(jobId: string, password?: string | null): Promise<void>;
  executeListingPhase(jobId: string, password?: string | null): Promise<void>;
  confirmJob(
    jobId: string,
    selection: ArchiveIngestJobSelectionItem[],
    options?: ConfirmArchiveIngestJobOptions,
  ): Promise<ArchiveIngestJob>;
  executeUploadPhase(jobId: string, password?: string | null): Promise<void>;
  processArchiveEntries(entries: ArchiveEntry[]): ArchiveIngestJobEntryRow[];
  retryJob(
    jobId: string,
    options?: { password?: string | null },
  ): Promise<ArchiveIngestJob>;
}
