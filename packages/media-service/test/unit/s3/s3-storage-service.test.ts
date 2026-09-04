import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createS3StorageService,
  S3NotConfiguredError,
} from "../../../src/internal/s3/s3-storage-service";

const mockSend = vi.fn();
vi.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: vi.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: vi.fn().mockImplementation((input) => ({ type: "PutObjectCommand", input })),
    GetObjectCommand: vi.fn().mockImplementation((input) => ({ type: "GetObjectCommand", input })),
    DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ type: "DeleteObjectCommand", input })),
    DeleteObjectsCommand: vi.fn().mockImplementation((input) => ({ type: "DeleteObjectsCommand", input })),
  };
});

const mockGetSignedUrl = vi.fn();
vi.mock("@aws-sdk/s3-request-presigner", () => {
  return {
    getSignedUrl: (...args: any[]) => mockGetSignedUrl(...args),
  };
});

describe("S3StorageService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createS3StorageService", () => {
    it("returns an unconfigured service when env variables/options are missing", () => {
      delete process.env.S3_ENDPOINT;
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;

      const service = createS3StorageService();
      expect(service.isConfigured()).toBe(false);
    });

    it("returns an unconfigured service when options are partially provided", () => {
      const service = createS3StorageService({
        endpoint: "https://s3.us-east-005.backblazeb2.com",
        bucket: "my-bucket",
        // accessKeyId and secretAccessKey missing
      });
      expect(service.isConfigured()).toBe(false);
    });

    it("returns a configured service when all required options are provided", () => {
      const service = createS3StorageService({
        endpoint: "https://s3.us-east-005.backblazeb2.com",
        region: "us-east-005",
        bucket: "my-bucket",
        accessKeyId: "key123",
        secretAccessKey: "secret456",
      });
      expect(service.isConfigured()).toBe(true);
    });

    it("reads configuration from environment variables if options are omitted", () => {
      process.env.S3_ENDPOINT = "https://s3.us-east-005.backblazeb2.com";
      process.env.S3_REGION = "us-east-005";
      process.env.S3_BUCKET = "env-bucket";
      process.env.S3_ACCESS_KEY_ID = "env-key";
      process.env.S3_SECRET_ACCESS_KEY = "env-secret";

      const service = createS3StorageService();
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe("Unconfigured S3StorageService operations", () => {
    it("throws S3NotConfiguredError on getPresignedUploadUrl", async () => {
      const service = createS3StorageService();
      await expect(service.getPresignedUploadUrl("test-key")).rejects.toThrow(S3NotConfiguredError);
    });

    it("throws S3NotConfiguredError on getPresignedPlaybackUrl", async () => {
      const service = createS3StorageService();
      await expect(service.getPresignedPlaybackUrl("test-key")).rejects.toThrow(S3NotConfiguredError);
    });

    it("throws S3NotConfiguredError on deleteObject", async () => {
      const service = createS3StorageService();
      await expect(service.deleteObject("test-key")).rejects.toThrow(S3NotConfiguredError);
    });

    it("throws S3NotConfiguredError on deleteObjects", async () => {
      const service = createS3StorageService();
      await expect(service.deleteObjects(["test-key"])).rejects.toThrow(S3NotConfiguredError);
    });
  });

  describe("Configured S3StorageService operations", () => {
    const validConfig = {
      endpoint: "https://s3.us-east-005.backblazeb2.com",
      region: "us-east-005",
      bucket: "my-bucket",
      accessKeyId: "key123",
      secretAccessKey: "secret456",
      presignedGetExpiresIn: 21600,
    };

    it("generates presigned upload URL", async () => {
      mockGetSignedUrl.mockResolvedValueOnce("https://s3.us-east-005.backblazeb2.com/my-bucket/key.mp4?sig=123");

      const service = createS3StorageService(validConfig);
      const result = await service.getPresignedUploadUrl("episodes/123/video.mp4", "video/mp4");

      expect(result).toEqual({
        uploadUrl: "https://s3.us-east-005.backblazeb2.com/my-bucket/key.mp4?sig=123",
        key: "episodes/123/video.mp4",
      });
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: "PutObjectCommand",
          input: {
            Bucket: "my-bucket",
            Key: "episodes/123/video.mp4",
            ContentType: "video/mp4",
          },
        }),
        { expiresIn: 3600 }
      );
    });

    it("generates presigned playback URL with default 6-hour TTL", async () => {
      mockGetSignedUrl.mockResolvedValueOnce("https://s3.us-east-005.backblazeb2.com/my-bucket/key.mp4?signed-get=true");

      const service = createS3StorageService(validConfig);
      const url = await service.getPresignedPlaybackUrl("episodes/123/video.mp4");

      expect(url).toBe("https://s3.us-east-005.backblazeb2.com/my-bucket/key.mp4?signed-get=true");
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: "GetObjectCommand",
          input: {
            Bucket: "my-bucket",
            Key: "episodes/123/video.mp4",
          },
        }),
        { expiresIn: 21600 }
      );
    });

    it("supports custom expiration for presigned playback URL", async () => {
      mockGetSignedUrl.mockResolvedValueOnce("https://s3.us-east-005.backblazeb2.com/my-bucket/key.mp4?signed-get=true");

      const service = createS3StorageService(validConfig);
      await service.getPresignedPlaybackUrl("episodes/123/video.mp4", 3600);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 3600 }
      );
    });

    it("deletes a single object", async () => {
      mockSend.mockResolvedValueOnce({});

      const service = createS3StorageService(validConfig);
      await service.deleteObject("episodes/123/video.mp4");

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "DeleteObjectCommand",
          input: {
            Bucket: "my-bucket",
            Key: "episodes/123/video.mp4",
          },
        })
      );
    });

    it("deletes multiple objects", async () => {
      mockSend.mockResolvedValueOnce({});

      const service = createS3StorageService(validConfig);
      await service.deleteObjects(["episodes/123/v1.mp4", "episodes/123/v2.mp4"]);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "DeleteObjectsCommand",
          input: {
            Bucket: "my-bucket",
            Delete: {
              Objects: [{ Key: "episodes/123/v1.mp4" }, { Key: "episodes/123/v2.mp4" }],
            },
          },
        })
      );
    });

    it("handles empty key array in deleteObjects without making SDK calls", async () => {
      const service = createS3StorageService(validConfig);
      await service.deleteObjects([]);

      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
