import type { VideoSourceRow } from "@repo/db";
import type { StorageRepository } from "../repositories/repository";
import {
  EpisodeNotFoundError,
  StorageProviderNotFoundError,
  VideoSourceNotFoundError,
} from "../errors";

export interface ResourceActionsDependencies {
  repository: StorageRepository;
  resolveTargetProvider: (providerId?: string) => Promise<{
    provider: import("@repo/db").StorageProviderRow | null;
    service: import("@repo/media-service").S3StorageService;
  }>;
  getCorrelatedInventory: (
    providerId?: string,
  ) => Promise<import("./provider-formatter").CorrelatedInventory>;
  invalidateCache: (providerId?: string) => void;
}

export class StorageResourceActionsService {
  constructor(private deps: ResourceActionsDependencies) {}

  async updateLimit(
    limitGb: number,
    providerId?: string,
  ): Promise<{ limitGb: number; limitBytes: number }> {
    if (limitGb <= 0 || Number.isNaN(limitGb)) {
      throw new Error("Storage limit must be a positive number");
    }

    const limitBytes = limitGb * 1024 * 1024 * 1024;

    if (providerId) {
      const updated = await this.deps.repository.setProviderLimit(
        providerId,
        limitGb,
      );

      if (!updated) {
        throw new StorageProviderNotFoundError(
          `Storage provider with id ${providerId} not found`,
        );
      }
    } else {
      await this.deps.repository.upsertSystemLimit(limitGb);
    }

    return {
      limitGb,
      limitBytes,
    };
  }

  async updateSourceMetadata(
    videoSourceId: string,
    input: { label?: string; quality?: string | null },
  ): Promise<VideoSourceRow> {
    const existing =
      await this.deps.repository.findVideoSourceById(videoSourceId);

    if (!existing) {
      throw new VideoSourceNotFoundError(
        `Video source with id ${videoSourceId} not found`,
      );
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

    const updated = await this.deps.repository.updateVideoSource(
      videoSourceId,
      updateData,
    );

    this.deps.invalidateCache();
    return updated!;
  }

  async attachOrphan(input: {
    key: string;
    episodeId: string;
    label?: string;
    quality?: string | null;
    providerId?: string;
  }): Promise<VideoSourceRow> {
    const existingEp = await this.deps.repository.findEpisodeById(
      input.episodeId,
    );

    if (!existingEp) {
      throw new EpisodeNotFoundError(
        `Episode with id ${input.episodeId} not found`,
      );
    }

    const { provider } = await this.deps.resolveTargetProvider(
      input.providerId,
    );
    const targetProviderId = provider
      ? provider.id
      : (input.providerId ?? null);

    const now = new Date();
    const created = await this.deps.repository.insertVideoSource({
      id: crypto.randomUUID(),
      episodeId: input.episodeId,
      type: "s3",
      url: input.key,
      label: input.label || "S3 Source",
      quality: input.quality ?? null,
      storageProviderId: targetProviderId,
      createdAt: now,
      updatedAt: now,
    });

    this.deps.invalidateCache(targetProviderId ?? undefined);
    return created!;
  }

  async deleteResources(
    keys: string[],
    providerId?: string,
  ): Promise<{
    deletedKeys: string[];
    reclaimedBytes: number;
    deletedSourcesCount: number;
  }> {
    const { service, provider } =
      await this.deps.resolveTargetProvider(providerId);
    if (!keys || keys.length === 0) {
      return { deletedKeys: [], reclaimedBytes: 0, deletedSourcesCount: 0 };
    }

    const { items } = await this.deps.getCorrelatedInventory(providerId);
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
      await this.deps.repository.deleteVideoSources(sourceIdsToDelete);
    }

    await service.deleteObjects(validKeys);
    this.deps.invalidateCache(provider?.id);

    return {
      deletedKeys: validKeys,
      reclaimedBytes,
      deletedSourcesCount: sourceIdsToDelete.length,
    };
  }

  async purgeOrphans(providerId?: string): Promise<{
    deletedKeys: string[];
    reclaimedBytes: number;
  }> {
    const { service, provider } =
      await this.deps.resolveTargetProvider(providerId);

    try {
      await Promise.all([
        service.purgeDanglingVersions(),
        service.abortStaleMultipartUploads(),
      ]);
    } catch {
      // Best-effort sweep during purge
    }

    const { items } = await this.deps.getCorrelatedInventory(providerId);
    const orphanItems = items.filter((item) => item.status === "orphaned");

    if (orphanItems.length === 0) {
      return { deletedKeys: [], reclaimedBytes: 0 };
    }

    const orphanKeys = orphanItems.map((i) => i.key);
    const reclaimedBytes = orphanItems.reduce((sum, i) => sum + i.sizeBytes, 0);

    await service.deleteObjects(orphanKeys);
    this.deps.invalidateCache(provider?.id);

    return {
      deletedKeys: orphanKeys,
      reclaimedBytes,
    };
  }

  async getPreviewUrl(
    key: string,
    providerId?: string,
  ): Promise<{ previewUrl: string }> {
    const { service } = await this.deps.resolveTargetProvider(providerId);
    const previewUrl = await service.getPresignedPlaybackUrl(key);
    return { previewUrl };
  }
}
