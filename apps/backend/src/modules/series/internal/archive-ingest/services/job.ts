import { randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat, statfs, unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import type {
  ArchiveIngestJobSelectionRow,
  NewArchiveIngestJobRow,
} from "@repo/db";
import type {
  ArchiveIngestJob,
  ArchiveIngestJobCreateRequest,
  ArchiveIngestJobProgress,
  ArchiveIngestJobSelectionItem,
  ArchiveIngestJobStatus,
} from "@repo/contracts";
import {
  SevenZipExtractor,
  type ArchiveExtractor,
  ArchiveEngineError,
} from "./extractor";
import { processArchiveEntries } from "./entry-processor";
export {
  processArchiveEntries,
  SIBLING_SIZE_DISPARITY_THRESHOLD,
} from "./entry-processor";
import {
  buildGoogleDriveConfirmRequest,
  collectGoogleDriveCookies,
  extractGoogleDriveConfirmForm,
  isGoogleDriveInterstitial,
  isGoogleDriveUrl,
  parseGoogleDriveSource,
} from "../utils/google-drive-url";
import { logger } from "../../../../../lib/logger";
import { captureException } from "../../../../../lib/sentry";
import {
  S3NotConfiguredError,
  type S3StorageService,
  type StorageProviderRegistry,
  type VideoSourceUpsertInput,
} from "@repo/media-service";
import type { ArchiveIngestRepository } from "../types";

export const MAX_CONCURRENT_JOBS_DEFAULT = 2;
export const ARCHIVE_DISK_PREFLIGHT_FACTOR = 2.5;

export type ArchiveJobFetchFn = (
  url: string,
  init?: RequestInit,
) => Promise<Response>;
/** Back-compat alias for the pre-refactor fetch hook name. */
export type ArchiveFetchFn = ArchiveJobFetchFn;
export type ArchiveJobStatfsFn = (
  path: string,
) => Promise<{ bavail: number; bsize: number }>;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

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

function sanitizeS3Filename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? raw;
  const cleaned = base.replace(/[^a-zA-Z0-9_.\-()[\] ]/g, "_");
  return cleaned.length > 0 ? cleaned : "video.mp4";
}

/**
 * Identity of a selection item for the completed-preservation merge:
 * filename AND episodeId must both match for stored progress to carry over.
 */
function keyOf(filename: string, episodeId: string | null | undefined): string {
  return JSON.stringify([filename, episodeId ?? null]);
}

export class ArchiveIngestJobManager {
  private repository: ArchiveIngestRepository;
  private stagingBaseDir: string;
  private extractor: ArchiveExtractor;
  private fetchFn: ArchiveJobFetchFn;
  private statfsFn: ArchiveJobStatfsFn;
  private maxConcurrentJobs: number;
  private s3StorageService?: S3StorageService;
  private storageProviderRegistry?: StorageProviderRegistry;
  private videoSourceRepository?: ArchiveIngestVideoSourceWriter;
  private activeControllers = new Map<string, AbortController>();

  constructor(options: ArchiveIngestJobManagerOptions) {
    this.repository = options.repository;
    this.stagingBaseDir = options.stagingBaseDir;
    this.extractor = options.extractor ?? new SevenZipExtractor();
    this.fetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));
    this.statfsFn =
      options.statfsFn ??
      (async (path) => {
        const s = await statfs(path);
        return { bavail: Number(s.bavail), bsize: Number(s.bsize) };
      });
    this.maxConcurrentJobs =
      options.maxConcurrentJobs ?? MAX_CONCURRENT_JOBS_DEFAULT;
    this.s3StorageService = options.s3StorageService;
    this.storageProviderRegistry = options.storageProviderRegistry;
    this.videoSourceRepository = options.videoSourceRepository;
  }

  public deriveSourceKey(url: string): string {
    const gdRef = parseGoogleDriveSource(url);
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

  public resolveReferer(sourceUrl: string, referer?: string | null): string {
    if (referer && referer.trim().length > 0) return referer.trim();
    try {
      return new URL(sourceUrl).origin;
    } catch {
      return sourceUrl;
    }
  }

  async findActiveJob(
    ownerId: string,
    sourceKey: string,
  ): Promise<ArchiveIngestJob | null> {
    return this.repository.findActiveJob(ownerId, sourceKey);
  }

  async countActiveJobs(ownerId?: string): Promise<number> {
    return this.repository.countActiveJobs(ownerId);
  }

  async submitJob(
    ownerId: string,
    request: ArchiveIngestJobCreateRequest,
  ): Promise<ArchiveIngestJob> {
    const sourceKey = this.deriveSourceKey(request.sourceUrl);

    // 1. Idempotency check: active/ready job for (owner_id, source_key)
    const existing = await this.findActiveJob(ownerId, sourceKey);
    if (existing) {
      logger.info(
        { jobId: existing.id, ownerId, sourceKey },
        "Returning existing active job",
      );
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
        "Recovering failed job with intact staging archive",
      );
      return await this.recoverFailedJob(recoverable, request.password);
    }

    // 2. Concurrency limit check
    const activeCount = await this.countActiveJobs();
    const shouldQueue = activeCount >= this.maxConcurrentJobs;
    const initialStatus: ArchiveIngestJobStatus = shouldQueue
      ? "queued"
      : "downloading";

    const jobId = randomUUID();
    const stagingPath = join(this.stagingBaseDir, jobId);
    const archiveFilename = this.extractFilename(request.sourceUrl);

    const newJob: NewArchiveIngestJobRow = {
      id: jobId,
      ownerId,
      seriesId: request.seriesId ?? null,
      sourceKey,
      sourceUrl: request.sourceUrl,
      referer: request.referer?.trim() ? request.referer.trim() : null,
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
      await this.repository.createJob(newJob);
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
        logger.error(
          { err, jobId },
          "Unexpected error in background job execution",
        );
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
    sourceKey: string,
  ): Promise<ArchiveIngestJob | null> {
    return this.repository.findFailedJob(ownerId, sourceKey);
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
    password?: string | null,
  ): Promise<ArchiveIngestJob> {
    if ((job.entries?.length ?? 0) > 0) {
      await this.repository.updateJob(job.id, {
        status: "ready",
        stage: "ready",
        errorCode: null,
        errorMessage: null,
      });
      const recovered = await this.getJob(job.id);
      if (!recovered) throw new Error(`Job ${job.id} not found after recovery`);
      return recovered;
    }

    await this.repository.updateJob(job.id, {
      status: "listing",
      stage: "listing",
      errorCode: null,
      errorMessage: null,
    });

    void this.executeListingPhase(job.id, password ?? null).catch((err) => {
      captureException(err);
      logger.error(
        { err, jobId: job.id },
        "Unexpected error in resumed listing execution",
      );
    });

    const resumed = await this.getJob(job.id);
    if (!resumed) throw new Error(`Job ${job.id} not found after recovery`);
    return resumed;
  }

  async getJob(jobId: string): Promise<ArchiveIngestJob | null> {
    return this.repository.findById(jobId);
  }

  /**
   * Lightweight progress projection of a job for cheap polling during the
   * upload phase: omits the static `entries` list and full selection items.
   * `completedFilenames` gathers filenames with `completed === true`;
   * `activeFilename` is the first non-ignored, not-yet-completed filename
   * while the job is `uploading`, otherwise null.
   */
  public toJobProgress(job: ArchiveIngestJob): ArchiveIngestJobProgress {
    const selection = (job.selection ?? []) as ArchiveIngestJobSelectionRow[];
    const completedFilenames = selection
      .filter((s) => s.completed === true)
      .map((s) => s.filename);
    let activeFilename: string | null = null;
    if (job.status === "uploading") {
      const active = selection.find(
        (s) => !s.isIgnored && s.completed !== true,
      );
      activeFilename = active?.filename ?? null;
    }
    return {
      id: job.id,
      status: job.status,
      stage: job.stage,
      bytesDone: job.bytesDone,
      bytesTotal: job.bytesTotal,
      completedFilenames,
      activeFilename,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
    };
  }

  async listJobs(ownerId: string, limit = 50): Promise<ArchiveIngestJob[]> {
    return this.repository.listJobsByOwner(ownerId, limit);
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
    await this.repository.updateJob(jobId, {
      status: "cancelled",
      stage: "cancelled",
    });

    // Clean up staging directory
    if (job.stagingPath) {
      await rm(job.stagingPath, { recursive: true, force: true }).catch(
        () => {},
      );
    }

    // Trigger any queued jobs waiting for a slot
    void this.pumpQueue();

    return this.getJob(jobId);
  }

  async executeJobPipeline(
    jobId: string,
    password?: string | null,
  ): Promise<void> {
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
      const gdRef = parseGoogleDriveSource(job.sourceUrl);
      if (gdRef) {
        directUrl = gdRef.downloadUrl;
      }

      // 2. Preflight request (Fetch headers / check Content-Length)
      const referer = this.resolveReferer(job.sourceUrl, job.referer);
      const headOrInitialRes = await this.fetchFn(directUrl, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT, Referer: referer },
        signal,
      });

      if (!headOrInitialRes.ok) {
        throw new Error(
          `Remote fetch failed with HTTP ${headOrInitialRes.status}: ${headOrInitialRes.statusText}`,
        );
      }

      // Handle Google Drive virus-scan / confirmation interstitial if served.
      // Gate on GDrive hostname: non-GDrive providers (MediaFire, Gofile,
      // direct links) may serve HTML landing/captcha pages with 200 OK that
      // must NOT enter the confirmation code path.
      let finalRes = headOrInitialRes;
      if (
        isGoogleDriveUrl(directUrl) &&
        isGoogleDriveInterstitial(headOrInitialRes)
      ) {
        const html = await headOrInitialRes.text();
        const form = extractGoogleDriveConfirmForm(html);
        if (form) {
          const cookie = collectGoogleDriveCookies(headOrInitialRes.headers);
          const reqDetails = buildGoogleDriveConfirmRequest(form, cookie);
          finalRes = await this.fetchFn(reqDetails.url, {
            headers: {
              "User-Agent": USER_AGENT,
              Referer: referer,
              ...reqDetails.headers,
            },
            signal,
          });
          if (!finalRes.ok) {
            throw new Error(
              `Google Drive confirmation download failed: HTTP ${finalRes.status}`,
            );
          }
        }
      }

      const lengthHeader = finalRes.headers.get("content-length");
      const contentLength = lengthHeader ? parseInt(lengthHeader, 10) : null;
      const bytesTotal =
        !Number.isNaN(contentLength) && contentLength && contentLength > 0
          ? contentLength
          : null;

      // Update bytesTotal if known
      if (bytesTotal !== null) {
        await this.repository.updateJob(jobId, { bytesTotal });

        // Disk capacity preflight: check available disk space >= 2.5 * Content-Length
        const freeBytes = await this.getFreeBytes(stagingPath);
        if (freeBytes !== null) {
          const required = Math.ceil(
            bytesTotal * ARCHIVE_DISK_PREFLIGHT_FACTOR,
          );
          if (freeBytes < required) {
            await this.failJob(
              jobId,
              "INSUFFICIENT_DISK_SPACE",
              `Available disk space (${freeBytes} bytes) is less than required ${required} bytes (2.5x archive size)`,
            );
            return;
          }
        }
      }

      // 3. Download stage: Stream response body to disk and record progress
      const archiveFilename = job.archiveFilename ?? "archive.zip";
      const archivePath = join(stagingPath, archiveFilename);

      await this.repository.updateJob(jobId, {
        status: "downloading",
        stage: "downloading",
      });

      if (finalRes.body) {
        const fileStream = createWriteStream(archivePath);
        let bytesDone = 0;
        const reader = (
          finalRes.body as ReadableStream<Uint8Array>
        ).getReader();
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
              await this.repository.updateJob(jobId, { bytesDone });
              lastDbUpdate = nowTime;
            }
          }
          // Final progress flush
          await this.repository.updateJob(jobId, { bytesDone });
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
        await this.repository.updateJob(jobId, {
          bytesDone: buffer.byteLength,
          bytesTotal: buffer.byteLength,
        });
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
          : ((err as { code?: string })?.code ?? "INGEST_FAILED");
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
  async executeListingPhase(
    jobId: string,
    password?: string | null,
  ): Promise<void> {
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
          : ((err as { code?: string })?.code ?? "LIST_FAILED");
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Preserve staging + archive for cheap re-list retries.
      await this.failJob(jobId, errorCode, errorMessage, {
        preserveStaging: true,
      });
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
    password?: string | null,
  ): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.status === "cancelled") return;
    if (!job.stagingPath) throw new Error(`Job ${jobId} has no staging path`);

    const archivePath = join(
      job.stagingPath,
      job.archiveFilename ?? "archive.zip",
    );

    // Listing stage: inspect entries using SevenZipExtractor.list
    await this.repository.updateJob(jobId, {
      status: "listing",
      stage: "listing",
    });

    const rawEntries = await this.extractor.list({
      archivePath,
      password: password ?? undefined,
      signal,
    });

    if (signal.aborted) return;

    // Filter video files, match episodes, and calculate size disparity
    const processedEntries = this.processArchiveEntries(rawEntries);

    // Transition to ready status and persist entries (retaining raw archive on disk)
    await this.repository.updateJob(jobId, {
      status: "ready",
      stage: "ready",
      entries: processedEntries,
      errorCode: null,
      errorMessage: null,
    });

    logger.info(
      { jobId, entryCount: processedEntries.length },
      "Archive ingest job is now ready",
    );
  }

  /**
   * Confirmation phase: persist user-selected episode matches, move the job
   * to `uploading`, and kick off the sequential extract + upload + record
   * loop in the background, returning immediately.
   *
   * Idempotency:
   * - If an upload loop for this job is already active in this process, the
   *   re-confirm is absorbed: the current job is returned unchanged without
   *   overwriting the stored selection and without starting a second loop.
   * - Otherwise the incoming selection is merged with the stored one so
   *   already-completed files (matched on filename + episodeId) are never
   *   re-uploaded.
   */
  async confirmJob(
    jobId: string,
    selection: ArchiveIngestJobSelectionItem[],
    options: ConfirmArchiveIngestJobOptions = {},
  ): Promise<ArchiveIngestJob> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (!["ready", "uploading", "failed"].includes(job.status)) {
      throw new Error(
        `Job ${jobId} cannot be confirmed from status '${job.status}'`,
      );
    }

    // Absorb in-flight duplicates: a live upload loop means an earlier
    // confirm already owns this job. Return current state untouched.
    if (this.activeControllers.has(jobId)) {
      const current = await this.getJob(jobId);
      if (!current)
        throw new Error(`Job ${jobId} not found after confirmation`);
      return current;
    }

    if (!Array.isArray(selection) || selection.length === 0) {
      throw new Error("Selection must be a non-empty array");
    }

    const normalized: ArchiveIngestJobSelectionRow[] = selection.map(
      (item) => ({
        filename: item.filename,
        episodeId: item.episodeId,
        label: item.label ?? null,
        quality: item.quality ?? null,
        isIgnored: item.isIgnored ?? false,
        completed: (item as { completed?: boolean }).completed ?? false,
        videoSourceId:
          (item as { videoSourceId?: string | null }).videoSourceId ?? null,
      }),
    );

    // Completed-preservation merge: a client re-send lacks completed flags,
    // so inherit them (plus the recorded video-source id) from the stored
    // selection -- but only when BOTH filename and episodeId match. A file
    // remapped to a different episode re-uploads for the new episode.
    const storedByKey = new Map(
      ((job.selection ?? []) as ArchiveIngestJobSelectionRow[]).map((s) => [
        keyOf(s.filename, s.episodeId),
        s,
      ]),
    );
    const merged: ArchiveIngestJobSelectionRow[] = normalized.map((item) => {
      const stored = storedByKey.get(keyOf(item.filename, item.episodeId));
      if (!stored) return item;
      return {
        ...item,
        completed: stored.completed ?? false,
        videoSourceId: stored.videoSourceId ?? item.videoSourceId ?? null,
      };
    });
    const pending = merged.filter(
      (i) => !i.isIgnored && i.episodeId && !i.completed,
    );
    if (pending.length === 0) {
      throw new Error("Selection contains no uploadable files");
    }

    const hasCompleted = merged.some((i) => i.completed);
    // Fresh confirmations start progress at 0; resumes preserve prior bytesDone.
    const bytesDone = hasCompleted ? (job.bytesDone ?? 0) : 0;

    await this.repository.updateJob(jobId, {
      status: "uploading",
      stage: "uploading",
      selection: merged,
      storageProviderId:
        options.storageProviderId !== undefined
          ? (options.storageProviderId ?? null)
          : job.storageProviderId,
      bytesDone,
      errorCode: null,
      errorMessage: null,
    });

    // Atomic kickoff guard: no await between this check and the kickoff, and
    // the upload loop registers its controller synchronously on entry — so a
    // loop started while we were awaiting the write above is never doubled.
    if (this.activeControllers.has(jobId)) {
      const current = await this.getJob(jobId);
      if (!current)
        throw new Error(`Job ${jobId} not found after confirmation`);
      return current;
    }
    void this.executeUploadPhase(jobId, options.password ?? null).catch(
      (err) => {
        captureException(err);
        logger.error(
          { err, jobId },
          "Unexpected error in background upload execution",
        );
      },
    );

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
  async executeUploadPhase(
    jobId: string,
    password?: string | null,
  ): Promise<void> {
    const controller = new AbortController();
    this.activeControllers.set(jobId, controller);
    const signal = controller.signal;

    try {
      const { s3, providerId: resolvedProviderId } =
        await this.resolveUploadStorage(jobId);

      for (;;) {
        if (signal.aborted) return;
        const job = await this.getJob(jobId);
        if (!job) throw new Error(`Job ${jobId} not found`);
        if (job.status === "cancelled") return;
        if (!job.stagingPath)
          throw new Error(`Job ${jobId} has no staging path`);

        const selection = (job.selection ??
          []) as ArchiveIngestJobSelectionRow[];
        const pendingIndex = selection.findIndex(
          (i) =>
            !i.isIgnored &&
            i.episodeId &&
            !(i as { completed?: boolean }).completed,
        );
        if (pendingIndex === -1) {
          await this.finalizeUploadJob(jobId);
          return;
        }

        const item = selection[pendingIndex]!;
        const archivePath = join(
          job.stagingPath,
          job.archiveFilename ?? "archive.zip",
        );

        let archiveStat: { size: number } | null = null;
        try {
          archiveStat = await stat(archivePath);
        } catch {
          archiveStat = null;
        }
        if (!archiveStat) {
          // Archive missing (e.g. re-confirm after cleanup): fail without deleting progress.
          await this.repository.updateJob(jobId, {
            status: "failed",
            stage: "failed",
            errorCode: "ARCHIVE_MISSING",
            errorMessage: `Archive file ${job.archiveFilename} is missing from staging; cannot resume without re-downloading`,
          });
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
            result.extractedFiles.find(
              (f) => basename(f.path) === basename(item.filename),
            ) ??
            result.extractedFiles[0];
          if (!match) {
            throw new Error(
              `Extraction produced no files for target ${item.filename}`,
            );
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
          const webStream = Readable.toWeb(
            nodeStream,
          ) as unknown as ReadableStream<Uint8Array>;
          const filename = sanitizeS3Filename(basename(item.filename));
          const key = `episodes/${item.episodeId}/${randomUUID()}-${filename}`;
          await s3.uploadStream(key, webStream, {
            contentType: "video/mp4",
            signal,
          });

          // Create or upsert the video_sources row via the injected writer.
          // Wiring (routes/subsystem) supplies a database-backed repository;
          // tests supply fakes. The manager never touches the database itself.
          if (!this.videoSourceRepository) {
            throw new Error(
              "videoSourceRepository is not configured for upload phase",
            );
          }
          const row = await this.videoSourceRepository.upsert({
            episodeId: item.episodeId!,
            type: "s3",
            url: key,
            label: item.label ?? filename,
            quality: item.quality ?? null,
            storageProviderId: resolvedProviderId,
          });

          // Mark completed + increment bytes_done, then delete local file immediately.
          const fresh = await this.getJob(jobId);
          const freshSelection = (
            (fresh?.selection ?? []) as ArchiveIngestJobSelectionRow[]
          ).map((s, idx) =>
            idx === pendingIndex
              ? { ...s, completed: true, videoSourceId: row.id }
              : s,
          );
          await this.repository.updateJob(jobId, {
            selection: freshSelection,
            bytesDone: (fresh?.bytesDone ?? 0) + extractedSize,
          });

          logger.info(
            { jobId, filename, bytes: extractedSize },
            "Archive ingest file uploaded",
          );
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
          : ((err as { code?: string })?.code ?? "UPLOAD_FAILED");
      const errorMessage = err instanceof Error ? err.message : String(err);
      // Preserve staging + archive for resume/retry (incl. password retry).
      await this.repository.updateJob(jobId, {
        status: "failed",
        stage: "failed",
        errorCode,
        errorMessage,
      });
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
    jobId: string,
  ): Promise<{ s3: S3StorageService; providerId: string | null }> {
    const job = await this.getJob(jobId);
    const requestedProviderId =
      job?.storageProviderId && job.storageProviderId.trim().length > 0
        ? job.storageProviderId.trim()
        : null;

    const resolved =
      await this.storageProviderRegistry?.getProvider(requestedProviderId);
    if (resolved) {
      if (job && resolved.provider.id !== job.storageProviderId) {
        await this.repository.updateJob(jobId, {
          storageProviderId: resolved.provider.id,
        });
      }
      return { s3: resolved.service, providerId: resolved.provider.id };
    }
    if (requestedProviderId)
      throw new Error("Specified storage provider not found");

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
      await rm(job.stagingPath, { recursive: true, force: true }).catch(
        () => {},
      );
    }
    await this.repository.updateJob(jobId, { status: "done", stage: "done" });
    logger.info({ jobId }, "Archive ingest job completed");
  }

  public processArchiveEntries(
    entries: Parameters<typeof processArchiveEntries>[0],
  ): ReturnType<typeof processArchiveEntries> {
    return processArchiveEntries(entries);
  }

  private async failJob(
    jobId: string,
    errorCode: string,
    errorMessage: string,
    options: { preserveStaging?: boolean } = {},
  ): Promise<void> {
    const current = await this.getJob(jobId);
    if (current?.status === "cancelled") {
      return;
    }

    await this.repository.updateJob(jobId, {
      status: "failed",
      stage: "failed",
      errorCode,
      errorMessage,
    });

    // Listing-resume failures preserve the on-disk archive so a retry can
    // re-list cheaply instead of re-downloading.
    if (options.preserveStaging) return;

    const job = await this.getJob(jobId);
    if (job?.stagingPath) {
      await rm(job.stagingPath, { recursive: true, force: true }).catch(
        () => {},
      );
    }
  }

  private async pumpQueue(): Promise<void> {
    try {
      const activeCount = await this.countActiveJobs();
      const slotsAvailable = this.maxConcurrentJobs - activeCount;
      if (slotsAvailable <= 0) return;

      const queuedJobs = await this.repository.findQueuedJobs(slotsAvailable);

      for (const job of queuedJobs) {
        // Transition to downloading and launch execution
        await this.repository.updateJob(job.id, {
          status: "downloading",
          stage: "downloading",
        });

        void this.executeJobPipeline(job.id).catch((err) => {
          captureException(err);
          logger.error({ err, jobId: job.id }, "Error processing queued job");
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
    options: { password?: string | null } = {},
  ): Promise<ArchiveIngestJob> {
    const job = await this.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.status !== "failed") {
      throw new Error(
        `Job ${jobId} cannot be retried from status '${job.status}'`,
      );
    }

    // Reset to downloading and re-run the full pipeline
    await this.repository.updateJob(jobId, {
      status: "downloading",
      stage: "downloading",
      errorCode: null,
      errorMessage: null,
      bytesDone: 0,
    });

    void this.executeJobPipeline(jobId, options.password ?? null).catch(
      (err) => {
        captureException(err);
        logger.error(
          { err, jobId },
          "Unexpected error in retried job execution",
        );
      },
    );

    const updated = await this.getJob(jobId);
    if (!updated) throw new Error(`Job ${jobId} not found after retry`);
    return updated;
  }
}

export function createArchiveIngestJobManager(
  options: ArchiveIngestJobManagerOptions,
): ArchiveIngestJobManager {
  return new ArchiveIngestJobManager(options);
}

/** Back-compat alias: pre-refactor service name. */
export const ArchiveIngestJobService = ArchiveIngestJobManager;
export type ArchiveIngestJobService = ArchiveIngestJobManager;
export type ArchiveIngestJobServiceOptions = ArchiveIngestJobManagerOptions;
export const createArchiveIngestJobService = createArchiveIngestJobManager;
