import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat, statfs, unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { eq, and, inArray, desc, sql, lte, isNotNull } from "drizzle-orm";
import {
  type DbClient,
  archiveIngestJobs,
  type ArchiveIngestJobEntryRow,
  type ArchiveIngestJobRow,
  type ArchiveIngestJobSelectionRow,
  type NewArchiveIngestJobRow,
} from "@repo/db";
import type {
  ArchiveIngestJob,
  ArchiveIngestJobCreateRequest,
  ArchiveIngestJobEntry,
  ArchiveIngestJobSelectionItem,
  ArchiveIngestJobStatus,
} from "@repo/contracts";
import { ARCHIVE_INGEST_ACTIVE_STATUSES } from "@repo/contracts";
import {
  SevenZipExtractor,
  type ArchiveEntry,
  type ArchiveExtractor,
  ArchiveEngineError,
} from "./seven-zip-extractor";
import {
  detectEpisodeNumber,
  detectQuality,
  isVideoFile,
  isSampleFile,
} from "../../episodes";
import { GoogleDriveUrlHelper } from "./google-drive-url";
import { logger } from "../../../lib/logger";
import { captureException } from "../../../lib/sentry";
import {
  createStorageProviderRegistry,
  createVideoSourceRepositoryInternal,
  S3NotConfiguredError,
  type S3StorageService,
  type StorageProviderRegistry,
} from "@repo/media-service";

export const MAX_CONCURRENT_JOBS_DEFAULT = 2;
export const ARCHIVE_DISK_PREFLIGHT_FACTOR = 2.5;
export const SIBLING_SIZE_DISPARITY_THRESHOLD = 0.5; // Flag if size differs by >50% from median

export type ArchiveJobFetchFn = (url: string, init?: RequestInit) => Promise<Response>;
export type ArchiveJobStatfsFn = (path: string) => Promise<{ bavail: number; bsize: number }>;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function mapRowToJob(row: ArchiveIngestJobRow): ArchiveIngestJob {
  return {
    id: row.id,
    ownerId: row.ownerId,
    seriesId: row.seriesId,
    sourceKey: row.sourceKey,
    sourceUrl: row.sourceUrl,
    status: row.status as ArchiveIngestJobStatus,
    stage: row.stage,
    bytesDone: row.bytesDone,
    bytesTotal: row.bytesTotal,
    stagingPath: row.stagingPath,
    archiveFilename: row.archiveFilename,
    entries: (row.entries ?? []) as ArchiveIngestJobEntry[],
    selection: row.selection ?? [],
    storageProviderId: row.storageProviderId,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    expiresAt: row.expiresAt
      ? row.expiresAt instanceof Date
        ? row.expiresAt.toISOString()
        : String(row.expiresAt)
      : null,
  };
}

export interface ArchiveIngestJobServiceOptions {
  db: DbClient;
  stagingBaseDir: string;
  extractor?: ArchiveExtractor;
  fetchFn?: ArchiveJobFetchFn;
  statfsFn?: ArchiveJobStatfsFn;
  maxConcurrentJobs?: number;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
}

export interface ConfirmArchiveIngestJobOptions {
  storageProviderId?: string | null;
  password?: string | null;
}

function sanitizeS3Filename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? raw;
  const cleaned = base.replace(/[^a-zA-Z0-9_.\-()[\] ]/g, "_");
  return cleaned.length > 0 ? cleaned : "video.mp4";
}

export class ArchiveIngestJobService {
  private db: DbClient;
  private stagingBaseDir: string;
  private extractor: ArchiveExtractor;
  private fetchFn: ArchiveJobFetchFn;
  private statfsFn: ArchiveJobStatfsFn;
  private maxConcurrentJobs: number;
  private s3StorageService?: S3StorageService;
  private storageProviderRegistry: StorageProviderRegistry;
  private activeControllers = new Map<string, AbortController>();

  constructor(options: ArchiveIngestJobServiceOptions) {
    this.db = options.db;
    this.stagingBaseDir = options.stagingBaseDir;
    this.extractor = options.extractor ?? new SevenZipExtractor();
    this.fetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));
    this.statfsFn =
      options.statfsFn ??
      (async (path) => {
        const s = await statfs(path);
        return { bavail: Number(s.bavail), bsize: Number(s.bsize) };
      });
    this.maxConcurrentJobs = options.maxConcurrentJobs ?? MAX_CONCURRENT_JOBS_DEFAULT;
    this.s3StorageService = options.s3StorageService;
    // Always resolve uploads through the database-backed provider registry so
    // the active default provider (e.g. IDrive) is used when no explicit
    // provider is requested. Auto-instantiate from the db connection when the
    // caller did not supply one (e.g. legacy constructions that only pass an
    // environment-based S3 service).
    this.storageProviderRegistry =
      options.storageProviderRegistry ??
      createStorageProviderRegistry(this.db, this.s3StorageService);
  }

  public deriveSourceKey(url: string): string {
    const gdRef = GoogleDriveUrlHelper.parseSource(url);
    if (gdRef) return `gdrive:${gdRef.fileId}`;
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return url;
    }
  }

  public extractFilename(url: string): string {
    try {
      const parsed = new URL(url);
      const segments = parsed.pathname.split("/").filter(Boolean);
      const last = segments[segments.length - 1];
      if (last) {
        return decodeURIComponent(last);
      }
    } catch {
      // Fallback below
    }
    return "archive.zip";
  }

  async findActiveJob(ownerId: string, sourceKey: string): Promise<ArchiveIngestJob | null> {
    const rows = await this.db
      .select()
      .from(archiveIngestJobs)
      .where(
        and(
          eq(archiveIngestJobs.ownerId, ownerId),
          eq(archiveIngestJobs.sourceKey, sourceKey),
          inArray(archiveIngestJobs.status, [...ARCHIVE_INGEST_ACTIVE_STATUSES])
        )
      )
      .limit(1);

    return rows[0] ? mapRowToJob(rows[0]) : null;
  }

  async countActiveJobs(ownerId?: string): Promise<number> {
    const activeStatuses: ArchiveIngestJobStatus[] = ["downloading", "listing", "uploading"];
    const condition = ownerId
      ? and(
          eq(archiveIngestJobs.ownerId, ownerId),
          inArray(archiveIngestJobs.status, activeStatuses)
        )
      : inArray(archiveIngestJobs.status, activeStatuses);

    const rows = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(archiveIngestJobs)
      .where(condition);

    return Number(rows[0]?.count ?? 0);
  }

  async submitJob(
    ownerId: string,
    request: ArchiveIngestJobCreateRequest
  ): Promise<ArchiveIngestJob> {
    const sourceKey = this.deriveSourceKey(request.sourceUrl);

    // 1. Idempotency check: active/ready job for (owner_id, source_key)
    const existing = await this.findActiveJob(ownerId, sourceKey);
    if (existing) {
      logger.info({ jobId: existing.id, ownerId, sourceKey }, "Returning existing active job");
      return existing;
    }

    // 1b. Smart staging reuse: a previous *failed* job for the same source
    // whose downloaded archive is still intact on disk is recovered instead
    // of re-downloading gigabytes of data (already-listed -> ready,
    // downloaded-but-unlisted -> resume at listing).
    const recoverable = await this.findRecoverableFailedJob(ownerId, sourceKey);
    if (recoverable && (await this.hasArchiveOnDisk(recoverable))) {
      logger.info(
        { jobId: recoverable.id, ownerId, sourceKey },
        "Recovering failed job with intact staging archive"
      );
      return await this.recoverFailedJob(recoverable, request.password);
    }

    // 2. Concurrency limit check
    const activeCount = await this.countActiveJobs();
    const shouldQueue = activeCount >= this.maxConcurrentJobs;
    const initialStatus: ArchiveIngestJobStatus = shouldQueue ? "queued" : "downloading";

    const jobId = randomUUID();
    const stagingPath = join(this.stagingBaseDir, jobId);
    const archiveFilename = this.extractFilename(request.sourceUrl);

    const newJob: NewArchiveIngestJobRow = {
      id: jobId,
      ownerId,
      seriesId: request.seriesId ?? null,
      sourceKey,
      sourceUrl: request.sourceUrl,
      status: initialStatus,
      stage: initialStatus,
      bytesDone: 0,
      bytesTotal: null,
      stagingPath,
      archiveFilename,
      entries: [],
      selection: [],
      storageProviderId: request.storageProviderId ?? null,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: null,
    };

    try {
      await this.db.insert(archiveIngestJobs).values(newJob);
    } catch (err) {
      // Race condition safety: if duplicate insert violated unique index, retrieve existing
      const duplicate = await this.findActiveJob(ownerId, sourceKey);
      if (duplicate) return duplicate;
      throw err;
    }

    const created = await this.getJob(jobId);
    if (!created) {
      throw new Error(`Failed to retrieve newly created job ${jobId}`);
    }

    if (initialStatus === "downloading") {
      // Start background processing pipeline
      void this.executeJobPipeline(jobId, request.password).catch((err) => {
        captureException(err);
        logger.error({ err, jobId }, "Unexpected error in background job execution");
      });
    }

    return created;
  }

  /**
   * Most recent `failed` job for (ownerId, sourceKey), if any. Failed
   * upload-phase jobs keep their staging archive on disk, so they are
   * candidates for recovery without re-downloading (see `recoverFailedJob`).
   * Download-phase failures already wipe staging via `failJob`, as do boot
   * reconciliation, cancellation, and expiration — their archives are never
   * intact, so `hasArchiveOnDisk` filters them out below.
   */
  private async findRecoverableFailedJob(
    ownerId: string,
    sourceKey: string
  ): Promise<ArchiveIngestJob | null> {
    const rows = await this.db
      .select()
      .from(archiveIngestJobs)
      .where(
        and(
          eq(archiveIngestJobs.ownerId, ownerId),
          eq(archiveIngestJobs.sourceKey, sourceKey),
          eq(archiveIngestJobs.status, "failed")
        )
      )
      .orderBy(desc(archiveIngestJobs.updatedAt))
      .limit(1);

    return rows[0] ? mapRowToJob(rows[0]) : null;
  }

  private async hasArchiveOnDisk(job: ArchiveIngestJob): Promise<boolean> {
    if (!job.stagingPath || !job.archiveFilename) return false;
    try {
      await stat(join(job.stagingPath, job.archiveFilename));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Recover a failed job whose archive is still intact in staging:
   * - entries already parsed  -> reset to `ready` (errors cleared) and return
   *   immediately; the user can review + confirm without any download/listing.
   * - downloaded but unlisted -> clear errors, move to `listing`, and resume
   *   the pipeline from the listing stage in the background.
   */
  private async recoverFailedJob(
    job: ArchiveIngestJob,
    password?: string | null
  ): Promise<ArchiveIngestJob> {
    if ((job.entries?.length ?? 0) > 0) {
      await this.db
        .update(archiveIngestJobs)
        .set({
          status: "ready",
          stage: "ready",
          errorCode: null,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(archiveIngestJobs.id, job.id));
      const recovered = await this.getJob(job.id);
      if (!recovered) throw new Error(`Job ${job.id} not found after recovery`);
      return recovered;
    }

    await this.db
      .update(archiveIngestJobs)
      .set({
        status: "listing",
        stage: "listing",
        errorCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(archiveIngestJobs.id, job.id));

    void this.executeListingPhase(job.id, password ?? null).catch((err) => {
      captureException(err);
      logger.error({ err, jobId: job.id }, "Unexpected error in resumed listing execution");
    });

    const resumed = await this.getJob(job.id);
    if (!resumed) throw new Error(`Job ${job.id} not found after recovery`);
    return resumed;
  }

  async getJob(jobId: string): Promise<ArchiveIngestJob | null> {
    const rows = await this.db
      .select()
      .from(archiveIngestJobs)
      .where(eq(archiveIngestJobs.id, jobId))
      .limit(1);

    return rows[0] ? mapRowToJob(rows[0]) : null;
  }

  async listJobs(ownerId: string, limit = 50): Promise<ArchiveIngestJob[]> {
    const rows = await this.db
      .select()
      .from(archiveIngestJobs)
      .where(eq(archiveIngestJobs.ownerId, ownerId))
      .orderBy(desc(archiveIngestJobs.createdAt))
      .limit(limit);

    return rows.map(mapRowToJob);
  }

  async cancelJob(jobId: string): Promise<ArchiveIngestJob | null> {
    const job = await this.getJob(jobId);
    if (!job) return null;

    if (
      job.status === "cancelled" ||
      job.status === "done" ||
      job.status === "failed" ||
      job.status === "expired"
    ) {
      return job;
    }

    // Abort active execution
    const controller = this.activeControllers.get(jobId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(jobId);
    }

    // Update status to cancelled
    await this.db
      .update(archiveIngestJobs)
      .set({
        status: "cancelled",
        stage: "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(archiveIngestJobs.id, jobId));

    // Clean up staging directory
    if (job.stagingPath) {
      await rm(job.stagingPath, { recursive: true, force: true }).catch(() => {});
    }

    // Trigger any queued jobs waiting for a slot
    void this.pumpQueue();

    return this.getJob(jobId);
  }

  async executeJobPipeline(jobId: string, password?: string | null): Promise<void> {
    const controller = new AbortController();
    this.activeControllers.set(jobId, controller);
    const signal = controller.signal;

    try {
      const job = await this.getJob(jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);
      if (job.status === "cancelled") return;

      const stagingPath = job.stagingPath;
      if (!stagingPath) throw new Error(`Job ${jobId} has no staging path`);

      await mkdir(stagingPath, { recursive: true });

      // 1. Resolve source URL (handling Google Drive if necessary)
      let directUrl = job.sourceUrl;
      const gdRef = GoogleDriveUrlHelper.parseSource(job.sourceUrl);
      if (gdRef) {
        directUrl = gdRef.downloadUrl;
      }

      // 2. Preflight request (Fetch headers / check Content-Length)
      const headOrInitialRes = await this.fetchFn(directUrl, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
        signal,
      });

      if (!headOrInitialRes.ok) {
        throw new Error(`Remote fetch failed with HTTP ${headOrInitialRes.status}: ${headOrInitialRes.statusText}`);
      }

      // Handle Google Drive virus-scan / confirmation interstitial if served
      let finalRes = headOrInitialRes;
      if (GoogleDriveUrlHelper.isInterstitial(headOrInitialRes)) {
        const html = await headOrInitialRes.text();
        const form = GoogleDriveUrlHelper.extractConfirmForm(html);
        if (form) {
          const cookie = GoogleDriveUrlHelper.collectCookies(headOrInitialRes.headers);
          const reqDetails = GoogleDriveUrlHelper.buildConfirmRequest(form, cookie);
          finalRes = await this.fetchFn(reqDetails.url, {
            headers: { "User-Agent": USER_AGENT, ...reqDetails.headers },
            signal,
          });
          if (!finalRes.ok) {
            throw new Error(`Google Drive confirmation download failed: HTTP ${finalRes.status}`);
          }
        }
      }

      const lengthHeader = finalRes.headers.get("content-length");
      const contentLength = lengthHeader ? parseInt(lengthHeader, 10) : null;
      const bytesTotal = !Number.isNaN(contentLength) && contentLength && contentLength > 0 ? contentLength : null;

      // Update bytesTotal if known
      if (bytesTotal !== null) {
        await this.db
          .update(archiveIngestJobs)
          .set({ bytesTotal, updatedAt: new Date() })
          .where(eq(archiveIngestJobs.id, jobId));

        // Disk capacity preflight: check available disk space >= 2.5 * Content-Length
        const freeBytes = await this.getFreeBytes(stagingPath);
        if (freeBytes !== null) {
          const required = Math.ceil(bytesTotal * ARCHIVE_DISK_PREFLIGHT_FACTOR);
          if (freeBytes < required) {
            await this.failJob(
              jobId,
              "INSUFFICIENT_DISK_SPACE",
              `Available disk space (${freeBytes} bytes) is less than required ${required} bytes (2.5x archive size)`
            );
            return;
          }
        }
      }

      // 3. Download stage: Stream response body to disk and record progress
      const archiveFilename = job.archiveFilename ?? "archive.zip";
      const archivePath = join(stagingPath, archiveFilename);

      await this.db
        .update(archiveIngestJobs)
        .set({ status: "downloading", stage: "downloading", updatedAt: new Date() })
        .where(eq(archiveIngestJobs.id, jobId));

      if (finalRes.body) {
        const fileStream = createWriteStream(archivePath);
        let bytesDone = 0;
        const reader = (finalRes.body as ReadableStream<Uint8Array>).getReader();
        let lastDbUpdate = Date.now();

        try {
          while (true) {
            if (signal.aborted) {
              throw new DOMException("Aborted", "AbortError");
            }
            const { done, value } = await reader.read();
            if (done) break;

            bytesDone += value.byteLength;
            await new Promise<void>((resolve, reject) => {
              fileStream.write(value, (err) => (err ? reject(err) : resolve()));
            });

            const nowTime = Date.now();
            if (nowTime - lastDbUpdate >= 250) {
              await this.db
                .update(archiveIngestJobs)
                .set({ bytesDone, updatedAt: new Date() })
                .where(eq(archiveIngestJobs.id, jobId));
              lastDbUpdate = nowTime;
            }
          }
          // Final progress flush
          await this.db
            .update(archiveIngestJobs)
            .set({ bytesDone, updatedAt: new Date() })
            .where(eq(archiveIngestJobs.id, jobId));
        } finally {
          try {
            reader.releaseLock();
          } catch {
            // ignore
          }
          await new Promise<void>((resolve) => fileStream.end(() => resolve()));
        }
      } else {
        // In-memory / buffer fallback
        const arrayBuf = await finalRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const { writeFile } = await import("node:fs/promises");
        await writeFile(archivePath, buffer);
        await this.db
          .update(archiveIngestJobs)
          .set({ bytesDone: buffer.byteLength, bytesTotal: buffer.byteLength, updatedAt: new Date() })
          .where(eq(archiveIngestJobs.id, jobId));
      }

      if (signal.aborted) return;

      // 4-5. Listing stage: inspect entries, persist them, transition to ready.
      await this.listArchiveIntoReady(jobId, signal, password ?? null);
    } catch (err) {
      const isAbort =
        signal.aborted ||
        (err as Error)?.name === "AbortError" ||
        (err as { code?: string })?.code === "ABORT_ERR" ||
        (err as Error)?.message?.toLowerCase().includes("abort");

      if (isAbort) {
        logger.info({ jobId }, "Job execution aborted");
        return;
      }

      logger.error({ err, jobId }, "Archive ingest job execution failed");
      captureException(err);

      const errorCode =
        err instanceof ArchiveEngineError
          ? err.code
          : (err as { code?: string })?.code ?? "INGEST_FAILED";
      const errorMessage = err instanceof Error ? err.message : String(err);

      await this.failJob(jobId, errorCode, errorMessage);
    } finally {
      this.activeControllers.delete(jobId);
      void this.pumpQueue();
    }
  }

  /**
   * Listing-only resume phase: re-reads the already-downloaded on-disk
   * archive for a job (e.g. recovered via `submitJob`) and transitions it
   * through `listing` to `ready`. Unlike the full pipeline, a listing failure
   * here preserves the staging archive so a retry can re-list cheaply instead
   * of re-downloading.
   */
  async executeListingPhase(jobId: string, password?: string | null): Promise<void> {
    const controller = new AbortController();
    this.activeControllers.set(jobId, controller);
    const signal = controller.signal;

    try {
      await this.listArchiveIntoReady(jobId, signal, password ?? null);
    } catch (err) {
      const isAbort =
        signal.aborted ||
        (err as Error)?.name === "AbortError" ||
        (err as { code?: string })?.code === "ABORT_ERR" ||
        (err as Error)?.message?.toLowerCase().includes("abort");

      if (isAbort) {
        logger.info({ jobId }, "Listing execution aborted");
        return;
      }

      logger.error({ err, jobId }, "Archive ingest listing execution failed");
      captureException(err);

      const errorCode =
        err instanceof ArchiveEngineError
          ? err.code
          : (err as { code?: string })?.code ?? "LIST_FAILED";
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Preserve staging + archive for cheap re-list retries.
      await this.failJob(jobId, errorCode, errorMessage, { preserveStaging: true });
    } finally {
      this.activeControllers.delete(jobId);
      void this.pumpQueue();
    }
  }

  /**
   * Shared listing implementation used by both the full download pipeline
   * and the listing-only resume phase: sets `listing` status, lists archive
   * entries, filters/matches episodes, and persists the `ready` transition.
   */
  private async listArchiveIntoReady(
    jobId: string,
    signal: AbortSignal,
    password?: string | null
  ): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.status === "cancelled") return;
    if (!job.stagingPath) throw new Error(`Job ${jobId} has no staging path`);

    const archivePath = join(job.stagingPath, job.archiveFilename ?? "archive.zip");

    // Listing stage: inspect entries using SevenZipExtractor.list
    await this.db
      .update(archiveIngestJobs)
      .set({ status: "listing", stage: "listing", updatedAt: new Date() })
      .where(eq(archiveIngestJobs.id, jobId));

    const rawEntries = await this.extractor.list({
      archivePath,
      password: password ?? undefined,
      signal,
    });

    if (signal.aborted) return;

    // Filter video files, match episodes, and calculate size disparity
    const processedEntries = this.processArchiveEntries(rawEntries);

    // Transition to ready status and persist entries (retaining raw archive on disk)
    await this.db
      .update(archiveIngestJobs)
      .set({
        status: "ready",
        stage: "ready",
        entries: processedEntries,
        errorCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(archiveIngestJobs.id, jobId));

    logger.info({ jobId, entryCount: processedEntries.length }, "Archive ingest job is now ready");
  }

  /**
   * Confirmation phase: persist user-selected episode matches, move the job
   * from `ready` to `uploading`, then sequentially extract + upload + record
   * each file, deleting each local file immediately to bound disk usage.
   */
  async confirmJob(
    jobId: string,
    selection: ArchiveIngestJobSelectionItem[],
    options: ConfirmArchiveIngestJobOptions = {}
  ): Promise<ArchiveIngestJob> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (!["ready", "uploading", "failed"].includes(job.status)) {
      throw new Error(`Job ${jobId} cannot be confirmed from status '${job.status}'`);
    }
    if (!Array.isArray(selection) || selection.length === 0) {
      throw new Error("Selection must be a non-empty array");
    }

    const normalized: ArchiveIngestJobSelectionRow[] = selection.map((item) => ({
      filename: item.filename,
      episodeId: item.episodeId,
      label: item.label ?? null,
      quality: item.quality ?? null,
      isIgnored: item.isIgnored ?? false,
      completed: (item as { completed?: boolean }).completed ?? false,
      videoSourceId: (item as { videoSourceId?: string | null }).videoSourceId ?? null,
    }));
    const pending = normalized.filter((i) => !i.isIgnored && i.episodeId && !i.completed);
    if (pending.length === 0) {
      throw new Error("Selection contains no uploadable files");
    }

    const hasCompleted = normalized.some((i) => i.completed);
    // Fresh confirmations start progress at 0; resumes preserve prior bytesDone.
    const bytesDone = hasCompleted ? (job.bytesDone ?? 0) : 0;

    await this.db
      .update(archiveIngestJobs)
      .set({
        status: "uploading",
        stage: "uploading",
        selection: normalized,
        storageProviderId:
          options.storageProviderId !== undefined
            ? (options.storageProviderId ?? null)
            : job.storageProviderId,
        bytesDone,
        errorCode: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(archiveIngestJobs.id, jobId));

    await this.executeUploadPhase(jobId, options.password ?? null);

    const updated = await this.getJob(jobId);
    if (!updated) throw new Error(`Job ${jobId} not found after confirmation`);
    return updated;
  }

  /**
   * Sequential execution engine. Resumable: starts at the first selection
   * item not yet marked completed. Each iteration extracts only the single
   * target file, uploads it, upserts video_sources, marks the item completed,
   * increments bytes_done, and deletes the local file before continuing.
   */
  async executeUploadPhase(jobId: string, password?: string | null): Promise<void> {
    const controller = new AbortController();
    this.activeControllers.set(jobId, controller);
    const signal = controller.signal;

    try {
      const { s3, providerId: resolvedProviderId } = await this.resolveUploadStorage(jobId);

      for (;;) {
        if (signal.aborted) return;
        const job = await this.getJob(jobId);
        if (!job) throw new Error(`Job ${jobId} not found`);
        if (job.status === "cancelled") return;
        if (!job.stagingPath) throw new Error(`Job ${jobId} has no staging path`);

        const selection = (job.selection ?? []) as ArchiveIngestJobSelectionRow[];
        const pendingIndex = selection.findIndex(
          (i) => !i.isIgnored && i.episodeId && !(i as { completed?: boolean }).completed
        );
        if (pendingIndex === -1) {
          await this.finalizeUploadJob(jobId);
          return;
        }

        const item = selection[pendingIndex]!;
        const archivePath = join(job.stagingPath, job.archiveFilename ?? "archive.zip");

        let archiveStat: { size: number } | null = null;
        try {
          archiveStat = await stat(archivePath);
        } catch {
          archiveStat = null;
        }
        if (!archiveStat) {
          // Archive missing (e.g. re-confirm after cleanup): fail without deleting progress.
          await this.db
            .update(archiveIngestJobs)
            .set({
              status: "failed",
              stage: "failed",
              errorCode: "ARCHIVE_MISSING",
              errorMessage: `Archive file ${job.archiveFilename} is missing from staging; cannot resume without re-downloading`,
              updatedAt: new Date(),
            })
            .where(eq(archiveIngestJobs.id, jobId));
          return;
        }

        const filesDir = join(job.stagingPath, "files");
        await mkdir(filesDir, { recursive: true });
        const listDir = join(job.stagingPath, "lists");
        await mkdir(listDir, { recursive: true });

        let extractedAbsPath: string | null = null;
        let extractedSize = 0;
        try {
          const result = await this.extractor.extract({
            archivePath,
            destDir: filesDir,
            targets: [item.filename],
            listFileDir: listDir,
            password: password ?? undefined,
            signal,
          });
          const match =
            result.extractedFiles.find((f) => f.path === item.filename) ??
            result.extractedFiles.find((f) => basename(f.path) === basename(item.filename)) ??
            result.extractedFiles[0];
          if (!match) {
            throw new Error(`Extraction produced no files for target ${item.filename}`);
          }
          extractedAbsPath = join(filesDir, match.path);
          try {
            extractedSize = (await stat(extractedAbsPath)).size;
          } catch {
            extractedSize = match.sizeBytes ?? 0;
          }

          if (signal.aborted) return;

          // Upload uncompressed file to S3 via multipart streaming upload.
          const nodeStream = createReadStream(extractedAbsPath);
          const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
          const filename = sanitizeS3Filename(basename(item.filename));
          const key = `episodes/${item.episodeId}/${randomUUID()}-${filename}`;
          await s3.uploadStream(key, webStream, {
            contentType: "video/mp4",
            signal,
          });

          // Create or upsert the video_sources row.
          const videoSourceRepo = createVideoSourceRepositoryInternal(this.db, {
            s3StorageService: this.s3StorageService,
            storageProviderRegistry: this.storageProviderRegistry,
          });
          const row = await videoSourceRepo.upsert({
            episodeId: item.episodeId!,
            type: "s3",
            url: key,
            label: item.label ?? filename,
            quality: item.quality ?? null,
            storageProviderId: resolvedProviderId,
          });

          // Mark completed + increment bytes_done, then delete local file immediately.
          const fresh = await this.getJob(jobId);
          const freshSelection = ((fresh?.selection ?? []) as ArchiveIngestJobSelectionRow[]).map(
            (s, idx) =>
              idx === pendingIndex
                ? { ...s, completed: true, videoSourceId: row.id }
                : s
          );
          await this.db
            .update(archiveIngestJobs)
            .set({
              selection: freshSelection,
              bytesDone: (fresh?.bytesDone ?? 0) + extractedSize,
              updatedAt: new Date(),
            })
            .where(eq(archiveIngestJobs.id, jobId));

          logger.info({ jobId, filename, bytes: extractedSize }, "Archive ingest file uploaded");
        } finally {
          if (extractedAbsPath) {
            await unlink(extractedAbsPath).catch(() => {});
          }
        }

        if (signal.aborted) return;
      }
    } catch (err) {
      const isAbort =
        signal.aborted ||
        (err as Error)?.name === "AbortError" ||
        (err as { code?: string })?.code === "ABORT_ERR" ||
        (err as Error)?.message?.toLowerCase().includes("abort");

      if (isAbort) {
        logger.info({ jobId }, "Upload execution aborted");
        return;
      }
      logger.error({ err, jobId }, "Archive ingest upload execution failed");
      captureException(err);
      const errorCode =
        err instanceof ArchiveEngineError
          ? err.code
          : (err as { code?: string })?.code ?? "UPLOAD_FAILED";
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Preserve staging + archive for resume/retry (incl. password retry).
      await this.db
        .update(archiveIngestJobs)
        .set({
          status: "failed",
          stage: "failed",
          errorCode,
          errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(archiveIngestJobs.id, jobId));
    } finally {
      this.activeControllers.delete(jobId);
      void this.pumpQueue();
    }
  }

  /**
   * Resolve the S3 client for the upload phase plus the provider id to
   * record. An explicit `job.storageProviderId` is honored; otherwise the
   * active default provider from the database registry (e.g. IDrive) is used.
   * The resolved provider id is persisted on the job so subsequent resumes
   * and the created `video_sources` rows stay linked to it. Only when no
   * provider can be resolved at all does the environment-based S3 fallback
   * apply (and it must be configured, otherwise `S3NotConfiguredError`).
   */
  private async resolveUploadStorage(
    jobId: string
  ): Promise<{ s3: S3StorageService; providerId: string | null }> {
    const job = await this.getJob(jobId);
    const requestedProviderId =
      job?.storageProviderId && job.storageProviderId.trim().length > 0
        ? job.storageProviderId.trim()
        : null;

    const resolved = await this.storageProviderRegistry.getProvider(requestedProviderId);
    if (resolved) {
      if (job && resolved.provider.id !== job.storageProviderId) {
        await this.db
          .update(archiveIngestJobs)
          .set({ storageProviderId: resolved.provider.id, updatedAt: new Date() })
          .where(eq(archiveIngestJobs.id, jobId));
      }
      return { s3: resolved.service, providerId: resolved.provider.id };
    }
    if (requestedProviderId) throw new Error("Specified storage provider not found");

    const fallback = this.s3StorageService ?? null;
    if (!fallback || !fallback.isConfigured()) {
      throw new S3NotConfiguredError("S3 storage service is not configured");
    }
    return { s3: fallback, providerId: null };
  }

  private async finalizeUploadJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) return;
    if (job.archiveFilename && job.stagingPath) {
      await unlink(join(job.stagingPath, job.archiveFilename)).catch(() => {});
    }
    if (job.stagingPath) {
      await rm(job.stagingPath, { recursive: true, force: true }).catch(() => {});
    }
    await this.db
      .update(archiveIngestJobs)
      .set({ status: "done", stage: "done", updatedAt: new Date() })
      .where(eq(archiveIngestJobs.id, jobId));
    logger.info({ jobId }, "Archive ingest job completed");
  }

  public processArchiveEntries(entries: ArchiveEntry[]): ArchiveIngestJobEntryRow[] {
    // 1. Filter out directories, non-videos, and sample files
    const validVideoEntries = entries.filter(
      (entry) => !entry.isDirectory && isVideoFile(entry.path) && !isSampleFile(entry.path)
    );

    if (validVideoEntries.length === 0) {
      return [];
    }

    // 2. Calculate median size across all valid sibling video files for disparity detection
    const validSizes = validVideoEntries
      .map((e) => e.sizeBytes)
      .filter((sz) => sz > 0)
      .sort((a, b) => a - b);

    let medianSize: number | null = null;
    if (validSizes.length > 0) {
      const mid = Math.floor(validSizes.length / 2);
      medianSize =
        validSizes.length % 2 !== 0
          ? validSizes[mid]!
          : Math.round((validSizes[mid - 1]! + validSizes[mid]!) / 2);
    }

    // 3. Match episode numbers, quality, and check sibling size disparity
    const matchedList: ArchiveIngestJobEntryRow[] = validVideoEntries.map((entry) => {
      const filename = basename(entry.path);
      const detectedEpisodeNumber = detectEpisodeNumber(filename);
      const quality = detectQuality(filename);

      let needsReview = false;

      // Flag if detected episode number is missing
      if (detectedEpisodeNumber === null) {
        needsReview = true;
      }

      // Sibling size disparity: flag unusually small videos (< 50% of median size)
      if (medianSize !== null && medianSize > 0 && entry.sizeBytes > 0) {
        if (entry.sizeBytes < medianSize * (1 - SIBLING_SIZE_DISPARITY_THRESHOLD)) {
          needsReview = true;
        }
      }

      return {
        filename: entry.path,
        sizeBytes: entry.sizeBytes,
        detectedEpisodeNumber,
        quality,
        needsReview,
      };
    });

    // 4. Flag collision: multiple files detecting the same episode number
    const counts = new Map<number, number>();
    for (const item of matchedList) {
      if (item.detectedEpisodeNumber !== null && item.detectedEpisodeNumber !== undefined) {
        counts.set(item.detectedEpisodeNumber, (counts.get(item.detectedEpisodeNumber) ?? 0) + 1);
      }
    }

    for (const item of matchedList) {
      if (
        item.detectedEpisodeNumber !== null &&
        item.detectedEpisodeNumber !== undefined &&
        (counts.get(item.detectedEpisodeNumber) ?? 0) > 1
      ) {
        item.needsReview = true;
      }
    }

    return matchedList;
  }

  private async failJob(
    jobId: string,
    errorCode: string,
    errorMessage: string,
    options: { preserveStaging?: boolean } = {}
  ): Promise<void> {
    const current = await this.getJob(jobId);
    if (current?.status === "cancelled") {
      return;
    }

    await this.db
      .update(archiveIngestJobs)
      .set({
        status: "failed",
        stage: "failed",
        errorCode,
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(archiveIngestJobs.id, jobId));

    // Listing-resume failures preserve the on-disk archive so a retry can
    // re-list cheaply instead of re-downloading.
    if (options.preserveStaging) return;

    const job = await this.getJob(jobId);
    if (job?.stagingPath) {
      await rm(job.stagingPath, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async pumpQueue(): Promise<void> {
    try {
      const activeCount = await this.countActiveJobs();
      const slotsAvailable = this.maxConcurrentJobs - activeCount;
      if (slotsAvailable <= 0) return;

      const queuedRows = await this.db
        .select()
        .from(archiveIngestJobs)
        .where(eq(archiveIngestJobs.status, "queued"))
        .orderBy(archiveIngestJobs.createdAt)
        .limit(slotsAvailable);

      for (const row of queuedRows) {
        // Transition to downloading and launch execution
        await this.db
          .update(archiveIngestJobs)
          .set({
            status: "downloading",
            stage: "downloading",
            updatedAt: new Date(),
          })
          .where(eq(archiveIngestJobs.id, row.id));

        void this.executeJobPipeline(row.id).catch((err) => {
          captureException(err);
          logger.error({ err, jobId: row.id }, "Error processing queued job");
        });
      }
    } catch (err) {
      logger.error({ err }, "Error pumping archive ingest queue");
    }
  }

  private async getFreeBytes(dir: string): Promise<number | null> {
    try {
      const s = await this.statfsFn(dir);
      return s.bavail * s.bsize;
    } catch {
      return null;
    }
  }

  /**
   * Retry a failed job. If the archive is still present in staging (e.g.
   * password-protected failure), re-run executeJobPipeline in-place; otherwise
   * re-download from scratch by creating a fresh job record.
   *
   * An optional password is forwarded to the extraction stage.
   */
  async retryJob(
    jobId: string,
    options: { password?: string | null } = {}
  ): Promise<ArchiveIngestJob> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.status !== "failed") {
      throw new Error(`Job ${jobId} cannot be retried from status '${job.status}'`);
    }

    // Reset to downloading and re-run the full pipeline
    await this.db
      .update(archiveIngestJobs)
      .set({
        status: "downloading",
        stage: "downloading",
        errorCode: null,
        errorMessage: null,
        bytesDone: 0,
        updatedAt: new Date(),
      })
      .where(eq(archiveIngestJobs.id, jobId));

    void this.executeJobPipeline(jobId, options.password ?? null).catch((err) => {
      captureException(err);
      logger.error({ err, jobId }, "Unexpected error in retried job execution");
    });

    const updated = await this.getJob(jobId);
    if (!updated) throw new Error(`Job ${jobId} not found after retry`);
    return updated;
  }
}

export function createArchiveIngestJobService(
  options: ArchiveIngestJobServiceOptions
): ArchiveIngestJobService {
  return new ArchiveIngestJobService(options);
}

// ─── Boot reconciliation ──────────────────────────────────────────────────

/**
 * Called once at server startup. Any job that was actively running
 * (queued/downloading/listing/uploading) when the process died is
 * transitioned to `failed` with errorCode `SERVER_RESTARTED`.
 * `ready` jobs are preserved — they can still be confirmed by the user.
 */
export async function markInterruptedJobsOnBoot(db: DbClient): Promise<void> {
  const interruptedStatuses = ["queued", "downloading", "listing", "uploading"];
  try {
    const result = await db
      .update(archiveIngestJobs)
      .set({
        status: "failed",
        stage: "failed",
        errorCode: "SERVER_RESTARTED",
        errorMessage: "Server restarted while job was in progress",
        updatedAt: new Date(),
      })
      .where(inArray(archiveIngestJobs.status, interruptedStatuses))
      .returning({ id: archiveIngestJobs.id, stagingPath: archiveIngestJobs.stagingPath });

    // Clean up partial staging for interrupted jobs
    for (const row of result) {
      if (row.stagingPath) {
        await rm(row.stagingPath, { recursive: true, force: true }).catch(() => {});
      }
    }

    logger.info({ count: result.length }, "Boot reconciliation: marked interrupted jobs as failed");
  } catch (err) {
    logger.error({ err }, "Boot reconciliation failed");
  }
}

/**
 * Scans the staging base directory and removes any subdirectory that does not
 * correspond to a known job in the database. Orphan directories accumulate
 * when the process dies before completing cleanup.
 */
export async function purgeOrphanStagingDirs(
  db: DbClient,
  stagingBaseDir: string
): Promise<void> {
  try {
    let entries: string[];
    try {
      entries = await readdir(stagingBaseDir);
    } catch {
      // Directory doesn't exist yet — nothing to purge
      return;
    }

    if (entries.length === 0) return;

    // Load all job IDs that have a staging_path inside this directory
    const rows = await db
      .select({ id: archiveIngestJobs.id })
      .from(archiveIngestJobs);

    const knownIds = new Set(rows.map((r) => r.id));

    let purged = 0;
    for (const entry of entries) {
      if (!knownIds.has(entry)) {
        const fullPath = join(stagingBaseDir, entry);
        await rm(fullPath, { recursive: true, force: true }).catch(() => {});
        purged++;
      }
    }

    if (purged > 0) {
      logger.info({ purged, stagingBaseDir }, "Purged orphan staging directories");
    }
  } catch (err) {
    logger.error({ err }, "purgeOrphanStagingDirs failed");
  }
}

// ─── Background expiration sweeper ───────────────────────────────────────

/**
 * Finds all `ready` jobs whose `expires_at` is in the past, transitions them
 * to `expired`, and deletes their staging directories. Intended to run on a
 * periodic timer (e.g. every 30 minutes).
 */
export async function sweepExpiredJobs(db: DbClient): Promise<void> {
  try {
    const now = new Date();
    const expired = await db
      .update(archiveIngestJobs)
      .set({
        status: "expired",
        stage: "expired",
        updatedAt: now,
      })
      .where(
        and(
          eq(archiveIngestJobs.status, "ready"),
          isNotNull(archiveIngestJobs.expiresAt),
          lte(archiveIngestJobs.expiresAt, now)
        )
      )
      .returning({ id: archiveIngestJobs.id, stagingPath: archiveIngestJobs.stagingPath });

    for (const row of expired) {
      if (row.stagingPath) {
        await rm(row.stagingPath, { recursive: true, force: true }).catch(() => {});
      }
    }

    if (expired.length > 0) {
      logger.info({ count: expired.length }, "Swept expired archive ingest jobs");
    }
  } catch (err) {
    logger.error({ err }, "sweepExpiredJobs failed");
  }
}
