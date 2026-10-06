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
import { successResponse, errorResponse } from "../../lib/response";
import type { ArchiveExtractFn, ArchiveFetchFn } from "./internal/archive-ingest";
import { ArchiveIngestJobService } from "./internal/archive-ingest-job-service";

export interface SeriesRoutesOptions {
  db: DbClient;
  authService: AuthenticationService;
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  mediaService?: MediaService;
  archiveFetchFn?: ArchiveFetchFn;
  archiveExtractFn?: ArchiveExtractFn;
  archiveStagingBaseDir?: string;
  archiveJobService?: ArchiveIngestJobService;
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

  const archiveJobService =
    options.archiveJobService ??
    new ArchiveIngestJobService({
      db: options.db,
      s3StorageService: options.s3StorageService,
      storageProviderRegistry: storageRegistry,
      ...(options.archiveFetchFn ? { fetchFn: options.archiveFetchFn } : {}),
      ...(options.archiveStagingBaseDir
        ? { stagingBaseDir: options.archiveStagingBaseDir }
        : { stagingBaseDir: "/tmp/archive-ingest-staging" }),
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
      "/series/:id/archive-ingest/jobs",
      async ({ params, body, headers }) => {
        const seriesRow = await seriesRepository.findById(params.id);
        if (!seriesRow) {
          throw new SeriesNotFoundError(`Series with id ${params.id} not found`);
        }
        const token = (headers["authorization"] ?? "").replace(/^Bearer\s+/i, "");
        const ownerId = await options.authService.verifyAccessToken(token);
        const job = await archiveJobService.submitJob(ownerId, {
          sourceUrl: body.sourceUrl,
          seriesId: params.id,
          storageProviderId: body.storageProviderId ?? null,
          password: body.password ?? null,
        });
        return successResponse(job);
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Start archive ingest job",
          description:
            "Starts a new durable archive ingest job for the series or returns an existing active job for the same source. Returns HTTP 200 in both cases. Requires authentication.",
        },
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
          storageProviderId: t.Optional(t.Nullable(t.String())),
          password: t.Optional(t.Nullable(t.String())),
        }),
      }
    )
    .get(
      "/series/:id/archive-ingest/jobs/:jobId",
      async ({ params, set }) => {
        const job = await archiveJobService.getJob(params.jobId);
        if (!job) {
          return errorResponse(set, 404, new Error("Job not found"));
        }
        return successResponse(job);
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Poll archive ingest job",
          description:
            "Returns the current state, progress, entries, and error details of an archive ingest job. Requires authentication.",
        },
        params: t.Object({
          id: t.String({ format: "uuid" }),
          jobId: t.String(),
        }),
      }
    )
    .post(
      "/series/:id/archive-ingest/jobs/:jobId/confirm",
      async ({ params, body, set }) => {
        const job = await archiveJobService.getJob(params.jobId);
        if (!job) {
          return errorResponse(set, 404, new Error("Job not found"));
        }
        try {
          const confirmed = await archiveJobService.confirmJob(
            params.jobId,
            body.selection.map((item) => ({
              filename: item.filename,
              episodeId: item.episodeId ?? null,
              label: item.label ?? null,
              quality: item.quality ?? null,
              isIgnored: item.isIgnored ?? false,
            })),
            {
              storageProviderId: body.storageProviderId ?? null,
              password: body.password ?? null,
            }
          );
          return successResponse(confirmed);
        } catch (err) {
          return errorResponse(set, 422, err instanceof Error ? err : new Error(String(err)));
        }
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Confirm archive ingest job selection",
          description:
            "Submits the user's episode-file match selection and starts the sequential upload phase. Requires authentication.",
        },
        params: t.Object({
          id: t.String({ format: "uuid" }),
          jobId: t.String(),
        }),
        body: t.Object({
          selection: t.Array(
            t.Object({
              filename: t.String(),
              episodeId: t.Optional(t.Nullable(t.String())),
              label: t.Optional(t.Nullable(t.String())),
              quality: t.Optional(t.Nullable(t.String())),
              isIgnored: t.Optional(t.Boolean()),
            })
          ),
          storageProviderId: t.Optional(t.Nullable(t.String())),
          password: t.Optional(t.Nullable(t.String())),
        }),
      }
    )
    .post(
      "/series/:id/archive-ingest/jobs/:jobId/cancel",
      async ({ params, set }) => {
        const cancelled = await archiveJobService.cancelJob(params.jobId);
        if (!cancelled) {
          return errorResponse(set, 404, new Error("Job not found"));
        }
        return successResponse(cancelled);
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Cancel archive ingest job",
          description:
            "Cancels an active archive ingest job, aborts its running download/upload, and purges its staging directory. Requires authentication.",
        },
        params: t.Object({
          id: t.String({ format: "uuid" }),
          jobId: t.String(),
        }),
      }
    )
    .post(
      "/series/:id/archive-ingest/jobs/:jobId/retry",
      async ({ params, body, set }) => {
        const job = await archiveJobService.getJob(params.jobId);
        if (!job) {
          return errorResponse(set, 404, new Error("Job not found"));
        }
        try {
          const retried = await archiveJobService.retryJob(params.jobId, {
            password: body?.password ?? null,
          });
          return successResponse(retried);
        } catch (err) {
          return errorResponse(set, 422, err instanceof Error ? err : new Error(String(err)));
        }
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Retry failed archive ingest job",
          description:
            "Retries a previously failed archive ingest job, re-running the download pipeline from the beginning. An optional password is forwarded for password-protected archives. Requires authentication.",
        },
        params: t.Object({
          id: t.String({ format: "uuid" }),
          jobId: t.String(),
        }),
        body: t.Optional(
          t.Object({
            password: t.Optional(t.Nullable(t.String())),
          })
        ),
      }
    );
};
