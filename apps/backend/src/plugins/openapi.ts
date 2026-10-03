import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";

export interface OpenapiPluginOptions {
  enabled: boolean;
}

/**
 * OpenAPI/Scalar documentation plugin. When disabled, returns a typed
 * pass-through plugin that leaves the application's route types untouched.
 */
export const openapiPlugin = (options: OpenapiPluginOptions) => {
  if (!options.enabled) {
    return new Elysia({ name: "openapi-passthrough" });
  }
  return new Elysia({ name: "openapi-plugin" }).use(
    openapi({
      path: "/docs",
      specPath: "/docs/json",
      provider: "scalar",
      documentation: {
        tags: [
          { name: "Authentication", description: "User registration, login, and session management." },
          { name: "Dashboard & Scheduler", description: "Admin overview statistics and ongoing-season scheduler controls." },
          { name: "Series", description: "Series catalog, discovery feeds, and TMDB import/sync." },
          { name: "Seasons", description: "Season details, updates, and ongoing-season scraping." },
          { name: "Episodes", description: "Episode listing, video sources, uploads, and scraping." },
          { name: "Genres", description: "Genre taxonomy management." },
          { name: "Storage", description: "Storage providers, S3 inventory, and orphan management." },
          { name: "Media & Playback", description: "Video source health checks and playback support." },
          { name: "Health", description: "Service and database health checks." },
        ],
      },
    })
  );
};
