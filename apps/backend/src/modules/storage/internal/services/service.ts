import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { type StorageProviderRow } from "@repo/db";
import {
  S3NotConfiguredError,
  createStorageProviderRegistry,
  type S3ObjectSummary,
  type S3StorageService,
} from "@repo/media-service";
import { StorageProviderNotFoundError } from "../errors";
import type { StorageService, StorageServiceOptions } from "../types";
import { storageRepository } from "../repositories/repository";
import { DEFAULT_CACHE_TTL_MS } from "./provider-formatter";
import { StorageMetricsQueryService } from "./metrics-queries";
import { StorageResourceActionsService } from "./resource-actions";
import { StorageProvidersService } from "./provider-service";
import { MinioService } from "./minio-service";

export function createStorageService<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown> = Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  options?: StorageServiceOptions,
): StorageService {
  const defaultS3 = options?.s3StorageService;
  const registry =
    options?.storageProviderRegistry ??
    createStorageProviderRegistry(db, defaultS3);
  const cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const repository = storageRepository(db);

  const cachedS3ObjectsMap = new Map<string, S3ObjectSummary[]>();
  const cachedAtMap = new Map<string, number>();

  async function resolveTargetProvider(providerId?: string): Promise<{
    provider: StorageProviderRow | null;
    service: S3StorageService;
  }> {
    if (providerId) {
      const match = await registry.getProvider(providerId);
      if (match) {
        return match;
      }
      throw new StorageProviderNotFoundError(
        `Storage provider with id ${providerId} not found`,
      );
    }

    try {
      const defaultMatch = await registry.getDefaultProvider();
      if (defaultMatch) {
        return defaultMatch;
      }
    } catch {
      // ignore db errors during resolution
    }

    if (defaultS3 && defaultS3.isConfigured()) {
      return {
        provider: null,
        service: defaultS3,
      };
    }

    throw new S3NotConfiguredError();
  }

  function invalidateCache(providerId?: string): void {
    if (providerId) {
      cachedS3ObjectsMap.delete(providerId);
      cachedAtMap.delete(providerId);
      registry.invalidateCache(providerId);
    } else {
      cachedS3ObjectsMap.clear();
      cachedAtMap.clear();
      registry.invalidateCache();
    }
  }

  async function getS3Objects(
    service: S3StorageService,
    cacheKey: string,
    force = false,
  ): Promise<S3ObjectSummary[]> {
    const now = Date.now();
    const cached = cachedS3ObjectsMap.get(cacheKey);
    const cachedAt = cachedAtMap.get(cacheKey) ?? 0;

    if (!force && cached && now - cachedAt < cacheTtlMs) {
      return cached;
    }

    const objects = await service.listAllObjects();
    cachedS3ObjectsMap.set(cacheKey, objects);
    cachedAtMap.set(cacheKey, Date.now());
    return objects;
  }

  const providersService = new StorageProvidersService({
    repository,
    invalidateCache,
    getServiceForProvider: (row) => registry.getServiceForProvider(row),
  });

  const metricsQueryService = new StorageMetricsQueryService({
    repository,
    resolveTargetProvider,
    getS3Objects,
    invalidateCache,
    listEnabledProviders: async () => {
      const list = await providersService.listProviders();
      return list.filter((p) => p.isEnabled);
    },
  });

  const resourceActionsService = new StorageResourceActionsService({
    repository,
    resolveTargetProvider,
    getCorrelatedInventory: (providerId) =>
      metricsQueryService.getCorrelatedInventory(providerId),
    invalidateCache,
  });

  const minioService = new MinioService({
    repository,
    invalidateCache,
    options,
  });

  const service: StorageService = {
    invalidateCache,

    getMetrics: (providerId) => metricsQueryService.getMetrics(providerId),
    getTotalUsedBytes: () => metricsQueryService.getTotalUsedBytes(),
    getResources: (query) => metricsQueryService.getResources(query),
    getSeries: (query) => metricsQueryService.getSeries(query),
    scan: (force, providerId) => metricsQueryService.scan(force, providerId),
    updateLimit: (limitGb, providerId) =>
      resourceActionsService.updateLimit(limitGb, providerId),
    updateSourceMetadata: (videoSourceId, input) =>
      resourceActionsService.updateSourceMetadata(videoSourceId, input),
    attachOrphan: (input) => resourceActionsService.attachOrphan(input),
    deleteResources: (keys, providerId) =>
      resourceActionsService.deleteResources(keys, providerId),
    purgeOrphans: (providerId) =>
      resourceActionsService.purgeOrphans(providerId),
    getPreviewUrl: (key, providerId) =>
      resourceActionsService.getPreviewUrl(key, providerId),

    listProviders: () => providersService.listProviders(),
    getProvider: (id) => providersService.getProvider(id),
    createProvider: (input) => providersService.createProvider(input),
    updateProvider: (id, input) => providersService.updateProvider(id, input),
    deleteProvider: (id) => providersService.deleteProvider(id),
    testProvider: (input) => providersService.testProvider(input),

    getMinioStatus: () => minioService.getMinioStatus(),
    spinUpMinio: (input) => minioService.spinUpMinio(input),
  };

  return service;
}
