import { Elysia, t } from "elysia";
import {
  UnauthorizedError,
  type AuthenticationService,
} from "@repo/contracts";
import { errorResponse, successResponse } from "../../lib/response";
import { createSaveVideoService } from "./index";
import { VideoParseError } from "./internal/parse";
import { createVideoRepositoryInternal } from "./internal/repository";

export interface VideoRoutesOptions {
  db: Parameters<typeof createSaveVideoService>[0];
  authService: AuthenticationService;
}

export const videoRoutes = (options: VideoRoutesOptions) => {
  const videos = createSaveVideoService(options.db);
  const repository = createVideoRepositoryInternal(options.db);

  return new Elysia({ name: "video-routes" })
    .get(
      "/videos",
      async ({ query }) => {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const { source } = query;
        const result = await repository.list({
          page,
          limit,
          source,
        });
        return successResponse({
          videos: result.videos,
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
      "/videos",
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
          const saved = await videos.saveVideoFromHtml(body);
          return successResponse(saved);
        } catch (error) {
          if (error instanceof VideoParseError) {
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
    );
};