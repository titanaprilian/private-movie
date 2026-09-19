import { Elysia, t } from "elysia";
import type { AuthenticationService } from "@repo/contracts";
import type { DbClient } from "@repo/db";
import {
  createEpisodeRepositoryInternal,
  createMediaService,
  createSeriesRepositoryInternal,
  createStorageProviderRegistry,
  SeriesNotFoundError,
  type BrowserFn,
  type FetchFn,
  type MediaService,
  type S3StorageService,
  type StorageProviderRegistry,
} from "@repo/media-service";
import { authGuard } from "../../lib/auth";
import { successResponse } from "../../lib/response";

export interface SeriesRoutesOptions {
  db: DbClient;
  authService: AuthenticationService;
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  mediaService?: MediaService;
}

function parseSourceTypesParam(input: unknown): string[] | undefined {
  if (input === undefined || input === null) {
    return undefined;
  }
  const rawList = Array.isArray(input) ? input : [input];
  const out: string[] = [];
  for (const item of rawList) {
    if (typeof item !== "string") {
      continue;
    }
    for (const part of item.split(",")) {
      const trimmed = part.trim();
      if (trimmed.length > 0) {
        out.push(trimmed);
      }
    }
  }
  return out.length > 0 ? out : undefined;
}

export const seriesRoutes = (options: SeriesRoutesOptions) => {
  const auth = authGuard(options.authService);
  const storageRegistry =
    options.storageProviderRegistry ??
    createStorageProviderRegistry(options.db, options.s3StorageService);

  const seriesRepository = createSeriesRepositoryInternal(options.db, {
    s3StorageService: options.s3StorageService,
    storageProviderRegistry: storageRegistry,
  });
  const episodeRepository = createEpisodeRepositoryInternal(options.db, {
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

  return new Elysia({ name: "series-routes" })
    .get(
      "/series",
      async ({ query }) => {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const { source, q, genre, filter } = query;
        const result = await seriesRepository.list({
          page,
          limit,
          source,
          q,
          genre,
          filter,
        });
        return successResponse({
          series: result.series,
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
          source: t.Optional(t.Union([t.Literal("otakudesu"), t.Literal("dramula")])),
          q: t.Optional(t.String()),
          genre: t.Optional(t.String()),
          filter: t.Optional(
            t.Union([t.Literal("all"), t.Literal("featured"), t.Literal("ongoing")])
          ),
        }),
      }
    )
    .get(
      "/series/home-feed",
      async ({ query }) => {
        const sourceTypes = parseSourceTypesParam(query?.sourceTypes);
        const genre = query?.genre;
        const feed = await seriesRepository.getHomeFeed(sourceTypes, genre);
        return successResponse(feed);
      },
      {
        query: t.Object({
          genre: t.Optional(t.String()),
          sourceTypes: t.Optional(t.Union([t.String(), t.Array(t.String())])),
        }),
      }
    )
    .post(
      "/preview-scrape-series",
      async ({ body }) => {
        const result = await mediaService.previewScrapeSeries(body);
        return successResponse(result);
      },
      {
        beforeHandle: auth,
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
          source: t.Union([t.Literal("otakudesu"), t.Literal("dramula")]),
          html: t.Optional(t.String()),
        }),
      }
    )
    .get(
      "/series/tmdb-preview",
      async ({ query }) => {
        const result = await mediaService.getTmdbPreview(
          query.type,
          query.tmdbId,
          query.includeSpecials
        );
        return successResponse(result);
      },
      {
        beforeHandle: auth,
        query: t.Object({
          type: t.Union([t.Literal("tv"), t.Literal("movie")]),
          tmdbId: t.Numeric(),
          includeSpecials: t.Optional(t.Boolean()),
        }),
      }
    )
    .post(
      "/series/tmdb-import",
      async ({ body }) => {
        const result = await mediaService.importTmdb({
          type: body.type,
          tmdbId: body.tmdbId,
          includeSpecials: body.includeSpecials,
        });
        return successResponse(result);
      },
      {
        beforeHandle: auth,
        body: t.Object({
          type: t.Union([t.Literal("tv"), t.Literal("movie")]),
          tmdbId: t.Numeric(),
          includeSpecials: t.Optional(t.Boolean()),
        }),
      }
    )
    .get(
      "/series/:id",
      async ({ params, query }) => {
        const sourceTypes = parseSourceTypesParam(query?.sourceTypes);
        const s = await seriesRepository.findByIdWithEpisodes(params.id, sourceTypes);
        if (!s) {
          throw new SeriesNotFoundError(`Series with id ${params.id} not found`);
        }
        return successResponse(s);
      },
      {
        params: t.Object({
          id: t.String(),
        }),
      }
    )
    .put(
      "/series/:id",
      async ({ params, body }) => {
        const updated = await seriesRepository.updateSeries(params.id, body);
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
          posterUrl: t.Optional(t.Nullable(t.String())),
          isFeatured: t.Optional(t.Boolean()),
          genreIds: t.Optional(t.Array(t.String())),
        }),
      }
    )
    .patch(
      "/series/:id",
      async ({ params, body }) => {
        const updated = await seriesRepository.updateSeries(params.id, body);
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
          posterUrl: t.Optional(t.Nullable(t.String())),
          isFeatured: t.Optional(t.Boolean()),
          genreIds: t.Optional(t.Array(t.String())),
        }),
      }
    )
    .delete(
      "/series/:id",
      async ({ params }) => {
        const deleted = await seriesRepository.deleteSeries(params.id);
        return successResponse(deleted);
      },
      {
        beforeHandle: auth,
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
      }
    )
    .post(
      "/series/:id/tmdb-sync",
      async ({ params, body }) => {
        const result = await mediaService.syncTmdb(params.id, body);
        return successResponse(result);
      },
      {
        beforeHandle: auth,
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          type: t.Union([t.Literal("tv"), t.Literal("movie")]),
          tmdbId: t.Numeric(),
          includeSpecials: t.Optional(t.Boolean()),
        }),
      }
    )
    .get(
      "/series/:id/tmdb-sync-preview",
      async ({ params, query }) => {
        const result = await mediaService.getTmdbSyncPreview(params.id, {
          type: query.type,
          tmdbId: query.tmdbId,
          includeSpecials: query.includeSpecials,
        });
        return successResponse(result);
      },
      {
        beforeHandle: auth,
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        query: t.Object({
          type: t.Union([t.Literal("tv"), t.Literal("movie")]),
          tmdbId: t.Numeric(),
          includeSpecials: t.Optional(t.Boolean()),
        }),
      }
    )
    .post(
      "/series/:id/preview-bulk-sources",
      async ({ params, body }) => {
        const result = await mediaService.previewBulkSources({
          seriesId: params.id,
          sourceUrl: body.sourceUrl,
          source: body.source,
          episodeOffset: body.episodeOffset,
          seasonId: body.seasonId,
          html: body.html,
        });
        return successResponse(result);
      },
      {
        beforeHandle: auth,
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
          source: t.Union([t.Literal("otakudesu"), t.Literal("dramula")]),
          episodeOffset: t.Optional(t.Number()),
          seasonId: t.Optional(t.String()),
          html: t.Optional(t.String()),
        }),
      }
    )
    .patch(
      "/series/:id/episodes/order",
      async ({ params, body }) => {
        const seriesRow = await seriesRepository.findById(params.id);
        if (!seriesRow) {
          throw new SeriesNotFoundError(`Series with id ${params.id} not found`);
        }
        await episodeRepository.updateOrders(body);
        return successResponse({ success: true });
      },
      {
        beforeHandle: auth,
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Array(
          t.Object({
            id: t.String({ format: "uuid" }),
            order: t.Number(),
            seasonId: t.Optional(t.String({ format: "uuid" })),
          })
        ),
      }
    );
};
