import {
  extractS3Key,
  type S3ObjectSummary,
  type S3StorageService,
} from "@repo/media-service";
import type {
  StorageMetrics,
  StorageResourceItem,
  StorageResourcesQuery,
  StorageResourcesResponseData,
  StorageSeriesItem,
  StorageSeriesQuery,
  StorageSeriesResponseData,
} from "@repo/contracts";
import type { StorageRepository } from "../repositories/repository";
import {
  DEFAULT_LIMIT_GB,
  type CorrelatedInventory,
} from "./provider-formatter";

export interface MetricsQueryDependencies {
  repository: StorageRepository;
  resolveTargetProvider: (providerId?: string) => Promise<{
    provider: import("@repo/db").StorageProviderRow | null;
    service: S3StorageService;
  }>;
  getS3Objects: (
    service: S3StorageService,
    cacheKey: string,
    force?: boolean,
  ) => Promise<S3ObjectSummary[]>;
  invalidateCache: (providerId?: string) => void;
  listEnabledProviders: () => Promise<{ id: string }[]>;
}

export class StorageMetricsQueryService {
  constructor(private deps: MetricsQueryDependencies) {}

  private async getStorageLimitGb(
    provider: import("@repo/db").StorageProviderRow | null,
  ): Promise<number> {
    if (provider) {
      return provider.storageLimitGb ?? DEFAULT_LIMIT_GB;
    }

    try {
      const value = await this.deps.repository.getSystemLimitValue();

      if (value) {
        const parsed = parseFloat(value);
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

  async getCorrelatedInventory(
    providerId?: string,
    force = false,
  ): Promise<CorrelatedInventory> {
    const { provider, service } =
      await this.deps.resolveTargetProvider(providerId);
    const cacheKey = provider?.id ?? "legacy_default";
    const s3Objects = await this.deps.getS3Objects(service, cacheKey, force);

    const dbSources = await this.deps.repository.listCorrelatedSources();

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
        const countForEp = episodeId
          ? (episodeSourceCounts.get(episodeId) ?? 1)
          : 1;
        return {
          key,
          filename,
          sizeBytes: obj.size,
          lastModified: (obj.lastModified instanceof Date
            ? obj.lastModified
            : new Date(obj.lastModified)
          ).toISOString(),
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
          lastModified: (obj.lastModified instanceof Date
            ? obj.lastModified
            : new Date(obj.lastModified)
          ).toISOString(),
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

  async getMetrics(providerId?: string): Promise<StorageMetrics> {
    const { items, totalBytes, linkedCount, orphanCount, provider } =
      await this.getCorrelatedInventory(providerId);

    const limitGb = await this.getStorageLimitGb(provider);
    const limitBytes = limitGb * 1024 * 1024 * 1024;
    const percentUsed =
      limitBytes > 0 ? Math.min(100, (totalBytes / limitBytes) * 100) : 0;

    return {
      totalBytes,
      limitBytes,
      percentUsed: Number(percentUsed.toFixed(2)),
      totalCount: items.length,
      linkedCount,
      orphanCount,
    };
  }

  async getTotalUsedBytes(): Promise<number | null> {
    const enabled = await this.deps.listEnabledProviders();
    if (enabled.length === 0) return null;

    let total = 0;
    for (const provider of enabled) {
      total += (await this.getMetrics(provider.id)).totalBytes;
    }
    return total;
  }

  async getResources(
    query?: StorageResourcesQuery,
  ): Promise<StorageResourcesResponseData> {
    const { items } = await this.getCorrelatedInventory(query?.providerId);

    let filtered = items;

    if (query?.seriesId) {
      filtered = filtered.filter((item) => item.seriesId === query.seriesId);
    }

    if (query?.seasonId) {
      filtered = filtered.filter((item) => item.seasonId === query.seasonId);
    }

    if (query?.status && query.status !== "all") {
      filtered = filtered.filter((item) => item.status === query.status);
    }

    if (query?.search && query.search.trim()) {
      const searchLower = query.search.trim().toLowerCase();
      filtered = filtered.filter((item) => {
        return (
          item.filename.toLowerCase().includes(searchLower) ||
          item.key.toLowerCase().includes(searchLower) ||
          (item.seriesTitle &&
            item.seriesTitle.toLowerCase().includes(searchLower)) ||
          (item.episodeTitle &&
            item.episodeTitle.toLowerCase().includes(searchLower))
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
  }

  async getSeries(
    query?: StorageSeriesQuery,
  ): Promise<StorageSeriesResponseData> {
    const { items } = await this.getCorrelatedInventory(query?.providerId);

    const seriesMap = new Map<
      string,
      StorageSeriesItem & {
        seasonMap: Map<string, StorageSeriesItem["seasons"][number]>;
      }
    >();

    for (const item of items) {
      if (item.status !== "linked" || !item.seriesId) continue;

      let entry = seriesMap.get(item.seriesId);
      if (!entry) {
        entry = {
          id: item.seriesId,
          title: item.seriesTitle ?? "Untitled Series",
          s3SourceCount: 0,
          s3SizeBytes: 0,
          seasons: [],
          seasonMap: new Map(),
        };
        seriesMap.set(item.seriesId, entry);
      }

      entry.s3SourceCount += 1;
      entry.s3SizeBytes += item.sizeBytes;

      if (item.seasonId) {
        let season = entry.seasonMap.get(item.seasonId);
        if (!season) {
          season = {
            id: item.seasonId,
            seasonNumber: item.seasonNumber ?? 0,
            title: item.seasonTitle ?? `Season ${item.seasonNumber ?? 0}`,
            s3SourceCount: 0,
            s3SizeBytes: 0,
          };
          entry.seasonMap.set(item.seasonId, season);
        }
        season.s3SourceCount += 1;
        season.s3SizeBytes += item.sizeBytes;
      }
    }

    const seriesItems: StorageSeriesItem[] = [...seriesMap.values()]
      .map(({ seasonMap, ...rest }) => ({
        ...rest,
        seasons: [...seasonMap.values()].sort(
          (a, b) => a.seasonNumber - b.seasonNumber,
        ),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));

    return {
      items: seriesItems,
      total: seriesItems.length,
    };
  }

  async scan(
    force = true,
    providerId?: string,
  ): Promise<{ count: number; totalBytes: number }> {
    this.deps.invalidateCache(providerId);
    const { service, provider } =
      await this.deps.resolveTargetProvider(providerId);

    try {
      await Promise.all([
        service.purgeDanglingVersions(),
        service.abortStaleMultipartUploads(),
      ]);
    } catch {
      // Best-effort sweep during scan
    }

    const cacheKey = provider?.id ?? "legacy_default";
    const objects = await this.deps.getS3Objects(service, cacheKey, force);
    const totalBytes = objects.reduce((sum, obj) => sum + obj.size, 0);
    return {
      count: objects.length,
      totalBytes,
    };
  }
}
