import { Elysia } from "elysia";
import type { DbClient } from "@repo/db";
import { checkHealth } from "./internal/service";

export interface HealthRoutesOptions {
  db: DbClient;
}

export const healthRoutes = (options: HealthRoutesOptions) => {
  return new Elysia({ name: "health-routes" })
    .decorate("db", options.db)
    .get("/health", async ({ db }) => {
      const connected = await checkHealth(db);
      return { status: "ok", db: connected };
    }, {
      detail: {
        tags: ["Health"],
        summary: "Health check",
        description: "Returns service and database connectivity status.",
      },
    });
};
