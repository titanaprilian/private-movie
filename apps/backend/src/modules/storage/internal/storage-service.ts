import { randomUUID } from "node:crypto";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { eq, inArray } from "drizzle-orm";
import {
  episodes,
  seasons,
  series,
  system,
  videoSources,
  storageProviders,
  type VideoSourceRow,
  type StorageProviderRow,
} from "@repo/db";
import {
  extractS3Key,
  S3NotConfiguredError,
  encryptCredential,
  decryptCredential,
  maskAccessKeyId,
  createS3StorageService,
  createStorageProviderRegistry,
  type S3ObjectSummary,
  type S3StorageService,
  type StorageProviderRegistry,
} from "@repo/media-service";
import type {
  StorageMetrics,
  StorageResourceItem,
  StorageResourcesQuery,
  StorageResourcesResponseData,
  StorageProviderItem,
  CreateStorageProviderRequest,
  UpdateStorageProviderRequest,
  TestStorageProviderRequest,
  TestStorageProviderResponseData,
} from "@repo/contracts";

export class EpisodeNotFoundError extends Error {
  constructor(message = "Episode not found") {
    super(message);
    this.name = "EpisodeNotFoundError";
  }
}

export class VideoSourceNotFoundError extends Error {
  constructor(message = "Video source not found") {
    super(message);
    this.name = "VideoSourceNotFoundError";
  }
}

export class StorageProviderNotFoundError extends Error {
  constructor(message = "Storage provider not found") {
    super(message);
    this.name = "StorageProviderNotFoundError";
  }
}

export class StorageProviderInUseError extends Error {
  constructor(message = "Cannot delete storage provider with active video sources") {
    super(message);
    this.name = "StorageProviderInUseError";
  }
}

export interface StorageServiceOptions {
  s3StorageService?: S3StorageService;
  storageProviderRegistry?: StorageProviderRegistry;
  cacheTtlMs?: number;
}

export interface StorageService {
  // Scoped storage management
  getMetrics(providerId?: string): Promise<StorageMetrics>;
  getResources(query?: StorageResourcesQuery): Promise<StorageResourcesResponseData>;
  scan(force?: boolean, providerId?: string): Promise<{ count: number; totalBytes: number }>;
  updateLimit(limitGb: number, providerId?: string): Promise<{ limitGb: number; limitBytes: number }>;
  updateSourceMetadata(
    videoSourceId: string,
    input: { label?: string; quality?: string | null }
  ): Promise<VideoSourceRow>;
  attachOrphan(input: {
    key: string;
    episodeId: string;
    label?: string;
    quality?: string | null;
    providerId?: string;
  }): Promise<VideoSourceRow>;
  deleteResources(
    keys: string[],
    providerId?: string
  ): Promise<{
    deletedKeys: string[];
    reclaimedBytes: number;
    deletedSourcesCount: number;
  }>;
  purgeOrphans(providerId?: string): Promise<{
    deletedKeys: string[];
    reclaimedBytes: number;
  }>;
  getPreviewUrl(key: string, providerId?: string): Promise<{ previewUrl: string }>;
  invalidateCache(providerId?: string): void;

  // Provider CRUD & verification
  listProviders(): Promise<StorageProviderItem[]>;
  getProvider(id: string): Promise<StorageProviderItem>;
  createProvider(input: CreateStorageProviderRequest): Promise<StorageProviderItem>;
  updateProvider(id: string, input: UpdateStorageProviderRequest): Promise<StorageProviderItem>;
  deleteProvider(id: string): Promise<void>;
  testProvider(input: TestStorageProviderRequest): Promise<TestStorageProviderResponseData>;
}

const DEFAULT_LIMIT_GB = 50;
const DEFAULT_CACHE_TTL_MS = 60_000;

export function createStorageService<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown> = Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  options?: StorageServiceOptions
): StorageService {
  const defaultS3 = options?.s3StorageService;
  const registry =
    options?.storageProviderRegistry ??
    createStorageProviderRegistry(db, defaultS3);
  const cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  // Per-provider cache
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
      throw new StorageProviderNotFoundError(`Storage provider with id ${providerId} not found`);
    }

    try {
      const defaultMatch = await registry.getDefaultProvider();
      if (defaultMatch) {
        return defaultMatch;
      }
    } catch {
      // ignore db errors during resolution (e.g. unit mocks with incomplete select chaining)
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
    force = false
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

  async function getStorageLimitGb(provider: StorageProviderRow | null): Promise<number> {
    if (provider) {
      return provider.storageLimitGb ?? DEFAULT_LIMIT_GB;
    }

    try {
      const [sysRow] = await db
        .select()
        .from(system)
        .where(eq(system.key, "s3_storage_limit_gb"));

      if (sysRow?.value) {
        const parsed = parseFloat(sysRow.value);
        if (!Number.isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }

    const envVal = process.env.S3_STORAGE_LIMIT_GB;
    if (envVal) {
      const parsed = parseFloat(envVal);
      if (!Number.isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return DEFAULT_LIMIT_GB;
  }

  async function getCorrelatedInventory(
    providerId?: string,
    force = false
  ): Promise<{
    items: StorageResourceItem[];
    totalBytes: number;
    linkedCount: number;
    orphanCount: number;
    provider: StorageProviderRow | null;
  }> {
    const { provider, service } = await resolveTargetProvider(providerId);
    const cacheKey = provider?.id ?? "legacy_default";
    const s3Objects = await getS3Objects(service, cacheKey, force);

    // Fetch video sources belonging to this provider or all S3 sources if no provider exists
    const queryBuilder = db
      .select({
        id: videoSources.id,
        episodeId: videoSources.episodeId,
        type: videoSources.type,
        url: videoSources.url,
        label: videoSources.label,
        quality: videoSources.quality,
        storageProviderId: videoSources.storageProviderId,
        episodeTitle: episodes.title,
        episodeOrder: episodes.order,
        seasonId: seasons.id,
        seasonNumber: seasons.seasonNumber,
        seasonTitle: seasons.title,
        seriesId: series.id,
        seriesTitle: series.title,
      })
      .from(videoSources)
      .leftJoin(episodes, eq(videoSources.episodeId, episodes.id))
      .leftJoin(seasons, eq(episodes.seasonId, seasons.id))
      .leftJoin(series, eq(seasons.seriesId, series.id));

    const dbSources = await queryBuilder;

    // Filter to sources matching the current provider (or unlinked sources if default)
    const matchingDbSources = dbSources.filter((src) => {
      if (src.type !== "s3") return false;
      if (provider) {
        return src.storageProviderId === provider.id;
      }
      return !src.storageProviderId;
    });

    const episodeSourceCounts = new Map<string, number>();
    for (const source of matchingDbSources) {
      if (source.episodeId) {
        const count = episodeSourceCounts.get(source.episodeId) ?? 0;
        episodeSourceCounts.set(source.episodeId, count + 1);
      }
    }

    const sourceByKey = new Map<string, (typeof matchingDbSources)[0]>();
    for (const source of matchingDbSources) {
      const extractedKey = extractS3Key(source.url);
      if (extractedKey) {
        sourceByKey.set(extractedKey, source);
      }
      if (source.url) {
        sourceByKey.set(source.url, source);
      }
    }

    let linkedCount = 0;
    let orphanCount = 0;
    let totalBytes = 0;

    const items: StorageResourceItem[] = s3Objects.map((obj) => {
      totalBytes += obj.size;
      const key = obj.key;
      const filename = key.split("/").pop() || key;
      const matchedSource = sourceByKey.get(key);

      if (matchedSource) {
        linkedCount++;
        const episodeId = matchedSource.episodeId;
        const countForEp = episodeId ? (episodeSourceCounts.get(episodeId) ?? 1) : 1;
        return {
          key,
          filename,
          sizeBytes: obj.size,
          lastModified: (obj.lastModified instanceof Date ? obj.lastModified : new Date(obj.lastModified)).toISOString(),
          status: "linked",
          videoSourceId: matchedSource.id,
          label: matchedSource.label,
          quality: matchedSource.quality ?? null,
          episodeId: matchedSource.episodeId ?? null,
          episodeTitle: matchedSource.episodeTitle ?? null,
          episodeOrder: matchedSource.episodeOrder ?? null,
          seasonId: matchedSource.seasonId ?? null,
          seasonNumber: matchedSource.seasonNumber ?? null,
          seasonTitle: matchedSource.seasonTitle ?? null,
          seriesId: matchedSource.seriesId ?? null,
          seriesTitle: matchedSource.seriesTitle ?? null,
          isLoneSource: countForEp <= 1,
        };
      } else {
        orphanCount++;
        return {
          key,
          filename,
          sizeBytes: obj.size,
          lastModified: (obj.lastModified instanceof Date ? obj.lastModified : new Date(obj.lastModified)).toISOString(),
          status: "orphaned",
          videoSourceId: null,
          label: null,
          quality: null,
          episodeId: null,
          episodeTitle: null,
          episodeOrder: null,
          seasonId: null,
          seasonNumber: null,
          seasonTitle: null,
          seriesId: null,
          seriesTitle: null,
          isLoneSource: false,
        };
      }
    });

    return {
      items,
      totalBytes,
      linkedCount,
      orphanCount,
      provider,
    };
  }

  function formatProviderItem(
    provider: StorageProviderRow,
    linkedSourcesCount: number
  ): StorageProviderItem {
    let accessKeyIdMasked = "••••";
    try {
      const decryptedAccessKey = decryptCredential(provider.accessKeyIdEnc);
      accessKeyIdMasked = maskAccessKeyId(decryptedAccessKey);
    } catch {
      // fallback
    }

    return {
      id: provider.id,
      name: provider.name,
      providerType: provider.providerType as StorageProviderItem["providerType"],
      endpoint: provider.endpoint,
      region: provider.region,
      bucket: provider.bucket,
      accessKeyIdMasked,
      publicBaseUrl: provider.publicBaseUrl,
      forcePathStyle: provider.forcePathStyle,
      storageLimitGb: provider.storageLimitGb,
      isDefault: provider.isDefault,
      isEnabled: provider.isEnabled,
      linkedSourcesCount,
      createdAt: provider.createdAt.toISOString(),
      updatedAt: provider.updatedAt.toISOString(),
    };
  }

  return {
    invalidateCache,

    async getMetrics(providerId?: string): Promise<StorageMetrics> {
      const { items, totalBytes, linkedCount, orphanCount, provider } =
        await getCorrelatedInventory(providerId);

      const limitGb = await getStorageLimitGb(provider);
      const limitBytes = limitGb * 1024 * 1024 * 1024;
      const percentUsed = limitBytes > 0 ? Math.min(100, (totalBytes / limitBytes) * 100) : 0;

      return {
        totalBytes,
        limitBytes,
        percentUsed: Number(percentUsed.toFixed(2)),
        totalCount: items.length,
        linkedCount,
        orphanCount,
      };
    },

    async getResources(query?: StorageResourcesQuery): Promise<StorageResourcesResponseData> {
      const { items } = await getCorrelatedInventory(query?.providerId);

      let filtered = items;

      if (query?.status && query.status !== "all") {
        filtered = filtered.filter((item) => item.status === query.status);
      }

      if (query?.search && query.search.trim()) {
        const searchLower = query.search.trim().toLowerCase();
        filtered = filtered.filter((item) => {
          return (
            item.filename.toLowerCase().includes(searchLower) ||
            item.key.toLowerCase().includes(searchLower) ||
            (item.seriesTitle && item.seriesTitle.toLowerCase().includes(searchLower)) ||
            (item.episodeTitle && item.episodeTitle.toLowerCase().includes(searchLower))
          );
        });
      }

      const sortBy = query?.sortBy ?? "date";
      const sortOrder = query?.sortOrder ?? "desc";

      filtered.sort((a, b) => {
        let comparison: number;
        if (sortBy === "size") {
          comparison = a.sizeBytes - b.sizeBytes;
        } else if (sortBy === "name") {
          comparison = a.filename.localeCompare(b.filename);
        } else {
          const dateA = new Date(a.lastModified).getTime();
          const dateB = new Date(b.lastModified).getTime();
          comparison = dateA - dateB;
        }

        return sortOrder === "asc" ? comparison : -comparison;
      });

      const page = Math.max(1, query?.page ?? 1);
      const limit = Math.min(100, Math.max(1, query?.limit ?? 25));
      const total = filtered.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const offset = (page - 1) * limit;
      const paginatedItems = filtered.slice(offset, offset + limit);

      return {
        items: paginatedItems,
        total,
        page,
        limit,
        totalPages,
      };
    },

    async scan(force = true, providerId?: string): Promise<{ count: number; totalBytes: number }> {
      invalidateCache(providerId);
      const { service, provider } = await resolveTargetProvider(providerId);
      const cacheKey = provider?.id ?? "legacy_default";
      const objects = await getS3Objects(service, cacheKey, force);
      const totalBytes = objects.reduce((sum, obj) => sum + obj.size, 0);
      return {
        count: objects.length,
        totalBytes,
      };
    },

    async updateLimit(
      limitGb: number,
      providerId?: string
    ): Promise<{ limitGb: number; limitBytes: number }> {
      if (limitGb <= 0 || Number.isNaN(limitGb)) {
        throw new Error("Storage limit must be a positive number");
      }

      const limitBytes = limitGb * 1024 * 1024 * 1024;
      const now = new Date();

      if (providerId) {
        const [updated] = await db
          .update(storageProviders)
          .set({
            storageLimitGb: limitGb,
            updatedAt: now,
          })
          .where(eq(storageProviders.id, providerId))
          .returning();

        if (!updated) {
          throw new StorageProviderNotFoundError(`Storage provider with id ${providerId} not found`);
        }
      } else {
        // Legacy system setting update
        await db
          .insert(system)
          .values({
            id: randomUUID(),
            key: "s3_storage_limit_gb",
            value: String(limitGb),
            createdAt: now,
          })
          .onConflictDoUpdate({
            target: system.key,
            set: {
              value: String(limitGb),
            },
          });
      }

      return {
        limitGb,
        limitBytes,
      };
    },

    async updateSourceMetadata(
      videoSourceId: string,
      input: { label?: string; quality?: string | null }
    ): Promise<VideoSourceRow> {
      const [existing] = await db
        .select()
        .from(videoSources)
        .where(eq(videoSources.id, videoSourceId));

      if (!existing) {
        throw new VideoSourceNotFoundError(`Video source with id ${videoSourceId} not found`);
      }

      const updateData: Partial<VideoSourceRow> = {
        updatedAt: new Date(),
      };
      if (input.label !== undefined) {
        updateData.label = input.label;
      }
      if (input.quality !== undefined) {
        updateData.quality = input.quality;
      }

      const [updated] = await db
        .update(videoSources)
        .set(updateData)
        .where(eq(videoSources.id, videoSourceId))
        .returning();

      invalidateCache();
      return updated!;
    },

    async attachOrphan(input: {
      key: string;
      episodeId: string;
      label?: string;
      quality?: string | null;
      providerId?: string;
    }): Promise<VideoSourceRow> {
      const [existingEp] = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, input.episodeId));

      if (!existingEp) {
        throw new EpisodeNotFoundError(`Episode with id ${input.episodeId} not found`);
      }

      const { provider } = await resolveTargetProvider(input.providerId);
      const targetProviderId = provider ? provider.id : input.providerId ?? null;

      const now = new Date();
      const [created] = await db
        .insert(videoSources)
        .values({
          id: randomUUID(),
          episodeId: input.episodeId,
          type: "s3",
          url: input.key,
          label: input.label || "S3 Source",
          quality: input.quality ?? null,
          storageProviderId: targetProviderId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      invalidateCache(targetProviderId ?? undefined);
      return created!;
    },

    async deleteResources(
      keys: string[],
      providerId?: string
    ): Promise<{
      deletedKeys: string[];
      reclaimedBytes: number;
      deletedSourcesCount: number;
    }> {
      const { service, provider } = await resolveTargetProvider(providerId);
      if (!keys || keys.length === 0) {
        return { deletedKeys: [], reclaimedBytes: 0, deletedSourcesCount: 0 };
      }

      const { items } = await getCorrelatedInventory(providerId);
      const itemMap = new Map(items.map((i) => [i.key, i]));

      let reclaimedBytes = 0;
      const validKeys: string[] = [];
      const sourceIdsToDelete: string[] = [];

      for (const k of keys) {
        const item = itemMap.get(k);
        if (item) {
          reclaimedBytes += item.sizeBytes;
          if (item.videoSourceId) {
            sourceIdsToDelete.push(item.videoSourceId);
          }
        }
        validKeys.push(k);
      }

      if (sourceIdsToDelete.length > 0) {
        await db.delete(videoSources).where(inArray(videoSources.id, sourceIdsToDelete));
      }

      await service.deleteObjects(validKeys);
      invalidateCache(provider?.id);

      return {
        deletedKeys: validKeys,
        reclaimedBytes,
        deletedSourcesCount: sourceIdsToDelete.length,
      };
    },

    async purgeOrphans(providerId?: string): Promise<{
      deletedKeys: string[];
      reclaimedBytes: number;
    }> {
      const { service, provider } = await resolveTargetProvider(providerId);
      const { items } = await getCorrelatedInventory(providerId);
      const orphanItems = items.filter((item) => item.status === "orphaned");

      if (orphanItems.length === 0) {
        return { deletedKeys: [], reclaimedBytes: 0 };
      }

      const orphanKeys = orphanItems.map((i) => i.key);
      const reclaimedBytes = orphanItems.reduce((sum, i) => sum + i.sizeBytes, 0);

      await service.deleteObjects(orphanKeys);
      invalidateCache(provider?.id);

      return {
        deletedKeys: orphanKeys,
        reclaimedBytes,
      };
    },

    async getPreviewUrl(key: string, providerId?: string): Promise<{ previewUrl: string }> {
      const { service } = await resolveTargetProvider(providerId);
      const previewUrl = await service.getPresignedPlaybackUrl(key);
      return { previewUrl };
    },

    // Provider CRUD methods
    async listProviders(): Promise<StorageProviderItem[]> {
      const providers = await db
        .select()
        .from(storageProviders)
        .orderBy(storageProviders.createdAt);

      const allSources = await db
        .select({ storageProviderId: videoSources.storageProviderId })
        .from(videoSources);

      const countMap = new Map<string, number>();
      for (const src of allSources) {
        if (src.storageProviderId) {
          countMap.set(
            src.storageProviderId,
            (countMap.get(src.storageProviderId) ?? 0) + 1
          );
        }
      }

      return providers.map((p) =>
        formatProviderItem(p, countMap.get(p.id) ?? 0)
      );
    },

    async getProvider(id: string): Promise<StorageProviderItem> {
      const [provider] = await db
        .select()
        .from(storageProviders)
        .where(eq(storageProviders.id, id));

      if (!provider) {
        throw new StorageProviderNotFoundError(`Storage provider with id ${id} not found`);
      }

      const sources = await db
        .select({ id: videoSources.id })
        .from(videoSources)
        .where(eq(videoSources.storageProviderId, id));

      return formatProviderItem(provider, sources.length);
    },

    async createProvider(input: CreateStorageProviderRequest): Promise<StorageProviderItem> {
      const now = new Date();
      const id = randomUUID();

      // If marked as default, unset existing default
      if (input.isDefault) {
        await db
          .update(storageProviders)
          .set({ isDefault: false, updatedAt: now })
          .where(eq(storageProviders.isDefault, true));
      }

      const accessKeyIdEnc = encryptCredential(input.accessKeyId);
      const secretAccessKeyEnc = encryptCredential(input.secretAccessKey);

      const [row] = await db
        .insert(storageProviders)
        .values({
          id,
          name: input.name,
          providerType: input.providerType,
          endpoint: input.endpoint,
          region: input.region,
          bucket: input.bucket,
          accessKeyIdEnc,
          secretAccessKeyEnc,
          publicBaseUrl: input.publicBaseUrl ? input.publicBaseUrl.trim() : null,
          forcePathStyle: input.forcePathStyle ?? false,
          storageLimitGb: input.storageLimitGb ?? DEFAULT_LIMIT_GB,
          isDefault: input.isDefault ?? false,
          isEnabled: input.isEnabled ?? true,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      invalidateCache();
      return formatProviderItem(row!, 0);
    },

    async updateProvider(
      id: string,
      input: UpdateStorageProviderRequest
    ): Promise<StorageProviderItem> {
      const [existing] = await db
        .select()
        .from(storageProviders)
        .where(eq(storageProviders.id, id));

      if (!existing) {
        throw new StorageProviderNotFoundError(`Storage provider with id ${id} not found`);
      }

      const now = new Date();

      if (input.isDefault) {
        await db
          .update(storageProviders)
          .set({ isDefault: false, updatedAt: now })
          .where(eq(storageProviders.isDefault, true));
      }

      const updateData: Partial<typeof storageProviders.$inferInsert> = {
        updatedAt: now,
      };

      if (input.name !== undefined) updateData.name = input.name;
      if (input.providerType !== undefined) updateData.providerType = input.providerType;
      if (input.endpoint !== undefined) updateData.endpoint = input.endpoint;
      if (input.region !== undefined) updateData.region = input.region;
      if (input.bucket !== undefined) updateData.bucket = input.bucket;
      if (input.publicBaseUrl !== undefined)
        updateData.publicBaseUrl = input.publicBaseUrl ? input.publicBaseUrl.trim() : null;
      if (input.forcePathStyle !== undefined) updateData.forcePathStyle = input.forcePathStyle;
      if (input.storageLimitGb !== undefined) updateData.storageLimitGb = input.storageLimitGb;
      if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;
      if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled;

      if (input.accessKeyId) {
        updateData.accessKeyIdEnc = encryptCredential(input.accessKeyId);
      }
      if (input.secretAccessKey) {
        updateData.secretAccessKeyEnc = encryptCredential(input.secretAccessKey);
      }

      const [updated] = await db
        .update(storageProviders)
        .set(updateData)
        .where(eq(storageProviders.id, id))
        .returning();

      invalidateCache(id);

      const sources = await db
        .select({ id: videoSources.id })
        .from(videoSources)
        .where(eq(videoSources.storageProviderId, id));

      return formatProviderItem(updated!, sources.length);
    },

    async deleteProvider(id: string): Promise<void> {
      const [existing] = await db
        .select()
        .from(storageProviders)
        .where(eq(storageProviders.id, id));

      if (!existing) {
        throw new StorageProviderNotFoundError(`Storage provider with id ${id} not found`);
      }

      const linkedSources = await db
        .select({ id: videoSources.id })
        .from(videoSources)
        .where(eq(videoSources.storageProviderId, id))
        .limit(1);

      if (linkedSources.length > 0) {
        throw new StorageProviderInUseError(
          `Cannot delete storage provider ${id}: linked video sources exist`
        );
      }

      await db.delete(storageProviders).where(eq(storageProviders.id, id));
      invalidateCache(id);
    },

    async testProvider(
      input: TestStorageProviderRequest
    ): Promise<TestStorageProviderResponseData> {
      let service: S3StorageService;

      if (input.providerId) {
        const [row] = await db
          .select()
          .from(storageProviders)
          .where(eq(storageProviders.id, input.providerId));

        if (!row) {
          throw new StorageProviderNotFoundError(
            `Storage provider with id ${input.providerId} not found`
          );
        }

        service = registry.getServiceForProvider(row);
      } else {
        if (
          !input.endpoint ||
          !input.bucket ||
          !input.accessKeyId ||
          !input.secretAccessKey
        ) {
          throw new Error("Missing required connection parameters");
        }

        service = createS3StorageService({
          endpoint: input.endpoint,
          region: input.region ?? "auto",
          bucket: input.bucket,
          accessKeyId: input.accessKeyId,
          secretAccessKey: input.secretAccessKey,
          forcePathStyle: input.forcePathStyle,
        });
      }

      try {
        const result = await service.testConnection();
        return {
          success: true,
          latencyMs: result.latencyMs,
        };
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : String(err),
          latencyMs: (err as { latencyMs?: number })?.latencyMs ?? 0,
        };
      }
    },
  };
}
