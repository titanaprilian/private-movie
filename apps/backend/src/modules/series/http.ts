import { Elysia, t } from "elysia";
import {
  SCRAPER_PROVIDERS,
  type AuthenticationService,
} from "@repo/contracts";
import type { DbClient } from "@repo/db";
import {
  createEpisodeRepositoryInternal,
  createMediaService,
  createSeasonsRepositoryInternal,
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
import { ArchiveIngestService, sseResponse } from "./internal/archive-ingest";
import type { ArchiveExtractFn, ArchiveFetchFn } from "./internal/archive-ingest";

export interface SeriesRoutesOptions {
  db: DbClient;
  authService: AuthenticationService;
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  mediaService?: MediaService;
  archiveIngestService?: ArchiveIngestService;
  archiveFetchFn?: ArchiveFetchFn;
  archiveExtractFn?: ArchiveExtractFn;
  archiveStagingBaseDir?: string;
}

const scraperSourceSchema = t.UnionEnum(SCRAPER_PROVIDERS);

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
  const seasonsRepository = createSeasonsRepositoryInternal(options.db);
  const mediaService =
    options.mediaService ??
    createMediaService(options.db, {
      fetchHtml: options.fetchHtml,
      browserFn: options.browserFn,
      s3StorageService: options.s3StorageService,
    });
  const archiveIngestService =
    options.archiveIngestService ??
    new ArchiveIngestService({
      db: options.db,
      s3StorageService: options.s3StorageService,
      storageProviderRegistry: storageRegistry,
      ...(options.archiveFetchFn ? { fetchFn: options.archiveFetchFn } : {}),
      ...(options.archiveExtractFn ? { extractFn: options.archiveExtractFn } : {}),
      ...(options.archiveStagingBaseDir
        ? { stagingBaseDir: options.archiveStagingBaseDir }
        : {}),
    });

  return new Elysia({ name: "series-routes" })
    .get(
      "/series",
      async ({ query }) => {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const { source, q, genre, filter, highlighted } = query;
        const result = await seriesRepository.list({
          page,
          limit,
          source,
          q,
          genre,
          filter,
          highlighted,
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
        detail: {
          tags: ["Series"],
          summary: "List series",
          description: "Returns a paginated library listing of series with optional filters.",
        },
        query: t.Object({
          page: t.Optional(t.Number({ default: 1, minimum: 1 })),
          limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
          source: t.Optional(scraperSourceSchema),
          q: t.Optional(t.String()),
          genre: t.Optional(t.String()),
          filter: t.Optional(
            t.Union([t.Literal("all"), t.Literal("featured"), t.Literal("ongoing")])
          ),
          highlighted: t.Optional(t.Boolean()),
        }),
      }
    )
    .get(
      "/series/home-feed",
      async ({ query }) => {
        const sourceTypes = parseSourceTypesParam(query?.sourceTypes);
        const feed = await seriesRepository.getHomeFeed(sourceTypes);
        return successResponse(feed);
      },
      {
        detail: {
          tags: ["Series"],
          summary: "Get home feed",
          description: "Returns curated home feed sections for the series library.",
        },
        query: t.Object({
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
        detail: {
          tags: ["Series"],
          summary: "Preview scrape series",
          description: "Scrapes a source URL and returns a preview of the series without persisting it. Requires authentication.",
        },
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
          source: scraperSourceSchema,
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
        detail: {
          tags: ["Series"],
          summary: "TMDB preview",
          description: "Returns a preview of TMDB metadata for a TV show or movie without importing it. Requires authentication.",
        },
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
        detail: {
          tags: ["Series"],
          summary: "TMDB import",
          description: "Imports a series from TMDB metadata into the library. Requires authentication.",
        },
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
        detail: {
          tags: ["Series"],
          summary: "Get series by id",
          description: "Returns a single series by id including its episodes.",
        },
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
        detail: {
          tags: ["Series"],
          summary: "Update series",
          description: "Performs a full update of a series by id. Requires authentication.",
        },
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          title: t.Optional(t.String()),
          description: t.Optional(t.Nullable(t.String())),
          posterUrl: t.Optional(t.Nullable(t.String())),
          logoUrl: t.Optional(t.Nullable(t.String())),
          isFeatured: t.Optional(t.Boolean()),
          isOngoingHighlighted: t.Optional(t.Boolean()),
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
        detail: {
          tags: ["Series"],
          summary: "Patch series",
          description: "Partially updates a series by id. Requires authentication.",
        },
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          title: t.Optional(t.String()),
          description: t.Optional(t.Nullable(t.String())),
          posterUrl: t.Optional(t.Nullable(t.String())),
          logoUrl: t.Optional(t.Nullable(t.String())),
          isFeatured: t.Optional(t.Boolean()),
          isOngoingHighlighted: t.Optional(t.Boolean()),
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
        detail: {
          tags: ["Series"],
          summary: "Delete series",
          description: "Deletes a series by id. Requires authentication.",
        },
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
        detail: {
          tags: ["Series"],
          summary: "TMDB sync",
          description: "Syncs an existing series with TMDB metadata. Requires authentication.",
        },
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
        detail: {
          tags: ["Series"],
          summary: "TMDB sync preview",
          description: "Previews TMDB metadata changes for an existing series without applying them. Requires authentication.",
        },
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
        detail: {
          tags: ["Series"],
          summary: "Preview bulk sources",
          description: "Previews bulk episode sources for a series from a scraper URL without persisting them. Requires authentication.",
        },
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
          source: scraperSourceSchema,
          episodeOffset: t.Optional(t.Number()),
          seasonId: t.Optional(t.String()),
          html: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/series/:id/seasons",
      async ({ params, body }) => {
        const seriesRow = await seriesRepository.findById(params.id);
        if (!seriesRow) {
          throw new SeriesNotFoundError(`Series with id ${params.id} not found`);
        }
        const created = await seasonsRepository.create({
          seriesId: params.id,
          title: body.title,
          seasonNumber: body.seasonNumber,
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.posterUrl !== undefined ? { posterUrl: body.posterUrl } : {}),
          status: body.status ?? "completed",
          ...(body.scraperUrl !== undefined ? { scraperUrl: body.scraperUrl } : {}),
          ...(body.source !== undefined ? { source: body.source } : {}),
          episodeOffset: body.episodeOffset ?? 0,
        });
        return successResponse(created);
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Create season for series",
          description: "Creates a new season for the given series. Requires authentication.",
        },
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          title: t.String({ minLength: 1 }),
          seasonNumber: t.Integer(),
          description: t.Optional(t.Nullable(t.String())),
          posterUrl: t.Optional(t.Nullable(t.String())),
          status: t.Optional(
            t.Union([
              t.Literal("completed"),
              t.Literal("ongoing"),
              t.Literal("pending"),
            ])
          ),
          scraperUrl: t.Optional(t.Nullable(t.String())),
          source: t.Optional(t.Nullable(t.String())),
          episodeOffset: t.Optional(t.Integer()),
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
        detail: {
          tags: ["Series"],
          summary: "Reorder episodes",
          description: "Updates the ordering of episodes within a series. Requires authentication.",
        },
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
    )
    .post(
      "/series/:id/archive-ingest/preview",
      async ({ params, body, request }) => {
        const seriesRepository = createSeriesRepositoryInternal(options.db);
        const seriesRow = await seriesRepository.findById(params.id);
        if (!seriesRow) {
          throw new SeriesNotFoundError(`Series with id ${params.id} not found`);
        }
        const stream = archiveIngestService.previewStream(params.id, body, request.signal);
        return sseResponse(stream);
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Preview archive ingest",
          description:
            "Downloads a remote ZIP/RAR season pack to temporary staging, extracts it, and streams download/extraction progress as server-sent events before returning the matched episode preview. Requires authentication.",
        },
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          url: t.String({ format: "uri" }),
          password: t.Optional(t.Nullable(t.String())),
          referer: t.Optional(t.Nullable(t.String())),
          targetSeasonId: t.Optional(t.Nullable(t.String())),
        }),
      }
    )
    .post(
      "/series/:id/archive-ingest/commit",
      async ({ params, body, request }) => {
        const seriesRepository = createSeriesRepositoryInternal(options.db);
        const seriesRow = await seriesRepository.findById(params.id);
        if (!seriesRow) {
          throw new SeriesNotFoundError(`Series with id ${params.id} not found`);
        }
        const stream = archiveIngestService.commitStream(params.id, body, request.signal);
        return sseResponse(stream);
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Commit archive ingest",
          description:
            "Uploads staged archive files to the selected storage provider sequentially, creates video_sources rows, and streams per-file upload progress as server-sent events. Cleans up staging on completion. Requires authentication.",
        },
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          stagingSessionId: t.String(),
          storageProviderId: t.String(),
          defaultLabel: t.Optional(t.Nullable(t.String())),
          items: t.Array(
            t.Object({
              fileId: t.String(),
              episodeId: t.String({ format: "uuid" }),
              label: t.Optional(t.Nullable(t.String())),
              quality: t.Optional(t.Nullable(t.String())),
              isIgnored: t.Optional(t.Boolean()),
            })
          ),
        }),
      }
    )
    .delete(
      "/series/:id/archive-ingest/:sessionId",
      async ({ params }) => {
        await archiveIngestService.deleteSession(params.sessionId);
        return successResponse({ success: true });
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Delete archive staging session",
          description:
            "Immediately removes the temporary staging directory for an archive ingest session. Requires authentication.",
        },
        params: t.Object({
          id: t.String({ format: "uuid" }),
          sessionId: t.String(),
        }),
      }
    );
};
