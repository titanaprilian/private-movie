/**
 * MVP public media OpenAPI contract.
 *
 * Single source of truth for the client-agnostic backend contract covering:
 * - `GET /api/series/home-feed` (public home feed)
 * - `GET /api/series/{id}` (public series details with episodes)
 * - the shared success (`{ data }`) and error (`{ error: { code, message } }`)
 *   envelope shapes.
 *
 * The backend serves this exact object at `GET /api/openapi.json` and the
 * committed `openapi/mvp-media.openapi.json` artifact (produced by
 * `bun run openapi:generate`) is what native clients generate DTOs from, so
 * both stay aligned by construction.
 */

export const MVP_MEDIA_OPENAPI_VERSION = "1.0.0";

export const MVP_MEDIA_PUBLIC_PATHS = [
  "/api/series/home-feed",
  "/api/series/{id}",
] as const;

export const MVP_MEDIA_OPENAPI = {
  openapi: "3.1.0",
  info: {
    title: "Private Movie MVP Public Media API",
    version: MVP_MEDIA_OPENAPI_VERSION,
    description:
      "MVP public media contract for native clients. Covers the public home feed, public series details with episodes, and the shared success/error envelopes.",
  },
  paths: {
    "/api/series/home-feed": {
      get: {
        operationId: "getHomeFeed",
        summary: "Get public home feed",
        description:
          "Returns the featured hero series (when present) and the Ongoing, Korean Drama, and Recently Added rows backed by series that have video sources.",
        responses: {
          "200": {
            description: "Home feed wrapped in the shared success envelope.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/HomeFeedSuccessResponse",
                },
              },
            },
          },
        },
      },
    },
    "/api/series/{id}": {
      get: {
        operationId: "getSeriesById",
        summary: "Get public series details with episodes",
        description:
          "Returns a series with its nested seasons, episodes, video sources, relations, and genres.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Series identifier.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Series details wrapped in the shared success envelope.",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/SeriesDetailsSuccessResponse",
                },
              },
            },
          },
          "404": {
            description: "Series not found, wrapped in the shared error envelope.",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      SuccessEnvelope: {
        title: "SuccessEnvelope",
        description:
          "Shared success envelope. Every 2xx media response is `{ data: T }`.",
        type: "object",
        required: ["data"],
        properties: {
          data: {
            description: "Endpoint-specific payload.",
          },
        },
      },
      ErrorEnvelope: {
        title: "ErrorEnvelope",
        description:
          "Shared error envelope. Every 4xx/5xx media response is `{ error: { code, message } }`.",
        type: "object",
        required: ["error"],
        properties: {
          error: { $ref: "#/components/schemas/ErrorObject" },
        },
      },
      ErrorObject: {
        title: "ErrorObject",
        type: "object",
        required: ["code", "message"],
        properties: {
          code: {
            type: "string",
            description:
              "Machine-readable code derived from the backend error class name (e.g. SERIES_NOT_FOUND).",
            examples: ["SERIES_NOT_FOUND", "VALIDATION"],
          },
          message: { type: "string" },
        },
      },
      ErrorResponse: {
        title: "ErrorResponse",
        allOf: [{ $ref: "#/components/schemas/ErrorEnvelope" }],
      },
      Genre: {
        title: "Genre",
        type: "object",
        required: ["id", "name", "slug"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
        },
      },
      SeriesMetadata: {
        title: "SeriesMetadata",
        type: "object",
        required: [
          "id",
          "title",
          "type",
          "isFeatured",
          "createdAt",
          "updatedAt",
          "genres",
          "seasonsCount",
          "episodesCount",
        ],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: ["string", "null"] },
          type: { type: "string" },
          posterUrl: { type: ["string", "null"] },
          backdropUrl: { type: ["string", "null"] },
          rating: { type: ["string", "null"] },
          isFeatured: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          genres: {
            type: "array",
            items: { $ref: "#/components/schemas/Genre" },
          },
          seasonsCount: { type: "integer", minimum: 0 },
          episodesCount: { type: "integer", minimum: 0 },
        },
      },
      HomeFeedHero: {
        title: "HomeFeedHero",
        allOf: [
          { $ref: "#/components/schemas/SeriesMetadata" },
          {
            type: "object",
            required: ["tags"],
            properties: {
              tags: {
                type: "array",
                items: { type: "string" },
                examples: [["TV Series", "Action"]],
              },
            },
          },
        ],
      },
      HomeFeedRow: {
        title: "HomeFeedRow",
        type: "object",
        required: ["title", "items"],
        properties: {
          title: { type: "string" },
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/SeriesMetadata" },
          },
        },
      },
      HomeFeed: {
        title: "HomeFeed",
        type: "object",
        required: ["hero", "rows"],
        properties: {
          hero: {
            anyOf: [
              { $ref: "#/components/schemas/HomeFeedHero" },
              { type: "null" },
            ],
          },
          rows: {
            type: "array",
            items: { $ref: "#/components/schemas/HomeFeedRow" },
          },
        },
      },
      HomeFeedSuccessResponse: {
        title: "HomeFeedSuccessResponse",
        type: "object",
        required: ["data"],
        properties: {
          data: { $ref: "#/components/schemas/HomeFeed" },
        },
      },
      VideoSource: {
        title: "VideoSource",
        type: "object",
        required: [
          "id",
          "episodeId",
          "type",
          "url",
          "label",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string" },
          episodeId: { type: "string" },
          type: {
            type: "string",
            description:
              "Client-consumable playback target kind ('embed' for WebView playback, 'direct' for native player).",
            enum: ["embed", "direct"],
          },
          url: {
            type: "string",
            description:
              "Normalized client-consumable playback target URL (e.g. /embed/{hash} for videobello embeds or direct video stream URL).",
          },
          label: { type: "string" },
          quality: { type: ["string", "null"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      EpisodeWithSources: {
        title: "EpisodeWithSources",
        type: "object",
        required: ["id", "title", "order", "createdAt", "updatedAt", "videoSources"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          order: { type: "integer" },
          description: { type: ["string", "null"] },
          seasonId: { type: ["string", "null"] },
          thumbnailUrl: { type: ["string", "null"] },
          rating: { type: ["string", "null"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          videoSources: {
            type: "array",
            items: { $ref: "#/components/schemas/VideoSource" },
          },
        },
      },
      SeasonWithEpisodes: {
        title: "SeasonWithEpisodes",
        type: "object",
        required: ["id", "seriesId", "title", "status", "createdAt", "updatedAt", "episodes"],
        properties: {
          id: { type: "string" },
          seriesId: { type: "string" },
          title: { type: "string" },
          description: { type: ["string", "null"] },
          posterUrl: { type: ["string", "null"] },
          seasonNumber: { type: ["integer", "null"] },
          status: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          episodes: {
            type: "array",
            items: { $ref: "#/components/schemas/EpisodeWithSources" },
          },
        },
      },
      SeriesDetails: {
        title: "SeriesDetails",
        type: "object",
        required: [
          "id",
          "title",
          "type",
          "isFeatured",
          "createdAt",
          "updatedAt",
          "seasons",
          "episodes",
          "relations",
          "genres",
        ],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: ["string", "null"] },
          type: { type: "string" },
          posterUrl: { type: ["string", "null"] },
          backdropUrl: { type: ["string", "null"] },
          rating: { type: ["string", "null"] },
          isFeatured: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          seasons: {
            type: "array",
            items: { $ref: "#/components/schemas/SeasonWithEpisodes" },
          },
          episodes: {
            type: "array",
            items: { $ref: "#/components/schemas/EpisodeWithSources" },
          },
          relations: {
            type: "array",
            items: {
              type: "object",
              required: ["relatedSeriesId", "relationType"],
              properties: {
                relatedSeriesId: { type: "string" },
                relationType: { type: "string" },
              },
            },
          },
          genres: {
            type: "array",
            items: { $ref: "#/components/schemas/Genre" },
          },
        },
      },
      SeriesDetailsSuccessResponse: {
        title: "SeriesDetailsSuccessResponse",
        type: "object",
        required: ["data"],
        properties: {
          data: { $ref: "#/components/schemas/SeriesDetails" },
        },
      },
    },
  },
} as const;

export type MvpMediaOpenApiDocument = typeof MVP_MEDIA_OPENAPI;
