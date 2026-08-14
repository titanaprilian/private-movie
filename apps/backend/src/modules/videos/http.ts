import { Elysia, t } from "elysia";
import {
  UnauthorizedError,
  type AuthenticationService,
} from "@repo/contracts";
import { errorResponse, successResponse } from "../../lib/response";
import { createSaveVideoService } from "./index";
import { VideoParseError } from "./internal/parse";

export interface VideoRoutesOptions {
  db: Parameters<typeof createSaveVideoService>[0];
  authService: AuthenticationService;
}

export const videoRoutes = (options: VideoRoutesOptions) => {
  const videos = createSaveVideoService(options.db);

  return new Elysia({ name: "video-routes" }).post(
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