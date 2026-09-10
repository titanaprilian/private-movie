import { randomUUID } from "node:crypto";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { eq, inArray } from "drizzle-orm";
import {
  episodes,
  seasons,
  series,
  system,
  videoSources,
  type VideoSourceRow,
} from "@repo/db";
import {
  extractS3Key,
  S3NotConfiguredError,
  type S3ObjectSummary,
  type S3StorageService,
} from "@repo/media-service";
import type {
  StorageMetrics,
  StorageResourceItem,
  StorageResourcesQuery,
  StorageResourcesResponseData,
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

export interface StorageServiceOptions {
  s3StorageService?: S3StorageService;
  cacheTtlMs?: number;
}

export interface StorageService {
  getMetrics(): Promise<StorageMetrics>;
  getResources(query?: StorageResourcesQuery): Promise<StorageResourcesResponseData>;
  scan(force?: boolean): Promise<{ count: number; totalBytes: number }>;
  updateLimit(limitGb: number): Promise<{ limitGb: number; limitBytes: number }>;
  updateSourceMetadata(
    videoSourceId: string,
    input: { label?: string; quality?: string | null }
  ): Promise<VideoSourceRow>;
  attachOrphan(input: {
    key: string;
    episodeId: string;
    label?: string;
    quality?: string | null;
  }): Promise<VideoSourceRow>;
  deleteResources(keys: string[]): Promise<{
    deletedKeys: string[];
    reclaimedBytes: number;
    deletedSourcesCount: number;
  }>;
  purgeOrphans(): Promise<{
    deletedKeys: string[];
    reclaimedBytes: number;
  }>;
  getPreviewUrl(key: string): Promise<{ previewUrl: string }>;
  invalidateCache(): void;
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
  const s3 = options?.s3StorageService;
  const cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;

  let cachedS3Objects: S3ObjectSummary[] | null = null;
  let cachedAt = 0;

  function ensureS3(): S3StorageService {
    if (!s3 || !s3.isConfigured()) {
      throw new S3NotConfiguredError();
    }
    return s3;
  }

  function invalidateCache(): void {
    cachedS3Objects = null;
    cachedAt = 0;
  }

  async function getS3Objects(force = false): Promise<S3ObjectSummary[]> {
    const s3Client = ensureS3();
    const now = Date.now();
    if (!force && cachedS3Objects && now - cachedAt < cacheTtlMs) {
      return cachedS3Objects;
    }

    const objects = await s3Client.listAllObjects();
    cachedS3Objects = objects;
    cachedAt = Date.now();
    return objects;
  }

  async function getStorageLimitGb(): Promise<number> {
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
      // ignore db read errors and fall through
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

  async function getCorrelatedInventory(force = false): Promise<{
    items: StorageResourceItem[];
    totalBytes: number;
    linkedCount: number;
    orphanCount: number;
  }> {
    const s3Objects = await getS3Objects(force);

    // Fetch all video sources with their episode, season, and series info
    const dbSources = await db
      .select({
        id: videoSources.id,
        episodeId: videoSources.episodeId,
        type: videoSources.type,
        url: videoSources.url,
        label: videoSources.label,
        quality: videoSources.quality,
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

    // Calculate source count per episode to detect lone sources
    const episodeSourceCounts = new Map<string, number>();
    for (const source of dbSources) {
      if (source.episodeId) {
        const count = episodeSourceCounts.get(source.episodeId) ?? 0;
        episodeSourceCounts.set(source.episodeId, count + 1);
      }
    }

    // Map video sources by S3 key
    const sourceByKey = new Map<string, (typeof dbSources)[0]>();
    for (const source of dbSources) {
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
    };
  }

  return {
    invalidateCache,

    async getMetrics(): Promise<StorageMetrics> {
      const limitGb = await getStorageLimitGb();
      const limitBytes = limitGb * 1024 * 1024 * 1024;
      const { items, totalBytes, linkedCount, orphanCount } = await getCorrelatedInventory();

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
      const { items } = await getCorrelatedInventory();

      let filtered = items;

      // Status filtering
      if (query?.status && query.status !== "all") {
        filtered = filtered.filter((item) => item.status === query.status);
      }

      // Search filtering
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

      // Sorting
      const sortBy = query?.sortBy ?? "date";
      const sortOrder = query?.sortOrder ?? "desc";

      filtered.sort((a, b) => {
        let comparison: number;
        if (sortBy === "size") {
          comparison = a.sizeBytes - b.sizeBytes;
        } else if (sortBy === "name") {
          comparison = a.filename.localeCompare(b.filename);
        } else {
          // default: date
          const dateA = new Date(a.lastModified).getTime();
          const dateB = new Date(b.lastModified).getTime();
          comparison = dateA - dateB;
        }

        return sortOrder === "asc" ? comparison : -comparison;
      });

      // Pagination
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

    async scan(force = true): Promise<{ count: number; totalBytes: number }> {
      invalidateCache();
      const objects = await getS3Objects(force);
      const totalBytes = objects.reduce((sum, obj) => sum + obj.size, 0);
      return {
        count: objects.length,
        totalBytes,
      };
    },

    async updateLimit(limitGb: number): Promise<{ limitGb: number; limitBytes: number }> {
      if (limitGb <= 0 || Number.isNaN(limitGb)) {
        throw new Error("Storage limit must be a positive number");
      }

      const limitBytes = limitGb * 1024 * 1024 * 1024;
      const now = new Date();

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
    }): Promise<VideoSourceRow> {
      const [existingEp] = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, input.episodeId));

      if (!existingEp) {
        throw new EpisodeNotFoundError(`Episode with id ${input.episodeId} not found`);
      }

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
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      invalidateCache();
      return created!;
    },

    async deleteResources(keys: string[]): Promise<{
      deletedKeys: string[];
      reclaimedBytes: number;
      deletedSourcesCount: number;
    }> {
      const s3Client = ensureS3();
      if (!keys || keys.length === 0) {
        return { deletedKeys: [], reclaimedBytes: 0, deletedSourcesCount: 0 };
      }

      const { items } = await getCorrelatedInventory();
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

      // Delete corresponding video sources from DB (preserves episode rows)
      if (sourceIdsToDelete.length > 0) {
        await db.delete(videoSources).where(inArray(videoSources.id, sourceIdsToDelete));
      }

      // Delete from S3
      await s3Client.deleteObjects(validKeys);

      invalidateCache();

      return {
        deletedKeys: validKeys,
        reclaimedBytes,
        deletedSourcesCount: sourceIdsToDelete.length,
      };
    },

    async purgeOrphans(): Promise<{
      deletedKeys: string[];
      reclaimedBytes: number;
    }> {
      const s3Client = ensureS3();
      const { items } = await getCorrelatedInventory();
      const orphanItems = items.filter((item) => item.status === "orphaned");

      if (orphanItems.length === 0) {
        return { deletedKeys: [], reclaimedBytes: 0 };
      }

      const orphanKeys = orphanItems.map((i) => i.key);
      const reclaimedBytes = orphanItems.reduce((sum, i) => sum + i.sizeBytes, 0);

      await s3Client.deleteObjects(orphanKeys);
      invalidateCache();

      return {
        deletedKeys: orphanKeys,
        reclaimedBytes,
      };
    },

    async getPreviewUrl(key: string): Promise<{ previewUrl: string }> {
      const s3Client = ensureS3();
      const previewUrl = await s3Client.getPresignedPlaybackUrl(key);
      return { previewUrl };
    },
  };
}
