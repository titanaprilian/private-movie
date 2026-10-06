import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, rm, statfs } from "node:fs/promises";
import { basename, join } from "node:path";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import {
  type DbClient,
  archiveIngestJobs,
  type ArchiveIngestJobEntryRow,
  type ArchiveIngestJobRow,
  type NewArchiveIngestJobRow,
} from "@repo/db";
import type {
  ArchiveIngestJob,
  ArchiveIngestJobCreateRequest,
  ArchiveIngestJobEntry,
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
}

export class ArchiveIngestJobService {
  private db: DbClient;
  private stagingBaseDir: string;
  private extractor: ArchiveExtractor;
  private fetchFn: ArchiveJobFetchFn;
  private statfsFn: ArchiveJobStatfsFn;
  private maxConcurrentJobs: number;
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

      // 4. Listing stage: inspect entries using SevenZipExtractor.list
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

      // 5. Transition to ready status and persist entries (retaining raw archive on disk)
      await this.db
        .update(archiveIngestJobs)
        .set({
          status: "ready",
          stage: "ready",
          entries: processedEntries,
          updatedAt: new Date(),
        })
        .where(eq(archiveIngestJobs.id, jobId));

      logger.info({ jobId, entryCount: processedEntries.length }, "Archive ingest job is now ready");
    } catch (err) {
      if (signal.aborted || (err as Error)?.name === "AbortError") {
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

  private async failJob(jobId: string, errorCode: string, errorMessage: string): Promise<void> {
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
}

export function createArchiveIngestJobService(
  options: ArchiveIngestJobServiceOptions
): ArchiveIngestJobService {
  return new ArchiveIngestJobService(options);
}
