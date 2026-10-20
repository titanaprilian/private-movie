import { t } from "elysia";
import type { AuthenticationService } from "@repo/contracts";
import type { DbClient } from "@repo/db";
import type {
  BrowserFn,
  FetchFn,
  MediaService,
  S3StorageService,
} from "@repo/media-service";

export interface SeasonRoutesOptions {
  db: DbClient;
  authService: AuthenticationService;
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
  mediaService?: MediaService;
}

export const seasonIdParams = t.Object({
  id: t.String(),
});

export const seasonUuidParams = t.Object({
  id: t.String({ format: "uuid" }),
});

export const updateSeasonBody = t.Object({
  title: t.Optional(t.String({ minLength: 1 })),
  description: t.Optional(t.Nullable(t.String())),
  posterUrl: t.Optional(t.Nullable(t.String())),
  status: t.Optional(t.String()),
  scraperUrl: t.Optional(t.Nullable(t.String())),
  source: t.Optional(t.Nullable(t.String())),
  episodeOffset: t.Optional(t.Integer()),
});

export const seasonTagsDetail = {
  tags: ["Seasons"],
} as const;

export const getSeasonDetail = {
  summary: "Get season",
  description: "Returns a single season by id.",
} as const;

export const updateSeasonDetail = {
  summary: "Update season",
  description: "Partially updates a season by id. Requires authentication.",
} as const;

export const deleteSeasonDetail = {
  summary: "Delete season",
  description: "Deletes a season by id. Requires authentication.",
} as const;

export const scrapeOngoingSeasonDetail = {
  summary: "Scrape ongoing season",
  description:
    "Syncs and scrapes new episodes for an ongoing season. Requires authentication.",
} as const;
