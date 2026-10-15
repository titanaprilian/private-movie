import { Elysia } from "elysia";
import type {
  AuthenticationService,
  StorageProviderType,
} from "@repo/contracts";
import type { DbClient } from "@repo/db";
import type { S3StorageService, StorageProviderRegistry } from "@repo/media-service";
import { authGuard } from "../../lib/auth";
import { errorResponse, successResponse } from "../../lib/response";
import { createStorageService } from "./internal/services/service";
import type { StorageOverrides, StorageService } from "./internal/types";
import {
  attachOrphanBody,
  attachOrphanDetail,
  createProviderBody,
  createProviderDetail,
  deleteProviderDetail,
  deleteResourcesBody,
  deleteResourcesDetail,
  getProviderDetail,
  listProvidersDetail,
  metricsDetail,
  metricsQuery,
  minioStatusDetail,
  previewUrlDetail,
  previewUrlQuery,
  providerIdParams,
  purgeOrphansBody,
  purgeOrphansDetail,
  resourceIdParams,
  resourcesDetail,
  resourcesQuery,
  scanBody,
  scanDetail,
  seriesDetail,
  seriesQuery,
  spinUpMinioBody,
  spinUpMinioDetail,
  testProviderBody,
  testProviderDetail,
  updateLimitBody,
  updateLimitDetail,
  updateProviderBody,
  updateProviderDetail,
  updateResourceMetadataBody,
  updateResourceMetadataDetail,
} from "./schemas";

export interface StorageRoutesOptions {
  db: DbClient;
  authService: AuthenticationService;
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  storageService?: StorageService;
  overrides?: StorageOverrides;
}

export const storageRoutes = (options: StorageRoutesOptions) => {
  const storageService =
    options.storageService ??
    options.overrides?.service ??
    createStorageService(options.db, {
      s3StorageService: options.s3StorageService,
      storageProviderRegistry: options.storageProviderRegistry,
      minioInspector: options.overrides?.minioInspector,
      minioContainerStarter: options.overrides?.minioContainerStarter,
      minioHealthChecker: options.overrides?.minioHealthChecker,
      minioBucketProvisioner: options.overrides?.minioBucketProvisioner,
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
          }, {
            detail: listProvidersDetail,
          })
          .get(
            "/providers/:id",
            async ({ params }) => {
              const provider = await storageService.getProvider(params.id);
              return successResponse(provider);
            },
            {
              params: providerIdParams,
              detail: getProviderDetail,
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
              body: createProviderBody,
              detail: createProviderDetail,
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
              params: providerIdParams,
              body: updateProviderBody,
              detail: updateProviderDetail,
            }
          )
          .delete(
            "/providers/:id",
            async ({ params }) => {
              await storageService.deleteProvider(params.id);
              return successResponse({ success: true, deletedId: params.id });
            },
            {
              params: providerIdParams,
              detail: deleteProviderDetail,
            }
          )
          .post(
            "/providers/test",
            async ({ body }) => {
              const result = await storageService.testProvider(body ?? {});
              return successResponse(result);
            },
            {
              body: testProviderBody,
              detail: testProviderDetail,
            }
          )
          .get("/minio/status", async () => {
            const status = await storageService.getMinioStatus();
            return successResponse(status);
          }, {
            detail: minioStatusDetail,
          })
          .post(
            "/minio/spin-up",
            async ({ body }) => {
              const result = await storageService.spinUpMinio(body ?? {});
              return successResponse(result);
            },
            {
              body: spinUpMinioBody,
              detail: spinUpMinioDetail,
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
              query: metricsQuery,
              detail: metricsDetail,
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
                seriesId: query?.seriesId,
                seasonId: query?.seasonId,
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
              query: resourcesQuery,
              detail: resourcesDetail,
            }
          )
          .get(
            "/series",
            async ({ query }) => {
              const series = await storageService.getSeries({
                providerId: query?.providerId,
              });
              return successResponse(series);
            },
            {
              query: seriesQuery,
              detail: seriesDetail,
            }
          )
          .post(
            "/scan",
            async ({ body }) => {
              const result = await storageService.scan(true, body?.providerId);
              return successResponse(result);
            },
            {
              body: scanBody,
              detail: scanDetail,
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
              body: updateLimitBody,
              detail: updateLimitDetail,
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
              params: resourceIdParams,
              body: updateResourceMetadataBody,
              detail: updateResourceMetadataDetail,
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
              body: attachOrphanBody,
              detail: attachOrphanDetail,
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
              body: deleteResourcesBody,
              detail: deleteResourcesDetail,
            }
          )
          .post(
            "/resources/purge-orphans",
            async ({ body }) => {
              const result = await storageService.purgeOrphans(body?.providerId);
              return successResponse(result);
            },
            {
              body: purgeOrphansBody,
              detail: purgeOrphansDetail,
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
              query: previewUrlQuery,
              detail: previewUrlDetail,
            }
          )
      )
  );
};
