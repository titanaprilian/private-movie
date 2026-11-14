import type { StorageProviderRow } from "@repo/db";
import type { StorageProviderItem, StorageResourceItem } from "@repo/contracts";
import { decryptCredential, maskAccessKeyId } from "@repo/media-service";

export const DEFAULT_LIMIT_GB = 50;
export const DEFAULT_CACHE_TTL_MS = 60_000;

export interface CorrelatedInventory {
  items: StorageResourceItem[];
  totalBytes: number;
  linkedCount: number;
  orphanCount: number;
  provider: StorageProviderRow | null;
}

export function formatProviderItem(
  provider: StorageProviderRow,
  linkedSourcesCount: number,
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
