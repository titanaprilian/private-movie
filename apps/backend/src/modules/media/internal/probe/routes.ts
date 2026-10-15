import { Elysia } from "elysia";
import { authGuard } from "../../../../lib/auth";
import { errorResponse, successResponse } from "../../../../lib/response";
import { sourceCheckBodySchema, type MediaRoutesOptions } from "../../schemas";
import { probeVideoSource } from "./service";

export const probeRoutes = (options: MediaRoutesOptions) => {
  const auth = authGuard(options.authService);

  return new Elysia({ name: "media-probe-routes" }).post(
    "/media/sources/check",
    async ({ body, set }) => {
      let targetUrl: URL;
      try {
        targetUrl = new URL(body.url);
      } catch {
        return errorResponse(
          set,
          400,
          new Error("Invalid URL format")
        );
      }

      return successResponse(await probeVideoSource(targetUrl, body.referer));
    },
    {
      beforeHandle: auth,
      body: sourceCheckBodySchema,
      detail: {
        tags: ["Media & Playback"],
        summary: "Check video source",
        description: "Probes a video source URL and reports whether it is reachable. Requires authentication.",
      },
    }
  );
};
