import { Elysia, t } from "elysia";
import {
  UnauthorizedError,
  type AuthenticationService,
  type StorageProviderType,
} from "@repo/contracts";
import { S3NotConfiguredError, type S3StorageService, type StorageProviderRegistry } from "@repo/media-service";
import { errorResponse, successResponse } from "../../lib/response";
import {
  createStorageService,
  EpisodeNotFoundError,
  VideoSourceNotFoundError,
  StorageProviderNotFoundError,
  StorageProviderInUseError,
} from "./internal/storage-service";

export interface StorageRoutesOptions {
  db: Parameters<typeof createStorageService>[0];
  authService: AuthenticationService;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
}

export const storageRoutes = (options: StorageRoutesOptions) => {
  const storageService = createStorageService(options.db, {
    s3StorageService: options.s3StorageService,
    storageProviderRegistry: options.storageProviderRegistry,
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
      // Storage Provider Management Endpoints
      .get("/providers", async ({ headers, set }) => {
        if (!(await checkAuth(headers, set))) return;

        try {
          const providers = await storageService.listProviders();
          return successResponse(providers);
        } catch (error) {
          if (error instanceof S3NotConfiguredError) {
            return errorResponse(set, 400, error);
          }
          throw error;
        }
      })
      .get(
        "/providers/:id",
        async ({ params, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          try {
            const provider = await storageService.getProvider(params.id);
            return successResponse(provider);
          } catch (error) {
            if (error instanceof StorageProviderNotFoundError) {
              return errorResponse(set, 404, error);
            }
            throw error;
          }
        },
        {
          params: t.Object({
            id: t.String({ minLength: 1 }),
          }),
        }
      )
      .post(
        "/providers",
        async ({ body, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          const provider = await storageService.createProvider({
            name: body.name,
            providerType: body.providerType as StorageProviderType,
            endpoint: body.endpoint,
            region: body.region,
            bucket: body.bucket,
            accessKeyId: body.accessKeyId,
            secretAccessKey: body.secretAccessKey,
            publicBaseUrl: body.publicBaseUrl,
            forcePathStyle: body.forcePathStyle,
            storageLimitGb: body.storageLimitGb,
            isDefault: body.isDefault,
            isEnabled: body.isEnabled,
          });
          return successResponse(provider);
        },
        {
          beforeHandle: async ({ headers, set }) => {
            if (!(await checkAuth(headers, set))) return;
          },
          body: t.Object({
            name: t.String({ minLength: 1 }),
            providerType: t.String({ minLength: 1 }),
            endpoint: t.String({ minLength: 1 }),
            region: t.String({ minLength: 1 }),
            bucket: t.String({ minLength: 1 }),
            accessKeyId: t.String({ minLength: 1 }),
            secretAccessKey: t.String({ minLength: 1 }),
            publicBaseUrl: t.Optional(t.Nullable(t.String())),
            forcePathStyle: t.Optional(t.Boolean()),
            storageLimitGb: t.Optional(t.Number()),
            isDefault: t.Optional(t.Boolean()),
            isEnabled: t.Optional(t.Boolean()),
          }),
        }
      )
      .put(
        "/providers/:id",
        async ({ params, body, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          try {
            const provider = await storageService.updateProvider(params.id, {
              name: body.name,
              providerType: body.providerType as StorageProviderType | undefined,
              endpoint: body.endpoint,
              region: body.region,
              bucket: body.bucket,
              accessKeyId: body.accessKeyId,
              secretAccessKey: body.secretAccessKey,
              publicBaseUrl: body.publicBaseUrl,
              forcePathStyle: body.forcePathStyle,
              storageLimitGb: body.storageLimitGb,
              isDefault: body.isDefault,
              isEnabled: body.isEnabled,
            });
            return successResponse(provider);
          } catch (error) {
            if (error instanceof StorageProviderNotFoundError) {
              return errorResponse(set, 404, error);
            }
            throw error;
          }
        },
        {
          params: t.Object({
            id: t.String({ minLength: 1 }),
          }),
          body: t.Object({
            name: t.Optional(t.String({ minLength: 1 })),
            providerType: t.Optional(t.String({ minLength: 1 })),
            endpoint: t.Optional(t.String({ minLength: 1 })),
            region: t.Optional(t.String({ minLength: 1 })),
            bucket: t.Optional(t.String({ minLength: 1 })),
            accessKeyId: t.Optional(t.String()),
            secretAccessKey: t.Optional(t.String()),
            publicBaseUrl: t.Optional(t.Nullable(t.String())),
            forcePathStyle: t.Optional(t.Boolean()),
            storageLimitGb: t.Optional(t.Number()),
            isDefault: t.Optional(t.Boolean()),
            isEnabled: t.Optional(t.Boolean()),
          }),
        }
      )
      .delete(
        "/providers/:id",
        async ({ params, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          try {
            await storageService.deleteProvider(params.id);
            return successResponse({ success: true, deletedId: params.id });
          } catch (error) {
            if (error instanceof StorageProviderNotFoundError) {
              return errorResponse(set, 404, error);
            }
            if (error instanceof StorageProviderInUseError) {
              return errorResponse(set, 409, error);
            }
            throw error;
          }
        },
        {
          params: t.Object({
            id: t.String({ minLength: 1 }),
          }),
        }
      )
      .post(
        "/providers/test",
        async ({ body, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          try {
            const result = await storageService.testProvider(body ?? {});
            return successResponse(result);
          } catch (error) {
            if (error instanceof StorageProviderNotFoundError) {
              return errorResponse(set, 404, error);
            }
            return errorResponse(
              set,
              400,
              error instanceof Error ? error : new Error(String(error))
            );
          }
        },
        {
          body: t.Optional(
            t.Object({
              providerId: t.Optional(t.String()),
              endpoint: t.Optional(t.String()),
              region: t.Optional(t.String()),
              bucket: t.Optional(t.String()),
              accessKeyId: t.Optional(t.String()),
              secretAccessKey: t.Optional(t.String()),
              forcePathStyle: t.Optional(t.Boolean()),
            })
          ),
        }
      )

      // Storage Scoped Operations
      .get(
        "/metrics",
        async ({ query, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          try {
            const metrics = await storageService.getMetrics(query?.providerId);
            return successResponse(metrics);
          } catch (error) {
            if (error instanceof StorageProviderNotFoundError) {
              return errorResponse(set, 404, error);
            }
            if (error instanceof S3NotConfiguredError) {
              return errorResponse(set, 400, error);
            }
            throw error;
          }
        },
        {
          query: t.Optional(
            t.Object({
              providerId: t.Optional(t.String()),
            })
          ),
        }
      )
      .get(
        "/resources",
        async ({ query, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          try {
            const page = query?.page ? parseInt(query.page, 10) : undefined;
            const limit = query?.limit ? parseInt(query.limit, 10) : undefined;
            const status =
              query?.status === "linked" || query?.status === "orphaned" || query?.status === "all"
                ? query.status
                : undefined;
            const sortBy =
              query?.sortBy === "size" || query?.sortBy === "date" || query?.sortBy === "name"
                ? query.sortBy
                : undefined;
            const sortOrder =
              query?.sortOrder === "asc" || query?.sortOrder === "desc"
                ? query.sortOrder
                : undefined;

            const resources = await storageService.getResources({
              providerId: query?.providerId,
              status,
              search: query?.search,
              sortBy,
              sortOrder,
              page: Number.isNaN(page) ? undefined : page,
              limit: Number.isNaN(limit) ? undefined : limit,
            });

            return successResponse(resources);
          } catch (error) {
            if (error instanceof StorageProviderNotFoundError) {
              return errorResponse(set, 404, error);
            }
            if (error instanceof S3NotConfiguredError) {
              return errorResponse(set, 400, error);
            }
            throw error;
          }
        },
        {
          query: t.Optional(
            t.Object({
              providerId: t.Optional(t.String()),
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
      .post(
        "/scan",
        async ({ body, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          try {
            const result = await storageService.scan(true, body?.providerId);
            return successResponse(result);
          } catch (error) {
            if (error instanceof StorageProviderNotFoundError) {
              return errorResponse(set, 404, error);
            }
            if (error instanceof S3NotConfiguredError) {
              return errorResponse(set, 400, error);
            }
            throw error;
          }
        },
        {
          body: t.Optional(
            t.Object({
              providerId: t.Optional(t.String()),
            })
          ),
        }
      )
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

          try {
            const result = await storageService.updateLimit(body.limitGb, body.providerId);
            return successResponse(result);
          } catch (error) {
            if (error instanceof StorageProviderNotFoundError) {
              return errorResponse(set, 404, error);
            }
            throw error;
          }
        },
        {
          body: t.Object({
            limitGb: t.Number(),
            providerId: t.Optional(t.String()),
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
              providerId: body.providerId,
            });
            return successResponse(attached);
          } catch (error) {
            if (error instanceof EpisodeNotFoundError) {
              return errorResponse(set, 404, error);
            }
            if (error instanceof StorageProviderNotFoundError) {
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
            providerId: t.Optional(t.String()),
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
            const result = await storageService.deleteResources(body.keys, body.providerId);
            return successResponse(result);
          } catch (error) {
            if (error instanceof StorageProviderNotFoundError) {
              return errorResponse(set, 404, error);
            }
            if (error instanceof S3NotConfiguredError) {
              return errorResponse(set, 400, error);
            }
            throw error;
          }
        },
        {
          body: t.Object({
            keys: t.Array(t.String({ minLength: 1 })),
            providerId: t.Optional(t.String()),
          }),
        }
      )
      .post(
        "/resources/purge-orphans",
        async ({ body, headers, set }) => {
          if (!(await checkAuth(headers, set))) return;

          try {
            const result = await storageService.purgeOrphans(body?.providerId);
            return successResponse(result);
          } catch (error) {
            if (error instanceof StorageProviderNotFoundError) {
              return errorResponse(set, 404, error);
            }
            if (error instanceof S3NotConfiguredError) {
              return errorResponse(set, 400, error);
            }
            throw error;
          }
        },
        {
          body: t.Optional(
            t.Object({
              providerId: t.Optional(t.String()),
            })
          ),
        }
      )
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
            const result = await storageService.getPreviewUrl(query.key.trim(), query.providerId);
            return successResponse(result);
          } catch (error) {
            if (error instanceof StorageProviderNotFoundError) {
              return errorResponse(set, 404, error);
            }
            if (error instanceof S3NotConfiguredError) {
              return errorResponse(set, 400, error);
            }
            throw error;
          }
        },
        {
          query: t.Object({
            key: t.String({ minLength: 1 }),
            providerId: t.Optional(t.String()),
          }),
        }
      )
  );
};
