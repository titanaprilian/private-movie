import { Elysia } from "elysia";
import {
  createMediaService,
  createStorageProviderRegistry,
} from "@repo/media-service";
import { authGuard } from "../../../../lib/auth";
import { successResponse } from "../../../../lib/response";
import { createEpisodeRepository } from "../catalog/repository";
import { IngestService } from "./service";
import {
  episodeIdParamsSchema,
  episodeUuidParamsSchema,
  presignUploadBodySchema,
  previewScrapeBodySchema,
  remoteIngestBodySchema,
  saveMediaBodySchema,
  scrapeSourcesBodySchema,
  uploadFileBodySchema,
  uploadProgressParamsSchema,
  type EpisodeRoutesOptions,
} from "../../schemas";

export const ingestRoutes = (options: EpisodeRoutesOptions) => {
  const auth = authGuard(options.authService);
  const storageRegistry =
    options.storageProviderRegistry ?? createStorageProviderRegistry(options.db);
  const episodeRepo = createEpisodeRepository(options.db, {
    s3StorageService: options.s3StorageService,
    storageProviderRegistry: storageRegistry,
  });
  const mediaService =
    options.mediaService ??
    createMediaService(options.db, {
      fetchHtml: options.fetchHtml,
      browserFn: options.browserFn,
      s3StorageService: options.s3StorageService,
    });
  const ingestService =
    options.ingestService ??
    new IngestService(options.db, options.s3StorageService, storageRegistry);

  return new Elysia({ name: "episode-ingest-routes" })
    .get(
      "/episodes/upload-progress/:sessionId",
      async ({ params }) => {
        const progress = ingestService.getUploadProgress(params.sessionId);
        return successResponse(progress);
      },
      {
        params: uploadProgressParamsSchema,
        detail: {
          tags: ["Episodes"],
          summary: "Get upload progress",
          description:
            "Returns the current progress of an upload session by session id.",
        },
      }
    )
    .post(
      "/episodes/:id/sources/remote-ingest",
      async ({ params, body, request }) => {
        const stream = await ingestService.remoteIngestStream(
          params.id,
          body,
          request.signal
        );
        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
          },
        });
      },
      {
        beforeHandle: auth,
        params: episodeUuidParamsSchema,
        body: remoteIngestBodySchema,
        detail: {
          tags: ["Episodes"],
          summary: "Remote ingest stream",
          description:
            "Ingests a remote stream URL into episode storage and streams progress as a long-lived server-sent events (SSE) response. Requires authentication.",
          hide: false,
        },
      }
    )
    .post(
      "/episodes/:id/sources/presign-upload",
      async ({ params, body }) => {
        const res = await ingestService.presignUpload(
          params.id,
          body.filename,
          body.contentType,
          body.storageProviderId ?? null
        );
        return successResponse(res);
      },
      {
        beforeHandle: auth,
        params: episodeUuidParamsSchema,
        body: presignUploadBodySchema,
        detail: {
          tags: ["Episodes"],
          summary: "Presign upload",
          description:
            "Generates a presigned upload URL for direct file upload to an episode. Requires authentication.",
        },
      }
    )
    .post(
      "/episodes/:id/sources/upload",
      async ({ params, body, request }) => {
        await ingestService.uploadFile(
          params.id,
          body.file,
          body.label,
          body.quality,
          body.uploadSessionId,
          body.storageProviderId ?? null,
          request.signal
        );
        const updated = await episodeRepo.findById(params.id);
        return successResponse(updated);
      },
      {
        beforeHandle: auth,
        params: episodeUuidParamsSchema,
        body: uploadFileBodySchema,
        detail: {
          tags: ["Episodes"],
          summary: "Upload file",
          description:
            "Uploads a video file to an episode's sources. Requires authentication.",
        },
      }
    )
    .post(
      "/episodes/:id/scrape-sources",
      async ({ params, body }) => {
        const result = await mediaService.scrapeAndSaveSources(
          params.id,
          body.sourceUrl
        );
        return successResponse(result);
      },
      {
        beforeHandle: auth,
        params: episodeIdParamsSchema,
        body: scrapeSourcesBodySchema,
        detail: {
          tags: ["Episodes"],
          summary: "Scrape sources",
          description:
            "Scrapes video sources from a URL and saves them to the episode. Requires authentication.",
        },
      }
    )
    .post(
      "/preview-scrape",
      async ({ body }) => {
        const result = await mediaService.previewScrape(body);
        return successResponse(result);
      },
      {
        beforeHandle: auth,
        body: previewScrapeBodySchema,
        detail: {
          tags: ["Episodes"],
          summary: "Preview scrape",
          description:
            "Previews scraped media from a source URL without saving. Requires authentication.",
        },
      }
    )
    .post(
      "/save-media",
      async ({ body }) => {
        const saved = await mediaService.saveMedia({
          ...body,
          episode: {
            ...body.episode,
            metadata: body.episode.metadata ?? {},
          },
        });
        return successResponse(saved);
      },
      {
        beforeHandle: auth,
        body: saveMediaBodySchema,
        detail: {
          tags: ["Episodes"],
          summary: "Save scraped media",
          description:
            "Saves previously scraped media as episodes and series records. Requires authentication.",
        },
      }
    );
};
