import { describe, expect, it, vi } from "vitest";
import { createStorageService } from "../../../src/modules/storage";
import type { MinioDeps } from "../../../src/modules/storage";
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

  describe("getTotalUsedBytes", () => {
    function providerRow(overrides: Record<string, unknown> = {}) {
      return {
        id: "prov-1",
        name: "Provider 1",
        providerType: "s3",
        endpoint: "https://s3.example.com",
        region: "auto",
        bucket: "bucket-1",
        accessKeyIdEnc: "enc",
        secretAccessKeyEnc: "enc",
        publicBaseUrl: null,
        forcePathStyle: false,
        storageLimitGb: 50,
        isDefault: false,
        isEnabled: true,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        ...overrides,
      };
    }

    // Minimal thenable Drizzle chain: `await db.select().from()...` resolves
    // to the queued rows regardless of further chaining.
    function chainFor(rows: unknown[]) {
      const chain: Record<string, unknown> = {};
      chain.from = vi.fn(() => chain);
      chain.orderBy = vi.fn(async () => rows);
      chain.leftJoin = vi.fn(() => chain);
      chain.where = vi.fn(() => chain);
      chain.then = (resolve: (v: unknown) => void) =>
        Promise.resolve(rows).then(resolve);
      return chain;
    }

    function setup(providerRows: Record<string, unknown>[], objectsByProvider: Record<string, { key: string; size: number }[]>) {
      const select = vi.fn();
      for (const rows of [providerRows, []]) {
        select.mockImplementationOnce(() => chainFor(rows));
      }
      const serviceById = new Map<string, { listAllObjects: () => Promise<{ key: string; size: number; lastModified: Date }[]> }>();
      for (const row of providerRows) {
        const objects = objectsByProvider[row.id as string] ?? [];
        if (objects === ("__FAIL__" as unknown)) {
          serviceById.set(row.id as string, {
            listAllObjects: () => Promise.reject(new Error("S3 listing failed")),
          });
        } else {
          serviceById.set(row.id as string, {
            listAllObjects: () =>
              Promise.resolve(
                (objects as { key: string; size: number }[]).map((o) => ({
                  ...o,
                  lastModified: new Date("2024-01-01T00:00:00.000Z"),
                }))
              ),
          });
        }
      }
      const registry = {
        getProvider: vi.fn(async (id: string) => {
          const row = providerRows.find((r) => r.id === id);
          if (!row) return null;
          return { provider: row, service: serviceById.get(id) };
        }),
        getDefaultProvider: vi.fn(async () => null),
        getServiceForProvider: vi.fn(),
        invalidateCache: vi.fn(),
      };
      // Each getMetrics(providerId) performs one correlated-inventory select
      // returning no linked video sources.
      select.mockImplementation(() => chainFor([]));
      const fakeDb = { select } as unknown as Parameters<typeof createStorageService>[0];
      const service = createStorageService(fakeDb, {
        storageProviderRegistry: registry as never,
      });
      return { service };
    }

    it("returns null when no storage providers are enabled", async () => {
      const { service } = setup([], {});
      await expect(service.getTotalUsedBytes()).resolves.toBeNull();
    });

    it("returns null when all providers are disabled", async () => {
      const { service } = setup(
        [providerRow({ id: "prov-1", isEnabled: false })],
        {}
      );
      await expect(service.getTotalUsedBytes()).resolves.toBeNull();
    });

    it("returns the exact summed bytes across multiple enabled providers", async () => {
      const { service } = setup(
        [providerRow({ id: "prov-1" }), providerRow({ id: "prov-2", name: "Provider 2" })],
        {
          "prov-1": [
            { key: "a.mp4", size: 100 },
            { key: "b.mp4", size: 200 },
          ],
          "prov-2": [{ key: "c.mp4", size: 300 }],
        }
      );
      await expect(service.getTotalUsedBytes()).resolves.toBe(600);
    });

    it("rejects when any single enabled provider fails to report metrics", async () => {
      const { service } = setup(
        [providerRow({ id: "prov-1" }), providerRow({ id: "prov-2", name: "Provider 2" })],
        {
          "prov-1": [{ key: "a.mp4", size: 100 }],
          "prov-2": "__FAIL__" as unknown as { key: string; size: number }[],
        }
      );
      await expect(service.getTotalUsedBytes()).rejects.toThrow("S3 listing failed");
    });
  });

  describe("MinioDeps export", () => {
    it("is exported from the public storage module entry point", () => {
      // Compile-time proof: assigning the full and partial dep bags to
      // MinioDeps must typecheck.
      const full: MinioDeps = {
        minioInspector: async () => ({ isAvailable: true, isRunning: true }),
        minioContainerStarter: async () => {},
        minioHealthChecker: async () => {},
        minioBucketProvisioner: async () => {},
      };
      const empty: MinioDeps = {};
      expect(full).toBeDefined();
      expect(empty).toBeDefined();
    });
  });
});
