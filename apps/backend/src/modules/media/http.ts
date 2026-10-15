import { Elysia } from "elysia";
import { MVP_MEDIA_OPENAPI } from "@repo/contracts";
import { embedApiRoutes } from "./internal/embed/routes";
import { proxyRoutes } from "./internal/proxy/routes";
import { cryptoRoutes } from "./internal/crypto/routes";
import { probeRoutes } from "./internal/probe/routes";
import type { MediaRoutesOptions } from "./schemas";

export type { MediaRoutesOptions } from "./schemas";
export { embedRoutes } from "./internal/embed/routes";
export {
  AD_BLOCK_NOOP_RESPONSE,
  UNTHROTTLED_MEDIA_ROUTE_PREFIXES,
  embedHashParamsSchema,
  proxyEmbedQuerySchema,
  relayQuerySchema,
  sourceCheckBodySchema,
} from "./schemas";

export const mediaRoutes = (options: MediaRoutesOptions) =>
  new Elysia({ name: "media-routes" })
    .get("/openapi.json", () => MVP_MEDIA_OPENAPI, {
      detail: { hide: true },
    })
    .use(embedApiRoutes())
    .use(proxyRoutes(options))
    .use(cryptoRoutes(options))
    .use(probeRoutes(options));
