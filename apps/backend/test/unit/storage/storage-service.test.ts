import { describe, expect, it, vi } from "vitest";
import { createStorageService } from "../../../src/modules/storage";
import { S3NotConfiguredError } from "@repo/media-service";

describe("StorageService Unit Tests", () => {
  it("throws S3NotConfiguredError when S3 is missing or unconfigured", async () => {
    const fakeDb = {
      select: vi.fn(),
    } as unknown as Parameters<typeof createStorageService>[0];

    const service = createStorageService(fakeDb);
    await expect(service.getMetrics()).rejects.toThrow(S3NotConfiguredError);
    await expect(service.scan()).rejects.toThrow(S3NotConfiguredError);
    await expect(service.purgeOrphans()).rejects.toThrow(S3NotConfiguredError);
    await expect(service.getPreviewUrl("key")).rejects.toThrow(S3NotConfiguredError);
  });

  it("validates positive number in updateLimit", async () => {
    const fakeDb = {
      insert: vi.fn(),
    } as unknown as Parameters<typeof createStorageService>[0];

    const service = createStorageService(fakeDb);
    await expect(service.updateLimit(0)).rejects.toThrow("Storage limit must be a positive number");
    await expect(service.updateLimit(-5)).rejects.toThrow("Storage limit must be a positive number");
  });
});
