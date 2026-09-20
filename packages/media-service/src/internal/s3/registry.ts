import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import {
  storageProviders,
  type StorageProviderRow,
} from "@repo/db";
import {
  createS3StorageService,
  type S3StorageService,
} from "./s3-storage-service";
import { decryptCredential } from "./encryption";

export interface StorageProviderRegistry {
  getProvider(providerId?: string | null): Promise<{
    provider: StorageProviderRow;
    service: S3StorageService;
  } | null>;
  getDefaultProvider(): Promise<{
    provider: StorageProviderRow;
    service: S3StorageService;
  } | null>;
  getServiceForProvider(provider: StorageProviderRow): S3StorageService | null;
  getService(providerId?: string | null): Promise<S3StorageService | null>;
  invalidateCache(providerId?: string): void;
}

export function createStorageProviderRegistry<
  THKT extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  db: PgDatabase<THKT, TSchema>,
  defaultS3Fallback?: S3StorageService
): StorageProviderRegistry {
  const serviceCache = new Map<string, S3StorageService>();

  function instantiateService(provider: StorageProviderRow): S3StorageService | null {
    try {
      const accessKeyId = decryptCredential(provider.accessKeyIdEnc);
      const secretAccessKey = decryptCredential(provider.secretAccessKeyEnc);

      return createS3StorageService({
        endpoint: provider.endpoint,
        region: provider.region,
        bucket: provider.bucket,
        accessKeyId,
        secretAccessKey,
        forcePathStyle: provider.forcePathStyle,
        publicBaseUrl: provider.publicBaseUrl,
      });
    } catch (error) {
      console.warn(
        `[StorageProviderRegistry] Failed to decrypt credentials for provider ${provider.id} (${provider.name}):`,
        error
      );
      return null;
    }
  }

  function getServiceForProvider(provider: StorageProviderRow): S3StorageService | null {
    const cached = serviceCache.get(provider.id);
    if (cached) return cached;

    const instance = instantiateService(provider);
    if (instance) {
      serviceCache.set(provider.id, instance);
    }
    return instance;
  }

  async function getDefaultProvider(): Promise<{
    provider: StorageProviderRow;
    service: S3StorageService;
  } | null> {
    // 1. Try to find provider marked as default
    const [defaultRow] = await db
      .select()
      .from(storageProviders)
      .where(eq(storageProviders.isDefault, true))
      .limit(1);

    if (defaultRow) {
      const service = getServiceForProvider(defaultRow);
      if (!service) return null;
      return {
        provider: defaultRow,
        service,
      };
    }

    // 2. Fall back to any enabled provider
    const [enabledRow] = await db
      .select()
      .from(storageProviders)
      .where(eq(storageProviders.isEnabled, true))
      .limit(1);

    if (enabledRow) {
      const service = getServiceForProvider(enabledRow);
      if (!service) return null;
      return {
        provider: enabledRow,
        service,
      };
    }

    // 3. Fall back to first provider row
    const [firstRow] = await db
      .select()
      .from(storageProviders)
      .limit(1);

    if (firstRow) {
      const service = getServiceForProvider(firstRow);
      if (!service) return null;
      return {
        provider: firstRow,
        service,
      };
    }

    return null;
  }

  async function getProvider(providerId?: string | null): Promise<{
    provider: StorageProviderRow;
    service: S3StorageService;
  } | null> {
    if (!providerId) {
      return await getDefaultProvider();
    }

    const [row] = await db
      .select()
      .from(storageProviders)
      .where(eq(storageProviders.id, providerId))
      .limit(1);

    if (!row) {
      return null;
    }

    const service = getServiceForProvider(row);
    if (!service) return null;

    return {
      provider: row,
      service,
    };
  }

  async function getService(providerId?: string | null): Promise<S3StorageService | null> {
    const res = await getProvider(providerId);
    if (res) {
      return res.service;
    }
    // Fall back to default fallback if configured
    if (defaultS3Fallback && defaultS3Fallback.isConfigured()) {
      return defaultS3Fallback;
    }
    return null;
  }

  function invalidateCache(providerId?: string): void {
    if (providerId) {
      serviceCache.delete(providerId);
    } else {
      serviceCache.clear();
    }
  }

  return {
    getProvider,
    getDefaultProvider,
    getServiceForProvider,
    getService,
    invalidateCache,
  };
}
