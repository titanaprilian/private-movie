import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, stat, statfs, unlink, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import type { DbClient } from "@repo/db";
import type {
  ArchiveIngestCommitRequest,
  ArchiveIngestPreviewRequest,
  ArchiveStagedFileItem,
} from "@repo/contracts";
import type {
  S3StorageService,
  StorageProviderRegistry,
} from "@repo/media-service";
import {
  createEpisodeRepositoryInternal,
  createSeriesRepositoryInternal,
  createVideoSourceRepositoryInternal,
  createStorageProviderRegistry,
  S3NotConfiguredError,
  SeriesNotFoundError,
} from "@repo/media-service";
import {
  createArchiveStagingSessionId,
  ensureArchiveStagingDir,
  getArchiveStagingBaseDir,
  getArchiveStagingDir,
  removeArchiveStagingDir,
  ArchivePasswordRequiredError,
  extractArchive,
  InvalidArchivePasswordError,
  matchArchiveFilesToEpisodes,
  type ArchiveProcessRunner,
} from "../../episodes";
import { captureException } from "../../../lib/sentry";
import { logger } from "../../../lib/logger";
import { DownloadIncompleteError } from "../../../lib/errors";
import {
  createProgressThrottle,
  SSE_HEARTBEAT_COMMENT,
  SSE_HEARTBEAT_MS,
  shouldSendHeartbeat,
} from "../../../lib/sse-progress";

export const MAX_ARCHIVE_DOWNLOAD_MB_DEFAULT = 5120;
export const ARCHIVE_DISK_SAFETY_MARGIN_BYTES = 2 * 1024 * 1024 * 1024;
export const ARCHIVE_DISK_EXPANSION_FACTOR = 2.2;

export function getMaxArchiveDownloadBytes(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.MAX_ARCHIVE_DOWNLOAD_MB;
  const parsed = raw ? parseInt(raw, 10) : NaN;
  const mb = !Number.isNaN(parsed) && parsed > 0 ? parsed : MAX_ARCHIVE_DOWNLOAD_MB_DEFAULT;
  return mb * 1024 * 1024;
}

export type ArchiveStatfsFn = (path: string) => Promise<{ bavail: number; bsize: number }>;

const defaultStatfsFn: ArchiveStatfsFn = async (path: string) => {
  const s = await statfs(path);
  return { bavail: Number(s.bavail), bsize: Number(s.bsize) };
};

export type ArchiveFetchFn = (
  url: string,
  init?: RequestInit
) => Promise<Response>;

export type ArchiveExtractFn = (options: {
  archivePath: string;
  destDir: string;
  password?: string | null;
  onProgressFile?: (filename: string) => void;
}) => Promise<void>;

const defaultExtractFn: ArchiveExtractFn = async (options) => {
  await extractArchive({
    archivePath: options.archivePath,
    destDir: options.destDir,
    password: options.password,
    onProgressFile: options.onProgressFile,
  });
};

export interface ArchiveIngestServiceOptions {
  db: DbClient;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  fetchFn?: ArchiveFetchFn;
  extractFn?: ArchiveExtractFn;
  stagingBaseDir?: string;
  createSessionId?: () => string;
  extractRunner?: ArchiveProcessRunner;
  statfsFn?: ArchiveStatfsFn;
  maxArchiveBytes?: number;
  heartbeatMs?: number;
}

interface StagedManifestEntry {
  fileId: string;
  absolutePath: string;
  filename: string;
  fileSizeBytes: number;
}

const MANIFEST_FILENAME = "manifest.json";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function sseHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFilesRecursive(full)));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function sanitizeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? raw;
  const cleaned = base.replace(/[^a-zA-Z0-9_.\-()[\] ]/g, "_");
  return cleaned.length > 0 ? cleaned : "video.mp4";
}

export class ArchiveIngestService {
  private db: DbClient;
  private s3StorageService?: S3StorageService;
  private storageProviderRegistry: StorageProviderRegistry;
  private fetchFn: ArchiveFetchFn;
  private extractFn: ArchiveExtractFn;
  private stagingBaseDir: string;
  private createSessionId: () => string;
  private extractRunner?: ArchiveProcessRunner;
  private statfsFn: ArchiveStatfsFn;
  private maxArchiveBytes: number;
  private heartbeatMs: number;
  private activeControllers = new Map<string, AbortController>();

  constructor(options: ArchiveIngestServiceOptions) {
    this.db = options.db;
    this.s3StorageService = options.s3StorageService;
    this.storageProviderRegistry =
      options.storageProviderRegistry ??
      createStorageProviderRegistry(options.db, options.s3StorageService);
    this.fetchFn = options.fetchFn ?? ((url, init) => fetch(url, init));
    this.extractFn = options.extractFn ?? defaultExtractFn;
    this.stagingBaseDir = options.stagingBaseDir ?? getArchiveStagingBaseDir();
    this.createSessionId = options.createSessionId ?? createArchiveStagingSessionId;
    this.extractRunner = options.extractRunner;
    this.statfsFn = options.statfsFn ?? defaultStatfsFn;
    this.maxArchiveBytes = options.maxArchiveBytes ?? getMaxArchiveDownloadBytes();
    this.heartbeatMs = options.heartbeatMs ?? SSE_HEARTBEAT_MS;
  }

  async deleteSession(sessionId: string): Promise<void> {
    const controller = this.activeControllers.get(sessionId);
    if (controller) {
      try {
        controller.abort();
      } catch {
        /* ignore */
      }
      this.activeControllers.delete(sessionId);
    }
    await removeArchiveStagingDir(this.stagingBaseDir, sessionId);
  }

  private async getFreeBytes(dir: string): Promise<number | null> {
    try {
      const s = await this.statfsFn(dir);
      return s.bavail * s.bsize;
    } catch {
      return null;
    }
  }

  private async resolveSeriesOrThrow(seriesId: string) {
    const seriesRepo = createSeriesRepositoryInternal(this.db, {
      s3StorageService: this.s3StorageService,
      storageProviderRegistry: this.storageProviderRegistry,
    });
    const found = await seriesRepo.findByIdWithEpisodes(seriesId);
    if (!found) {
      throw new SeriesNotFoundError(`Series with id ${seriesId} not found`);
    }
    return seriesRepo;
  }

  private async resolveS3(providerId: string | null): Promise<{
    s3: S3StorageService;
    resolvedProviderId: string | null;
  }> {
    let s3: S3StorageService | null = null;
    const effectiveProviderId = providerId && providerId.trim().length > 0 ? providerId : null;
    if (this.storageProviderRegistry) {
      s3 = await this.storageProviderRegistry.getService(effectiveProviderId);
    }
    if (!s3 && effectiveProviderId) {
      throw new Error("Specified storage provider not found");
    }
    if (!s3) {
      s3 = this.s3StorageService ?? null;
    }
    if (!s3 || !s3.isConfigured()) {
      throw new S3NotConfiguredError("S3 storage service is not configured");
    }
    let resolvedProviderId = effectiveProviderId;
    if (!resolvedProviderId && this.storageProviderRegistry) {
      const defaultProv = await this.storageProviderRegistry.getDefaultProvider();
      if (defaultProv) {
        resolvedProviderId = defaultProv.provider.id;
      }
    }
    return { s3, resolvedProviderId: resolvedProviderId ?? null };
  }

  previewStream(
    seriesId: string,
    body: ArchiveIngestPreviewRequest,
    requestSignal: AbortSignal
  ): ReadableStream {
    const encoder = new TextEncoder();
    const send = (
      controller: ReadableStreamDefaultController,
      event: string,
      data: unknown
    ) => {
      try {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      } catch {
        /* client disconnected */
      }
    };
    const finish = async (controller: ReadableStreamDefaultController) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      try {
        controller.close();
      } catch {
        /* ignore */
      }
    };

    return new ReadableStream({
      start: async (controller) => {
        let cleanupSessionId: string | null = null;
        try {
          const seriesRepo = await this.resolveSeriesOrThrow(seriesId);

          let targetUrl: URL;
          try {
            targetUrl = new URL(body.url);
          } catch {
            send(controller, "error", {
              code: "INVALID_URL",
              message: "Invalid URL format",
            });
            await finish(controller);
            return;
          }

          const sessionId = this.createSessionId();
          cleanupSessionId = sessionId;
          const sessionDir = await ensureArchiveStagingDir(this.stagingBaseDir, sessionId);
          const extractedDir = join(sessionDir, "extracted");
          await mkdir(extractedDir, { recursive: true });

          const urlPath = targetUrl.pathname.split("/").filter(Boolean).pop() ?? "archive.zip";
          const archiveFilename = sanitizeFilename(decodeURIComponent(urlPath));
          const archivePath = join(sessionDir, archiveFilename);
          const referer =
            body.referer && body.referer.trim().length > 0
              ? body.referer.trim()
              : targetUrl.origin;

          // NOTE: intentionally decoupled from requestSignal. A transient SSE
          // socket disconnect must NOT abort the background download/extraction.
          // Only an explicit DELETE (deleteSession) aborts via activeControllers.
          void requestSignal;
          const abortController = new AbortController();
          this.activeControllers.set(sessionId, abortController);

          let lastActivity = Date.now();
          const trackedSend = (event: string, data: unknown) => {
            lastActivity = Date.now();
            send(controller, event, data);
          };
          const heartbeatMs = this.heartbeatMs;
          const heartbeat = setInterval(() => {
            try {
              if (shouldSendHeartbeat(lastActivity, Date.now(), heartbeatMs)) {
                controller.enqueue(encoder.encode(SSE_HEARTBEAT_COMMENT));
              }
            } catch {
              /* client disconnected */
            }
          }, heartbeatMs);
          const stopHeartbeat = () => clearInterval(heartbeat);

          const failAndCleanup = async (code: string, message: string) => {
            trackedSend("error", { code, message });
            stopHeartbeat();
            this.activeControllers.delete(sessionId);
            await removeArchiveStagingDir(this.stagingBaseDir, sessionId).catch(() => {});
            await finish(controller);
          };

          try {
            const remoteRes = await this.fetchFn(targetUrl.toString(), {
              headers: { "User-Agent": USER_AGENT, Referer: referer },
              signal: abortController.signal,
            });
            if (!remoteRes.ok) {
              await failAndCleanup(
                "REMOTE_FETCH_FAILED",
                `Remote server returned HTTP ${remoteRes.status}: ${remoteRes.statusText}`
              );
              return;
            }

            const lengthHeader = remoteRes.headers.get("content-length");
            const parsed = lengthHeader ? parseInt(lengthHeader, 10) : NaN;
            const total = !Number.isNaN(parsed) && parsed > 0 ? parsed : null;

            // Max-size preflight: reject oversized archives without downloading.
            if (total !== null && total > this.maxArchiveBytes) {
              await failAndCleanup(
                "ARCHIVE_TOO_LARGE",
                `Archive size ${total} bytes exceeds the maximum of ${this.maxArchiveBytes} bytes`
              );
              return;
            }

            // Disk-space preflight: require free >= content-length * 2.2 + 2GB.
            if (total !== null) {
              const free = await this.getFreeBytes(sessionDir);
              if (free !== null) {
                const required =
                  total * ARCHIVE_DISK_EXPANSION_FACTOR + ARCHIVE_DISK_SAFETY_MARGIN_BYTES;
                if (free < required) {
                  await failAndCleanup(
                    "INSUFFICIENT_DISK_SPACE",
                    "Not enough disk space to download and extract this archive"
                  );
                  return;
                }
              }
            } else {
              // Unknown length: require at least the 2GB safety margin upfront.
              const free = await this.getFreeBytes(sessionDir);
              if (free !== null && free < ARCHIVE_DISK_SAFETY_MARGIN_BYTES) {
                await failAndCleanup(
                  "INSUFFICIENT_DISK_SPACE",
                  "Not enough disk space to download and extract this archive"
                );
                return;
              }
            }

            try {
              if (remoteRes.body) {
                const fileStream = createWriteStream(archivePath);
                let loaded = 0;
                const reader = (remoteRes.body as ReadableStream<Uint8Array>).getReader();
                const throttle = createProgressThrottle();
                let diskCheckCounter = 0;
                try {
                  while (true) {
                    if (abortController.signal.aborted) {
                      throw new DOMException("Aborted", "AbortError");
                    }
                    const { done, value } = await reader.read();
                    if (done) break;
                    loaded += value.byteLength;
                    await new Promise<void>((resolve, reject) => {
                      fileStream.write(value, (err) => (err ? reject(err) : resolve()));
                    });
                    // Runtime cap: abort downloads that exceed the 5GB cap mid-stream.
                    if (loaded > this.maxArchiveBytes) {
                      throw Object.assign(
                        new Error(
                          `Archive size exceeds the maximum of ${this.maxArchiveBytes} bytes`
                        ),
                        { code: "ARCHIVE_TOO_LARGE" }
                      );
                    }
                    // Runtime disk guard for chunked transfers without content-length.
                    if (total === null) {
                      diskCheckCounter += 1;
                      if (diskCheckCounter % 5 === 0 || loaded < 1024 * 1024) {
                        const free = await this.getFreeBytes(sessionDir);
                        if (free !== null && free < ARCHIVE_DISK_SAFETY_MARGIN_BYTES) {
                          throw Object.assign(
                            new Error("Not enough disk space to download this archive"),
                            { code: "INSUFFICIENT_DISK_SPACE" }
                          );
                        }
                      }
                    }
                    const percent =
                      total && total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : null;
                    const sample = { loaded, total, percent };
                    if (throttle.shouldEmit(sample)) {
                      throttle.markEmitted(sample);
                      trackedSend("download_progress", sample);
                    }
                  }
                  if (total !== null && loaded < total) {
                    throw new DownloadIncompleteError(loaded, total);
                  }
                } finally {
                  try {
                    reader.releaseLock();
                  } catch {
                    /* ignore */
                  }
                  await new Promise<void>((resolve) => fileStream.end(() => resolve()));
                }
              } else {
                const text = await remoteRes.text();
                const buffer = Buffer.from(text);
                if (buffer.byteLength > this.maxArchiveBytes) {
                  await failAndCleanup(
                    "ARCHIVE_TOO_LARGE",
                    `Archive size ${buffer.byteLength} bytes exceeds the maximum of ${this.maxArchiveBytes} bytes`
                  );
                  return;
                }
                await writeFile(archivePath, buffer);
                trackedSend("download_progress", {
                  loaded: buffer.byteLength,
                  total: total ?? buffer.byteLength,
                  percent: 100,
                });
              }
            } catch (err) {
              if (abortController.signal.aborted) {
                // Explicit cancel via deleteSession already purged the directory.
                stopHeartbeat();
                this.activeControllers.delete(sessionId);
                try {
                  controller.close();
                } catch {
                  /* ignore */
                }
                return;
              }
              if ((err as { code?: string })?.code === "ARCHIVE_TOO_LARGE") {
                await failAndCleanup("ARCHIVE_TOO_LARGE", (err as Error).message);
                return;
              }
              if ((err as { code?: string })?.code === "INSUFFICIENT_DISK_SPACE") {
                await failAndCleanup("INSUFFICIENT_DISK_SPACE", (err as Error).message);
                return;
              }
              throw err;
            }

            trackedSend("extract_progress", { currentFile: archiveFilename, totalFiles: null });
            try {
              if (this.extractRunner) {
                await extractArchive({
                  archivePath,
                  destDir: extractedDir,
                  password: body.password ?? null,
                  runner: this.extractRunner,
                });
              } else {
                await this.extractFn({
                  archivePath,
                  destDir: extractedDir,
                  password: body.password ?? null,
                  onProgressFile: (filename) =>
                    trackedSend("extract_progress", { currentFile: filename, totalFiles: null }),
                });
              }
            } catch (err) {
              if (abortController.signal.aborted) {
                stopHeartbeat();
                this.activeControllers.delete(sessionId);
                try {
                  controller.close();
                } catch {
                  /* ignore */
                }
                return;
              }
              if (err instanceof ArchivePasswordRequiredError) {
                await failAndCleanup("ARCHIVE_PASSWORD_REQUIRED", err.message);
              } else if (err instanceof InvalidArchivePasswordError) {
                await failAndCleanup("INVALID_ARCHIVE_PASSWORD", err.message);
              } else {
                await failAndCleanup(
                  "ARCHIVE_EXTRACTION_FAILED",
                  err instanceof Error ? err.message : "Failed to extract archive"
                );
              }
              return;
            }

            // Free gigabytes of staging disk immediately: delete raw archive post-extraction.
            await unlink(archivePath).catch(() => {});

            const absoluteFiles = await listFilesRecursive(extractedDir);
            const entries: StagedManifestEntry[] = [];
            for (const abs of absoluteFiles) {
              if (basename(abs) === MANIFEST_FILENAME) continue;
              const info = await stat(abs);
              entries.push({
                fileId: randomUUID(),
                absolutePath: abs,
                filename: relative(extractedDir, abs),
                fileSizeBytes: info.size,
              });
            }
            await writeFile(join(sessionDir, MANIFEST_FILENAME), JSON.stringify(entries));

            const withEpisodes = await seriesRepo.findByIdWithEpisodes(seriesId);
            const episodesForMatch = (withEpisodes?.episodes ?? [])
              .filter((ep) =>
                body.targetSeasonId ? ep.seasonId === body.targetSeasonId : true
              )
              .map((ep) => ({
                id: ep.id,
                order: (ep as { order?: number | null }).order ?? null,
                tmdbEpisodeNumber:
                  (ep as { tmdbEpisodeNumber?: number | null }).tmdbEpisodeNumber ?? null,
              }));

            const items: ArchiveStagedFileItem[] = matchArchiveFilesToEpisodes(
              entries.map((e) => ({
                fileId: e.fileId,
                filename: e.filename,
                fileSizeBytes: e.fileSizeBytes,
              })),
              episodesForMatch
            );

            trackedSend("preview_ready", { stagingSessionId: sessionId, items });
            stopHeartbeat();
            this.activeControllers.delete(sessionId);
            await finish(controller);
          } finally {
            stopHeartbeat();
            this.activeControllers.delete(sessionId);
          }
        } catch (err) {
          if (err instanceof SeriesNotFoundError) {
            throw err;
          }
          if (err instanceof DownloadIncompleteError) {
            captureException(err, { loaded: err.loaded, expected: err.expected });
            logger.error({ err, loaded: err.loaded, expected: err.expected }, "archive download incomplete");
            try {
              send(controller, "error", {
                code: "DOWNLOAD_INCOMPLETE",
                message: err.message,
              });
            } catch {
              /* ignore */
            }
            if (cleanupSessionId) {
              this.activeControllers.delete(cleanupSessionId);
              await removeArchiveStagingDir(this.stagingBaseDir, cleanupSessionId).catch(
                () => {}
              );
            }
            await finish(controller);
            return;
          }
          if ((err as Error)?.name === "AbortError") {
            if (cleanupSessionId) {
              this.activeControllers.delete(cleanupSessionId);
            }
            try {
              controller.close();
            } catch {
              /* ignore */
            }
            return;
          }
          captureException(err);
          logger.error({ err }, "archive ingest stream failed");
          try {
            send(controller, "error", {
              code: "INGEST_FAILED",
              message: err instanceof Error ? err.message : String(err),
            });
          } catch {
            /* ignore */
          }
          if (cleanupSessionId) {
            this.activeControllers.delete(cleanupSessionId);
            await removeArchiveStagingDir(this.stagingBaseDir, cleanupSessionId).catch(
              () => {}
            );
          }
          await finish(controller);
        }
      },
    });
  }

  commitStream(
    seriesId: string,
    body: ArchiveIngestCommitRequest,
    requestSignal: AbortSignal
  ): ReadableStream {
    const encoder = new TextEncoder();
    const send = (
      controller: ReadableStreamDefaultController,
      event: string,
      data: unknown
    ) => {
      try {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      } catch {
        /* client disconnected */
      }
    };
    const finish = async (controller: ReadableStreamDefaultController) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      try {
        controller.close();
      } catch {
        /* ignore */
      }
    };

    return new ReadableStream({
      start: async (controller) => {
        try {
          await this.resolveSeriesOrThrow(seriesId);
          const { s3, resolvedProviderId } = await this.resolveS3(
            body.storageProviderId ?? null
          );

          const sessionDir = getArchiveStagingDir(this.stagingBaseDir, body.stagingSessionId);
          let manifest: StagedManifestEntry[];
          try {
            const raw = await readFile(join(sessionDir, MANIFEST_FILENAME), "utf8");
            manifest = JSON.parse(raw) as StagedManifestEntry[];
          } catch {
            send(controller, "error", {
              code: "STAGING_SESSION_NOT_FOUND",
              message: "Staging session not found or expired",
            });
            await finish(controller);
            return;
          }
          const byFileId = new Map(manifest.map((m) => [m.fileId, m]));

          const episodeRepo = createEpisodeRepositoryInternal(this.db, {
            s3StorageService: this.s3StorageService,
            storageProviderRegistry: this.storageProviderRegistry,
          });
          const videoSourceRepo = createVideoSourceRepositoryInternal(this.db, {
            s3StorageService: this.s3StorageService,
            storageProviderRegistry: this.storageProviderRegistry,
          });

          const activeItems = body.items.filter((i) => !i.isIgnored);
          let completed = 0;

          for (let index = 0; index < activeItems.length; index += 1) {
            const item = activeItems[index];
            const staged = byFileId.get(item.fileId);
            if (!staged) {
              send(controller, "error", {
                code: "STAGED_FILE_NOT_FOUND",
                message: `Staged file ${item.fileId} not found`,
              });
              await finish(controller);
              return;
            }
            const episode = await episodeRepo.findById(item.episodeId);
            if (!episode) {
              send(controller, "error", {
                code: "EPISODE_NOT_FOUND",
                message: `Episode with id ${item.episodeId} not found`,
              });
              await finish(controller);
              return;
            }

            const filename = sanitizeFilename(basename(staged.filename));
            const key = `episodes/${item.episodeId}/${randomUUID()}-${filename}`;
            const total = staged.fileSizeBytes;
            const label = item.label ?? body.defaultLabel ?? filename;
            const quality = item.quality ?? null;

            const abortController = new AbortController();
            const onAbort = () => abortController.abort();
            if (requestSignal.aborted) {
              onAbort();
            } else {
              requestSignal.addEventListener("abort", onAbort, { once: true });
            }

            try {
              const { createReadStream } = await import("node:fs");
              const { Readable } = await import("node:stream");
              const nodeStream = createReadStream(staged.absolutePath);
              const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;
              const uploadThrottle = createProgressThrottle();

              await s3.uploadStream(key, webStream, {
                contentType: "video/mp4",
                signal: abortController.signal,
                onProgress: ({ loaded }) => {
                  const percent =
                    total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
                  const sample = { loaded, total, percent };
                  if (!uploadThrottle.shouldEmit(sample)) return;
                  uploadThrottle.markEmitted(sample);
                  send(controller, "upload_progress", {
                    fileIndex: index,
                    totalFiles: activeItems.length,
                    filename,
                    percent,
                    loaded,
                    total,
                  });
                },
              });

              const row = await videoSourceRepo.upsert({
                episodeId: item.episodeId,
                type: "s3",
                url: key,
                label,
                quality,
                storageProviderId: resolvedProviderId,
              });
              completed += 1;
              send(controller, "file_completed", {
                episodeId: item.episodeId,
                videoSourceId: row.id,
              });
            } finally {
              requestSignal.removeEventListener("abort", onAbort);
            }
          }

          await removeArchiveStagingDir(this.stagingBaseDir, body.stagingSessionId);
          send(controller, "all_completed", { success: true, count: completed });
          await finish(controller);
        } catch (err) {
          if (err instanceof SeriesNotFoundError || err instanceof S3NotConfiguredError) {
            throw err;
          }
          if (err instanceof Error && err.message === "Specified storage provider not found") {
            send(controller, "error", {
              code: "STORAGE_PROVIDER_NOT_FOUND",
              message: err.message,
            });
            await finish(controller);
            return;
          }
          captureException(err);
          logger.error({ err }, "archive commit stream failed");
          send(controller, "error", {
            code: "INGEST_FAILED",
            message: err instanceof Error ? err.message : String(err),
          });
          await finish(controller);
        }
      },
    });
  }
}

export function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, { status: 200, headers: sseHeaders() });
}
