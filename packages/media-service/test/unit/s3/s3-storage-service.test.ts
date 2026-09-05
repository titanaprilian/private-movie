import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createS3StorageService,
  extractS3Key,
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

const { mockUploadDone, mockUploadOn, mockUploadAbort, mockUploadConstructor } = vi.hoisted(() => {
  const mockUploadDone = vi.fn();
  const mockUploadOn = vi.fn();
  const mockUploadAbort = vi.fn();
  const mockUploadConstructor = vi.fn().mockImplementation((params) => {
    const instance = {
      done: mockUploadDone,
      on: mockUploadOn,
      abort: mockUploadAbort,
      params,
    };
    mockUploadDone.mockResolvedValue({});
    mockUploadOn.mockImplementation((event: string, listener: Function) => {
      if (event === "httpUploadProgress") {
        (instance as any)._progressListener = listener;
      }
      return instance;
    });
    return instance;
  });
  return { mockUploadDone, mockUploadOn, mockUploadAbort, mockUploadConstructor };
});

vi.mock("@aws-sdk/lib-storage", () => {
  return {
    Upload: mockUploadConstructor,
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

    it("throws S3NotConfiguredError on uploadObject", async () => {
      const service = createS3StorageService();
      await expect(service.uploadObject("test-key", Buffer.from("hello"))).rejects.toThrow(S3NotConfiguredError);
    });

    it("throws S3NotConfiguredError on uploadStream", async () => {
      const service = createS3StorageService();
      const stream = new ReadableStream();
      await expect(service.uploadStream("test-key", stream)).rejects.toThrow(S3NotConfiguredError);
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
        expect.objectContaining({ expiresIn: 3600 })
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

    it("uploads object using PutObjectCommand", async () => {
      mockSend.mockResolvedValueOnce({});

      const service = createS3StorageService(validConfig);
      const data = Buffer.from("test video content");
      await service.uploadObject("episodes/123/uploaded.mp4", data, "video/mp4");

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "PutObjectCommand",
          input: {
            Bucket: "my-bucket",
            Key: "episodes/123/uploaded.mp4",
            Body: data,
            ContentType: "video/mp4",
          },
        })
      );
    });

    it("handles empty key array in deleteObjects without making SDK calls", async () => {
      const service = createS3StorageService(validConfig);
      await service.deleteObjects([]);

      expect(mockSend).not.toHaveBeenCalled();
    });

    it("uploads stream using @aws-sdk/lib-storage Upload", async () => {
      const service = createS3StorageService(validConfig);
      const stream = new ReadableStream();
      const onProgress = vi.fn();

      mockUploadDone.mockImplementationOnce(async () => {
        // simulate progress call
        const instance = mockUploadConstructor.mock.results[mockUploadConstructor.mock.results.length - 1].value;
        if (instance._progressListener) {
          instance._progressListener({ loaded: 500, total: 1000 });
        }
      });

      await service.uploadStream("episodes/123/stream.mp4", stream, {
        contentType: "video/mp4",
        onProgress,
      });

      expect(mockUploadConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            Bucket: "my-bucket",
            Key: "episodes/123/stream.mp4",
            Body: stream,
            ContentType: "video/mp4",
          }),
          queueSize: 4,
          partSize: 10 * 1024 * 1024,
        })
      );
      expect(onProgress).toHaveBeenCalledWith({ loaded: 500, total: 1000 });
      expect(mockUploadDone).toHaveBeenCalled();
    });

    it("handles AbortSignal trigger on uploadStream", async () => {
      const service = createS3StorageService(validConfig);
      const stream = new ReadableStream();
      const controller = new AbortController();

      mockUploadDone.mockImplementationOnce(() => new Promise((resolve) => setTimeout(resolve, 50)));
      mockUploadAbort.mockResolvedValueOnce(undefined);

      const uploadPromise = service.uploadStream("episodes/123/stream.mp4", stream, {
        signal: controller.signal,
      });

      controller.abort();

      await expect(uploadPromise).rejects.toThrow();
      expect(mockUploadAbort).toHaveBeenCalled();
    });

    it("rejects immediately if AbortSignal is already aborted", async () => {
      const service = createS3StorageService(validConfig);
      const stream = new ReadableStream();
      const controller = new AbortController();
      controller.abort();

      mockUploadAbort.mockResolvedValueOnce(undefined);

      await expect(
        service.uploadStream("episodes/123/stream.mp4", stream, {
          signal: controller.signal,
        })
      ).rejects.toThrow();

      expect(mockUploadAbort).toHaveBeenCalled();
    });
  });

  describe("extractS3Key", () => {
    it("returns plain object keys as-is", () => {
      expect(extractS3Key("episodes/123/video.mp4")).toBe("episodes/123/video.mp4");
    });

    it("strips a leading slash from plain keys", () => {
      expect(extractS3Key("/episodes/123/video.mp4")).toBe("episodes/123/video.mp4");
    });

    it("strips the bucket from s3:// URIs", () => {
      expect(extractS3Key("s3://my-bucket/episodes/123/video.mp4")).toBe(
        "episodes/123/video.mp4"
      );
    });

    it("returns empty string for blank input", () => {
      expect(extractS3Key("")).toBe("");
      expect(extractS3Key("   ")).toBe("");
    });
  });
});
