import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm, stat, statfs } from "node:fs/promises";
import { join } from "node:path";
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
import type {
  ArchiveIngestJobManager,
  ArchiveIngestJobManagerOptions,
  ConfirmArchiveIngestJobOptions,
} from "../types";
import {
  executeUploadPhase as runUploadPhase,
  type UploadPipelineDeps,
} from "./upload-pipeline";

export const MAX_CONCURRENT_JOBS_DEFAULT = 2;
export const ARCHIVE_DISK_PREFLIGHT_FACTOR = 2.5;

export type {
  ArchiveIngestRepository,
  ArchiveIngestJobManager,
  ArchiveIngestJobManagerOptions,
  ConfirmArchiveIngestJobOptions,
} from "../types";
export type {
  ArchiveJobFetchFn,
  ArchiveFetchFn,
  ArchiveJobStatfsFn,
  ArchiveIngestVideoSourceWriter,
} from "../types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/**
 * Identity of a selection item for the completed-preservation merge:
 * filename AND episodeId must both match for stored progress to carry over.
 */
function keyOf(filename: string, episodeId: string | null | undefined): string {
  return JSON.stringify([filename, episodeId ?? null]);
}

/**
 * Lean factory closure managing archive ingest lifecycle state transitions,
 * idempotency checks, and queue pumping. Upload streaming lives in
 * `services/upload-pipeline.ts`; download/listing orchestration stays here.
 */
export function createArchiveIngestJobManager(
  options: ArchiveIngestJobManagerOptions,
): ArchiveIngestJobManager {
  const repository = options.repository;
  const stagingBaseDir = options.stagingBaseDir;
  const extractor: ArchiveExtractor =
    options.extractor ?? new SevenZipExtractor();
  const fetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));
  const statfsFn =
    options.statfsFn ??
    (async (path: string) => {
      const s = await statfs(path);
      return { bavail: Number(s.bavail), bsize: Number(s.bsize) };
    });
  const maxConcurrentJobs =
    options.maxConcurrentJobs ?? MAX_CONCURRENT_JOBS_DEFAULT;
  const s3StorageService = options.s3StorageService;
  const storageProviderRegistry = options.storageProviderRegistry;
  const videoSourceRepository = options.videoSourceRepository;
  const activeControllers = new Map<string, AbortController>();

  function deriveSourceKey(url: string): string {
    const gdRef = parseGoogleDriveSource(url);
    if (gdRef) return `gdrive:${gdRef.fileId}`;
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return url;
    }
  }

  function extractFilename(url: string): string {
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

  function resolveReferer(sourceUrl: string, referer?: string | null): string {
    if (referer && referer.trim().length > 0) return referer.trim();
    try {
      return new URL(sourceUrl).origin;
    } catch {
      return sourceUrl;
    }
  }

  async function findActiveJob(
    ownerId: string,
    sourceKey: string,
  ): Promise<ArchiveIngestJob | null> {
    return repository.findActiveJob(ownerId, sourceKey);
  }

  async function countActiveJobs(ownerId?: string): Promise<number> {
    return repository.countActiveJobs(ownerId);
  }

  async function getJob(jobId: string): Promise<ArchiveIngestJob | null> {
    return repository.findById(jobId);
  }

  async function findRecoverableFailedJob(
    ownerId: string,
    sourceKey: string,
  ): Promise<ArchiveIngestJob | null> {
    return repository.findFailedJob(ownerId, sourceKey);
  }

  async function hasArchiveOnDisk(job: ArchiveIngestJob): Promise<boolean> {
    if (!job.stagingPath || !job.archiveFilename) return false;
    try {
      await stat(join(job.stagingPath, job.archiveFilename));
      return true;
    } catch {
      return false;
    }
  }

  async function getFreeBytes(dir: string): Promise<number | null> {
    try {
      const s = await statfsFn(dir);
      return s.bavail * s.bsize;
    } catch {
      return null;
    }
  }

  async function failJob(
    jobId: string,
    errorCode: string,
    errorMessage: string,
    failOptions: { preserveStaging?: boolean } = {},
  ): Promise<void> {
    const current = await getJob(jobId);
    if (current?.status === "cancelled") {
      return;
    }

    await repository.updateJob(jobId, {
      status: "failed",
      stage: "failed",
      errorCode,
      errorMessage,
    });

    if (failOptions.preserveStaging) return;

    const job = await getJob(jobId);
    if (job?.stagingPath) {
      await rm(job.stagingPath, { recursive: true, force: true }).catch(
        () => {},
      );
    }
  }

  async function pumpQueue(): Promise<void> {
    try {
      const activeCount = await countActiveJobs();
      const slotsAvailable = maxConcurrentJobs - activeCount;
      if (slotsAvailable <= 0) return;

      const queuedJobs = await repository.findQueuedJobs(slotsAvailable);

      for (const job of queuedJobs) {
        await repository.updateJob(job.id, {
          status: "downloading",
          stage: "downloading",
        });

        void executeJobPipeline(job.id).catch((err) => {
          captureException(err);
          logger.error({ err, jobId: job.id }, "Error processing queued job");
        });
      }
    } catch (err) {
      logger.error({ err }, "Error pumping archive ingest queue");
    }
  }

  function uploadDeps(): UploadPipelineDeps {
    return {
      repository,
      extractor,
      ...(s3StorageService ? { s3StorageService } : {}),
      ...(storageProviderRegistry ? { storageProviderRegistry } : {}),
      ...(videoSourceRepository ? { videoSourceRepository } : {}),
      getJob,
      registerController: (jobId: string) => {
        const controller = new AbortController();
        activeControllers.set(jobId, controller);
        return controller;
      },
      releaseController: (jobId: string) => {
        activeControllers.delete(jobId);
      },
      onSettled: () => {
        void pumpQueue();
      },
    };
  }

  async function executeUploadPhase(
    jobId: string,
    password?: string | null,
  ): Promise<void> {
    await runUploadPhase(uploadDeps(), jobId, password);
  }

  async function listArchiveIntoReady(
    jobId: string,
    signal: AbortSignal,
    password?: string | null,
  ): Promise<void> {
    const job = await getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.status === "cancelled") return;
    if (!job.stagingPath) throw new Error(`Job ${jobId} has no staging path`);

    const archivePath = join(
      job.stagingPath,
      job.archiveFilename ?? "archive.zip",
    );

    await repository.updateJob(jobId, {
      status: "listing",
      stage: "listing",
    });

    const rawEntries = await extractor.list({
      archivePath,
      password: password ?? undefined,
      signal,
    });

    if (signal.aborted) return;

    const processedEntries = processArchiveEntries(rawEntries);

    await repository.updateJob(jobId, {
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

  async function recoverFailedJob(
    job: ArchiveIngestJob,
    password?: string | null,
  ): Promise<ArchiveIngestJob> {
    if ((job.entries?.length ?? 0) > 0) {
      await repository.updateJob(job.id, {
        status: "ready",
        stage: "ready",
        errorCode: null,
        errorMessage: null,
      });
      const recovered = await getJob(job.id);
      if (!recovered) throw new Error(`Job ${job.id} not found after recovery`);
      return recovered;
    }

    await repository.updateJob(job.id, {
      status: "listing",
      stage: "listing",
      errorCode: null,
      errorMessage: null,
    });

    void executeListingPhase(job.id, password ?? null).catch((err) => {
      captureException(err);
      logger.error(
        { err, jobId: job.id },
        "Unexpected error in resumed listing execution",
      );
    });

    const resumed = await getJob(job.id);
    if (!resumed) throw new Error(`Job ${job.id} not found after recovery`);
    return resumed;
  }

  async function submitJob(
    ownerId: string,
    request: ArchiveIngestJobCreateRequest,
  ): Promise<ArchiveIngestJob> {
    const sourceKey = deriveSourceKey(request.sourceUrl);

    const existing = await findActiveJob(ownerId, sourceKey);
    if (existing) {
      logger.info(
        { jobId: existing.id, ownerId, sourceKey },
        "Returning existing active job",
      );
      return existing;
    }

    const recoverable = await findRecoverableFailedJob(ownerId, sourceKey);
    if (recoverable && (await hasArchiveOnDisk(recoverable))) {
      logger.info(
        { jobId: recoverable.id, ownerId, sourceKey },
        "Recovering failed job with intact staging archive",
      );
      return await recoverFailedJob(recoverable, request.password);
    }

    const activeCount = await countActiveJobs();
    const shouldQueue = activeCount >= maxConcurrentJobs;
    const initialStatus: ArchiveIngestJobStatus = shouldQueue
      ? "queued"
      : "downloading";

    const jobId = randomUUID();
    const stagingPath = join(stagingBaseDir, jobId);
    const archiveFilename = extractFilename(request.sourceUrl);

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
      await repository.createJob(newJob);
    } catch (err) {
      const duplicate = await findActiveJob(ownerId, sourceKey);
      if (duplicate) return duplicate;
      throw err;
    }

    const created = await getJob(jobId);
    if (!created) {
      throw new Error(`Failed to retrieve newly created job ${jobId}`);
    }

    if (initialStatus === "downloading") {
      void executeJobPipeline(jobId, request.password).catch((err) => {
        captureException(err);
        logger.error(
          { err, jobId },
          "Unexpected error in background job execution",
        );
      });
    }

    return created;
  }

  function toJobProgress(job: ArchiveIngestJob): ArchiveIngestJobProgress {
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

  async function listJobs(
    ownerId: string,
    limit = 50,
  ): Promise<ArchiveIngestJob[]> {
    return repository.listJobsByOwner(ownerId, limit);
  }

  async function cancelJob(jobId: string): Promise<ArchiveIngestJob | null> {
    const job = await getJob(jobId);
    if (!job) return null;

    if (
      job.status === "cancelled" ||
      job.status === "done" ||
      job.status === "failed" ||
      job.status === "expired"
    ) {
      return job;
    }

    const controller = activeControllers.get(jobId);
    if (controller) {
      controller.abort();
      activeControllers.delete(jobId);
    }

    await repository.updateJob(jobId, {
      status: "cancelled",
      stage: "cancelled",
    });

    if (job.stagingPath) {
      await rm(job.stagingPath, { recursive: true, force: true }).catch(
        () => {},
      );
    }

    void pumpQueue();

    return getJob(jobId);
  }

  async function executeJobPipeline(
    jobId: string,
    password?: string | null,
  ): Promise<void> {
    const controller = new AbortController();
    activeControllers.set(jobId, controller);
    const signal = controller.signal;

    try {
      const job = await getJob(jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);
      if (job.status === "cancelled") return;

      const stagingPath = job.stagingPath;
      if (!stagingPath) throw new Error(`Job ${jobId} has no staging path`);

      await mkdir(stagingPath, { recursive: true });

      let directUrl = job.sourceUrl;
      const gdRef = parseGoogleDriveSource(job.sourceUrl);
      if (gdRef) {
        directUrl = gdRef.downloadUrl;
      }

      const referer = resolveReferer(job.sourceUrl, job.referer);
      const headOrInitialRes = await fetchFn(directUrl, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT, Referer: referer },
        signal,
      });

      if (!headOrInitialRes.ok) {
        throw new Error(
          `Remote fetch failed with HTTP ${headOrInitialRes.status}: ${headOrInitialRes.statusText}`,
        );
      }

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
          finalRes = await fetchFn(reqDetails.url, {
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

      if (bytesTotal !== null) {
        await repository.updateJob(jobId, { bytesTotal });

        const freeBytes = await getFreeBytes(stagingPath);
        if (freeBytes !== null) {
          const required = Math.ceil(
            bytesTotal * ARCHIVE_DISK_PREFLIGHT_FACTOR,
          );
          if (freeBytes < required) {
            await failJob(
              jobId,
              "INSUFFICIENT_DISK_SPACE",
              `Available disk space (${freeBytes} bytes) is less than required ${required} bytes (2.5x archive size)`,
            );
            return;
          }
        }
      }

      const archiveFilename = job.archiveFilename ?? "archive.zip";
      const archivePath = join(stagingPath, archiveFilename);

      await repository.updateJob(jobId, {
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
              await repository.updateJob(jobId, { bytesDone });
              lastDbUpdate = nowTime;
            }
          }
          await repository.updateJob(jobId, { bytesDone });
        } finally {
          try {
            reader.releaseLock();
          } catch {
            // ignore
          }
          await new Promise<void>((resolve) => fileStream.end(() => resolve()));
        }
      } else {
        const arrayBuf = await finalRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const { writeFile } = await import("node:fs/promises");
        await writeFile(archivePath, buffer);
        await repository.updateJob(jobId, {
          bytesDone: buffer.byteLength,
          bytesTotal: buffer.byteLength,
        });
      }

      if (signal.aborted) return;

      await listArchiveIntoReady(jobId, signal, password ?? null);
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

      await failJob(jobId, errorCode, errorMessage);
    } finally {
      activeControllers.delete(jobId);
      void pumpQueue();
    }
  }

  async function executeListingPhase(
    jobId: string,
    password?: string | null,
  ): Promise<void> {
    const controller = new AbortController();
    activeControllers.set(jobId, controller);
    const signal = controller.signal;

    try {
      await listArchiveIntoReady(jobId, signal, password ?? null);
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

      await failJob(jobId, errorCode, errorMessage, {
        preserveStaging: true,
      });
    } finally {
      activeControllers.delete(jobId);
      void pumpQueue();
    }
  }

  async function confirmJob(
    jobId: string,
    selection: ArchiveIngestJobSelectionItem[],
    confirmOptions: ConfirmArchiveIngestJobOptions = {},
  ): Promise<ArchiveIngestJob> {
    const job = await getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (!["ready", "uploading", "failed"].includes(job.status)) {
      throw new Error(
        `Job ${jobId} cannot be confirmed from status '${job.status}'`,
      );
    }

    if (activeControllers.has(jobId)) {
      const current = await getJob(jobId);
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
    const bytesDone = hasCompleted ? (job.bytesDone ?? 0) : 0;

    await repository.updateJob(jobId, {
      status: "uploading",
      stage: "uploading",
      selection: merged,
      storageProviderId:
        confirmOptions.storageProviderId !== undefined
          ? (confirmOptions.storageProviderId ?? null)
          : job.storageProviderId,
      bytesDone,
      errorCode: null,
      errorMessage: null,
    });

    if (activeControllers.has(jobId)) {
      const current = await getJob(jobId);
      if (!current)
        throw new Error(`Job ${jobId} not found after confirmation`);
      return current;
    }
    void executeUploadPhase(jobId, confirmOptions.password ?? null).catch(
      (err) => {
        captureException(err);
        logger.error(
          { err, jobId },
          "Unexpected error in background upload execution",
        );
      },
    );

    const updated = await getJob(jobId);
    if (!updated) throw new Error(`Job ${jobId} not found after confirmation`);
    return updated;
  }

  async function retryJob(
    jobId: string,
    retryOptions: { password?: string | null } = {},
  ): Promise<ArchiveIngestJob> {
    const job = await getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);
    if (job.status !== "failed") {
      throw new Error(
        `Job ${jobId} cannot be retried from status '${job.status}'`,
      );
    }

    await repository.updateJob(jobId, {
      status: "downloading",
      stage: "downloading",
      errorCode: null,
      errorMessage: null,
      bytesDone: 0,
    });

    void executeJobPipeline(jobId, retryOptions.password ?? null).catch(
      (err) => {
        captureException(err);
        logger.error(
          { err, jobId },
          "Unexpected error in retried job execution",
        );
      },
    );

    const updated = await getJob(jobId);
    if (!updated) throw new Error(`Job ${jobId} not found after retry`);
    return updated;
  }

  return {
    deriveSourceKey,
    extractFilename,
    resolveReferer,
    findActiveJob,
    countActiveJobs,
    submitJob,
    getJob,
    toJobProgress,
    listJobs,
    cancelJob,
    executeJobPipeline,
    executeListingPhase,
    confirmJob,
    executeUploadPhase,
    processArchiveEntries,
    retryJob,
  };
}

/** Back-compat alias: pre-refactor service name. */
export type ArchiveIngestJobService = ArchiveIngestJobManager;
export type ArchiveIngestJobServiceOptions = ArchiveIngestJobManagerOptions;
export const createArchiveIngestJobService = createArchiveIngestJobManager;
