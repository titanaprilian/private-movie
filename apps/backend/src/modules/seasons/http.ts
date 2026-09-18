import { Elysia, t } from "elysia";
import type { AuthenticationService } from "@repo/contracts";
import type { DbClient } from "@repo/db";
import {
  createMediaService,
  createSeasonsRepositoryInternal,
  SeasonNotFoundError,
  SeasonNotOngoingError,
  SeasonMissingScraperUrlError,
  type BrowserFn,
  type FetchFn,
  type MediaService,
  type S3StorageService,
} from "@repo/media-service";
import { authGuard } from "../../lib/auth";
import { successResponse } from "../../lib/response";

export interface SeasonRoutesOptions {
  db: DbClient;
  authService: AuthenticationService;
  fetchHtml?: FetchFn;
  browserFn?: BrowserFn;
  s3StorageService?: S3StorageService;
  mediaService?: MediaService;
}

export const seasonRoutes = (options: SeasonRoutesOptions) => {
  const auth = authGuard(options.authService);
  const seasonsRepository = createSeasonsRepositoryInternal(options.db);
  const mediaService =
    options.mediaService ??
    createMediaService(options.db, {
      fetchHtml: options.fetchHtml,
      browserFn: options.browserFn,
      s3StorageService: options.s3StorageService,
    });

  return new Elysia({ name: "season-routes" })
    .get(
      "/seasons/:id",
      async ({ params }) => {
        const season = await seasonsRepository.findById(params.id);
        if (!season) {
          throw new SeasonNotFoundError(`Season with id ${params.id} not found`);
        }
        return successResponse(season);
      },
      {
        params: t.Object({
          id: t.String(),
        }),
      }
    )
    .patch(
      "/seasons/:id",
      async ({ params, body }) => {
        const updated = await seasonsRepository.updateSeason(params.id, {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.posterUrl !== undefined ? { posterUrl: body.posterUrl } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          ...(body.scraperUrl !== undefined ? { scraperUrl: body.scraperUrl } : {}),
          ...(body.source !== undefined ? { source: body.source } : {}),
          ...(body.episodeOffset !== undefined ? { episodeOffset: body.episodeOffset } : {}),
        });
        return successResponse(updated);
      },
      {
        beforeHandle: auth,
        params: t.Object({ id: t.String({ format: "uuid" }) }),
        body: t.Object({
          title: t.Optional(t.String({ minLength: 1 })),
          description: t.Optional(t.Nullable(t.String())),
          posterUrl: t.Optional(t.Nullable(t.String())),
          status: t.Optional(t.String()),
          scraperUrl: t.Optional(t.Nullable(t.String())),
          source: t.Optional(t.Nullable(t.String())),
          episodeOffset: t.Optional(t.Integer()),
        }),
      }
    )
    .delete(
      "/seasons/:id",
      async ({ params }) => {
        await seasonsRepository.deleteSeason(params.id);
        return successResponse({ deleted: true });
      },
      {
        beforeHandle: auth,
        params: t.Object({ id: t.String({ format: "uuid" }) }),
      }
    )
    .post(
      "/seasons/:id/scrape-ongoing",
      async ({ params }) => {
        const result = await mediaService.syncAndScrapeOngoingSeason(params.id);
        if (!result.success) {
          if (result.error?.includes("ongoing status")) {
            throw new SeasonNotOngoingError(result.error);
          }
          if (result.error?.includes("missing scraperUrl")) {
            throw new SeasonMissingScraperUrlError(result.error);
          }
          throw new Error(result.error ?? "Failed to scrape ongoing season");
        }
        return successResponse(result);
      },
      {
        beforeHandle: auth,
        params: t.Object({ id: t.String({ format: "uuid" }) }),
      }
    );
};
