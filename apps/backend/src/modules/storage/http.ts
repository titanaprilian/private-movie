import { Elysia, t } from "elysia";
import type {
  AuthenticationService,
  StorageProviderType,
} from "@repo/contracts";
import type { S3StorageService, StorageProviderRegistry } from "@repo/media-service";
import { authGuard } from "../../lib/auth";
import { errorResponse, successResponse } from "../../lib/response";
import { createStorageService } from "./internal/storage-service";

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
  const auth = authGuard(options.authService);

  return new Elysia({ name: "storage-routes" }).guard(
    { beforeHandle: auth },
    (app) =>
      app.group("/storage", (storage) =>
        storage
          // Storage Provider Management Endpoints
          .get("/providers", async () => {
            const providers = await storageService.listProviders();
            return successResponse(providers);
          })
          .get(
            "/providers/:id",
            async ({ params }) => {
              const provider = await storageService.getProvider(params.id);
              return successResponse(provider);
            },
            {
              params: t.Object({
                id: t.String({ minLength: 1 }),
              }),
            }
          )
          .post(
            "/providers",
            async ({ body }) => {
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
            async ({ params, body }) => {
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
            async ({ params }) => {
              await storageService.deleteProvider(params.id);
              return successResponse({ success: true, deletedId: params.id });
            },
            {
              params: t.Object({
                id: t.String({ minLength: 1 }),
              }),
            }
          )
          .post(
            "/providers/test",
            async ({ body }) => {
              const result = await storageService.testProvider(body ?? {});
              return successResponse(result);
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
            async ({ query }) => {
              const metrics = await storageService.getMetrics(query?.providerId);
              return successResponse(metrics);
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
            async ({ query }) => {
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
            async ({ body }) => {
              const result = await storageService.scan(true, body?.providerId);
              return successResponse(result);
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
            async ({ body, set }) => {
              if (typeof body.limitGb !== "number" || body.limitGb <= 0) {
                return errorResponse(
                  set,
                  400,
                  new Error("Storage limit must be a positive number")
                );
              }

              const result = await storageService.updateLimit(body.limitGb, body.providerId);
              return successResponse(result);
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
            async ({ params, body }) => {
              const updated = await storageService.updateSourceMetadata(params.id, {
                label: body.label,
                quality: body.quality,
              });
              return successResponse(updated);
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
            async ({ body }) => {
              const attached = await storageService.attachOrphan({
                key: body.key,
                episodeId: body.episodeId,
                label: body.label,
                quality: body.quality,
                providerId: body.providerId,
              });
              return successResponse(attached);
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
            async ({ body, set }) => {
              if (!Array.isArray(body.keys) || body.keys.length === 0) {
                return errorResponse(
                  set,
                  400,
                  new Error("keys array is required and must not be empty")
                );
              }

              const result = await storageService.deleteResources(body.keys, body.providerId);
              return successResponse(result);
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
            async ({ body }) => {
              const result = await storageService.purgeOrphans(body?.providerId);
              return successResponse(result);
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
            async ({ query, set }) => {
              if (!query.key || !query.key.trim()) {
                return errorResponse(
                  set,
                  400,
                  new Error("key query parameter is required")
                );
              }

              const result = await storageService.getPreviewUrl(query.key.trim(), query.providerId);
              return successResponse(result);
            },
            {
              query: t.Object({
                key: t.String({ minLength: 1 }),
                providerId: t.Optional(t.String()),
              }),
            }
          )
      )
  );
};
