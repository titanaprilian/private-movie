import { randomUUID } from "node:crypto";
import {
  encryptCredential,
  createS3StorageService,
  type S3StorageService,
} from "@repo/media-service";
import type {
  StorageProviderItem,
  CreateStorageProviderRequest,
  UpdateStorageProviderRequest,
  TestStorageProviderRequest,
  TestStorageProviderResponseData,
} from "@repo/contracts";
import type { StorageRepository } from "../repositories/repository";
import {
  StorageProviderInUseError,
  StorageProviderNotFoundError,
} from "../errors";
import { DEFAULT_LIMIT_GB, formatProviderItem } from "./provider-formatter";

export interface ProvidersServiceDependencies {
  repository: StorageRepository;
  invalidateCache: (providerId?: string) => void;
  getServiceForProvider: (
    row: import("@repo/db").StorageProviderRow,
  ) => S3StorageService | null;
}

export class StorageProvidersService {
  constructor(private deps: ProvidersServiceDependencies) {}

  async listProviders(): Promise<StorageProviderItem[]> {
    const providers = await this.deps.repository.listProviders();
    const allSources = await this.deps.repository.listVideoSourceProviderIds();

    const countMap = new Map<string, number>();
    for (const src of allSources) {
      if (src.storageProviderId) {
        countMap.set(
          src.storageProviderId,
          (countMap.get(src.storageProviderId) ?? 0) + 1,
        );
      }
    }

    return providers.map((p) => formatProviderItem(p, countMap.get(p.id) ?? 0));
  }

  async getProvider(id: string): Promise<StorageProviderItem> {
    const provider = await this.deps.repository.findProviderById(id);

    if (!provider) {
      throw new StorageProviderNotFoundError(
        `Storage provider with id ${id} not found`,
      );
    }

    const sources =
      await this.deps.repository.listVideoSourceIdsForProvider(id);
    return formatProviderItem(provider, sources.length);
  }

  async createProvider(
    input: CreateStorageProviderRequest,
  ): Promise<StorageProviderItem> {
    const now = new Date();
    const id = randomUUID();

    if (input.isDefault) {
      await this.deps.repository.unsetDefaultProviders();
    }

    const accessKeyIdEnc = encryptCredential(input.accessKeyId);
    const secretAccessKeyEnc = encryptCredential(input.secretAccessKey);

    const row = await this.deps.repository.insertProvider({
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
    });

    this.deps.invalidateCache();
    return formatProviderItem(row!, 0);
  }

  async updateProvider(
    id: string,
    input: UpdateStorageProviderRequest,
  ): Promise<StorageProviderItem> {
    const existing = await this.deps.repository.findProviderById(id);

    if (!existing) {
      throw new StorageProviderNotFoundError(
        `Storage provider with id ${id} not found`,
      );
    }

    const now = new Date();

    if (input.isDefault) {
      await this.deps.repository.unsetDefaultProviders();
    }

    const updateData: Parameters<StorageRepository["updateProvider"]>[1] = {
      updatedAt: now,
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.providerType !== undefined)
      updateData.providerType = input.providerType;
    if (input.endpoint !== undefined) updateData.endpoint = input.endpoint;
    if (input.region !== undefined) updateData.region = input.region;
    if (input.bucket !== undefined) updateData.bucket = input.bucket;
    if (input.publicBaseUrl !== undefined)
      updateData.publicBaseUrl = input.publicBaseUrl
        ? input.publicBaseUrl.trim()
        : null;
    if (input.forcePathStyle !== undefined)
      updateData.forcePathStyle = input.forcePathStyle;
    if (input.storageLimitGb !== undefined)
      updateData.storageLimitGb = input.storageLimitGb;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;
    if (input.isEnabled !== undefined) updateData.isEnabled = input.isEnabled;

    if (input.accessKeyId) {
      updateData.accessKeyIdEnc = encryptCredential(input.accessKeyId);
    }
    if (input.secretAccessKey) {
      updateData.secretAccessKeyEnc = encryptCredential(input.secretAccessKey);
    }

    const updated = await this.deps.repository.updateProvider(id, updateData);

    this.deps.invalidateCache(id);

    const sources =
      await this.deps.repository.listVideoSourceIdsForProvider(id);

    return formatProviderItem(updated!, sources.length);
  }

  async deleteProvider(id: string): Promise<void> {
    const existing = await this.deps.repository.findProviderById(id);

    if (!existing) {
      throw new StorageProviderNotFoundError(
        `Storage provider with id ${id} not found`,
      );
    }

    if (await this.deps.repository.hasLinkedSources(id)) {
      throw new StorageProviderInUseError(
        `Cannot delete storage provider ${id}: linked video sources exist`,
      );
    }

    await this.deps.repository.deleteProvider(id);
    this.deps.invalidateCache(id);
  }

  async testProvider(
    input: TestStorageProviderRequest,
  ): Promise<TestStorageProviderResponseData> {
    let service: S3StorageService;

    if (input.providerId) {
      const row = await this.deps.repository.findProviderById(input.providerId);

      if (!row) {
        throw new StorageProviderNotFoundError(
          `Storage provider with id ${input.providerId} not found`,
        );
      }

      const resolvedService = this.deps.getServiceForProvider(row);
      if (!resolvedService) {
        throw new Error("Failed to decrypt storage provider credentials");
      }
      service = resolvedService;
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
  }
}
