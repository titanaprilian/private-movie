import { randomUUID } from "node:crypto";
import type { DbClient } from "@repo/db";
import type { S3StorageService, StorageProviderRegistry } from "@repo/media-service";
import {
  createEpisodeRepositoryInternal,
  createVideoSourceRepositoryInternal,
  EpisodeNotFoundError,
  S3NotConfiguredError,
} from "@repo/media-service";
import { FileTooLargeError, UploadSessionNotFoundError } from "../../../lib/errors";

export interface ProgressInfo {
  loaded: number;
  total: number;
  percent: number;
}

export class IngestService {
  private uploadProgressCache = new Map<string, ProgressInfo>();

  constructor(
    private db: DbClient,
    private s3StorageService?: S3StorageService,
    private storageProviderRegistry?: StorageProviderRegistry
  ) {}

  getUploadProgress(sessionId: string): ProgressInfo {
    const progress = this.uploadProgressCache.get(sessionId);
    if (!progress) {
      throw new UploadSessionNotFoundError(`Upload session with id ${sessionId} not found`);
    }
    return progress;
  }

  async getS3ServiceAndProviderId(targetProviderId: string | null): Promise<{
    s3: S3StorageService;
    resolvedProviderId: string | null;
  }> {
    let s3: S3StorageService | null = null;
    if (this.storageProviderRegistry) {
      s3 = await this.storageProviderRegistry.getService(targetProviderId);
    }
    if (!s3 && targetProviderId) {
      throw new Error("Specified storage provider not found");
    }
    if (!s3) {
      s3 = this.s3StorageService ?? null;
    }
    if (!s3 || !s3.isConfigured()) {
      throw new S3NotConfiguredError("S3 storage service is not configured");
    }

    let resolvedProviderId = targetProviderId;
    if (!resolvedProviderId && this.storageProviderRegistry) {
      const defaultProv = await this.storageProviderRegistry.getDefaultProvider();
      if (defaultProv) {
        resolvedProviderId = defaultProv.provider.id;
      }
    }

    return { s3, resolvedProviderId };
  }

  async presignUpload(
    episodeId: string,
    filename: string,
    contentType: string | null | undefined,
    storageProviderId: string | null = null
  ) {
    const episodeRepo = createEpisodeRepositoryInternal(this.db);
    const episode = await episodeRepo.findById(episodeId);
    if (!episode) {
      throw new EpisodeNotFoundError(`Episode with id ${episodeId} not found`);
    }

    const { s3 } = await this.getS3ServiceAndProviderId(storageProviderId);
    const key = `episodes/${episodeId}/${randomUUID()}-${filename}`;
    return s3.getPresignedUploadUrl(key, contentType ?? undefined);
  }

  async uploadFile(
    episodeId: string,
    file: File,
    label: string,
    quality: string | null | undefined,
    uploadSessionId: string | null | undefined,
    storageProviderId: string | null = null,
    signal?: AbortSignal
  ) {
    const maxUploadMb = parseInt(process.env.MAX_UPLOAD_SIZE_MB || "1024", 10) || 1024;
    const maxSizeBytes = maxUploadMb * 1024 * 1024;

    if (file && typeof file.size === "number" && file.size > maxSizeBytes) {
      throw new FileTooLargeError(
        maxUploadMb >= 1024 && maxUploadMb % 1024 === 0
          ? `File size exceeds the maximum allowed limit of ${maxUploadMb / 1024}GB`
          : `File size exceeds the maximum allowed limit of ${maxUploadMb}MB`
      );
    }

    const episodeRepo = createEpisodeRepositoryInternal(this.db);
    const episode = await episodeRepo.findById(episodeId);
    if (!episode) {
      throw new EpisodeNotFoundError(`Episode with id ${episodeId} not found`);
    }

    const { s3, resolvedProviderId } = await this.getS3ServiceAndProviderId(storageProviderId);

    const filename = file.name || "video.mp4";
    const key = `episodes/${episodeId}/${randomUUID()}-${filename}`;
    const contentType = file.type || "video/mp4";

    try {
      if (uploadSessionId) {
        this.uploadProgressCache.set(uploadSessionId, {
          loaded: 0,
          total: file.size && typeof file.size === "number" ? file.size : 0,
          percent: 0,
        });
      }

      await s3.uploadStream(key, file.stream(), {
        contentType,
        signal,
        onProgress: ({ loaded, total }) => {
          if (uploadSessionId) {
            const effectiveTotal =
              (file.size && typeof file.size === "number" && file.size > 0 ? file.size : total) ?? 0;
            const percent =
              effectiveTotal && effectiveTotal > 0
                ? Math.min(100, Math.round((loaded / effectiveTotal) * 100))
                : 0;
            this.uploadProgressCache.set(uploadSessionId, {
              loaded,
              total: effectiveTotal,
              percent,
            });
          }
        },
      });

    const videoSourceRepo = createVideoSourceRepositoryInternal(this.db, {
      s3StorageService: s3,
      storageProviderRegistry: this.storageProviderRegistry,
    });
      await videoSourceRepo.upsert({
        episodeId,
        type: "s3",
        url: key,
        label,
        quality: quality ?? null,
        storageProviderId: resolvedProviderId,
      });

      return await episodeRepo.findById(episodeId);
    } finally {
      if (uploadSessionId) {
        this.uploadProgressCache.delete(uploadSessionId);
      }
    }
  }

  async remoteIngestStream(
    episodeId: string,
    body: {
      url: string;
      label: string;
      quality?: string | null;
      referer?: string;
      storageProviderId?: string;
    },
    requestSignal: AbortSignal
  ): Promise<ReadableStream> {
    const episodeRepo = createEpisodeRepositoryInternal(this.db);
    const videoSourceRepo = createVideoSourceRepositoryInternal(this.db, {
      s3StorageService: this.s3StorageService,
      storageProviderRegistry: this.storageProviderRegistry,
    });

    const episode = await episodeRepo.findById(episodeId);
    if (!episode) {
      throw new EpisodeNotFoundError(`Episode with id ${episodeId} not found`);
    }

    const { s3, resolvedProviderId } = await this.getS3ServiceAndProviderId(
      body.storageProviderId ?? null
    );

    let targetUrl: URL;
    try {
      targetUrl = new URL(body.url);
    } catch {
      throw new Error("Invalid URL format");
    }

    let filename = "video.mp4";
    const pathnameSegments = targetUrl.pathname.split("/").filter(Boolean);
    if (pathnameSegments.length > 0) {
      const rawFilename = decodeURIComponent(pathnameSegments[pathnameSegments.length - 1]);
      const sanitized = rawFilename.replace(/[^a-zA-Z0-9_.-]/g, "_");
      if (sanitized.length > 0) {
        filename = sanitized;
      }
    }

    const key = `episodes/${episodeId}/${randomUUID()}-${filename}`;
    const refererHeader =
      body.referer && body.referer.trim().length > 0 ? body.referer.trim() : targetUrl.origin;

    const userAgentHeader =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

    const abortController = new AbortController();
    const onClientAbort = () => {
      console.log(`[remote-ingest] Client request.signal aborted for key ${key}`);
      abortController.abort();
    };

    if (requestSignal.aborted) {
      onClientAbort();
    } else {
      requestSignal.addEventListener("abort", onClientAbort, { once: true });
    }

    console.log(
      `[remote-ingest] Starting ingestion for episode ${episodeId}, target URL: ${targetUrl.toString()}`
    );

    const encoder = new TextEncoder();
    return new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch (e) {
            console.error(`[remote-ingest] Failed to enqueue event ${event}:`, e);
          }
        };

        try {
          console.log(`[remote-ingest] Fetching upstream URL with referer: ${refererHeader}`);
          const remoteRes = await fetch(targetUrl.toString(), {
            headers: {
              "User-Agent": userAgentHeader,
              Referer: refererHeader,
            },
            signal: abortController.signal,
          });

          if (!remoteRes.ok) {
            console.error(
              `[remote-ingest] Upstream returned HTTP ${remoteRes.status}: ${remoteRes.statusText}`
            );
            sendEvent("error", {
              code: "REMOTE_FETCH_FAILED",
              message: `Remote server returned HTTP ${remoteRes.status}: ${remoteRes.statusText}`,
            });
            await new Promise((resolve) => setTimeout(resolve, 50));
            try {
              controller.close();
            } catch {
              /* ignore */
            }
            return;
          }

          if (!remoteRes.body) {
            console.error("[remote-ingest] Upstream returned empty response body");
            sendEvent("error", {
              code: "REMOTE_FETCH_FAILED",
              message: "Remote server returned empty response body",
            });
            await new Promise((resolve) => setTimeout(resolve, 50));
            try {
              controller.close();
            } catch {
              /* ignore */
            }
            return;
          }

          const contentLengthHeader = remoteRes.headers.get("content-length");
          const parsedLength = contentLengthHeader ? parseInt(contentLengthHeader, 10) : undefined;
          const expectedTotal =
            parsedLength && !Number.isNaN(parsedLength) && parsedLength > 0
              ? parsedLength
              : undefined;

          const contentType = remoteRes.headers.get("content-type") || "video/mp4";
          console.log(
            `[remote-ingest] Upstream connected OK (Content-Length: ${
              expectedTotal ?? "unknown"
            }, Content-Type: ${contentType}). Streaming to S3 key: ${key}`
          );

          let lastLoggedMb = 0;
          await s3.uploadStream(key, remoteRes.body, {
            contentType,
            signal: abortController.signal,
            onProgress: ({ loaded, total }) => {
              const effectiveTotal = expectedTotal ?? total;
              const percent =
                effectiveTotal && effectiveTotal > 0
                  ? Math.min(100, Math.round((loaded / effectiveTotal) * 100))
                  : 0;
              const currentMb = Math.floor(loaded / (10 * 1024 * 1024)) * 10;
              if (currentMb > lastLoggedMb) {
                lastLoggedMb = currentMb;
                console.log(
                  `[remote-ingest] Upload progress: ${(loaded / (1024 * 1024)).toFixed(1)} MB (${percent}%)`
                );
              }
              sendEvent("progress", {
                loaded,
                total: effectiveTotal ?? 0,
                percent,
              });
            },
          });

          console.log(
            `[remote-ingest] S3 uploadStream finished successfully for key: ${key}. Updating DB...`
          );

          const videoSourceRow = await videoSourceRepo.upsert({
            episodeId,
            type: "s3",
            url: key,
            label: body.label,
            quality: body.quality ?? null,
            storageProviderId: resolvedProviderId,
          });

          const updatedEpisode = await episodeRepo.findById(episodeId);

          console.log(
            `[remote-ingest] DB upsert complete for episode ${episodeId}. Sending complete event...`
          );

          sendEvent("complete", {
            episode: updatedEpisode,
            videoSource: videoSourceRow,
          });
          await new Promise((resolve) => setTimeout(resolve, 50));
          try {
            controller.close();
          } catch {
            /* ignore */
          }
          console.log(`[remote-ingest] Ingestion completed successfully for episode ${episodeId}`);
        } catch (err: unknown) {
          if (abortController.signal.aborted) {
            console.warn(`[remote-ingest] Ingestion aborted for episode ${episodeId}`);
            try {
              controller.close();
            } catch {
              /* ignore */
            }
            return;
          }
          console.error("[remote-ingest] Remote video ingestion failed with exception:", err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          sendEvent("error", {
            code: "INGEST_FAILED",
            message: errorMessage,
          });
          await new Promise((resolve) => setTimeout(resolve, 50));
          try {
            controller.close();
          } catch {
            /* ignore */
          }
        } finally {
          requestSignal.removeEventListener("abort", onClientAbort);
        }
      },
    });
  }
}
