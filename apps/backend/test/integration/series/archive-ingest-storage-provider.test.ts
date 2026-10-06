import { describe, expect, it, beforeEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { db } from "../../utils/db";
import { createMockS3 } from "../../utils/s3";
import {
  users,
  series,
  seasons,
  episodes,
  videoSources,
  archiveIngestJobs,
  storageProviders,
  type StorageProviderRow,
} from "@repo/db";
import {
  encryptCredential,
  type S3StorageService,
  type StorageProviderRegistry,
} from "@repo/media-service";
import { ArchiveIngestJobService } from "../../../src/modules/series";

async function createShow() {
  const userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    name: "Provider Resolution User",
    email: `provider-resolution-${Date.now()}-${Math.random()}@example.com`,
    passwordHash: "dummyhash",
    createdAt: new Date(),
  });
  const seriesId = crypto.randomUUID();
  await db.insert(series).values({ id: seriesId, title: "Show", createdAt: new Date(), updatedAt: new Date() });
  const seasonId = crypto.randomUUID();
  await db.insert(seasons).values({ id: seasonId, seriesId, title: "S1", createdAt: new Date(), updatedAt: new Date() });
  const epIds: string[] = [];
  for (let i = 1; i <= 2; i += 1) {
    const epId = crypto.randomUUID();
    await db.insert(episodes).values({ id: epId, title: `E${i}`, seasonId, order: i, createdAt: new Date(), updatedAt: new Date() });
    epIds.push(epId);
  }
  return { userId, seriesId, epIds };
}

async function seedProvider(input: { id: string; name: string; isDefault: boolean }): Promise<StorageProviderRow> {
  const [row] = await db
    .insert(storageProviders)
    .values({
      id: input.id,
      name: input.name,
      providerType: "custom",
      endpoint: "https://s3.example.com",
      region: "us-east-1",
      bucket: "videos",
      accessKeyIdEnc: encryptCredential("TEST_KEY"),
      secretAccessKeyEnc: encryptCredential("TEST_SECRET"),
      storageLimitGb: 100,
      isDefault: input.isDefault,
      isEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  if (!row) throw new Error("failed to seed storage provider");
  return row;
}

/** Registry double with real resolution semantics: null -> default provider. */
function makeRegistryDouble(opts: {
  defaultProvider: StorageProviderRow;
  serviceFor: (providerId: string | null) => S3StorageService;
  seenIds: Array<string | null | undefined>;
}): StorageProviderRegistry {
  return {
    getProvider: async (providerId?: string | null) => {
      opts.seenIds.push(providerId ?? null);
      if (!providerId) {
        return { provider: opts.defaultProvider, service: opts.serviceFor(null) };
      }
      if (providerId === opts.defaultProvider.id) {
        return { provider: opts.defaultProvider, service: opts.serviceFor(providerId) };
      }
      return null;
    },
    getDefaultProvider: async () => ({
      provider: opts.defaultProvider,
      service: opts.serviceFor(null),
    }),
    getServiceForProvider: (provider: StorageProviderRow) => opts.serviceFor(provider.id),
    getService: async (providerId?: string | null) => opts.serviceFor(providerId ?? null),
    invalidateCache: () => {},
  } as unknown as StorageProviderRegistry;
}

function makeExtractorStub() {
  return {
    binaryPath: "7zz",
    list: async () => [],
    extract: async (opts: { destDir: string; targets: string[] }) => {
      const target = opts.targets[0]!;
      await mkdir(opts.destDir, { recursive: true });
      const abs = join(opts.destDir, basename(target));
      await writeFile(abs, `content-of-${target}`);
      return { extractedFiles: [{ path: basename(target), sizeBytes: 12 }] };
    },
    run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
  };
}

async function seedReadyJob(opts: {
  ownerId: string;
  seriesId: string;
  stagingBase: string;
  storageProviderId: string | null;
}): Promise<string> {
  const jobId = crypto.randomUUID();
  const stagingPath = join(opts.stagingBase, jobId);
  mkdirSync(stagingPath, { recursive: true });
  writeFileSync(join(stagingPath, "pack.7z"), "fake-archive");
  await db.insert(archiveIngestJobs).values({
    id: jobId, ownerId: opts.ownerId, seriesId: opts.seriesId,
    sourceKey: `prov-res-${jobId}`, sourceUrl: "https://example.com/pack.7z",
    status: "ready", stage: "ready", bytesDone: 0, bytesTotal: null,
    stagingPath, archiveFilename: "pack.7z", entries: [], selection: [],
    storageProviderId: opts.storageProviderId, errorCode: null, errorMessage: null,
    createdAt: new Date(), updatedAt: new Date(), expiresAt: null,
  });
  return jobId;
}

describe("ArchiveIngest storage provider resolution (ticket 693)", () => {
  let testTmpBase = "";

  beforeEach(() => {
    try { rmSync(testTmpBase, { recursive: true, force: true }); } catch { /* ignore */ }
    testTmpBase = mkdtempSync(join(tmpdir(), "prov-resolution-"));
  });

  it("resolves to the default database provider when job.storageProviderId is null and records it", async () => {
    const { userId, seriesId, epIds } = await createShow();
    const defaultProvider = await seedProvider({ id: "prov-default-693", name: "Default", isDefault: true });

    const uploads: string[] = [];
    const seenIds: Array<string | null | undefined> = [];
    const registry = makeRegistryDouble({
      defaultProvider,
      seenIds,
      serviceFor: () => createMockS3({ uploadStream: async (key: string) => { uploads.push(key); } }) as unknown as S3StorageService,
    });

    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      s3StorageService: createMockS3({ isConfigured: () => false }),
      storageProviderRegistry: registry,
      extractor: makeExtractorStub() as never,
    });

    const jobId = await seedReadyJob({ ownerId: userId, seriesId, stagingBase: testTmpBase, storageProviderId: null });

    const selection = [
      { filename: "Show.S01E01.mp4", episodeId: epIds[0]!, label: "E1", quality: "1080p" },
    ];
    const result = await service.confirmJob(jobId, selection);
    expect(result.status).toBe("done");

    // Registry must have been asked for the default (null id)…
    expect(seenIds).toContain(null);
    // …the upload must have gone to the provider's service…
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toContain(epIds[0]!);
    // …and the resolved provider id must be recorded on the job…
    const finalJob = await service.getJob(jobId);
    expect(finalJob?.storageProviderId).toBe(defaultProvider.id);
    // …and on the created video_sources rows.
    const rows = await db.select().from(videoSources);
    const mine = rows.filter((r) => epIds.includes(r.episodeId));
    expect(mine).toHaveLength(1);
    expect(mine[0]?.storageProviderId).toBe(defaultProvider.id);
  });

  it("honors an explicit job.storageProviderId", async () => {
    const { userId, seriesId, epIds } = await createShow();
    const defaultProvider = await seedProvider({ id: "prov-default-693b", name: "Default", isDefault: true });

    const seenIds: Array<string | null | undefined> = [];
    const uploads: string[] = [];
    const registry = makeRegistryDouble({
      defaultProvider,
      seenIds,
      serviceFor: () => createMockS3({ uploadStream: async (key: string) => { uploads.push(key); } }) as unknown as S3StorageService,
    });

    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      s3StorageService: createMockS3({ isConfigured: () => false }),
      storageProviderRegistry: registry,
      extractor: makeExtractorStub() as never,
    });

    const jobId = await seedReadyJob({
      ownerId: userId, seriesId, stagingBase: testTmpBase, storageProviderId: defaultProvider.id,
    });

    await service.confirmJob(jobId, [
      { filename: "Show.S01E01.mp4", episodeId: epIds[0]!, label: "E1" },
    ]);

    expect(seenIds).toContain(defaultProvider.id);
    expect(uploads).toHaveLength(1);
    const rows = await db.select().from(videoSources);
    const mine = rows.filter((r) => epIds.includes(r.episodeId));
    expect(mine).toHaveLength(1);
    expect(mine[0]?.storageProviderId).toBe(defaultProvider.id);
  });

  it("fails the job when an explicit storage provider cannot be resolved", async () => {
    const { userId, seriesId, epIds } = await createShow();
    const defaultProvider = await seedProvider({ id: "prov-default-693c", name: "Default", isDefault: true });
    const registry = makeRegistryDouble({
      defaultProvider,
      seenIds: [],
      serviceFor: () => createMockS3() as unknown as S3StorageService,
    });

    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      s3StorageService: createMockS3({ isConfigured: () => false }),
      storageProviderRegistry: registry,
      extractor: makeExtractorStub() as never,
    });

    const jobId = await seedReadyJob({
      ownerId: userId, seriesId, stagingBase: testTmpBase, storageProviderId: "prov-does-not-exist",
    });

    await service.confirmJob(jobId, [
      { filename: "Show.S01E01.mp4", episodeId: epIds[0]!, label: "E1" },
    ]);
    const finalJob = await service.getJob(jobId);
    expect(finalJob?.status).toBe("failed");
    expect(finalJob?.errorMessage).toContain("Specified storage provider not found");
  });

  it("auto-instantiates a registry when omitted, resolving the default provider from the database", async () => {
    const defaultProvider = await seedProvider({ id: "prov-auto-default-693", name: "Auto Default", isDefault: true });

    const service = new ArchiveIngestJobService({ db, stagingBaseDir: testTmpBase });
    const internal = service as unknown as { storageProviderRegistry?: StorageProviderRegistry };
    expect(internal.storageProviderRegistry).toBeDefined();

    const resolved = await internal.storageProviderRegistry!.getProvider(null);
    expect(resolved?.provider.id).toBe(defaultProvider.id);
    expect(resolved?.service).toBeDefined();
  });

  it("raises S3NotConfiguredError when no providers exist and no fallback is configured", async () => {
    const { userId, seriesId, epIds } = await createShow();
    // No providers seeded; auto-instantiated registry resolves to null…
    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      s3StorageService: createMockS3({ isConfigured: () => false }),
      extractor: makeExtractorStub() as never,
    });

    const jobId = await seedReadyJob({ ownerId: userId, seriesId, stagingBase: testTmpBase, storageProviderId: null });

    await service.confirmJob(jobId, [
      { filename: "Show.S01E01.mp4", episodeId: epIds[0]!, label: "E1" },
    ]);
    const finalJob = await service.getJob(jobId);
    expect(finalJob?.status).toBe("failed");
    expect(finalJob?.errorMessage).toContain("not configured");
  });
});
