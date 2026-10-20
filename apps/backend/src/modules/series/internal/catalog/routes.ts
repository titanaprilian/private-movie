import { Elysia } from "elysia";
import {
  createEpisodeRepositoryInternal,
  createStorageProviderRegistry,
} from "@repo/media-service";
import { authGuard } from "../../../../lib/auth";
import { successResponse } from "../../../../lib/response";
import { createSeasonRepository } from "../../../seasons";
import { SeriesNotFoundError } from "../errors";
import { createSeriesRepository } from "./repository";
import { parseSourceTypesParam } from "./utils/source-types";
import type { SeriesRoutesOptions } from "../../schemas";
import {
  createSeasonBodySchema,
  homeFeedQuerySchema,
  reorderEpisodesBodySchema,
  seriesIdParamsSchema,
  seriesListQuerySchema,
  seriesUuidParamsSchema,
  updateSeriesBodySchema,
} from "../../schemas";

export const catalogRoutes = (options: SeriesRoutesOptions) => {
  const auth = authGuard(options.authService);
  const storageRegistry =
    options.storageProviderRegistry ??
    createStorageProviderRegistry(options.db, options.s3StorageService);

  const seriesRepository = createSeriesRepository(options.db, {
    s3StorageService: options.s3StorageService,
    storageProviderRegistry: storageRegistry,
  });
  const episodeRepository = createEpisodeRepositoryInternal(options.db, {
    s3StorageService: options.s3StorageService,
    storageProviderRegistry: storageRegistry,
  });
  const seasonsRepository = createSeasonRepository(options.db);

  return new Elysia({ name: "series-catalog-routes" })
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
        query: seriesListQuerySchema,
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
        query: homeFeedQuerySchema,
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
        params: seriesIdParamsSchema,
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
        params: seriesUuidParamsSchema,
        body: updateSeriesBodySchema,
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
        params: seriesUuidParamsSchema,
        body: updateSeriesBodySchema,
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
        params: seriesUuidParamsSchema,
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
        params: seriesUuidParamsSchema,
        body: createSeasonBodySchema,
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
        params: seriesUuidParamsSchema,
        body: reorderEpisodesBodySchema,
      }
    );
};
