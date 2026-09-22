import { Elysia, t } from "elysia";
import {
  SCRAPER_PROVIDERS,
  type AuthenticationService,
} from "@repo/contracts";
import type { DbClient } from "@repo/db";
import {
  createEpisodeRepositoryInternal,
  createMediaService,
  createVideoSourceRepositoryInternal,
  createStorageProviderRegistry,
  EpisodeNotFoundError,
  VideoSourceNotFoundError,
  type BrowserFn,
  type FetchFn,
  type MediaService,
  type S3StorageService,
  type StorageProviderRegistry,
} from "@repo/media-service";
import { authGuard } from "../../lib/auth";
import { successResponse } from "../../lib/response";
import { FileTooLargeError, UploadSessionNotFoundError } from "../../lib/errors";
import { IngestService } from "./internal/ingest-service";

export const UNTHROTTLED_EPISODE_ROUTE_SUFFIXES = [
  "/remote-ingest",
];

const scraperSourceSchema = t.UnionEnum(SCRAPER_PROVIDERS);

export interface EpisodeRoutesOptions {
  db: DbClient;
  authService: AuthenticationService;
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  mediaService?: MediaService;
  ingestService?: IngestService;
}

export const episodeRoutes = (options: EpisodeRoutesOptions) => {
  const auth = authGuard(options.authService);
  const storageRegistry =
    options.storageProviderRegistry ?? createStorageProviderRegistry(options.db);
  const episodeRepo = createEpisodeRepositoryInternal(options.db, {
    s3StorageService: options.s3StorageService,
    storageProviderRegistry: storageRegistry,
  });
  const videoSourceRepo = createVideoSourceRepositoryInternal(options.db, {
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
    new IngestService(
      options.db,
      options.s3StorageService,
      storageRegistry
    );

  return new Elysia({ name: "episode-routes" })
    .get(
      "/episodes",
      async ({ query }) => {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const { seasonId } = query;
        const result = await episodeRepo.list({
          page,
          limit,
          seasonId,
        });
        return successResponse({
          episodes: result.episodes,
          meta: {
            total: result.total,
            page,
            limit,
          },
        });
      },
      {
        query: t.Object({
          page: t.Optional(t.Number({ default: 1, minimum: 1 })),
          limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
          seasonId: t.Optional(t.String()),
        }),
      }
    )
    .get(
      "/episodes/upload-progress/:sessionId",
      async ({ params }) => {
        const progress = ingestService.getUploadProgress(params.sessionId);
        return successResponse(progress);
      },
      {
        params: t.Object({
          sessionId: t.String(),
        }),
      }
    )
    .get(
      "/episodes/:id",
      async ({ params }) => {
        const episode = await episodeRepo.findById(params.id);
        if (!episode) {
          throw new EpisodeNotFoundError(`Episode with id ${params.id} not found`);
        }
        return successResponse(episode);
      },
      {
        params: t.Object({
          id: t.String(),
        }),
      }
    )
    .post(
      "/episodes/:id/sources/remote-ingest",
      async ({ params, body, request }) => {
        const stream = await ingestService.remoteIngestStream(params.id, body, request.signal);
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
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          url: t.String({ format: "uri" }),
          label: t.String(),
          quality: t.Optional(t.Nullable(t.String())),
          referer: t.Optional(t.String()),
          storageProviderId: t.Optional(t.String()),
        }),
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
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          filename: t.String(),
          contentType: t.Optional(t.Nullable(t.String())),
          storageProviderId: t.Optional(t.String()),
        }),
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
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          file: t.File(),
          label: t.String(),
          quality: t.Optional(t.Nullable(t.String())),
          uploadSessionId: t.Optional(t.Nullable(t.String())),
          storageProviderId: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/episodes/:id/sources",
      async ({ params, body }) => {
        const episode = await episodeRepo.findById(params.id);
        if (!episode) {
          throw new EpisodeNotFoundError(`Episode with id ${params.id} not found`);
        }

        for (const source of body.videoSources) {
          await videoSourceRepo.upsert({
            episodeId: params.id,
            type: source.type,
            url: source.url,
            label: source.label,
            quality: source.quality ?? null,
            storageProviderId: source.storageProviderId ?? null,
          });
        }

        const updated = await episodeRepo.findById(params.id);
        return successResponse(updated);
      },
      {
        beforeHandle: auth,
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          videoSources: t.Array(
            t.Object({
              type: t.Union([t.Literal("embed"), t.Literal("direct"), t.Literal("s3")]),
              url: t.String(),
              label: t.String(),
              quality: t.Optional(t.Nullable(t.String())),
              storageProviderId: t.Optional(t.Nullable(t.String())),
            })
          ),
        }),
      }
    )
    .post(
      "/episodes/:id/scrape-sources",
      async ({ params, body }) => {
        const result = await mediaService.scrapeAndSaveSources(params.id, body.sourceUrl);
        return successResponse(result);
      },
      {
        beforeHandle: auth,
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
        }),
      }
    )
    .patch(
      "/episodes/:id/sources/:sourceId",
      async ({ params, body }) => {
        const episode = await episodeRepo.findById(params.id);
        if (!episode) {
          throw new EpisodeNotFoundError(`Episode with id ${params.id} not found`);
        }

        const source = await videoSourceRepo.findById(params.sourceId);
        if (!source || source.episodeId !== params.id) {
          throw new VideoSourceNotFoundError(
            `Video source with id ${params.sourceId} not found`
          );
        }

        await videoSourceRepo.update(params.sourceId, body);
        const updatedEpisode = await episodeRepo.findById(params.id);
        return successResponse(updatedEpisode);
      },
      {
        beforeHandle: auth,
        params: t.Object({
          id: t.String({ format: "uuid" }),
          sourceId: t.String(),
        }),
        body: t.Object({
          type: t.Optional(t.Union([t.Literal("embed"), t.Literal("direct"), t.Literal("s3")])),
          url: t.Optional(t.String()),
          label: t.Optional(t.String()),
          quality: t.Optional(t.Nullable(t.String())),
          storageProviderId: t.Optional(t.Nullable(t.String())),
        }),
      }
    )
    .delete(
      "/episodes/:id/sources/:sourceId",
      async ({ params }) => {
        const episode = await episodeRepo.findById(params.id);
        if (!episode) {
          throw new EpisodeNotFoundError(`Episode with id ${params.id} not found`);
        }

        const source = await videoSourceRepo.findById(params.sourceId);
        if (!source || source.episodeId !== params.id) {
          throw new VideoSourceNotFoundError(
            `Video source with id ${params.sourceId} not found`
          );
        }

        await videoSourceRepo.delete(params.sourceId);
        const updatedEpisode = await episodeRepo.findById(params.id);
        return successResponse(updatedEpisode);
      },
      {
        beforeHandle: auth,
        params: t.Object({
          id: t.String({ format: "uuid" }),
          sourceId: t.String(),
        }),
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
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
          source: scraperSourceSchema,
          html: t.Optional(t.String()),
        }),
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
        body: t.Object({
          episode: t.Object({
            sourceUrl: t.String({ format: "uri" }),
            source: scraperSourceSchema,
            title: t.String(),
            videoType: t.Optional(t.Nullable(t.String())),
            videoSources: t.Optional(
              t.Array(
                t.Object({
                  type: t.Union([t.Literal("embed"), t.Literal("direct")]),
                  url: t.String(),
                  label: t.String(),
                  quality: t.Optional(t.Nullable(t.String())),
                })
              )
            ),
            metadata: t.Optional(t.Record(t.String(), t.Unknown())),
          }),
          series: t.Optional(
            t.Nullable(
              t.Object({
                sourceUrl: t.String({ format: "uri" }),
                source: scraperSourceSchema,
                title: t.String(),
                description: t.Nullable(t.String()),
                posterUrl: t.Nullable(t.String()),
              })
            )
          ),
        }),
      }
    )
    .patch(
      "/episodes/:id",
      async ({ params, body }) => {
        const updated = await episodeRepo.updateEpisode(params.id, body);
        return successResponse(updated);
      },
      {
        beforeHandle: auth,
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          title: t.Optional(t.String()),
          description: t.Optional(t.Nullable(t.String())),
        }),
      }
    )
    .delete(
      "/episodes/:id",
      async ({ params }) => {
        const deleted = await episodeRepo.deleteEpisode(params.id);
        return successResponse(deleted);
      },
      {
        beforeHandle: auth,
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
      }
    );
};
