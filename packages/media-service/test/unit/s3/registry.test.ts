import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStorageProviderRegistry } from "../../../src/internal/s3/registry";
import type { StorageProviderRow } from "@repo/db";

describe("StorageProviderRegistry decryption failure handling", () => {
  const dummyRow: StorageProviderRow = {
    id: "provider-1",
    name: "Corrupted Provider",
    endpoint: "https://s3.example.com",
    region: "us-east-1",
    bucket: "test-bucket",
    accessKeyIdEnc: "invalid:hex:string",
    secretAccessKeyEnc: "invalid:hex:string",
    forcePathStyle: false,
    publicBaseUrl: null,
    isDefault: true,
    isEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("catches decryption failures gracefully and logs a warning in getServiceForProvider", () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mockDb = {} as any;

    const registry = createStorageProviderRegistry(mockDb);
    const service = registry.getServiceForProvider(dummyRow);

    expect(service).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[StorageProviderRegistry] Failed to decrypt credentials for provider provider-1 (Corrupted Provider):",
      expect.any(Error)
    );

    consoleWarnSpy.mockRestore();
  });

  it("returns null when getDefaultProvider hits decryption failure", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const mockDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [dummyRow],
          }),
        }),
      }),
    } as any;

    const registry = createStorageProviderRegistry(mockDb);
    const result = await registry.getDefaultProvider();

    expect(result).toBeNull();
    consoleWarnSpy.mockRestore();
  });
});
