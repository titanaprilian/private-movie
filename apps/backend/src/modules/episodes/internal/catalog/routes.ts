import { Elysia } from "elysia";
import {
  createStorageProviderRegistry,
  createVideoSourceRepositoryInternal,
} from "@repo/media-service";
import { EpisodeNotFoundError, VideoSourceNotFoundError } from "../errors";
import { authGuard } from "../../../../lib/auth";
import { successResponse } from "../../../../lib/response";
import { createEpisodeRepository } from "./repository";
import {
  addVideoSourcesBodySchema,
  episodeIdParamsSchema,
  episodeUuidParamsSchema,
  listEpisodesQuerySchema,
  updateEpisodeBodySchema,
  updateVideoSourceBodySchema,
  videoSourceParamsSchema,
  type EpisodeRoutesOptions,
} from "../../schemas";

export const catalogRoutes = (options: EpisodeRoutesOptions) => {
  const auth = authGuard(options.authService);
  const storageRegistry =
    options.storageProviderRegistry ?? createStorageProviderRegistry(options.db);
  const episodeRepo = createEpisodeRepository(options.db, {
    s3StorageService: options.s3StorageService,
    storageProviderRegistry: storageRegistry,
  });
  const videoSourceRepo = createVideoSourceRepositoryInternal(options.db, {
    s3StorageService: options.s3StorageService,
    storageProviderRegistry: storageRegistry,
  });

  return new Elysia({ name: "episode-catalog-routes" })
    .get(
      "/episodes",
      async ({ query }) => {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const { seasonId } = query;
        const result = await episodeRepo.list({
          page,
          limit,
          seasonId,
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
        query: listEpisodesQuerySchema,
        detail: {
          tags: ["Episodes"],
          summary: "List episodes",
          description:
            "Returns a paginated list of episodes, optionally filtered by seasonId.",
        },
      }
    )
    .get(
      "/episodes/:id",
      async ({ params }) => {
        const episode = await episodeRepo.findById(params.id);
        if (!episode) {
          throw new EpisodeNotFoundError(`Episode with id ${params.id} not found`);
        }
        return successResponse(episode);
      },
      {
        params: episodeIdParamsSchema,
        detail: {
          tags: ["Episodes"],
          summary: "Get episode by id",
          description: "Returns a single episode by id.",
        },
      }
    )
    .post(
      "/episodes/:id/sources",
      async ({ params, body }) => {
        const episode = await episodeRepo.findById(params.id);
        if (!episode) {
          throw new EpisodeNotFoundError(`Episode with id ${params.id} not found`);
        }

        for (const source of body.videoSources) {
          await videoSourceRepo.upsert({
            episodeId: params.id,
            type: source.type,
            url: source.url,
            label: source.label,
            quality: source.quality ?? null,
            storageProviderId: source.storageProviderId ?? null,
          });
        }

        const updated = await episodeRepo.findById(params.id);
        return successResponse(updated);
      },
      {
        beforeHandle: auth,
        params: episodeUuidParamsSchema,
        body: addVideoSourcesBodySchema,
        detail: {
          tags: ["Episodes"],
          summary: "Add video sources",
          description: "Adds video sources to an episode. Requires authentication.",
        },
      }
    )
    .patch(
      "/episodes/:id/sources/:sourceId",
      async ({ params, body }) => {
        const episode = await episodeRepo.findById(params.id);
        if (!episode) {
          throw new EpisodeNotFoundError(`Episode with id ${params.id} not found`);
        }

        const source = await videoSourceRepo.findById(params.sourceId);
        if (!source || source.episodeId !== params.id) {
          throw new VideoSourceNotFoundError(
            `Video source with id ${params.sourceId} not found`
          );
        }

        await videoSourceRepo.update(params.sourceId, body);
        const updatedEpisode = await episodeRepo.findById(params.id);
        return successResponse(updatedEpisode);
      },
      {
        beforeHandle: auth,
        params: videoSourceParamsSchema,
        body: updateVideoSourceBodySchema,
        detail: {
          tags: ["Episodes"],
          summary: "Update video source",
          description:
            "Updates a video source belonging to an episode. Requires authentication.",
        },
      }
    )
    .delete(
      "/episodes/:id/sources/:sourceId",
      async ({ params }) => {
        const episode = await episodeRepo.findById(params.id);
        if (!episode) {
          throw new EpisodeNotFoundError(`Episode with id ${params.id} not found`);
        }

        const source = await videoSourceRepo.findById(params.sourceId);
        if (!source || source.episodeId !== params.id) {
          throw new VideoSourceNotFoundError(
            `Video source with id ${params.sourceId} not found`
          );
        }

        await videoSourceRepo.delete(params.sourceId);
        const updatedEpisode = await episodeRepo.findById(params.id);
        return successResponse(updatedEpisode);
      },
      {
        beforeHandle: auth,
        params: videoSourceParamsSchema,
        detail: {
          tags: ["Episodes"],
          summary: "Delete video source",
          description:
            "Deletes a video source belonging to an episode. Requires authentication.",
        },
      }
    )
    .patch(
      "/episodes/:id",
      async ({ params, body }) => {
        const updated = await episodeRepo.updateEpisode(params.id, body);
        return successResponse(updated);
      },
      {
        beforeHandle: auth,
        params: episodeUuidParamsSchema,
        body: updateEpisodeBodySchema,
        detail: {
          tags: ["Episodes"],
          summary: "Update episode",
          description:
            "Updates an episode's title and description. Requires authentication.",
        },
      }
    )
    .delete(
      "/episodes/:id",
      async ({ params }) => {
        const deleted = await episodeRepo.deleteEpisode(params.id);
        return successResponse(deleted);
      },
      {
        beforeHandle: auth,
        params: episodeUuidParamsSchema,
        detail: {
          tags: ["Episodes"],
          summary: "Delete episode",
          description: "Deletes an episode by id. Requires authentication.",
        },
      }
    );
};
