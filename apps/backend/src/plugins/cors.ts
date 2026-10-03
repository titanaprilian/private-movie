import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { isOriginAllowed, type AppConfig } from "../config/app-config";

/**
 * CORS plugin driven by the pure application configuration loader.
 * Origin evaluation is delegated to the pure `isOriginAllowed` predicate
 * so development and production rules cannot drift apart.
 */
export const corsPlugin = (config: AppConfig) =>
  new Elysia({ name: "cors-plugin" }).use(
    cors({
      origin: (request) => {
        const origin = request.headers.get("origin");
        return isOriginAllowed(origin, config);
      },
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      maxAge: 86400,
    })
  );
