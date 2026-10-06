import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "../../utils/db";
import { users, archiveIngestJobs } from "@repo/db";
import { eq } from "drizzle-orm";
import { ArchiveIngestJobService } from "../../../src/modules/series";

describe("ArchiveIngestJobService Integration Tests", () => {
  let testTmpBase = "";
  let testUserId = "";

  beforeEach(async () => {
    testTmpBase = mkdtempSync(join(tmpdir(), "durable-jobs-test-"));
    testUserId = crypto.randomUUID();
    await db.insert(users).values({
      id: testUserId,
      name: "Test Ingest User",
      email: `test-ingest-${Date.now()}-${Math.random()}@example.com`,
      passwordHash: "dummyhash",
      createdAt: new Date(),
    });
  });

  afterEach(async () => {
    try {
      rmSync(testTmpBase, { recursive: true, force: true });
      testTmpBase = mkdtempSync(join(tmpdir(), "durable-jobs-test-"));
    } catch {
      // ignore
    }
  });

  it("submitting the same source_key returns existing active job without creating duplicate", async () => {
    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      fetchFn: async () => {
        const data = new TextEncoder().encode("dummy-content");
        return new Response(data, {
          status: 200,
          headers: { "Content-Length": String(data.byteLength) },
        });
      },
      extractor: {
        binaryPath: "7zz",
        list: async () => [
          { path: "Series.S01E01.mp4", sizeBytes: 1024 * 1024 * 500, isDirectory: false },
        ],
        extract: async () => ({ extractedFiles: [] }),
        run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    });

    const sourceUrl = "https://example.com/downloads/pack1.zip";

    // 1st submission
    const job1 = await service.submitJob(testUserId, { sourceUrl });
    expect(job1).toBeDefined();
    expect(job1.id).toBeDefined();
    expect(job1.status).toBe("downloading");

    // 2nd submission with identical URL for same user
    const job2 = await service.submitJob(testUserId, { sourceUrl });
    expect(job2.id).toBe(job1.id);
    expect(job2.createdAt).toBe(job1.createdAt);

    // Verify only 1 row exists in DB
    const rows = await db
      .select()
      .from(archiveIngestJobs)
      .where(eq(archiveIngestJobs.ownerId, testUserId));
    expect(rows.length).toBe(1);
    expect(rows[0]?.id).toBe(job1.id);
  });

  it("disk space preflight rejects downloads when available space is less than 2.5x content length", async () => {
    const contentLength = 100 * 1024 * 1024; // 100MB
    const availableSpace = 200 * 1024 * 1024; // 200MB (< 250MB required)

    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      statfsFn: async () => ({ bavail: availableSpace, bsize: 1 }),
      fetchFn: async () => {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array([1, 2, 3]));
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { "Content-Length": String(contentLength) },
        });
      },
      extractor: {
        binaryPath: "7zz",
        list: async () => [],
        extract: async () => ({ extractedFiles: [] }),
        run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    });

    const sourceUrl = "https://example.com/huge-pack.zip";
    const job = await service.submitJob(testUserId, { sourceUrl });

    // Wait for pipeline execution to settle
    await new Promise((r) => setTimeout(r, 200));

    const updated = await service.getJob(job.id);
    expect(updated?.status).toBe("failed");
    expect(updated?.errorCode).toBe("INSUFFICIENT_DISK_SPACE");
    expect(updated?.errorMessage).toContain("Available disk space");

    // Ensure staging directory was cleaned up on failure
    if (job.stagingPath) {
      expect(existsSync(job.stagingPath)).toBe(false);
    }
  });

  it("download progress updates bytes_done and bytes_total in the database", async () => {
    const chunk1 = new Uint8Array(1024 * 50);
    const chunk2 = new Uint8Array(1024 * 50);
    const totalBytes = chunk1.byteLength + chunk2.byteLength;

    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      fetchFn: async () => {
        const stream = new ReadableStream({
          async start(controller) {
            controller.enqueue(chunk1);
            await new Promise((r) => setTimeout(r, 50));
            controller.enqueue(chunk2);
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { "Content-Length": String(totalBytes) },
        });
      },
      extractor: {
        binaryPath: "7zz",
        list: async () => [
          { path: "Series.S01E01.mp4", sizeBytes: 100_000, isDirectory: false },
        ],
        extract: async () => ({ extractedFiles: [] }),
        run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    });

    const sourceUrl = "https://example.com/progress-test.zip";
    const job = await service.submitJob(testUserId, { sourceUrl });

    // Wait for pipeline to complete
    await new Promise((r) => setTimeout(r, 350));

    const completedJob = await service.getJob(job.id);
    expect(completedJob?.status).toBe("ready");
    expect(completedJob?.bytesTotal).toBe(totalBytes);
    expect(completedJob?.bytesDone).toBe(totalBytes);
    expect(completedJob?.entries).toHaveLength(1);
    expect(completedJob?.entries[0]?.detectedEpisodeNumber).toBe(1);
  });

  it("listing inspects entries, matches episode numbers, flags size disparity anomalies, and transitions job to ready", async () => {
    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      fetchFn: async () => {
        const data = new TextEncoder().encode("archive-body");
        return new Response(data, {
          status: 200,
          headers: { "Content-Length": String(data.byteLength) },
        });
      },
      extractor: {
        binaryPath: "7zz",
        list: async () => [
          { path: "Show/Show.S01E01.1080p.mp4", sizeBytes: 500_000_000, isDirectory: false },
          { path: "Show/Show.S01E02.1080p.mp4", sizeBytes: 520_000_000, isDirectory: false },
          { path: "Show/Show.S01E03.1080p.mp4", sizeBytes: 50_000_000, isDirectory: false }, // tiny size anomaly
          { path: "Show/Show.S01E04.sample.mp4", sizeBytes: 20_000_000, isDirectory: false }, // sample file
          { path: "Show/readme.txt", sizeBytes: 200, isDirectory: false }, // non video
        ],
        extract: async () => ({ extractedFiles: [] }),
        run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    });

    const sourceUrl = "https://example.com/show-full.7z";
    const job = await service.submitJob(testUserId, { sourceUrl });

    await new Promise((r) => setTimeout(r, 300));

    const readyJob = await service.getJob(job.id);
    expect(readyJob?.status).toBe("ready");
    expect(readyJob?.stage).toBe("ready");
    expect(readyJob?.entries).toHaveLength(3); // Sample and txt filtered out

    const ep1 = readyJob?.entries.find((e) => e.filename.includes("E01"));
    const ep2 = readyJob?.entries.find((e) => e.filename.includes("E02"));
    const ep3 = readyJob?.entries.find((e) => e.filename.includes("E03"));

    expect(ep1?.detectedEpisodeNumber).toBe(1);
    expect(ep1?.quality).toBe("1080p");
    expect(ep1?.needsReview).toBe(false);

    expect(ep2?.detectedEpisodeNumber).toBe(2);
    expect(ep2?.quality).toBe("1080p");
    expect(ep2?.needsReview).toBe(false);

    // Ep3 flagged due to sibling size disparity
    expect(ep3?.detectedEpisodeNumber).toBe(3);
    expect(ep3?.needsReview).toBe(true);
  });

  it("cancelling a job immediately aborts active signal, sets status to cancelled, and deletes staging directory", async () => {
    let wasAborted = false;

    const hangingBody = new ReadableStream<Uint8Array>({
      start(_controller) {
        // Will never close until aborted
      },
      cancel() {
        wasAborted = true;
      },
    });

    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      fetchFn: async (_url, init) => {
        init?.signal?.addEventListener("abort", () => {
          wasAborted = true;
        });
        return new Response(hangingBody, {
          status: 200,
          headers: { "Content-Length": "1000000" },
        });
      },
      extractor: {
        binaryPath: "7zz",
        list: async () => [],
        extract: async () => ({ extractedFiles: [] }),
        run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    });

    const sourceUrl = "https://example.com/infinite-download.zip";
    const job = await service.submitJob(testUserId, { sourceUrl });

    expect(job.stagingPath).toBeDefined();
    const stagingDir = job.stagingPath!;

    // Allow pipeline to enter downloading stage
    await new Promise((r) => setTimeout(r, 100));

    const cancelledJob = await service.cancelJob(job.id);
    expect(cancelledJob?.status).toBe("cancelled");
    expect(cancelledJob?.stage).toBe("cancelled");
    expect(wasAborted).toBe(true);

    // Verify staging directory is cleaned up
    expect(existsSync(stagingDir)).toBe(false);
  });

  it("enforces concurrency limit: extra jobs are queued and can be started sequentially", async () => {
    const service = new ArchiveIngestJobService({
      db,
      stagingBaseDir: testTmpBase,
      maxConcurrentJobs: 1, // Allow only 1 active job at a time
      fetchFn: async () => {
        return new Response(new TextEncoder().encode("data"), {
          status: 200,
          headers: { "Content-Length": "4" },
        });
      },
      extractor: {
        binaryPath: "7zz",
        list: async () => [
          { path: "Series.S01E01.mp4", sizeBytes: 1000, isDirectory: false },
        ],
        extract: async () => ({ extractedFiles: [] }),
        run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
      },
    });

    const job1 = await service.submitJob(testUserId, { sourceUrl: "https://example.com/job1.zip" });
    const job2 = await service.submitJob(testUserId, { sourceUrl: "https://example.com/job2.zip" });

    expect(job1.status).toBe("downloading");
    expect(job2.status).toBe("queued");
    expect(job2.stage).toBe("queued");

    // Wait for job1 to complete, which should pump the queue and trigger job2
    await new Promise((r) => setTimeout(r, 400));

    const finishedJob2 = await service.getJob(job2.id);
    expect(finishedJob2?.status).toBe("ready");
  });
});
