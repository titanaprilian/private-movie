import { describe, expect, it, beforeEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { db } from "../../utils/db";
import { users, series, seasons, episodes, videoSources, archiveIngestJobs } from "@repo/db";
import { ArchiveIngestJobService, ArchiveEngineError } from "../../../src/modules/series";
import { writeFile, mkdir } from "node:fs/promises";

async function createShow() {
  const userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    name: "Upload Exec User",
    email: `upload-exec-${Date.now()}-${Math.random()}@example.com`,
    passwordHash: "dummyhash",
    createdAt: new Date(),
  });
  const seriesId = crypto.randomUUID();
  await db.insert(series).values({ id: seriesId, title: "Show", createdAt: new Date(), updatedAt: new Date() });
  const seasonId = crypto.randomUUID();
  await db.insert(seasons).values({ id: seasonId, seriesId, title: "S1", createdAt: new Date(), updatedAt: new Date() });
  const epIds: string[] = [];
  for (let i = 1; i <= 3; i += 1) {
    const epId = crypto.randomUUID();
    await db.insert(episodes).values({ id: epId, title: `E${i}`, seasonId, order: i, createdAt: new Date(), updatedAt: new Date() });
    epIds.push(epId);
  }
  return { userId, seriesId, seasonId, epIds };
}

function makeFakeS3(uploads: string[]) {
  return {
    isConfigured: () => true,
    getPresignedUploadUrl: async (key: string) => ({ uploadUrl: "", key }),
    getPresignedPlaybackUrl: async (key: string) => key,
    uploadObject: async () => {},
    uploadStream: async (key: string, body: ReadableStream | NodeJS.ReadableStream) => {
      uploads.push(key);
      const stream = body as unknown as ReadableStream<Uint8Array>;
      if (typeof (stream as ReadableStream).getReader === "function") {
        const reader = (stream as ReadableStream<Uint8Array>).getReader();
        for (;;) {
          const { done } = await reader.read();
          if (done) break;
        }
        try { reader.releaseLock(); } catch { /* ignore */ }
      }
    },
    deleteObject: async () => {},
    deleteObjects: async () => {},
    listObjects: async () => ({ objects: [], isTruncated: false }),
    listAllObjects: async () => [],
    getBucketStorageUsage: async () => ({ objectCount: 0, totalBytes: 0 }),
    purgeDanglingVersions: async () => ({ deletedCount: 0 }),
    abortStaleMultipartUploads: async () => ({ abortedCount: 0 }),
    testConnection: async () => ({ success: true, latencyMs: 0 }),
    getPublicBaseUrl: () => null,
  };
}

describe("ArchiveIngest upload execution (ticket 688)", () => {
  let testTmpBase = "";

  beforeEach(() => {
    try { rmSync(testTmpBase, { recursive: true, force: true }); } catch { /* ignore */ }
    testTmpBase = mkdtempSync(join(tmpdir(), "upload-exec-"));
  });

  it("extracts + uploads sequentially, deletes each local file before the next, creates video_sources, cleans staging -> done", async () => {
    const { userId, seriesId, epIds } = await createShow();
    const jobId = crypto.randomUUID();
    const stagingPath = join(testTmpBase, jobId);
    mkdirSync(stagingPath, { recursive: true });
    writeFileSync(join(stagingPath, "pack.7z"), "fake-archive");

    await db.insert(archiveIngestJobs).values({
      id: jobId, ownerId: userId, seriesId, sourceKey: `test-${jobId}`, sourceUrl: "https://example.com/pack.7z",
      status: "ready", stage: "ready", bytesDone: 0, bytesTotal: null,
      stagingPath, archiveFilename: "pack.7z", entries: [], selection: [],
      storageProviderId: null, errorCode: null, errorMessage: null,
      createdAt: new Date(), updatedAt: new Date(), expiresAt: null,
    });

    const extractOrder: string[] = [];
    const deletedBeforeNext: boolean[] = [];
    const uploads: string[] = [];
    let lastExtractedAbs: string | null = null;

    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      s3StorageService: makeFakeS3(uploads) as never,
      extractor: {
        binaryPath: "7zz",
        list: async () => [],
        extract: async (opts) => {
          const target = opts.targets[0]!;
          // Previous uncompressed file must already be deleted (bounded disk usage).
          if (lastExtractedAbs) {
            deletedBeforeNext.push(!existsSync(lastExtractedAbs));
          }
          extractOrder.push(target);
          await mkdir(opts.destDir, { recursive: true });
          const abs = join(opts.destDir, basename(target));
          await writeFile(abs, `content-of-${target}`);
          lastExtractedAbs = abs;
          return { extractedFiles: [{ path: basename(target), sizeBytes: 12 }] };
        },
        run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    });

    const selection = [
      { filename: "Show.S01E01.mp4", episodeId: epIds[0]!, label: "E1", quality: "1080p" },
      { filename: "Show.S01E02.mp4", episodeId: epIds[1]!, label: "E2", quality: "1080p" },
    ];

    const result = await service.confirmJob(jobId, selection);
    expect(result.status).toBe("done");
    expect(extractOrder).toEqual(["Show.S01E01.mp4", "Show.S01E02.mp4"]);
    expect(deletedBeforeNext).toEqual([true]);
    expect(uploads).toHaveLength(2);
    expect(uploads[0]).toContain(epIds[0]!);
    expect(uploads[1]).toContain(epIds[1]!);

    const rows = await db.select().from(videoSources);
    const mine = rows.filter((r) => epIds.includes(r.episodeId));
    expect(mine).toHaveLength(2);

    const finalJob = await service.getJob(jobId);
    expect(finalJob?.status).toBe("done");
    expect(finalJob?.selection.filter((s) => (s as { completed?: boolean }).completed)).toHaveLength(2);
    expect(finalJob?.bytesDone).toBeGreaterThan(0);
    expect(existsSync(stagingPath)).toBe(false);
  });

  it("resumes at first non-completed file, skipping already completed", async () => {
    const { userId, seriesId, epIds } = await createShow();
    const jobId = crypto.randomUUID();
    const stagingPath = join(testTmpBase, jobId);
    mkdirSync(stagingPath, { recursive: true });
    writeFileSync(join(stagingPath, "pack.7z"), "fake-archive");

    await db.insert(archiveIngestJobs).values({
      id: jobId, ownerId: userId, seriesId, sourceKey: `test-${jobId}`, sourceUrl: "https://example.com/pack.7z",
      status: "uploading", stage: "uploading", bytesDone: 12, bytesTotal: null,
      stagingPath, archiveFilename: "pack.7z", entries: [], selection: [
        { filename: "Show.S01E01.mp4", episodeId: epIds[0], label: "E1", completed: true, videoSourceId: "vs1" },
        { filename: "Show.S01E02.mp4", episodeId: epIds[1], label: "E2", completed: false },
        { filename: "Show.S01E03.mp4", episodeId: epIds[2], label: "E3", completed: false },
      ],
      storageProviderId: null, errorCode: null, errorMessage: null,
      createdAt: new Date(), updatedAt: new Date(), expiresAt: null,
    });

    const extractOrder: string[] = [];
    const uploads: string[] = [];
    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      s3StorageService: makeFakeS3(uploads) as never,
      extractor: {
        binaryPath: "7zz",
        list: async () => [],
        extract: async (opts) => {
          extractOrder.push(opts.targets[0]!);
          await mkdir(opts.destDir, { recursive: true });
          const abs = join(opts.destDir, basename(opts.targets[0]!));
          await writeFile(abs, "x");
          return { extractedFiles: [{ path: basename(opts.targets[0]!), sizeBytes: 1 }] };
        },
        run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    });

    await service.executeUploadPhase(jobId);
    expect(extractOrder).toEqual(["Show.S01E02.mp4", "Show.S01E03.mp4"]);
    const finalJob = await service.getJob(jobId);
    expect(finalJob?.status).toBe("done");
  });

  it("keeps archive on password failure and succeeds on retry with password", async () => {
    const { userId, seriesId, epIds } = await createShow();
    const jobId = crypto.randomUUID();
    const stagingPath = join(testTmpBase, jobId);
    mkdirSync(stagingPath, { recursive: true });
    writeFileSync(join(stagingPath, "pack.7z"), "fake-archive");

    await db.insert(archiveIngestJobs).values({
      id: jobId, ownerId: userId, seriesId, sourceKey: `test-${jobId}`, sourceUrl: "https://example.com/pack.7z",
      status: "ready", stage: "ready", bytesDone: 0, bytesTotal: null,
      stagingPath, archiveFilename: "pack.7z", entries: [], selection: [],
      storageProviderId: null, errorCode: null, errorMessage: null,
      createdAt: new Date(), updatedAt: new Date(), expiresAt: null,
    });

    let attempts = 0;
    const uploads: string[] = [];
    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      s3StorageService: makeFakeS3(uploads) as never,
      extractor: {
        binaryPath: "7zz",
        list: async () => [],
        extract: async (opts) => {
          attempts += 1;
          if (!opts.password) {
            throw new ArchiveEngineError("PASSWORD_REQUIRED", "password required");
          }
          await mkdir(opts.destDir, { recursive: true });
          const abs = join(opts.destDir, basename(opts.targets[0]!));
          await writeFile(abs, "secret-content");
          return { extractedFiles: [{ path: basename(opts.targets[0]!), sizeBytes: 5 }] };
        },
        run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    });

    const selection = [{ filename: "Show.S01E01.mp4", episodeId: epIds[0]!, label: "E1" }];
    await service.confirmJob(jobId, selection);
    let failed = await service.getJob(jobId);
    expect(failed?.status).toBe("failed");
    expect(failed?.errorCode).toBe("PASSWORD_REQUIRED");
    // Archive must remain intact for retry without re-downloading.
    expect(existsSync(join(stagingPath, "pack.7z"))).toBe(true);

    await service.confirmJob(jobId, selection, { password: "correct-horse" });
    failed = await service.getJob(jobId);
    expect(failed?.status).toBe("done");
    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(uploads).toHaveLength(1);
  });
});
