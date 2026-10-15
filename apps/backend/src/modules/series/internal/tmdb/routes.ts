import { Elysia } from "elysia";
import { authGuard } from "../../../../lib/auth";
import { successResponse } from "../../../../lib/response";
import type { SeriesRoutesOptions } from "../../schemas";
import {
  previewBulkSourcesBodySchema,
  previewScrapeSeriesBodySchema,
  seriesIdParamsSchema,
  seriesUuidParamsSchema,
  tmdbImportBodySchema,
  tmdbPreviewQuerySchema,
  tmdbSyncBodySchema,
  tmdbSyncPreviewQuerySchema,
} from "../../schemas";
import { createTmdbService } from "./service";

export const tmdbRoutes = (options: SeriesRoutesOptions) => {
  const auth = authGuard(options.authService);
  const tmdbService = createTmdbService(options.db, {
    fetchHtml: options.fetchHtml,
    browserFn: options.browserFn,
  });

  return new Elysia({ name: "series-tmdb-routes" })
    .post(
      "/preview-scrape-series",
      async ({ body }) => {
        const result = await tmdbService.previewScrapeSeries(body);
        return successResponse(result);
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "Preview scrape series",
          description: "Scrapes a source URL and returns a preview of the series without persisting it. Requires authentication.",
        },
        body: previewScrapeSeriesBodySchema,
      }
    )
    .get(
      "/series/tmdb-preview",
      async ({ query }) => {
        const result = await tmdbService.getTmdbPreview(
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
        query: tmdbPreviewQuerySchema,
      }
    )
    .post(
      "/series/tmdb-import",
      async ({ body }) => {
        const result = await tmdbService.importTmdb({
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
        body: tmdbImportBodySchema,
      }
    )
    .post(
      "/series/:id/tmdb-sync",
      async ({ params, body }) => {
        const result = await tmdbService.syncTmdb(params.id, body);
        return successResponse(result);
      },
      {
        beforeHandle: auth,
        detail: {
          tags: ["Series"],
          summary: "TMDB sync",
          description: "Syncs an existing series with TMDB metadata. Requires authentication.",
        },
        params: seriesUuidParamsSchema,
        body: tmdbSyncBodySchema,
      }
    )
    .get(
      "/series/:id/tmdb-sync-preview",
      async ({ params, query }) => {
        const result = await tmdbService.getTmdbSyncPreview(params.id, {
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
        params: seriesUuidParamsSchema,
        query: tmdbSyncPreviewQuerySchema,
      }
    )
    .post(
      "/series/:id/preview-bulk-sources",
      async ({ params, body }) => {
        const result = await tmdbService.previewBulkSources({
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
        params: seriesIdParamsSchema,
        body: previewBulkSourcesBodySchema,
      }
    );
};
