import { Elysia, t } from "elysia";
import {
  UnauthorizedError,
  type AuthenticationService,
} from "@repo/contracts";
import { errorResponse, successResponse } from "../../lib/response";
import {
  createSaveEpisodeService,
  EpisodeFetchError,
  SeriesFetchError,
  type FetchFn,
  VideoSourceNotFoundError,
} from "./index";
import { EpisodeMissingFieldsError, EpisodeParseError, SeriesParseError, MirrorResolveError } from "@repo/media-scraper";
import {
  createEpisodeRepositoryInternal,
  EpisodeNotFoundError,
} from "./internal/episodes/repository";
import {
  createSeriesRepositoryInternal,
  SeriesNotFoundError,
} from "./internal/series/repository";
import { createVideoSourceRepositoryInternal } from "./internal/video-sources/repository";

export interface MediaRoutesOptions {
  db: Parameters<typeof createSaveEpisodeService>[0];
  authService: AuthenticationService;
  fetchHtml?: FetchFn;
}

export const mediaRoutes = (options: MediaRoutesOptions) => {
  const episodes = createSaveEpisodeService(options.db, {
    fetchHtml: options.fetchHtml,
  });
  const episodeRepository = createEpisodeRepositoryInternal(options.db);
  const seriesRepository = createSeriesRepositoryInternal(options.db);
  const videoSourceRepository = createVideoSourceRepositoryInternal(options.db);

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
    .get(
      "/episodes/:id",
      async ({ params, set }) => {
        const episode = await episodeRepository.findById(params.id);
        if (!episode) {
          return errorResponse(
            set,
            404,
            new EpisodeNotFoundError(`Episode with id ${params.id} not found`)
          );
        }
        return successResponse(episode);
      },
      {
        params: t.Object({
          id: t.String(),
        }),
      }
    )
    .post(
      "/episodes/:id/sources",
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

        const episode = await episodeRepository.findById(params.id);
        if (!episode) {
          return errorResponse(
            set,
            404,
            new EpisodeNotFoundError(`Episode with id ${params.id} not found`)
          );
        }

        for (const source of body.videoSources) {
          await videoSourceRepository.upsert({
            episodeId: params.id,
            type: source.type,
            url: source.url,
            label: source.label,
            quality: source.quality ?? null,
          });
        }

        const updated = await episodeRepository.findById(params.id);
        return successResponse(updated);
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
        }),
        body: t.Object({
          videoSources: t.Array(
            t.Object({
              type: t.Union([t.Literal("embed"), t.Literal("direct")]),
              url: t.String(),
              label: t.String(),
              quality: t.Optional(t.Nullable(t.String())),
            })
          ),
        }),
      }
    )
    .patch(
      "/episodes/:id/sources/:sourceId",
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

        const episode = await episodeRepository.findById(params.id);
        if (!episode) {
          return errorResponse(
            set,
            404,
            new EpisodeNotFoundError(`Episode with id ${params.id} not found`)
          );
        }

        const source = await videoSourceRepository.findById(params.sourceId);
        if (!source || source.episodeId !== params.id) {
          return errorResponse(
            set,
            404,
            new VideoSourceNotFoundError(
              `Video source with id ${params.sourceId} not found`
            )
          );
        }

        await videoSourceRepository.update(params.sourceId, body);

        const updatedEpisode = await episodeRepository.findById(params.id);
        return successResponse(updatedEpisode);
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
          sourceId: t.String(),
        }),
        body: t.Object({
          type: t.Optional(t.Union([t.Literal("embed"), t.Literal("direct")])),
          url: t.Optional(t.String()),
          label: t.Optional(t.String()),
          quality: t.Optional(t.Nullable(t.String())),
        }),
      }
    )
    .delete(
      "/episodes/:id/sources/:sourceId",
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

        const episode = await episodeRepository.findById(params.id);
        if (!episode) {
          return errorResponse(
            set,
            404,
            new EpisodeNotFoundError(`Episode with id ${params.id} not found`)
          );
        }

        const source = await videoSourceRepository.findById(params.sourceId);
        if (!source || source.episodeId !== params.id) {
          return errorResponse(
            set,
            404,
            new VideoSourceNotFoundError(
              `Video source with id ${params.sourceId} not found`
            )
          );
        }

        await videoSourceRepository.delete(params.sourceId);

        const updatedEpisode = await episodeRepository.findById(params.id);
        return successResponse(updatedEpisode);
      },
      {
        params: t.Object({
          id: t.String({ format: "uuid" }),
          sourceId: t.String(),
        }),
      }
    )
    .post(
      "/preview-scrape",
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
          const result = await episodes.previewScrape(body);
          return successResponse(result);
        } catch (error) {
          if (error instanceof EpisodeFetchError) {
            return errorResponse(set, 400, error);
          }
          if (error instanceof EpisodeMissingFieldsError) {
            return errorResponse(set, 400, error);
          }
          if (error instanceof EpisodeParseError) {
            return errorResponse(set, 400, error);
          }
          if (error instanceof MirrorResolveError) {
            return errorResponse(set, 400, error);
          }
          throw error;
        }
      },
      {
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
          source: t.Literal("otakudesu"),
          html: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/preview-scrape-series",
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
          const result = await episodes.previewScrapeSeries(body);
          return successResponse(result);
        } catch (error) {
          if (error instanceof SeriesFetchError) {
            return errorResponse(set, 400, error);
          }
          if (error instanceof SeriesParseError) {
            return errorResponse(set, 400, error);
          }
          throw error;
        }
      },
      {
        body: t.Object({
          sourceUrl: t.String({ format: "uri" }),
          source: t.Literal("otakudesu"),
          html: t.Optional(t.String()),
        }),
      }
    )
    .post(
      "/save-media",
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

        const saved = await episodes.saveMedia(body);
        return successResponse(saved);
      },
      {
        body: t.Object({
          episode: t.Object({
            sourceUrl: t.String({ format: "uri" }),
            source: t.Literal("otakudesu"),
            title: t.String(),
            videoType: t.Nullable(t.String()),
            videoSources: t.Optional(
              t.Array(
                t.Object({
                  type: t.Union([t.Literal("embed"), t.Literal("direct")]),
                  url: t.String(),
                  label: t.String(),
                  quality: t.Optional(t.Nullable(t.String())),
                })
              )
            ),
            metadata: t.Record(t.String(), t.Unknown()),
          }),
          series: t.Optional(
            t.Nullable(
              t.Object({
                sourceUrl: t.String({ format: "uri" }),
                source: t.Literal("otakudesu"),
                title: t.String(),
                description: t.Nullable(t.String()),
                posterUrl: t.Nullable(t.String()),
              })
            )
          ),
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
          videoType: t.Optional(t.Nullable(t.String())),
          description: t.Optional(t.Nullable(t.String())),
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
    )
    .patch(
      "/series/:id",
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
          const updated = await seriesRepository.updateSeries(params.id, body);
          return successResponse(updated);
        } catch (error) {
          if (error instanceof SeriesNotFoundError) {
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
          description: t.Optional(t.Nullable(t.String())),
          posterUrl: t.Optional(t.Nullable(t.String())),
        }),
      }
    )
    .patch(
      "/series/:id/episodes/order",
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

        const seriesRow = await seriesRepository.findById(params.id);
        if (!seriesRow) {
          return errorResponse(
            set,
            404,
            new SeriesNotFoundError(`Series with id ${params.id} not found`)
          );
        }

        try {
          await episodeRepository.updateOrders(body);
          return successResponse({ success: true });
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
        body: t.Array(
          t.Object({
            id: t.String({ format: "uuid" }),
            order: t.Number(),
          })
        ),
      }
    )
    .delete(
      "/series/:id",
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
          const deleted = await seriesRepository.deleteSeries(params.id);
          return successResponse(deleted);
        } catch (error) {
          if (error instanceof SeriesNotFoundError) {
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
    );
};