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
import type { IngestService } from "./internal/ingest/service";

export const UNTHROTTLED_EPISODE_ROUTE_SUFFIXES = ["/remote-ingest"];

export const scraperSourceSchema = t.UnionEnum(SCRAPER_PROVIDERS);

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

export const listEpisodesQuerySchema = t.Object({
  page: t.Optional(t.Number({ default: 1, minimum: 1 })),
  limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
  seasonId: t.Optional(t.String()),
});

export const uploadProgressParamsSchema = t.Object({
  sessionId: t.String(),
});

export const episodeIdParamsSchema = t.Object({
  id: t.String(),
});

export const episodeUuidParamsSchema = t.Object({
  id: t.String({ format: "uuid" }),
});

export const videoSourceParamsSchema = t.Object({
  id: t.String({ format: "uuid" }),
  sourceId: t.String(),
});

const videoSourceTypeSchema = t.Union([
  t.Literal("embed"),
  t.Literal("direct"),
  t.Literal("s3"),
]);

export const remoteIngestBodySchema = t.Object({
  url: t.String({ format: "uri" }),
  label: t.String(),
  quality: t.Optional(t.Nullable(t.String())),
  referer: t.Optional(t.String()),
  storageProviderId: t.Optional(t.String()),
});

export const presignUploadBodySchema = t.Object({
  filename: t.String(),
  contentType: t.Optional(t.Nullable(t.String())),
  storageProviderId: t.Optional(t.String()),
});

export const uploadFileBodySchema = t.Object({
  file: t.File(),
  label: t.String(),
  quality: t.Optional(t.Nullable(t.String())),
  uploadSessionId: t.Optional(t.Nullable(t.String())),
  storageProviderId: t.Optional(t.String()),
});

export const addVideoSourcesBodySchema = t.Object({
  videoSources: t.Array(
    t.Object({
      type: videoSourceTypeSchema,
      url: t.String(),
      label: t.String(),
      quality: t.Optional(t.Nullable(t.String())),
      storageProviderId: t.Optional(t.Nullable(t.String())),
    }),
  ),
});

export const scrapeSourcesBodySchema = t.Object({
  sourceUrl: t.String({ format: "uri" }),
});

export const updateVideoSourceBodySchema = t.Object({
  type: t.Optional(
    t.Union([t.Literal("embed"), t.Literal("direct"), t.Literal("s3")]),
  ),
  url: t.Optional(t.String()),
  label: t.Optional(t.String()),
  quality: t.Optional(t.Nullable(t.String())),
  storageProviderId: t.Optional(t.Nullable(t.String())),
});

export const previewScrapeBodySchema = t.Object({
  sourceUrl: t.String({ format: "uri" }),
  source: scraperSourceSchema,
  html: t.Optional(t.String()),
});

export const saveMediaBodySchema = t.Object({
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
        }),
      ),
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
      }),
    ),
  ),
});

export const updateEpisodeBodySchema = t.Object({
  title: t.Optional(t.String()),
  description: t.Optional(t.Nullable(t.String())),
});
