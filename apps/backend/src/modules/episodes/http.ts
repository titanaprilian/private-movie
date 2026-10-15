import { Elysia } from "elysia";
import { catalogRoutes } from "./internal/catalog/routes";
import { ingestRoutes } from "./internal/ingest/routes";
import type { EpisodeRoutesOptions } from "./schemas";

export {
  UNTHROTTLED_EPISODE_ROUTE_SUFFIXES,
  type EpisodeRoutesOptions,
} from "./schemas";

export const episodeRoutes = (options: EpisodeRoutesOptions) =>
  new Elysia({ name: "episode-routes" })
    .use(catalogRoutes(options))
    .use(ingestRoutes(options));
