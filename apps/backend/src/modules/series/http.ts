import { Elysia } from "elysia";
import { archiveIngestRoutes } from "./internal/archive-ingest/routes";
import { catalogRoutes } from "./internal/catalog/routes";
import { tmdbRoutes } from "./internal/tmdb/routes";
import type { SeriesRoutesOptions } from "./schemas";

export type { SeriesRoutesOptions } from "./schemas";
export {
  archiveJobConfirmBodySchema,
  archiveJobCreateBodySchema,
  archiveJobParamsSchema,
  archiveJobPollQuerySchema,
  archiveJobRetryBodySchema,
  createSeasonBodySchema,
  homeFeedQuerySchema,
  previewBulkSourcesBodySchema,
  previewScrapeSeriesBodySchema,
  reorderEpisodesBodySchema,
  scraperSourceSchema,
  seriesIdParamsSchema,
  seriesListQuerySchema,
  seriesUuidParamsSchema,
  tmdbImportBodySchema,
  tmdbPreviewQuerySchema,
  tmdbSyncBodySchema,
  tmdbSyncPreviewQuerySchema,
  updateSeriesBodySchema,
} from "./schemas";

export const seriesRoutes = (options: SeriesRoutesOptions) =>
  new Elysia({ name: "series-routes" })
    .use(catalogRoutes(options))
    .use(tmdbRoutes(options))
    .use(archiveIngestRoutes(options));
