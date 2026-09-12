import { describe, expect, it } from "vitest";
import { normalizeVideoSource } from "../../../src/internal/playback/normalization";
import type { S3StorageService } from "../../../src/internal/s3/s3-storage-service";
import type { StorageProviderRegistry } from "../../../src/internal/s3/registry";

describe("Multi-Provider Playback URL Normalization", () => {
  const dummyService1: S3StorageService = {
    isConfigured: () => true,
    getPublicBaseUrl: () => "https://cdn.provider1.com",
    getPresignedPlaybackUrl: async (k) => `https://signed.p1.com/${k}`,
    getPresignedUploadUrl: async () => ({} as any),
    uploadObject: async () => {},
    uploadStream: async () => {},
    deleteObject: async () => {},
    deleteObjects: async () => {},
    listObjects: async () => ({} as any),
    listAllObjects: async () => [],
    getBucketStorageUsage: async () => ({} as any),
    testConnection: async () => ({ success: true, latencyMs: 10 }),
  };

  const dummyService2: S3StorageService = {
    isConfigured: () => true,
    getPublicBaseUrl: () => null,
    getPresignedPlaybackUrl: async (k) => `https://signed.p2.com/${k}?token=secret`,
    getPresignedUploadUrl: async () => ({} as any),
    uploadObject: async () => {},
    uploadStream: async () => {},
    deleteObject: async () => {},
    deleteObjects: async () => {},
    listObjects: async () => ({} as any),
    listAllObjects: async () => [],
    getBucketStorageUsage: async () => ({} as any),
    testConnection: async () => ({ success: true, latencyMs: 10 }),
  };

  const mockRegistry: StorageProviderRegistry = {
    getProvider: async () => null,
    getDefaultProvider: async () => null,
    getServiceForProvider: () => dummyService1,
    getService: async (id) => {
      if (id === "prov-1") return dummyService1;
      if (id === "prov-2") return dummyService2;
      return null;
    },
    invalidateCache: () => {},
  };

  it("normalizes to direct public CDN URL when provider has publicBaseUrl", async () => {
    const source = {
      id: "s-1",
      url: "episodes/ep1/video.mp4",
      type: "s3",
      storageProviderId: "prov-1",
    };

    const normalized = await normalizeVideoSource(source, {
      storageProviderRegistry: mockRegistry,
    });

    expect(normalized.url).toBe("https://cdn.provider1.com/episodes/ep1/video.mp4");
  });

  it("normalizes to presigned playback URL when provider has no publicBaseUrl", async () => {
    const source = {
      id: "s-2",
      url: "episodes/ep2/video.mp4",
      type: "s3",
      storageProviderId: "prov-2",
    };

    const normalized = await normalizeVideoSource(source, {
      storageProviderRegistry: mockRegistry,
    });

    expect(normalized.url).toBe("https://signed.p2.com/episodes/ep2/video.mp4?token=secret");
  });
});
