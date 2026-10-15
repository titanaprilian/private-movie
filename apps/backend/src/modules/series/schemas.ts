import { t } from "elysia";
import { SCRAPER_PROVIDERS, type AuthenticationService } from "@repo/contracts";
import type { DbClient } from "@repo/db";
import type {
  BrowserFn,
  FetchFn,
  MediaService,
  S3StorageService,
  StorageProviderRegistry,
} from "@repo/media-service";
import type {
  ArchiveFetchFn,
  ArchiveIngestJobManager,
} from "./internal/archive-ingest/services/job";

export interface SeriesRoutesOptions {
  db: DbClient;
  authService: AuthenticationService;
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  mediaService?: MediaService;
  archiveFetchFn?: ArchiveFetchFn;
  archiveStagingBaseDir?: string;
  archiveJobService?: ArchiveIngestJobManager;
}

export const scraperSourceSchema = t.UnionEnum(SCRAPER_PROVIDERS);

export const seriesListQuerySchema = t.Object({
  page: t.Optional(t.Number({ default: 1, minimum: 1 })),
  limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
  source: t.Optional(scraperSourceSchema),
  q: t.Optional(t.String()),
  genre: t.Optional(t.String()),
  filter: t.Optional(
    t.Union([t.Literal("all"), t.Literal("featured"), t.Literal("ongoing")]),
  ),
  highlighted: t.Optional(t.Boolean()),
});

export const homeFeedQuerySchema = t.Object({
  sourceTypes: t.Optional(t.Union([t.String(), t.Array(t.String())])),
});

export const previewScrapeSeriesBodySchema = t.Object({
  sourceUrl: t.String({ format: "uri" }),
  source: scraperSourceSchema,
  html: t.Optional(t.String()),
});

export const tmdbPreviewQuerySchema = t.Object({
  type: t.Union([t.Literal("tv"), t.Literal("movie")]),
  tmdbId: t.Numeric(),
  includeSpecials: t.Optional(t.Boolean()),
});

export const tmdbImportBodySchema = t.Object({
  type: t.Union([t.Literal("tv"), t.Literal("movie")]),
  tmdbId: t.Numeric(),
  includeSpecials: t.Optional(t.Boolean()),
});

export const seriesIdParamsSchema = t.Object({
  id: t.String(),
});

export const seriesUuidParamsSchema = t.Object({
  id: t.String({ format: "uuid" }),
});

export const updateSeriesBodySchema = t.Object({
  title: t.Optional(t.String()),
  description: t.Optional(t.Nullable(t.String())),
  posterUrl: t.Optional(t.Nullable(t.String())),
  logoUrl: t.Optional(t.Nullable(t.String())),
  isFeatured: t.Optional(t.Boolean()),
  isOngoingHighlighted: t.Optional(t.Boolean()),
  genreIds: t.Optional(t.Array(t.String())),
});

export const tmdbSyncBodySchema = t.Object({
  type: t.Union([t.Literal("tv"), t.Literal("movie")]),
  tmdbId: t.Numeric(),
  includeSpecials: t.Optional(t.Boolean()),
});

export const tmdbSyncPreviewQuerySchema = t.Object({
  type: t.Union([t.Literal("tv"), t.Literal("movie")]),
  tmdbId: t.Numeric(),
  includeSpecials: t.Optional(t.Boolean()),
});

export const previewBulkSourcesBodySchema = t.Object({
  sourceUrl: t.String({ format: "uri" }),
  source: scraperSourceSchema,
  episodeOffset: t.Optional(t.Number()),
  seasonId: t.Optional(t.String()),
  html: t.Optional(t.String()),
});

export const createSeasonBodySchema = t.Object({
  title: t.String({ minLength: 1 }),
  seasonNumber: t.Integer(),
  description: t.Optional(t.Nullable(t.String())),
  posterUrl: t.Optional(t.Nullable(t.String())),
  status: t.Optional(
    t.Union([
      t.Literal("completed"),
      t.Literal("ongoing"),
      t.Literal("pending"),
    ]),
  ),
  scraperUrl: t.Optional(t.Nullable(t.String())),
  source: t.Optional(t.Nullable(t.String())),
  episodeOffset: t.Optional(t.Integer()),
});

export const reorderEpisodesBodySchema = t.Array(
  t.Object({
    id: t.String({ format: "uuid" }),
    order: t.Number(),
    seasonId: t.Optional(t.String({ format: "uuid" })),
  }),
);

export const archiveJobCreateBodySchema = t.Object({
  sourceUrl: t.String({ format: "uri" }),
  storageProviderId: t.Optional(t.Nullable(t.String())),
  password: t.Optional(t.Nullable(t.String())),
  referer: t.Optional(t.Nullable(t.String())),
});

export const archiveJobParamsSchema = t.Object({
  id: t.String({ format: "uuid" }),
  jobId: t.String(),
});

export const archiveJobPollQuerySchema = t.Object({
  summary: t.Optional(t.BooleanString()),
});

export const archiveJobConfirmBodySchema = t.Object({
  selection: t.Array(
    t.Object({
      filename: t.String(),
      episodeId: t.Optional(t.Nullable(t.String())),
      label: t.Optional(t.Nullable(t.String())),
      quality: t.Optional(t.Nullable(t.String())),
      isIgnored: t.Optional(t.Boolean()),
    }),
  ),
  storageProviderId: t.Optional(t.Nullable(t.String())),
  password: t.Optional(t.Nullable(t.String())),
});

export const archiveJobRetryBodySchema = t.Optional(
  t.Object({
    password: t.Optional(t.Nullable(t.String())),
  }),
);
