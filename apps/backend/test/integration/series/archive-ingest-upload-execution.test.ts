import { describe, expect, it, beforeEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { db } from "../../utils/db";
import { users, series, seasons, episodes, videoSources, archiveIngestJobs, type ArchiveIngestJobSelectionRow } from "@repo/db";
import { ArchiveIngestJobService, ArchiveEngineError } from "../../../src/modules/series";
import { writeFile, mkdir } from "node:fs/promises";
import { waitForJobStatus } from "../../utils/archive-ingest";

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
    expect(result.status).toBe("uploading");
    await waitForJobStatus(service.getJob.bind(service), jobId, "done");
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
    const immediate = await service.confirmJob(jobId, selection);
    expect(immediate.status).toBe("uploading");
    let failed = await waitForJobStatus(service.getJob.bind(service), jobId, "failed");
    expect(failed?.status).toBe("failed");
    expect(failed?.errorCode).toBe("PASSWORD_REQUIRED");
    // Archive must remain intact for retry without re-downloading.
    expect(existsSync(join(stagingPath, "pack.7z"))).toBe(true);

    const retryImmediate = await service.confirmJob(jobId, selection, { password: "correct-horse" });
    expect(retryImmediate.status).toBe("uploading");
    failed = await waitForJobStatus(service.getJob.bind(service), jobId, "done");
    expect(failed?.status).toBe("done");
    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(uploads).toHaveLength(1);
  });

  it("confirm resolves with uploading while a blocked extractor is still in flight", async () => {
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

    let releaseExtract!: () => void;
    const extractGate = new Promise<void>((resolve) => { releaseExtract = resolve; });
    const uploads: string[] = [];
    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      s3StorageService: makeFakeS3(uploads) as never,
      extractor: {
        binaryPath: "7zz",
        list: async () => [],
        extract: async (opts) => {
          await extractGate;
          await mkdir(opts.destDir, { recursive: true });
          const abs = join(opts.destDir, basename(opts.targets[0]!));
          await writeFile(abs, "blocked-content");
          return { extractedFiles: [{ path: basename(opts.targets[0]!), sizeBytes: 5 }] };
        },
        run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    });

    const selection = [{ filename: "Show.S01E01.mp4", episodeId: epIds[0]!, label: "E1" }];
    const result = await service.confirmJob(jobId, selection);
    expect(result.status).toBe("uploading");
    // Extractor is still blocked — job must still be uploading, not done/failed.
    const midFlight = await service.getJob(jobId);
    expect(midFlight?.status).toBe("uploading");

    releaseExtract();
    const finalJob = await waitForJobStatus(service.getJob.bind(service), jobId, "done");
    expect(finalJob.status).toBe("done");
    expect(uploads).toHaveLength(1);
  });
});

describe("ArchiveIngest idempotent re-confirm (ticket 695)", () => {
  let testTmpBase = "";

  beforeEach(() => {
    try { rmSync(testTmpBase, { recursive: true, force: true }); } catch { /* ignore */ }
    testTmpBase = mkdtempSync(join(tmpdir(), "reconfirm-"));
  });

  async function seedJob(opts: {
    ownerId: string;
    seriesId: string;
    status: "ready" | "failed";
    selection: ArchiveIngestJobSelectionRow[];
    bytesDone?: number;
  }): Promise<{ jobId: string; stagingPath: string }> {
    const jobId = crypto.randomUUID();
    const stagingPath = join(testTmpBase, jobId);
    mkdirSync(stagingPath, { recursive: true });
    writeFileSync(join(stagingPath, "pack.7z"), "fake-archive");
    await db.insert(archiveIngestJobs).values({
      id: jobId, ownerId: opts.ownerId, seriesId: opts.seriesId,
      sourceKey: `reconfirm-${jobId}`, sourceUrl: "https://example.com/pack.7z",
      status: opts.status, stage: opts.status, bytesDone: opts.bytesDone ?? 0, bytesTotal: null,
      stagingPath, archiveFilename: "pack.7z", entries: [], selection: opts.selection,
      storageProviderId: null, errorCode: opts.status === "failed" ? "PREV_FAIL" : null,
      errorMessage: opts.status === "failed" ? "previous failure" : null,
      createdAt: new Date(), updatedAt: new Date(), expiresAt: null,
    });
    return { jobId, stagingPath };
  }

  function makeSuccessExtractor(extractOrder: string[]) {
    return {
      binaryPath: "7zz",
      list: async () => [],
      extract: async (opts: { destDir: string; targets: string[] }) => {
        const target = opts.targets[0]!;
        extractOrder.push(target);
        await mkdir(opts.destDir, { recursive: true });
        const abs = join(opts.destDir, basename(target));
        await writeFile(abs, `content-of-${target}`);
        return { extractedFiles: [{ path: basename(target), sizeBytes: 7 }] };
      },
      run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
    };
  }

  it("absorbs a second confirm while the upload runs: selection untouched, each file uploaded exactly once", async () => {
    const { userId, seriesId, epIds } = await createShow();
    const selection = [
      { filename: "Show.S01E01.mp4", episodeId: epIds[0]!, label: "E1", quality: "1080p" },
      { filename: "Show.S01E02.mp4", episodeId: epIds[1]!, label: "E2", quality: "1080p" },
    ];
    const { jobId } = await seedJob({ ownerId: userId, seriesId, status: "ready", selection: [] });

    let releaseExtract!: () => void;
    const extractGate = new Promise<void>((resolve) => { releaseExtract = resolve; });
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
          await extractGate;
          extractOrder.push(opts.targets[0]!);
          await mkdir(opts.destDir, { recursive: true });
          const abs = join(opts.destDir, basename(opts.targets[0]!));
          await writeFile(abs, "gated-content");
          return { extractedFiles: [{ path: basename(opts.targets[0]!), sizeBytes: 5 }] };
        },
        run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    });

    const first = await service.confirmJob(jobId, selection);
    expect(first.status).toBe("uploading");
    const storedAfterFirst = (await service.getJob(jobId))?.selection;

    // Re-click mid-upload with a DIFFERENT label: must be absorbed, not applied.
    const duplicateSelection = [
      { filename: "Show.S01E01.mp4", episodeId: epIds[0]!, label: "E1-CHANGED" },
      { filename: "Show.S01E02.mp4", episodeId: epIds[1]!, label: "E2-CHANGED" },
    ];
    const second = await service.confirmJob(jobId, duplicateSelection);
    expect(second.status).toBe("uploading");
    const storedAfterSecond = (await service.getJob(jobId))?.selection;
    expect(storedAfterSecond).toEqual(storedAfterFirst);
    expect(JSON.stringify(storedAfterSecond)).not.toContain("CHANGED");

    releaseExtract();
    const finalJob = await waitForJobStatus(service.getJob.bind(service), jobId, "done");
    expect(finalJob.status).toBe("done");
    expect(extractOrder).toEqual(["Show.S01E01.mp4", "Show.S01E02.mp4"]);
    expect(uploads).toHaveLength(2);

    const rows = await db.select().from(videoSources);
    const mine = rows.filter((r) => epIds.includes(r.episodeId));
    expect(mine).toHaveLength(2);
  });

  it("re-confirm of a failed job merges stored completed flags: skips done files, no duplicate video sources", async () => {
    const { userId, seriesId, epIds } = await createShow();
    const vsId = crypto.randomUUID();
    await db.insert(videoSources).values({
      id: vsId, episodeId: epIds[0]!, type: "s3", url: "episodes/old-key.mp4",
      label: "E1", quality: "1080p", createdAt: new Date(), updatedAt: new Date(),
    });
    const { jobId } = await seedJob({
      ownerId: userId, seriesId, status: "failed", bytesDone: 12,
      selection: [
        { filename: "Show.S01E01.mp4", episodeId: epIds[0], label: "E1", completed: true, videoSourceId: vsId },
        { filename: "Show.S01E02.mp4", episodeId: epIds[1], label: "E2", completed: false },
      ],
    });

    const extractOrder: string[] = [];
    const uploads: string[] = [];
    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      s3StorageService: makeFakeS3(uploads) as never,
      extractor: makeSuccessExtractor(extractOrder) as never,
    });

    // Client re-send lacks completed flags entirely.
    const immediate = await service.confirmJob(jobId, [
      { filename: "Show.S01E01.mp4", episodeId: epIds[0]!, label: "E1" },
      { filename: "Show.S01E02.mp4", episodeId: epIds[1]!, label: "E2" },
    ]);
    expect(immediate.status).toBe("uploading");

    const finalJob = await waitForJobStatus(service.getJob.bind(service), jobId, "done");
    expect(finalJob.status).toBe("done");
    expect(extractOrder).toEqual(["Show.S01E02.mp4"]);
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toContain(epIds[1]!);

    const rows = await db.select().from(videoSources);
    const ep1Rows = rows.filter((r) => r.episodeId === epIds[0]);
    expect(ep1Rows).toHaveLength(1);
    expect(ep1Rows[0]?.id).toBe(vsId);

    const completed = finalJob.selection.filter((s) => (s as { completed?: boolean }).completed);
    expect(completed).toHaveLength(2);
    const kept = finalJob.selection.find((s) => s.filename === "Show.S01E01.mp4");
    expect((kept as { videoSourceId?: string }).videoSourceId).toBe(vsId);
  });

  it("re-uploads a file remapped to a different episode instead of crediting stored progress", async () => {
    const { userId, seriesId, epIds } = await createShow();
    const { jobId } = await seedJob({
      ownerId: userId, seriesId, status: "failed",
      selection: [
        { filename: "Show.S01E01.mp4", episodeId: epIds[0], label: "E1", completed: true, videoSourceId: "vs-old" },
      ],
    });

    const extractOrder: string[] = [];
    const uploads: string[] = [];
    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      s3StorageService: makeFakeS3(uploads) as never,
      extractor: makeSuccessExtractor(extractOrder) as never,
    });

    const immediate = await service.confirmJob(jobId, [
      { filename: "Show.S01E01.mp4", episodeId: epIds[1]!, label: "E1-remapped" },
    ]);
    expect(immediate.status).toBe("uploading");

    const finalJob = await waitForJobStatus(service.getJob.bind(service), jobId, "done");
    expect(finalJob.status).toBe("done");
    expect(extractOrder).toEqual(["Show.S01E01.mp4"]);
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toContain(epIds[1]!);

    const item = finalJob.selection.find((s) => s.filename === "Show.S01E01.mp4");
    expect(item?.episodeId).toBe(epIds[1]);
    expect((item as { completed?: boolean }).completed).toBe(true);
    expect((item as { videoSourceId?: string }).videoSourceId).not.toBe("vs-old");

    const rows = await db.select().from(videoSources);
    const mine = rows.filter((r) => r.episodeId === epIds[1]);
    expect(mine).toHaveLength(1);
  });
});
