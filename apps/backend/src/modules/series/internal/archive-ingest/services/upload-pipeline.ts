import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import type { ArchiveIngestJobSelectionRow } from "@repo/db";
import type {
  S3StorageService,
  StorageProviderRegistry,
} from "@repo/media-service";
import { ArchiveEngineError, type ArchiveExtractor } from "./extractor";
import { logger } from "../../../../../lib/logger";
import { captureException } from "../../../../../lib/sentry";
import { S3NotConfiguredError } from "@repo/media-service";
import type {
  ArchiveIngestRepository,
  ArchiveIngestVideoSourceWriter,
} from "../types";
import type { ArchiveIngestJob } from "@repo/contracts";

function sanitizeS3Filename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? raw;
  const cleaned = base.replace(/[^a-zA-Z0-9_.\-()[\] ]/g, "_");
  return cleaned.length > 0 ? cleaned : "video.mp4";
}

export interface UploadPipelineDeps {
  repository: ArchiveIngestRepository;
  extractor: ArchiveExtractor;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  videoSourceRepository?: ArchiveIngestVideoSourceWriter;
  getJob(jobId: string): Promise<ArchiveIngestJob | null>;
  registerController(jobId: string): AbortController;
  releaseController(jobId: string): void;
  onSettled(): void;
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
export async function resolveUploadStorage(
  deps: UploadPipelineDeps,
  jobId: string,
): Promise<{ s3: S3StorageService; providerId: string | null }> {
  const job = await deps.getJob(jobId);
  const requestedProviderId =
    job?.storageProviderId && job.storageProviderId.trim().length > 0
      ? job.storageProviderId.trim()
      : null;

  const resolved =
    await deps.storageProviderRegistry?.getProvider(requestedProviderId);
  if (resolved) {
    if (job && resolved.provider.id !== job.storageProviderId) {
      await deps.repository.updateJob(jobId, {
        storageProviderId: resolved.provider.id,
      });
    }
    return { s3: resolved.service, providerId: resolved.provider.id };
  }
  if (requestedProviderId)
    throw new Error("Specified storage provider not found");

  const fallback = deps.s3StorageService ?? null;
  if (!fallback || !fallback.isConfigured()) {
    throw new S3NotConfiguredError("S3 storage service is not configured");
  }
  return { s3: fallback, providerId: null };
}

export async function finalizeUploadJob(
  deps: UploadPipelineDeps,
  jobId: string,
): Promise<void> {
  const job = await deps.getJob(jobId);
  if (!job) return;
  if (job.archiveFilename && job.stagingPath) {
    await unlink(join(job.stagingPath, job.archiveFilename)).catch(() => {});
  }
  if (job.stagingPath) {
    await rm(job.stagingPath, { recursive: true, force: true }).catch(() => {});
  }
  await deps.repository.updateJob(jobId, { status: "done", stage: "done" });
  logger.info({ jobId }, "Archive ingest job completed");
}

/**
 * Sequential execution engine. Resumable: starts at the first selection
 * item not yet marked completed. Each iteration extracts only the single
 * target file, uploads it, upserts video_sources, marks the item completed,
 * increments bytes_done, and deletes the local file before continuing.
 */
export async function executeUploadPhase(
  deps: UploadPipelineDeps,
  jobId: string,
  password?: string | null,
): Promise<void> {
  const controller = deps.registerController(jobId);
  const signal = controller.signal;

  try {
    const { s3, providerId: resolvedProviderId } = await resolveUploadStorage(
      deps,
      jobId,
    );

    for (;;) {
      if (signal.aborted) return;
      const job = await deps.getJob(jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);
      if (job.status === "cancelled") return;
      if (!job.stagingPath) throw new Error(`Job ${jobId} has no staging path`);

      const selection = (job.selection ?? []) as ArchiveIngestJobSelectionRow[];
      const pendingIndex = selection.findIndex(
        (i) =>
          !i.isIgnored &&
          i.episodeId &&
          !(i as { completed?: boolean }).completed,
      );
      if (pendingIndex === -1) {
        await finalizeUploadJob(deps, jobId);
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
        await deps.repository.updateJob(jobId, {
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
        const result = await deps.extractor.extract({
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
        if (!deps.videoSourceRepository) {
          throw new Error(
            "videoSourceRepository is not configured for upload phase",
          );
        }
        const row = await deps.videoSourceRepository.upsert({
          episodeId: item.episodeId!,
          type: "s3",
          url: key,
          label: item.label ?? filename,
          quality: item.quality ?? null,
          storageProviderId: resolvedProviderId,
        });

        // Mark completed + increment bytes_done, then delete local file immediately.
        const fresh = await deps.getJob(jobId);
        const freshSelection = (
          (fresh?.selection ?? []) as ArchiveIngestJobSelectionRow[]
        ).map((s, idx) =>
          idx === pendingIndex
            ? { ...s, completed: true, videoSourceId: row.id }
            : s,
        );
        await deps.repository.updateJob(jobId, {
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
    await deps.repository.updateJob(jobId, {
      status: "failed",
      stage: "failed",
      errorCode,
      errorMessage,
    });
  } finally {
    deps.releaseController(jobId);
    deps.onSettled();
  }
}
