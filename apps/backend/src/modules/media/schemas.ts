import { t } from "elysia";
import type { AuthenticationService } from "@repo/contracts";
import type { DbClient } from "@repo/db";

export interface MediaRoutesOptions {
  db: DbClient;
  authService: AuthenticationService;
}

export const embedHashParamsSchema = t.Object({
  hash: t.String(),
});

export const proxyEmbedQuerySchema = t.Object({
  url: t.String(),
});

export const relayQuerySchema = t.Object({
  url: t.String(),
});

export const sourceCheckBodySchema = t.Object({
  url: t.String(),
  type: t.Union([t.Literal("direct"), t.Literal("embed"), t.Literal("s3")]),
  referer: t.Optional(t.String()),
});

/**
 * 204 no-op for blocked ad assets: never lets the request reach upstream.
 */
export const AD_BLOCK_NOOP_RESPONSE = () =>
  new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400",
    },
  });

export const UNTHROTTLED_MEDIA_ROUTE_PREFIXES = [
  "/embed",
  "/player",
  "/_app",
  "/api/media/relay",
  "/api/media/proxy",
];
