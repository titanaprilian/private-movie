import { Elysia, t } from "elysia";
import {
  UnauthorizedError,
  type AuthenticationService,
} from "@repo/contracts";
import { errorResponse, successResponse } from "../../lib/response";
import { createSaveEpisodeService, type FetchHtmlFn } from "./index";
import { EpisodeParseError } from "./internal/episodes/parse";
import {
  createEpisodeRepositoryInternal,
  EpisodeNotFoundError,
} from "./internal/episodes/repository";
import {
  createSeriesRepositoryInternal,
  SeriesNotFoundError,
} from "./internal/series/repository";

export interface MediaRoutesOptions {
  db: Parameters<typeof createSaveEpisodeService>[0];
  authService: AuthenticationService;
  fetchHtml?: FetchHtmlFn;
}

export const mediaRoutes = (options: MediaRoutesOptions) => {
  const episodes = createSaveEpisodeService(options.db, {
    fetchHtml: options.fetchHtml,
  });
  const episodeRepository = createEpisodeRepositoryInternal(options.db);
  const seriesRepository = createSeriesRepositoryInternal(options.db);

  return new Elysia({ name: "media-routes" })
    .get(
      "/episodes",
      async ({ query }) => {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const { source } = query;
        const result = await episodeRepository.list({
          page,
          limit,
          source,
        });
        return successResponse({
          episodes: result.episodes,
          meta: {
            total: result.total,
            page,
            limit,
          },
        });
      },
      {
        query: t.Object({
          page: t.Optional(t.Number({ default: 1, minimum: 1 })),
          limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
          source: t.Optional(t.Literal("otakudesu")),
        }),
      }
    )
    .post(
      "/episodes",
      async ({ body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const saved = await episodes.saveEpisodeFromHtml(body);
          return successResponse(saved);
        } catch (error) {
          if (error instanceof EpisodeParseError) {
            return errorResponse(set, 400, error);
          }
          throw error;
        }
      },
      {
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
          source: t.Literal("otakudesu"),
          html: t.String(),
        }),
      }
    )
    .patch(
      "/episodes/:id",
      async ({ params, body, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const updated = await episodeRepository.updateEpisode(params.id, body);
          return successResponse(updated);
        } catch (error) {
          if (error instanceof EpisodeNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          title: t.Optional(t.String()),
          videoUrl: t.Optional(t.String()),
          videoType: t.Optional(t.Nullable(t.String())),
          metadata: t.Optional(t.Record(t.String(), t.Unknown())),
        }),
      }
    )
    .delete(
      "/episodes/:id",
      async ({ params, headers, set }) => {
        const authHeader = headers["authorization"];
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          return errorResponse(
            set,
            401,
            new UnauthorizedError("missing or invalid authorization header")
          );
        }
        const token = authHeader.substring(7);
        try {
          await options.authService.verifyAccessToken(token);
        } catch {
          return errorResponse(set, 401, new UnauthorizedError("unauthorized"));
        }

        try {
          const deleted = await episodeRepository.deleteEpisode(params.id);
          return successResponse(deleted);
        } catch (error) {
          if (error instanceof EpisodeNotFoundError) {
            return errorResponse(set, 404, error);
          }
          throw error;
        }
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
      }
    )
    .get(
      "/series",
      async ({ query }) => {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const { source } = query;
        const result = await seriesRepository.list({
          page,
          limit,
          source,
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
        query: t.Object({
          page: t.Optional(t.Number({ default: 1, minimum: 1 })),
          limit: t.Optional(t.Number({ default: 20, minimum: 1, maximum: 100 })),
          source: t.Optional(t.Literal("otakudesu")),
        }),
      }
    )
    .get(
      "/series/:id",
      async ({ params, set }) => {
        const s = await seriesRepository.findByIdWithEpisodes(params.id);
        if (!s) {
          return errorResponse(
            set,
            404,
            new SeriesNotFoundError(`Series with id ${params.id} not found`)
          );
        }
        return successResponse(s);
      },
      {
        params: t.Object({
          id: t.String(),
        }),
      }
    );
};