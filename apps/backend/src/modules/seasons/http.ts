import { Elysia } from "elysia";
import { createMediaService } from "@repo/media-service";
import { authGuard } from "../../lib/auth";
import { successResponse } from "../../lib/response";
import { createSeasonRepository } from "./internal/repository";
import { createSeasonService } from "./internal/service";
import {
  SeasonMissingScraperUrlError,
  SeasonNotFoundError,
  SeasonNotOngoingError,
} from "./internal/errors";
import {
  deleteSeasonDetail,
  getSeasonDetail,
  scrapeOngoingSeasonDetail,
  seasonIdParams,
  seasonUuidParams,
  updateSeasonBody,
  updateSeasonDetail,
  type SeasonRoutesOptions,
} from "./schemas";

export type { SeasonRoutesOptions } from "./schemas";

export const seasonRoutes = (options: SeasonRoutesOptions) => {
  const auth = authGuard(options.authService);
  const seasonsRepository = createSeasonRepository(options.db);
  const mediaService =
    options.mediaService ??
    createMediaService(options.db, {
      fetchHtml: options.fetchHtml,
      browserFn: options.browserFn,
      s3StorageService: options.s3StorageService,
    });
  const seasonService = createSeasonService(options.db, {
    seasonsRepository,
    scrapeSeason: (season) => mediaService.syncAndScrapeOngoingSeason(season.id),
  });

  return new Elysia({ name: "season-routes" })
    .guard(
      {
        detail: {
          tags: ["Seasons"],
        },
      },
      (app) =>
        app
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
              params: seasonIdParams,
              detail: {
                summary: getSeasonDetail.summary,
                description: getSeasonDetail.description,
              },
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
                ...(body.episodeOffset !== undefined
                  ? { episodeOffset: body.episodeOffset }
                  : {}),
              });
              return successResponse(updated);
            },
            {
              beforeHandle: auth,
              params: seasonUuidParams,
              body: updateSeasonBody,
              detail: {
                summary: updateSeasonDetail.summary,
                description: updateSeasonDetail.description,
              },
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
              params: seasonUuidParams,
              detail: {
                summary: deleteSeasonDetail.summary,
                description: deleteSeasonDetail.description,
              },
            }
          )
          .post(
            "/seasons/:id/scrape-ongoing",
            async ({ params }) => {
              try {
                const result = await seasonService.scrapeOngoingSeason(params.id);
                return successResponse(result);
              } catch (error) {
                if (
                  error instanceof SeasonNotOngoingError ||
                  error instanceof SeasonMissingScraperUrlError
                ) {
                  await seasonsRepository.updateSeason(params.id, {
                    lastScrapedAt: new Date(),
                    lastScrapeError: error.message,
                  });
                }
                throw error;
              }
            },
            {
              beforeHandle: auth,
              params: seasonUuidParams,
              detail: {
                summary: scrapeOngoingSeasonDetail.summary,
                description: scrapeOngoingSeasonDetail.description,
              },
            }
          )
    );
};
