import { describe, expect, it, beforeEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../../utils/db";
import { createMockS3 } from "../../utils/s3";
import { users, series, seasons, archiveIngestJobs } from "@repo/db";
import { ArchiveIngestJobService } from "../../../src/modules/series";

async function createOwner(): Promise<string> {
  const userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    name: "Staging Reuse User",
    email: `staging-reuse-${Date.now()}-${Math.random()}@example.com`,
    passwordHash: "dummyhash",
    createdAt: new Date(),
  });
  const seriesId = crypto.randomUUID();
  await db.insert(series).values({ id: seriesId, title: "Show", createdAt: new Date(), updatedAt: new Date() });
  const seasonId = crypto.randomUUID();
  await db.insert(seasons).values({ id: seasonId, seriesId, title: "S1", createdAt: new Date(), updatedAt: new Date() });
  return userId;
}

async function waitForStatus(
  service: ArchiveIngestJobService,
  jobId: string,
  status: string,
  timeoutMs = 8000
): Promise<void> {
  const start = Date.now();
  for (;;) {
    const job = await service.getJob(jobId);
    if (job?.status === status) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`timed out waiting for job ${jobId} to reach status '${status}' (at '${job?.status}')`);
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe("ArchiveIngest smart staging reuse on submit (ticket 693)", () => {
  let testTmpBase = "";

  beforeEach(() => {
    try { rmSync(testTmpBase, { recursive: true, force: true }); } catch { /* ignore */ }
    testTmpBase = mkdtempSync(join(tmpdir(), "staging-reuse-"));
  });

  it("recovers a failed already-listed job to ready without re-downloading", async () => {
    const userId = await createOwner();
    const sourceUrl = "https://example.com/season-pack.7z";

    let downloadCalls = 0;
    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      s3StorageService: createMockS3(),
      fetchFn: (async () => {
        downloadCalls += 1;
        throw new Error("must not re-download");
      }) as never,
      extractor: {
        binaryPath: "7zz",
        list: async () => { throw new Error("must not re-list"); },
        extract: async () => { throw new Error("must not extract"); },
        run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    });

    // A previous upload-phase failure: entries parsed, archive still on disk.
    const failedJobId = crypto.randomUUID();
    const stagingPath = join(testTmpBase, failedJobId);
    mkdirSync(stagingPath, { recursive: true });
    writeFileSync(join(stagingPath, "season-pack.7z"), "fake-archive-bytes");
    const sourceKey = service.deriveSourceKey(sourceUrl);
    await db.insert(archiveIngestJobs).values({
      id: failedJobId, ownerId: userId, seriesId: null, sourceKey, sourceUrl,
      status: "failed", stage: "failed", bytesDone: 100, bytesTotal: 100,
      stagingPath, archiveFilename: "season-pack.7z",
      entries: [
        { filename: "Show.S01E01.mp4", sizeBytes: 100, detectedEpisodeNumber: 1, quality: "1080p", needsReview: false },
        { filename: "Show.S01E02.mp4", sizeBytes: 100, detectedEpisodeNumber: 2, quality: "1080p", needsReview: false },
      ],
      selection: [],
      storageProviderId: null, errorCode: "UPLOAD_FAILED", errorMessage: "boom",
      createdAt: new Date(), updatedAt: new Date(), expiresAt: null,
    });

    const result = await service.submitJob(userId, { sourceUrl });

    expect(result.id).toBe(failedJobId);
    expect(result.status).toBe("ready");
    expect(result.errorCode).toBeNull();
    expect(result.errorMessage).toBeNull();
    expect(result.entries).toHaveLength(2);
    expect(downloadCalls).toBe(0);
    // Archive must remain on disk so the user can still confirm the upload.
    expect(existsSync(join(stagingPath, "season-pack.7z"))).toBe(true);
  });

  it("resumes a failed downloaded-but-unlisted job at the listing stage without re-downloading", async () => {
    const userId = await createOwner();
    const sourceUrl = "https://example.com/unlisted-pack.7z";

    let downloadCalls = 0;
    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      s3StorageService: createMockS3(),
      fetchFn: (async () => {
        downloadCalls += 1;
        throw new Error("must not re-download");
      }) as never,
      extractor: {
        binaryPath: "7zz",
        list: async () => [
          { path: "Show.S01E01.mp4", sizeBytes: 100, isDirectory: false },
          { path: "Show.S01E02.mp4", sizeBytes: 100, isDirectory: false },
        ],
        extract: async () => { throw new Error("must not extract"); },
        run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    });

    const failedJobId = crypto.randomUUID();
    const stagingPath = join(testTmpBase, failedJobId);
    mkdirSync(stagingPath, { recursive: true });
    writeFileSync(join(stagingPath, "unlisted-pack.7z"), "fake-archive-bytes");
    const sourceKey = service.deriveSourceKey(sourceUrl);
    await db.insert(archiveIngestJobs).values({
      id: failedJobId, ownerId: userId, seriesId: null, sourceKey, sourceUrl,
      status: "failed", stage: "failed", bytesDone: 18, bytesTotal: 18,
      stagingPath, archiveFilename: "unlisted-pack.7z", entries: [], selection: [],
      storageProviderId: null, errorCode: "LIST_FAILED", errorMessage: "list boom",
      createdAt: new Date(), updatedAt: new Date(), expiresAt: null,
    });

    const result = await service.submitJob(userId, { sourceUrl });

    expect(result.id).toBe(failedJobId);
    expect(["listing", "ready"]).toContain(result.status);
    expect(downloadCalls).toBe(0);

    await waitForStatus(service, failedJobId, "ready");
    const ready = await service.getJob(failedJobId);
    expect(ready?.entries).toHaveLength(2);
    expect(ready?.errorCode).toBeNull();
  });

  it("creates a fresh job and downloads when the failed job's archive is gone", async () => {
    const userId = await createOwner();
    const sourceUrl = "https://example.com/gone-pack.7z";

    let downloadCalls = 0;
    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      s3StorageService: createMockS3(),
      fetchFn: (async () => {
        downloadCalls += 1;
        return new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: { "content-length": "4", "content-type": "application/zip" },
        });
      }) as unknown as typeof fetch,
      extractor: {
        binaryPath: "7zz",
        list: async () => [
          { path: "Show.S01E01.mp4", sizeBytes: 4, isDirectory: false },
        ],
        extract: async () => { throw new Error("must not extract"); },
        run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    });

    // Failed job whose staging directory was wiped (archive lost).
    const failedJobId = crypto.randomUUID();
    const sourceKey = service.deriveSourceKey(sourceUrl);
    await db.insert(archiveIngestJobs).values({
      id: failedJobId, ownerId: userId, seriesId: null, sourceKey, sourceUrl,
      status: "failed", stage: "failed", bytesDone: 0, bytesTotal: null,
      stagingPath: join(testTmpBase, failedJobId), archiveFilename: "gone-pack.7z",
      entries: [{ filename: "Show.S01E01.mp4", sizeBytes: 4, detectedEpisodeNumber: 1, quality: null, needsReview: false }],
      selection: [],
      storageProviderId: null, errorCode: "UPLOAD_FAILED", errorMessage: "boom",
      createdAt: new Date(), updatedAt: new Date(), expiresAt: null,
    });

    const result = await service.submitJob(userId, { sourceUrl });

    expect(result.id).not.toBe(failedJobId);
    expect(["queued", "downloading"]).toContain(result.status);
    await waitForStatus(service, result.id, "ready");
    expect(downloadCalls).toBe(1);
    const downloaded = await service.getJob(result.id);
    expect(downloaded?.entries).toHaveLength(1);

    // The old failed job stays untouched.
    const oldRows = await db.select().from(archiveIngestJobs).where(eq(archiveIngestJobs.id, failedJobId));
    expect(oldRows[0]?.status).toBe("failed");
  });
});
