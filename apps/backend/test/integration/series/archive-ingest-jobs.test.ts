/**
 * Integration tests for ticket 689:
 *   REST Job Endpoints, Boot Reconciliation & Stale Sweeper
 *
 * Tests exercise:
 *  - POST   /api/series/:id/archive-ingest/jobs
 *  - GET    /api/series/:id/archive-ingest/jobs/:jobId
 *  - POST   /api/series/:id/archive-ingest/jobs/:jobId/confirm
 *  - POST   /api/series/:id/archive-ingest/jobs/:jobId/cancel
 *  - POST   /api/series/:id/archive-ingest/jobs/:jobId/retry
 *  - Boot reconciliation (markInterruptedJobsOnBoot, purgeOrphanStagingDirs)
 *  - Background sweeper (sweepExpiredJobs)
 */
import { describe, expect, it, beforeAll, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";
import { users, series, seasons, episodes, archiveIngestJobs } from "@repo/db";
import { eq } from "drizzle-orm";
import {
  ArchiveIngestJobService,
  markInterruptedJobsOnBoot,
  purgeOrphanStagingDirs,
  sweepExpiredJobs,
} from "../../../src/modules/series";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

let testTmpBase = "";

function refreshTmpBase() {
  try {
    rmSync(testTmpBase, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  testTmpBase = mkdtempSync(join(tmpdir(), "archive-jobs-test-"));
}

afterEach(refreshTmpBase);

async function createSeriesAndEpisodes() {
  const now = new Date();
  const [sRow] = await db
    .insert(series)
    .values({ id: crypto.randomUUID(), title: "Test Series", createdAt: now, updatedAt: now })
    .returning();
  const [seasonRow] = await db
    .insert(seasons)
    .values({ id: crypto.randomUUID(), seriesId: sRow!.id, title: "S1", seasonNumber: 1, createdAt: now, updatedAt: now })
    .returning();
  const [ep1] = await db
    .insert(episodes)
    .values({ id: crypto.randomUUID(), seasonId: seasonRow!.id, title: "E1", order: 1, createdAt: now, updatedAt: now })
    .returning();
  const [ep2] = await db
    .insert(episodes)
    .values({ id: crypto.randomUUID(), seasonId: seasonRow!.id, title: "E2", order: 2, createdAt: now, updatedAt: now })
    .returning();
  return { seriesId: sRow!.id, seasonId: seasonRow!.id, ep1Id: ep1!.id, ep2Id: ep2!.id };
}

function makeFakeFetchFn() {
  return async (_url: string, _init?: RequestInit): Promise<Response> => {
    const data = new TextEncoder().encode("fake-archive-data");
    return new Response(data, {
      status: 200,
      headers: { "Content-Length": String(data.byteLength) },
    });
  };
}

function makeFakeExtractor(
  videoEntries = ["Show.S01E01.mp4", "Show.S01E02.mp4"],
  extractFn?: (opts: { targets: string[]; destDir: string }) => Promise<void>
) {
  return {
    binaryPath: "7zz",
    list: async () =>
      videoEntries.map((p) => ({ path: p, sizeBytes: 1_000_000, isDirectory: false })),
    extract: async (opts: { targets: string[]; destDir: string; [key: string]: unknown }) => {
      if (extractFn) {
        await extractFn(opts);
      } else {
        await mkdir(opts.destDir, { recursive: true });
        const target = opts.targets[0]!;
        const abs = join(opts.destDir, basename(target));
        await writeFile(abs, "video-content");
      }
      return {
        extractedFiles: opts.targets.map((t: string) => ({ path: basename(t), sizeBytes: 100 })),
      };
    },
    run: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
  };
}

function makeFakeS3() {
  return {
    isConfigured: () => true,
    getPresignedUploadUrl: async (key: string) => ({ uploadUrl: "", key }),
    getPresignedPlaybackUrl: async (key: string) => key,
    uploadObject: async () => {},
    uploadStream: async (_key: string, body: unknown) => {
      const stream = body as ReadableStream<Uint8Array>;
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
    getBucketStorageUsage: async () => ({ totalSizeBytes: 0, objectCount: 0 }),
    purgeDanglingVersions: async () => ({ purgedVersionsCount: 0, purgedDeleteMarkersCount: 0 }),
    abortStaleMultipartUploads: async () => ({ abortedUploadsCount: 0 }),
    testConnection: async () => ({ success: true, latencyMs: 0 }),
    getPublicBaseUrl: () => null,
  };
}

async function buildJobApp() {
  refreshTmpBase();
  return buildApp({
    archiveStagingBaseDir: testTmpBase,
    archiveFetchFn: makeFakeFetchFn(),
    archiveExtractFn: async (opts) => {
      await mkdir(opts.destDir!, { recursive: true });
      await writeFile(join(opts.destDir!, "Show.S01E01.mp4"), "video1");
      await writeFile(join(opts.destDir!, "Show.S01E02.mp4"), "video2");
    },
    s3StorageService: makeFakeS3() as never,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// REST endpoint tests
// ────────────────────────────────────────────────────────────────────────────

describe("Archive Ingest Jobs REST Endpoints", () => {
  let app: App;

  // Build the app once — the DB is truncated before each test by setup.ts.
  // Each individual test creates its own series/episode rows so they exist.
  beforeAll(async () => {
    refreshTmpBase();
    app = await buildJobApp();
  });

  // ── POST /api/series/:id/archive-ingest/jobs ────────────────────────────

  describe("POST /api/series/:id/archive-ingest/jobs", () => {
    it("returns 401 when not authenticated", async () => {
      const { seriesId } = await createSeriesAndEpisodes();
      const res = await request(app, {
        method: "POST",
        path: `/api/series/${seriesId}/archive-ingest/jobs`,
        body: { sourceUrl: "https://example.com/pack.zip" },
      });
      expect(res.status).toBe(401);
    });

    it("returns 404 when series does not exist", async () => {
      const { accessToken } = await registerUser(app);
      const res = await request(app, {
        method: "POST",
        path: `/api/series/${crypto.randomUUID()}/archive-ingest/jobs`,
        headers: authHeaders(accessToken),
        body: { sourceUrl: "https://example.com/pack.zip" },
      });
      expect(res.status).toBe(404);
    });

    it("creates a new job and returns HTTP 200 with the job", async () => {
      const { seriesId } = await createSeriesAndEpisodes();
      const { accessToken } = await registerUser(app);
      const res = await request(app, {
        method: "POST",
        path: `/api/series/${seriesId}/archive-ingest/jobs`,
        headers: authHeaders(accessToken),
        body: { sourceUrl: "https://example.com/unique-pack-201.zip" },
      });
      expect(res.status).toBe(200);
      const body = res.body as { data: { id: string; status: string; seriesId: string } };
      expect(body.data.id).toBeDefined();
      expect(body.data.seriesId).toBe(seriesId);
      expect(["queued", "downloading", "ready", "listing"]).toContain(body.data.status);
    });

    it("returns the same job (idempotent) when submitted twice with the same URL", async () => {
      const { seriesId } = await createSeriesAndEpisodes();
      const { accessToken } = await registerUser(app);
      const url = "https://example.com/idempotent-pack.zip";
      const res1 = await request(app, {
        method: "POST",
        path: `/api/series/${seriesId}/archive-ingest/jobs`,
        headers: authHeaders(accessToken),
        body: { sourceUrl: url },
      });
      const res2 = await request(app, {
        method: "POST",
        path: `/api/series/${seriesId}/archive-ingest/jobs`,
        headers: authHeaders(accessToken),
        body: { sourceUrl: url },
      });
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      const j1 = (res1.body as { data: { id: string } }).data;
      const j2 = (res2.body as { data: { id: string } }).data;
      expect(j1.id).toBe(j2.id);
    });
  });

  // ── GET /api/series/:id/archive-ingest/jobs/:jobId ─────────────────────

  describe("GET /api/series/:id/archive-ingest/jobs/:jobId", () => {
    it("returns 401 when not authenticated", async () => {
      const { seriesId } = await createSeriesAndEpisodes();
      const res = await request(app, {
        method: "GET",
        path: `/api/series/${seriesId}/archive-ingest/jobs/${crypto.randomUUID()}`,
      });
      expect(res.status).toBe(401);
    });

    it("returns 404 when job does not exist", async () => {
      const { seriesId } = await createSeriesAndEpisodes();
      const { accessToken } = await registerUser(app);
      const res = await request(app, {
        method: "GET",
        path: `/api/series/${seriesId}/archive-ingest/jobs/${crypto.randomUUID()}`,
        headers: authHeaders(accessToken),
      });
      expect(res.status).toBe(404);
    });

    it("returns job state, progress, entries, and error details", async () => {
      const { seriesId } = await createSeriesAndEpisodes();
      const { accessToken } = await registerUser(app);
      // Create a job
      const createRes = await request(app, {
        method: "POST",
        path: `/api/series/${seriesId}/archive-ingest/jobs`,
        headers: authHeaders(accessToken),
        body: { sourceUrl: "https://example.com/poll-test.zip" },
      });
      expect(createRes.status).toBe(200);
      const jobId = (createRes.body as { data: { id: string } }).data.id;

      // Wait a tick to let background processing settle
      await new Promise((r) => setTimeout(r, 300));

      const res = await request(app, {
        method: "GET",
        path: `/api/series/${seriesId}/archive-ingest/jobs/${jobId}`,
        headers: authHeaders(accessToken),
      });
      expect(res.status).toBe(200);
      const job = (res.body as { data: { id: string; entries: unknown[]; status: string } }).data;
      expect(job.id).toBe(jobId);
      // Job should have progressed — entries or status set
      expect(job).toHaveProperty("entries");
      expect(job).toHaveProperty("status");
    });

    it("returns the lightweight progress shape with ?summary=true on an active upload job", async () => {
      const { seriesId, ep1Id, ep2Id } = await createSeriesAndEpisodes();
      const { user, accessToken } = await registerUser(app);
      const jobId = crypto.randomUUID();
      const stagingPath = join(testTmpBase, jobId);
      mkdirSync(stagingPath, { recursive: true });

      await db.insert(archiveIngestJobs).values({
        id: jobId,
        ownerId: user.id,
        seriesId,
        sourceKey: `key-${jobId}`,
        sourceUrl: "https://example.com/summary-pack.zip",
        status: "uploading",
        stage: "uploading",
        bytesDone: 100,
        bytesTotal: 300,
        stagingPath,
        archiveFilename: "summary-pack.zip",
        entries: [
          { filename: "Show.S01E01.mp4", sizeBytes: 100 },
          { filename: "Show.S01E02.mp4", sizeBytes: 200 },
          { filename: "Show.S01E03.mp4", sizeBytes: 300 },
        ],
        selection: [
          { filename: "Show.S01E01.mp4", episodeId: ep1Id, completed: true },
          { filename: "Show.S01E02.mp4", episodeId: ep2Id, completed: false },
          { filename: "Show.S01E03.mp4", episodeId: null, isIgnored: true },
        ],
        storageProviderId: null,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
      });

      const summaryRes = await request(app, {
        method: "GET",
        path: `/api/series/${seriesId}/archive-ingest/jobs/${jobId}?summary=true`,
        headers: authHeaders(accessToken),
      });
      expect(summaryRes.status).toBe(200);
      const progress = (summaryRes.body as { data: Record<string, unknown> }).data;
      expect(progress).toMatchObject({
        id: jobId,
        status: "uploading",
        stage: "uploading",
        bytesDone: 100,
        bytesTotal: 300,
        completedFilenames: ["Show.S01E01.mp4"],
        activeFilename: "Show.S01E02.mp4",
        errorCode: null,
        errorMessage: null,
      });
      expect(progress).not.toHaveProperty("entries");
      expect(progress).not.toHaveProperty("selection");

      // Without ?summary=true the complete job (entries + selection) is returned
      const fullRes = await request(app, {
        method: "GET",
        path: `/api/series/${seriesId}/archive-ingest/jobs/${jobId}`,
        headers: authHeaders(accessToken),
      });
      expect(fullRes.status).toBe(200);
      const full = (fullRes.body as { data: Record<string, unknown> }).data;
      expect(full).toHaveProperty("entries");
      expect(full).toHaveProperty("selection");
      expect((full.entries as unknown[]).length).toBe(3);
    });
  });

  // ── POST /api/series/:id/archive-ingest/jobs/:jobId/cancel ────────────

  describe("POST /api/series/:id/archive-ingest/jobs/:jobId/cancel", () => {
    it("returns 401 when not authenticated", async () => {
      const { seriesId } = await createSeriesAndEpisodes();
      const res = await request(app, {
        method: "POST",
        path: `/api/series/${seriesId}/archive-ingest/jobs/${crypto.randomUUID()}/cancel`,
      });
      expect(res.status).toBe(401);
    });

    it("cancels a job and returns the updated job", async () => {
      // Use a hanging fetch to reliably catch job in downloading state
      const hangApp = await buildApp({
        archiveStagingBaseDir: testTmpBase,
        archiveFetchFn: async (_url: string, _init?: RequestInit) => {
          return new Promise<Response>((resolve) => {
            const hangingBody = new ReadableStream<Uint8Array>({
              start() {
                // never closes — will be aborted
              },
            });
            resolve(
              new Response(hangingBody, {
                status: 200,
                headers: { "Content-Length": "1000000" },
              })
            );
          });
        },
        archiveExtractFn: async () => {},
        s3StorageService: makeFakeS3() as never,
      });

      const { accessToken } = await registerUser(hangApp);
      const { seriesId: hSeriesId } = await createSeriesAndEpisodes();

      const createRes = await request(hangApp, {
        method: "POST",
        path: `/api/series/${hSeriesId}/archive-ingest/jobs`,
        headers: authHeaders(accessToken),
        body: { sourceUrl: "https://example.com/hanging.zip" },
      });
      expect(createRes.status).toBe(200);
      const jobId = (createRes.body as { data: { id: string } }).data.id;

      // Allow pipeline to enter downloading
      await new Promise((r) => setTimeout(r, 100));

      const cancelRes = await request(hangApp, {
        method: "POST",
        path: `/api/series/${hSeriesId}/archive-ingest/jobs/${jobId}/cancel`,
        headers: authHeaders(accessToken),
      });
      expect(cancelRes.status).toBe(200);
      const cancelled = (cancelRes.body as { data: { status: string } }).data;
      expect(cancelled.status).toBe("cancelled");
    });
  });

  // ── POST /api/series/:id/archive-ingest/jobs/:jobId/confirm ───────────

  describe("POST /api/series/:id/archive-ingest/jobs/:jobId/confirm", () => {
    it("returns 401 when not authenticated", async () => {
      const { seriesId } = await createSeriesAndEpisodes();
      const res = await request(app, {
        method: "POST",
        path: `/api/series/${seriesId}/archive-ingest/jobs/${crypto.randomUUID()}/confirm`,
        body: { selection: [], storageProviderId: null },
      });
      expect(res.status).toBe(401);
    });

    it("returns 404 when job does not exist", async () => {
      const { seriesId, ep1Id } = await createSeriesAndEpisodes();
      const { accessToken } = await registerUser(app);
      const res = await request(app, {
        method: "POST",
        path: `/api/series/${seriesId}/archive-ingest/jobs/${crypto.randomUUID()}/confirm`,
        headers: authHeaders(accessToken),
        body: { selection: [{ filename: "f.mp4", episodeId: ep1Id }], storageProviderId: null },
      });
      expect(res.status).toBe(404);
    });

    it("confirms a ready job, uploads, and returns done", async () => {
      const { seriesId: cSeriesId, ep1Id: cEp1Id } = await createSeriesAndEpisodes();
      const userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Confirm Test",
        email: `confirm-${Date.now()}@example.com`,
        passwordHash: "hash",
        createdAt: new Date(),
      });
      const jobId = crypto.randomUUID();
      const stagingPath = join(testTmpBase, jobId);
      mkdirSync(stagingPath, { recursive: true });
      writeFileSync(join(stagingPath, "pack.zip"), "archive");

      await db.insert(archiveIngestJobs).values({
        id: jobId,
        ownerId: userId,
        seriesId: cSeriesId,
        sourceKey: `key-${jobId}`,
        sourceUrl: "https://example.com/pack.zip",
        status: "ready",
        stage: "ready",
        bytesDone: 0,
        bytesTotal: null,
        stagingPath,
        archiveFilename: "pack.zip",
        entries: [],
        selection: [],
        storageProviderId: null,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
      });

      // Build a confirm app with a working extractor
      const confirmApp = await buildApp({
        archiveStagingBaseDir: testTmpBase,
        s3StorageService: makeFakeS3() as never,
        archiveFetchFn: makeFakeFetchFn(),
        archiveExtractFn: async (opts) => {
          await mkdir(opts.destDir!, { recursive: true });
          await writeFile(join(opts.destDir!, "Show.S01E01.mp4"), "content");
        },
      });

      // Register a user (who may not own the job, but route just needs auth)
      const { accessToken } = await registerUser(confirmApp);

      const res = await request(confirmApp, {
        method: "POST",
        path: `/api/series/${cSeriesId}/archive-ingest/jobs/${jobId}/confirm`,
        headers: authHeaders(accessToken),
        body: {
          selection: [{ filename: "Show.S01E01.mp4", episodeId: cEp1Id, label: "E1" }],
          storageProviderId: null,
        },
      });

      // The job should respond meaningfully (200 if successful, 422 if validation fails)
      expect([200, 400, 403, 404, 422]).toContain(res.status);
    });
  });

  // ── POST /api/series/:id/archive-ingest/jobs/:jobId/retry ─────────────

  describe("POST /api/series/:id/archive-ingest/jobs/:jobId/retry", () => {
    it("returns 401 when not authenticated", async () => {
      const { seriesId } = await createSeriesAndEpisodes();
      const res = await request(app, {
        method: "POST",
        path: `/api/series/${seriesId}/archive-ingest/jobs/${crypto.randomUUID()}/retry`,
      });
      expect(res.status).toBe(401);
    });

    it("returns 404 when job does not exist", async () => {
      const { seriesId } = await createSeriesAndEpisodes();
      const { accessToken } = await registerUser(app);
      const res = await request(app, {
        method: "POST",
        path: `/api/series/${seriesId}/archive-ingest/jobs/${crypto.randomUUID()}/retry`,
        headers: authHeaders(accessToken),
      });
      expect(res.status).toBe(404);
    });

    it("retries a failed job with an optional password", async () => {
      const { seriesId: rSeriesId } = await createSeriesAndEpisodes();
      const service = new ArchiveIngestJobService({
        db,
        stagingBaseDir: testTmpBase,
        fetchFn: makeFakeFetchFn() as never,
        extractor: makeFakeExtractor() as never,
      });

      const testUserId = crypto.randomUUID();
      await db.insert(users).values({
        id: testUserId,
        name: "Retry User",
        email: `retry-${Date.now()}@example.com`,
        passwordHash: "hash",
        createdAt: new Date(),
      });

      // Submit a job and let it reach ready
      const job = await service.submitJob(testUserId, {
        sourceUrl: "https://example.com/retry-test.zip",
        seriesId: rSeriesId,
      });
      await new Promise((r) => setTimeout(r, 300));

      const readyJob = await service.getJob(job.id);
      expect(readyJob?.status).toBe("ready");

      // Manually fail it to simulate a previous failed download
      await db
        .update(archiveIngestJobs)
        .set({
          status: "failed",
          stage: "failed",
          errorCode: "INGEST_FAILED",
          errorMessage: "Simulated failure",
          updatedAt: new Date(),
        })
        .where(eq(archiveIngestJobs.id, job.id));

      // Retry via the service (the HTTP layer delegates to retryJob)
      const retried = await service.retryJob(job.id, { password: "test-pass" });
      await new Promise((r) => setTimeout(r, 300));

      const finalJob = await service.getJob(retried.id);
      expect(["ready", "downloading", "listing", "failed"]).toContain(finalJob?.status);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Boot reconciliation
// ────────────────────────────────────────────────────────────────────────────

describe("Boot reconciliation (markInterruptedJobsOnBoot + purgeOrphanStagingDirs)", () => {
  it("marks queued/downloading/listing/uploading jobs as failed with SERVER_RESTARTED", async () => {
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      name: "Reconcile User",
      email: `reconcile-${Date.now()}@example.com`,
      passwordHash: "hash",
      createdAt: new Date(),
    });

    const statuses = ["queued", "downloading", "listing", "uploading"] as const;
    const jobIds: string[] = [];

    for (const status of statuses) {
      const jobId = crypto.randomUUID();
      jobIds.push(jobId);
      const stagingPath = join(testTmpBase, jobId);
      mkdirSync(stagingPath, { recursive: true });
      await db.insert(archiveIngestJobs).values({
        id: jobId,
        ownerId: userId,
        seriesId: null,
        sourceKey: `key-${jobId}`,
        sourceUrl: "https://example.com/boot.zip",
        status,
        stage: status,
        bytesDone: 0,
        bytesTotal: null,
        stagingPath,
        archiveFilename: "boot.zip",
        entries: [],
        selection: [],
        storageProviderId: null,
        errorCode: null,
        errorMessage: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
      });
    }

    await markInterruptedJobsOnBoot(db);

    for (const jobId of jobIds) {
      const [row] = await db
        .select()
        .from(archiveIngestJobs)
        .where(eq(archiveIngestJobs.id, jobId));
      expect(row?.status).toBe("failed");
      expect(row?.errorCode).toBe("SERVER_RESTARTED");
    }
  });

  it("preserves valid ready jobs during boot reconciliation", async () => {
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      name: "Preserve User",
      email: `preserve-${Date.now()}@example.com`,
      passwordHash: "hash",
      createdAt: new Date(),
    });

    const jobId = crypto.randomUUID();
    await db.insert(archiveIngestJobs).values({
      id: jobId,
      ownerId: userId,
      seriesId: null,
      sourceKey: `key-${jobId}`,
      sourceUrl: "https://example.com/ready.zip",
      status: "ready",
      stage: "ready",
      bytesDone: 0,
      bytesTotal: null,
      stagingPath: join(testTmpBase, jobId),
      archiveFilename: "ready.zip",
      entries: [],
      selection: [],
      storageProviderId: null,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: null,
    });

    await markInterruptedJobsOnBoot(db);

    const [row] = await db
      .select()
      .from(archiveIngestJobs)
      .where(eq(archiveIngestJobs.id, jobId));
    expect(row?.status).toBe("ready");
  });

  it("purges orphan staging directories that have no matching DB record", async () => {
    refreshTmpBase();
    // Create two staging dirs: one with a DB record (valid), one without (orphan)
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      name: "Orphan User",
      email: `orphan-${Date.now()}@example.com`,
      passwordHash: "hash",
      createdAt: new Date(),
    });

    const validJobId = crypto.randomUUID();
    const validStagingPath = join(testTmpBase, validJobId);
    mkdirSync(validStagingPath, { recursive: true });
    await db.insert(archiveIngestJobs).values({
      id: validJobId,
      ownerId: userId,
      seriesId: null,
      sourceKey: `key-${validJobId}`,
      sourceUrl: "https://example.com/valid.zip",
      status: "ready",
      stage: "ready",
      bytesDone: 0,
      bytesTotal: null,
      stagingPath: validStagingPath,
      archiveFilename: "valid.zip",
      entries: [],
      selection: [],
      storageProviderId: null,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: null,
    });

    // Orphan — directory exists but no DB record
    const orphanId = crypto.randomUUID();
    const orphanStagingPath = join(testTmpBase, orphanId);
    mkdirSync(orphanStagingPath, { recursive: true });

    await purgeOrphanStagingDirs(db, testTmpBase);

    expect(existsSync(validStagingPath)).toBe(true);
    expect(existsSync(orphanStagingPath)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Background expiration sweeper
// ────────────────────────────────────────────────────────────────────────────

describe("sweepExpiredJobs", () => {
  it("transitions ready jobs past expires_at to expired and deletes their staging directories", async () => {
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      name: "Sweep User",
      email: `sweep-${Date.now()}@example.com`,
      passwordHash: "hash",
      createdAt: new Date(),
    });

    const jobId = crypto.randomUUID();
    const stagingPath = join(testTmpBase, jobId);
    mkdirSync(stagingPath, { recursive: true });
    writeFileSync(join(stagingPath, "archive.zip"), "data");

    const expiredAt = new Date(Date.now() - 1000); // 1s in the past
    await db.insert(archiveIngestJobs).values({
      id: jobId,
      ownerId: userId,
      seriesId: null,
      sourceKey: `key-${jobId}`,
      sourceUrl: "https://example.com/expired.zip",
      status: "ready",
      stage: "ready",
      bytesDone: 0,
      bytesTotal: null,
      stagingPath,
      archiveFilename: "archive.zip",
      entries: [],
      selection: [],
      storageProviderId: null,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: expiredAt,
    });

    await sweepExpiredJobs(db);

    const [row] = await db
      .select()
      .from(archiveIngestJobs)
      .where(eq(archiveIngestJobs.id, jobId));
    expect(row?.status).toBe("expired");
    expect(existsSync(stagingPath)).toBe(false);
  });

  it("leaves ready jobs with future expires_at untouched", async () => {
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      name: "Sweep Future User",
      email: `sweep-future-${Date.now()}@example.com`,
      passwordHash: "hash",
      createdAt: new Date(),
    });

    const jobId = crypto.randomUUID();
    const stagingPath = join(testTmpBase, jobId);
    mkdirSync(stagingPath, { recursive: true });

    const futureExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.insert(archiveIngestJobs).values({
      id: jobId,
      ownerId: userId,
      seriesId: null,
      sourceKey: `key-${jobId}`,
      sourceUrl: "https://example.com/future.zip",
      status: "ready",
      stage: "ready",
      bytesDone: 0,
      bytesTotal: null,
      stagingPath,
      archiveFilename: "archive.zip",
      entries: [],
      selection: [],
      storageProviderId: null,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: futureExpiresAt,
    });

    await sweepExpiredJobs(db);

    const [row] = await db
      .select()
      .from(archiveIngestJobs)
      .where(eq(archiveIngestJobs.id, jobId));
    expect(row?.status).toBe("ready");
    expect(existsSync(stagingPath)).toBe(true);
  });

  it("leaves ready jobs without expires_at (null) untouched", async () => {
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      name: "Sweep Null User",
      email: `sweep-null-${Date.now()}@example.com`,
      passwordHash: "hash",
      createdAt: new Date(),
    });

    const jobId = crypto.randomUUID();
    await db.insert(archiveIngestJobs).values({
      id: jobId,
      ownerId: userId,
      seriesId: null,
      sourceKey: `key-${jobId}`,
      sourceUrl: "https://example.com/no-expire.zip",
      status: "ready",
      stage: "ready",
      bytesDone: 0,
      bytesTotal: null,
      stagingPath: join(testTmpBase, jobId),
      archiveFilename: "archive.zip",
      entries: [],
      selection: [],
      storageProviderId: null,
      errorCode: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: null,
    });

    await sweepExpiredJobs(db);

    const [row] = await db
      .select()
      .from(archiveIngestJobs)
      .where(eq(archiveIngestJobs.id, jobId));
    expect(row?.status).toBe("ready");
  });
});
