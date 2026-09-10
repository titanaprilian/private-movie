import { Elysia, t } from "elysia";
import { UnauthorizedError, type AuthenticationService } from "@repo/contracts";
import { S3NotConfiguredError, type S3StorageService } from "@repo/media-service";
import { errorResponse, successResponse } from "../../lib/response";
import {
  createStorageService,
  EpisodeNotFoundError,
  VideoSourceNotFoundError,
} from "./internal/storage-service";

export interface StorageRoutesOptions {
  db: Parameters<typeof createStorageService>[0];
  authService: AuthenticationService;
  s3StorageService?: S3StorageService;
}

export const storageRoutes = (options: StorageRoutesOptions) => {
  const storageService = createStorageService(options.db, {
    s3StorageService: options.s3StorageService,
  });

  async function checkAuth(
    headers: Record<string, string | undefined>,
    set: { status?: number | string }
  ): Promise<boolean> {
    const authHeader = headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      errorResponse(
        set,
        401,
        new UnauthorizedError("missing or invalid authorization header")
      );
      return false;
    }
    const token = authHeader.substring(7);
    try {
      await options.authService.verifyAccessToken(token);
      return true;
    } catch {
      errorResponse(set, 401, new UnauthorizedError("unauthorized"));
      return false;
    }
  }

  return new Elysia({ name: "storage-routes" }).group("/storage", (storage) =>
    storage
      .get("/metrics", async ({ headers, set }) => {
        if (!(await checkAuth(headers, set))) return;

        try {
          const metrics = await storageService.getMetrics();
          return successResponse(metrics);
        } catch (error) {
          if (error instanceof S3NotConfiguredError) {
            return errorResponse(set, 400, error);
          }
          throw error;
        }
      })
      .get(
        "/resources",
        async ({ query, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          try {
            const page = query.page ? parseInt(query.page, 10) : undefined;
            const limit = query.limit ? parseInt(query.limit, 10) : undefined;
            const status =
              query.status === "linked" || query.status === "orphaned" || query.status === "all"
                ? query.status
                : undefined;
            const sortBy =
              query.sortBy === "size" || query.sortBy === "date" || query.sortBy === "name"
                ? query.sortBy
                : undefined;
            const sortOrder =
              query.sortOrder === "asc" || query.sortOrder === "desc"
                ? query.sortOrder
                : undefined;

            const resources = await storageService.getResources({
              status,
              search: query.search,
              sortBy,
              sortOrder,
              page: Number.isNaN(page) ? undefined : page,
              limit: Number.isNaN(limit) ? undefined : limit,
            });

            return successResponse(resources);
          } catch (error) {
            if (error instanceof S3NotConfiguredError) {
              return errorResponse(set, 400, error);
            }
            throw error;
          }
        },
        {
          query: t.Optional(
            t.Object({
              status: t.Optional(t.String()),
              search: t.Optional(t.String()),
              sortBy: t.Optional(t.String()),
              sortOrder: t.Optional(t.String()),
              page: t.Optional(t.String()),
              limit: t.Optional(t.String()),
            })
          ),
        }
      )
      .post("/scan", async ({ headers, set }) => {
        if (!(await checkAuth(headers, set))) return;

        try {
          const result = await storageService.scan(true);
          return successResponse(result);
        } catch (error) {
          if (error instanceof S3NotConfiguredError) {
            return errorResponse(set, 400, error);
          }
          throw error;
        }
      })
      .put(
        "/limit",
        async ({ body, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          if (typeof body.limitGb !== "number" || body.limitGb <= 0) {
            return errorResponse(
              set,
              400,
              new Error("Storage limit must be a positive number")
            );
          }

          const result = await storageService.updateLimit(body.limitGb);
          return successResponse(result);
        },
        {
          body: t.Object({
            limitGb: t.Number(),
          }),
        }
      )
      .patch(
        "/resources/:id",
        async ({ params, body, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          try {
            const updated = await storageService.updateSourceMetadata(params.id, {
              label: body.label,
              quality: body.quality,
            });
            return successResponse(updated);
          } catch (error) {
            if (error instanceof VideoSourceNotFoundError) {
              return errorResponse(set, 404, error);
            }
            throw error;
          }
        },
        {
          params: t.Object({
            id: t.String(),
          }),
          body: t.Object({
            label: t.Optional(t.String({ minLength: 1 })),
            quality: t.Optional(t.Nullable(t.String())),
          }),
        }
      )
      .post(
        "/resources/attach",
        async ({ body, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          try {
            const attached = await storageService.attachOrphan({
              key: body.key,
              episodeId: body.episodeId,
              label: body.label,
              quality: body.quality,
            });
            return successResponse(attached);
          } catch (error) {
            if (error instanceof EpisodeNotFoundError) {
              return errorResponse(set, 404, error);
            }
            throw error;
          }
        },
        {
          body: t.Object({
            key: t.String({ minLength: 1 }),
            episodeId: t.String({ minLength: 1 }),
            label: t.Optional(t.String()),
            quality: t.Optional(t.Nullable(t.String())),
          }),
        }
      )
      .post(
        "/resources/delete",
        async ({ body, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          if (!Array.isArray(body.keys) || body.keys.length === 0) {
            return errorResponse(
              set,
              400,
              new Error("keys array is required and must not be empty")
            );
          }

          try {
            const result = await storageService.deleteResources(body.keys);
            return successResponse(result);
          } catch (error) {
            if (error instanceof S3NotConfiguredError) {
              return errorResponse(set, 400, error);
            }
            throw error;
          }
        },
        {
          body: t.Object({
            keys: t.Array(t.String({ minLength: 1 })),
          }),
        }
      )
      .post("/resources/purge-orphans", async ({ headers, set }) => {
        if (!(await checkAuth(headers, set))) return;

        try {
          const result = await storageService.purgeOrphans();
          return successResponse(result);
        } catch (error) {
          if (error instanceof S3NotConfiguredError) {
            return errorResponse(set, 400, error);
          }
          throw error;
        }
      })
      .get(
        "/resources/preview-url",
        async ({ query, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          if (!query.key || !query.key.trim()) {
            return errorResponse(
              set,
              400,
              new Error("key query parameter is required")
            );
          }

          try {
            const result = await storageService.getPreviewUrl(query.key.trim());
            return successResponse(result);
          } catch (error) {
            if (error instanceof S3NotConfiguredError) {
              return errorResponse(set, 400, error);
            }
            throw error;
          }
        },
        {
          query: t.Object({
            key: t.String({ minLength: 1 }),
          }),
        }
      )
  );
};
