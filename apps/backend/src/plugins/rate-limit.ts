import { Elysia } from "elysia";
import { rateLimit } from "@elysiajs/rate-limit";
import { getClientIp } from "../lib/ip";
import { UNTHROTTLED_MEDIA_ROUTE_PREFIXES } from "../modules/media/http";
import { UNTHROTTLED_EPISODE_ROUTE_SUFFIXES } from "../modules/episodes/http";

export const GLOBAL_RATE_LIMIT_DURATION_MS = 60000;
export const GLOBAL_RATE_LIMIT_MAX = 100;

export interface RateLimitPluginOptions {
  duration?: number;
  max?: number;
  /** When true, registers a pass-through plugin with no throttling. */
  disabled?: boolean;
  /** Custom skip predicate. Defaults to the media/streaming bypass policy. */
  skip?: (request: Request) => boolean;
}

/**
 * Pure skip policy: embed, media proxy, and long-lived streaming endpoints
 * are never throttled (video streams rapidly fetch hundreds of chunks which
 * would otherwise break the global 100 req/min limit).
 */
export function isUnthrottledRoute(request: Request): boolean {
  const url = new URL(request.url);
  const isMediaUnthrottled = UNTHROTTLED_MEDIA_ROUTE_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix)
  );
  const isEpisodeUnthrottled = UNTHROTTLED_EPISODE_ROUTE_SUFFIXES.some((suffix) =>
    url.pathname.endsWith(suffix)
  );
  return isMediaUnthrottled || isEpisodeUnthrottled;
}

/**
 * Global rate limiting plugin (100 req/min by default). Tests configure
 * throttling explicitly via `disabled`/`max`/`duration` overrides instead
 * of environment checks or test headers.
 */
export const rateLimitPlugin = (options: RateLimitPluginOptions = {}) => {
  if (options.disabled) {
    return new Elysia({ name: "rate-limit-passthrough" });
  }
  return new Elysia({ name: "rate-limit-plugin" }).use(
    rateLimit({
      duration: options.duration ?? GLOBAL_RATE_LIMIT_DURATION_MS,
      max: options.max ?? GLOBAL_RATE_LIMIT_MAX,
      generator: (request, server) => getClientIp(request, server),
      errorResponse: new Response(
        JSON.stringify({
          error: {
            code: "RATE_LIMIT",
            message: "rate-limit reached",
          },
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
          },
        }
      ),
      skip: options.skip ?? isUnthrottledRoute,
    })
  );
};
