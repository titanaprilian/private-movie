import type {
  ArchiveIngestJob,
  ArchiveIngestJobStatus,
} from "@repo/contracts";
import type {
  ArchiveIngestJobRow,
  NewArchiveIngestJobRow,
} from "@repo/db";

export type { ArchiveIngestJobRow, NewArchiveIngestJobRow };

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
  findActiveJob(ownerId: string, sourceKey: string): Promise<ArchiveIngestJob | null>;
  countActiveJobs(ownerId?: string): Promise<number>;
  createJob(input: NewArchiveIngestJobRow): Promise<ArchiveIngestJob>;
  findById(jobId: string): Promise<ArchiveIngestJob | null>;
  findFailedJob(ownerId: string, sourceKey: string): Promise<ArchiveIngestJob | null>;
  updateJob(
    jobId: string,
    patch: ArchiveIngestJobUpdatePatch
  ): Promise<ArchiveIngestJob | null>;
  markInterruptedJobsAsFailed(): Promise<InterruptedArchiveIngestJob[]>;
  findExpiredReadyJobs(now?: Date): Promise<ArchiveIngestJob[]>;
  markJobsExpired(ids: string[], now?: Date): Promise<ExpiredArchiveIngestJob[]>;
  listJobsByOwner(ownerId: string, limit?: number): Promise<ArchiveIngestJob[]>;
  findQueuedJobs(limit: number): Promise<ArchiveIngestJob[]>;
  listActiveJobIds(): Promise<string[]>;
}

export type { ArchiveIngestJob, ArchiveIngestJobStatus };
