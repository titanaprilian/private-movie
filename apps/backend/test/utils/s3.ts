import type { S3StorageService, S3ObjectSummary } from "@repo/media-service";

export function createMockS3(
  overrides?: Partial<S3StorageService>
): S3StorageService {
  const objects: S3ObjectSummary[] = [];
  return {
    isConfigured: () => true,
    getPresignedUploadUrl: async (key: string) => ({
      uploadUrl: `https://s3.example.com/${key}`,
      key,
    }),
    getPresignedPlaybackUrl: async (key: string) =>
      `https://s3.signed.com/${key}?expires=21600`,
    uploadObject: async () => {},
    uploadStream: async () => {},
    deleteObject: async () => {},
    deleteObjects: async () => {},
    listObjects: async () => ({
      objects,
      isTruncated: false,
    }),
    listAllObjects: async () => objects,
    getBucketStorageUsage: async () => ({
      totalSizeBytes: 0,
      objectCount: 0,
    }),
    testConnection: async () => ({ success: true, latencyMs: 10 }),
    getPublicBaseUrl: () => null,
    ...overrides,
  };
}
