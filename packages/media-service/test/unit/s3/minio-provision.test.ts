import { describe, it, expect, vi, beforeEach } from "vitest";

const sentCommands: Array<{ name: string; input: Record<string, unknown> }> = [];
let corsFailure: unknown = null;

vi.mock("@aws-sdk/client-s3", () => {
  class MockHeadBucketCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class MockCreateBucketCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class MockPutBucketCorsCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class MockS3Client {
    send = vi.fn(async (command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      sentCommands.push({ name: command.constructor.name, input: command.input });
      if (command.constructor.name === "MockHeadBucketCommand") {
        const err = new Error("NotFound");
        (err as { name: string }).name = "NotFound";
        throw err;
      }
      if (command.constructor.name === "MockPutBucketCorsCommand" && corsFailure) {
        throw corsFailure;
      }
      return {};
    });
  }
  return {
    S3Client: MockS3Client,
    HeadBucketCommand: MockHeadBucketCommand,
    CreateBucketCommand: MockCreateBucketCommand,
    PutBucketCorsCommand: MockPutBucketCorsCommand,
  };
});

import {
  ensureMinioBucketWithCors,
  isBucketCorsNotImplementedError,
} from "../../../src/internal/s3/minio-provision";

describe("ensureMinioBucketWithCors", () => {
  beforeEach(() => {
    sentCommands.length = 0;
    corsFailure = null;
  });

  it("creates a missing bucket and applies the video streaming CORS policy", async () => {
    await ensureMinioBucketWithCors({
      endpoint: "http://localhost:9000",
      region: "us-east-1",
      bucket: "private-movie-videos",
      accessKeyId: "TESTACCESSKEY12345",
      secretAccessKey: "test-secret",
      forcePathStyle: true,
    });

    const names = sentCommands.map((c) => c.name);
    expect(names).toContain("MockHeadBucketCommand");
    expect(names).toContain("MockCreateBucketCommand");
    expect(names).toContain("MockPutBucketCorsCommand");

    const cors = sentCommands.find((c) => c.name === "MockPutBucketCorsCommand");
    expect(cors!.input).toMatchObject({ Bucket: "private-movie-videos" });
    const rules = (cors!.input as { CORSConfiguration: { CORSRules: Array<Record<string, unknown>> } })
      .CORSConfiguration.CORSRules;
    expect(rules).toHaveLength(1);
    expect(rules[0].AllowedMethods).toEqual(expect.arrayContaining(["GET", "HEAD"]));
    expect(rules[0].AllowedHeaders).toEqual(["*"]);
    expect(rules[0].ExposeHeaders).toEqual(
      expect.arrayContaining(["Content-Range", "Content-Length", "ETag", "Accept-Ranges"])
    );
  });

  it("succeeds when PutBucketCors rejects with 501 NotImplemented (MinIO native CORS)", async () => {
    const err = new Error("NotImplemented");
    (err as { name: string }).name = "NotImplemented";
    (err as { $metadata: { httpStatusCode: number } }).$metadata = { httpStatusCode: 501 };
    corsFailure = err;

    await expect(
      ensureMinioBucketWithCors({
        endpoint: "http://localhost:9000",
        region: "us-east-1",
        bucket: "private-movie-videos",
        accessKeyId: "TESTACCESSKEY12345",
        secretAccessKey: "test-secret",
        forcePathStyle: true,
      })
    ).resolves.toBeUndefined();

    const names = sentCommands.map((c) => c.name);
    expect(names).toContain("MockPutBucketCorsCommand");
  });

  it("succeeds when PutBucketCors rejects with bare 501 status code", async () => {
    const err = new Error("501");
    (err as { $metadata: { httpStatusCode: number } }).$metadata = { httpStatusCode: 501 };
    corsFailure = err;

    await expect(
      ensureMinioBucketWithCors({
        endpoint: "http://localhost:9000",
        bucket: "private-movie-videos",
        accessKeyId: "TESTACCESSKEY12345",
        secretAccessKey: "test-secret",
      })
    ).resolves.toBeUndefined();
  });

  it("rethrows non-NotImplemented CORS errors", async () => {
    const err = new Error("AccessDenied");
    (err as { name: string }).name = "AccessDenied";
    (err as { $metadata: { httpStatusCode: number } }).$metadata = { httpStatusCode: 403 };
    corsFailure = err;

    await expect(
      ensureMinioBucketWithCors({
        endpoint: "http://localhost:9000",
        bucket: "private-movie-videos",
        accessKeyId: "TESTACCESSKEY12345",
        secretAccessKey: "test-secret",
      })
    ).rejects.toThrow("AccessDenied");
  });

  it("isBucketCorsNotImplementedError classifies 501 / NotImplemented errors", () => {
    const notImpl = new Error("NotImplemented");
    (notImpl as { name: string }).name = "NotImplemented";
    expect(isBucketCorsNotImplementedError(notImpl)).toBe(true);

    const status501 = Object.assign(new Error("some failure"), {
      $metadata: { httpStatusCode: 501 },
    });
    expect(isBucketCorsNotImplementedError(status501)).toBe(true);

    const denied = Object.assign(new Error("AccessDenied"), {
      name: "AccessDenied",
      $metadata: { httpStatusCode: 403 },
    });
    expect(isBucketCorsNotImplementedError(denied)).toBe(false);
  });
});
