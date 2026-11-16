import { describe, expect, it } from "vitest";
import { users, type NewArchiveIngestJobRow } from "@repo/db";
import { createArchiveIngestRepository } from "../../../src/modules/series";
import { db } from "../../utils/db";

async function createTestUser(emailPrefix = "archive-repo"): Promise<string> {
  const userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    name: "Archive Ingest Repo User",
    email: `${emailPrefix}-${userId}@example.com`,
    passwordHash: "dummyhash",
    createdAt: new Date(),
  });
  return userId;
}

function makeJobInput(
  ownerId: string,
  overrides: Partial<NewArchiveIngestJobRow> = {},
): NewArchiveIngestJobRow {
  const id = crypto.randomUUID();
  return {
    id,
    ownerId,
    seriesId: null,
    sourceKey: `https://example.com/archive-${id}.zip`,
    sourceUrl: `https://example.com/archive-${id}.zip`,
    referer: null,
    status: "downloading",
    stage: "downloading",
    bytesDone: 0,
    bytesTotal: 1024,
    stagingPath: `/tmp/staging/${id}`,
    archiveFilename: "archive.zip",
    entries: [],
    selection: [],
    storageProviderId: null,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    expiresAt: null,
    ...overrides,
  };
}

describe("archive ingest repository findActiveJob", () => {
  it("returns the mapped domain job for an active (owner, sourceKey) pair", async () => {
    const ownerId = await createTestUser();
    const repo = createArchiveIngestRepository(db);

    const input = makeJobInput(ownerId, {
      status: "ready",
      stage: "ready",
      sourceKey: "https://example.com/active.zip",
    });
    await repo.createJob(input);

    const result = await repo.findActiveJob(
      ownerId,
      "https://example.com/active.zip",
    );

    expect(result).not.toBeNull();
    expect(result?.id).toBe(input.id);
    expect(result?.ownerId).toBe(ownerId);
    expect(result?.status).toBe("ready");
    expect(result?.sourceKey).toBe("https://example.com/active.zip");
    expect(typeof result?.createdAt).toBe("string");
    expect(result?.expiresAt).toBeNull();
  });

  it("returns null when no active job exists or status is inactive", async () => {
    const ownerId = await createTestUser();
    const repo = createArchiveIngestRepository(db);

    // Inactive job: failed
    const failedInput = makeJobInput(ownerId, {
      status: "failed",
      stage: "failed",
      sourceKey: "https://example.com/inactive.zip",
    });
    await repo.createJob(failedInput);

    const result = await repo.findActiveJob(
      ownerId,
      "https://example.com/inactive.zip",
    );
    expect(result).toBeNull();

    const missingResult = await repo.findActiveJob(
      ownerId,
      "https://example.com/nonexistent.zip",
    );
    expect(missingResult).toBeNull();
  });
});

describe("archive ingest repository countActiveJobs", () => {
  it("returns the active job count without an owner filter", async () => {
    const owner1 = await createTestUser("owner-1");
    const owner2 = await createTestUser("owner-2");
    const repo = createArchiveIngestRepository(db);

    expect(await repo.countActiveJobs()).toBe(0);

    // downloading, listing, uploading count toward active concurrency slots
    await repo.createJob(makeJobInput(owner1, { status: "downloading" }));
    await repo.createJob(makeJobInput(owner2, { status: "listing" }));
    // completed/ready/cancelled do not count toward counted active concurrency slots
    await repo.createJob(makeJobInput(owner1, { status: "ready" }));
    await repo.createJob(makeJobInput(owner2, { status: "cancelled" }));

    expect(await repo.countActiveJobs()).toBe(2);
  });

  it("supports an owner-scoped count and defaults to zero", async () => {
    const owner1 = await createTestUser("owner-scoped-1");
    const owner2 = await createTestUser("owner-scoped-2");
    const repo = createArchiveIngestRepository(db);

    await repo.createJob(makeJobInput(owner1, { status: "uploading" }));
    await repo.createJob(makeJobInput(owner2, { status: "uploading" }));

    expect(await repo.countActiveJobs(owner1)).toBe(1);
    expect(await repo.countActiveJobs(owner2)).toBe(1);
    expect(await repo.countActiveJobs("nonexistent-owner")).toBe(0);
  });
});

describe("archive ingest repository createJob", () => {
  it("inserts the row and returns the mapped domain job", async () => {
    const ownerId = await createTestUser();
    const repo = createArchiveIngestRepository(db);

    const input = makeJobInput(ownerId, {
      bytesTotal: 2048,
      archiveFilename: "my-series.rar",
    });
    const result = await repo.createJob(input);

    expect(result.id).toBe(input.id);
    expect(result.ownerId).toBe(ownerId);
    expect(result.bytesTotal).toBe(2048);
    expect(result.archiveFilename).toBe("my-series.rar");
    expect(typeof result.createdAt).toBe("string");
    expect(typeof result.updatedAt).toBe("string");
  });
});

describe("archive ingest repository findById", () => {
  it("returns the mapped job for a known id", async () => {
    const ownerId = await createTestUser();
    const repo = createArchiveIngestRepository(db);

    const input = makeJobInput(ownerId, {
      status: "uploading",
      stage: "uploading",
    });
    await repo.createJob(input);

    const result = await repo.findById(input.id);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(input.id);
    expect(result?.status).toBe("uploading");
    expect(result?.stage).toBe("uploading");
  });

  it("returns null for an unknown id", async () => {
    const repo = createArchiveIngestRepository(db);
    const result = await repo.findById(crypto.randomUUID());
    expect(result).toBeNull();
  });
});

describe("archive ingest repository findFailedJob", () => {
  it("returns the most recent failed job for the pair", async () => {
    const ownerId = await createTestUser();
    const repo = createArchiveIngestRepository(db);
    const sourceKey = "https://example.com/retry-test.zip";

    const t1 = new Date("2026-09-01T10:00:00.000Z");
    const t2 = new Date("2026-09-01T12:00:00.000Z");

    const olderFailed = makeJobInput(ownerId, {
      sourceKey,
      status: "failed",
      stage: "failed",
      errorCode: "EXTRACT_FAILED",
      errorMessage: "first attempt failed",
      updatedAt: t1,
    });
    const newerFailed = makeJobInput(ownerId, {
      sourceKey,
      status: "failed",
      stage: "failed",
      errorCode: "EXTRACT_FAILED",
      errorMessage: "second attempt failed",
      updatedAt: t2,
    });

    await repo.createJob(olderFailed);
    await repo.createJob(newerFailed);

    const result = await repo.findFailedJob(ownerId, sourceKey);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(newerFailed.id);
    expect(result?.errorMessage).toBe("second attempt failed");
  });

  it("returns null when no failed job exists", async () => {
    const ownerId = await createTestUser();
    const repo = createArchiveIngestRepository(db);

    const result = await repo.findFailedJob(
      ownerId,
      "https://example.com/not-failed.zip",
    );
    expect(result).toBeNull();
  });
});

describe("archive ingest repository updateJob", () => {
  it("applies the patch with a fresh updatedAt and returns the mapped job", async () => {
    const ownerId = await createTestUser();
    const repo = createArchiveIngestRepository(db);

    const input = makeJobInput(ownerId, {
      status: "downloading",
      stage: "downloading",
      bytesDone: 100,
    });
    const created = await repo.createJob(input);

    const updated = await repo.updateJob(created.id, {
      status: "ready",
      stage: "ready",
      bytesDone: 1024,
    });

    expect(updated).not.toBeNull();
    expect(updated?.id).toBe(created.id);
    expect(updated?.status).toBe("ready");
    expect(updated?.stage).toBe("ready");
    expect(updated?.bytesDone).toBe(1024);
  });

  it("returns null when the job does not exist", async () => {
    const repo = createArchiveIngestRepository(db);
    const result = await repo.updateJob(crypto.randomUUID(), {
      status: "failed",
    });
    expect(result).toBeNull();
  });
});

describe("archive ingest repository markInterruptedJobsAsFailed", () => {
  it("returns staging refs for filesystem cleanup and marks interrupted jobs as failed", async () => {
    const ownerId = await createTestUser();
    const repo = createArchiveIngestRepository(db);

    const interruptedStatuses = [
      "queued",
      "downloading",
      "listing",
      "uploading",
    ] as const;
    const createdJobs: string[] = [];

    for (const status of interruptedStatuses) {
      const input = makeJobInput(ownerId, {
        status,
        stage: status,
      });
      await repo.createJob(input);
      createdJobs.push(input.id);
    }

    // A job in "ready" or "cancelled" state should NOT be touched
    const readyJob = makeJobInput(ownerId, { status: "ready", stage: "ready" });
    await repo.createJob(readyJob);

    const refs = await repo.markInterruptedJobsAsFailed();

    expect(refs).toHaveLength(4);
    for (const id of createdJobs) {
      expect(refs.some((r) => r.id === id)).toBe(true);
      const row = await repo.findById(id);
      expect(row?.status).toBe("failed");
      expect(row?.errorCode).toBe("SERVER_RESTARTED");
    }

    const readyAfter = await repo.findById(readyJob.id);
    expect(readyAfter?.status).toBe("ready");
  });

  it("returns an empty array when nothing was interrupted", async () => {
    const repo = createArchiveIngestRepository(db);
    const refs = await repo.markInterruptedJobsAsFailed();
    expect(refs).toEqual([]);
  });
});

describe("archive ingest repository expiry", () => {
  it("findExpiredReadyJobs returns mapped expired ready jobs", async () => {
    const ownerId = await createTestUser();
    const repo = createArchiveIngestRepository(db);

    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);

    const expiredInput = makeJobInput(ownerId, {
      status: "ready",
      stage: "ready",
      expiresAt: past,
    });
    const futureInput = makeJobInput(ownerId, {
      status: "ready",
      stage: "ready",
      expiresAt: future,
    });
    const noExpireInput = makeJobInput(ownerId, {
      status: "ready",
      stage: "ready",
      expiresAt: null,
    });

    await repo.createJob(expiredInput);
    await repo.createJob(futureInput);
    await repo.createJob(noExpireInput);

    const expiredJobs = await repo.findExpiredReadyJobs(new Date());

    expect(expiredJobs.some((j) => j.id === expiredInput.id)).toBe(true);
    expect(expiredJobs.some((j) => j.id === futureInput.id)).toBe(false);
    expect(expiredJobs.some((j) => j.id === noExpireInput.id)).toBe(false);
  });

  it("markJobsExpired transitions ids to expired and returns staging refs", async () => {
    const ownerId = await createTestUser();
    const repo = createArchiveIngestRepository(db);

    const input = makeJobInput(ownerId, {
      status: "ready",
      stage: "ready",
      stagingPath: `/tmp/staging/${crypto.randomUUID()}`,
    });
    await repo.createJob(input);

    const refs = await repo.markJobsExpired([input.id]);

    expect(refs).toHaveLength(1);
    expect(refs[0]?.id).toBe(input.id);
    expect(refs[0]?.stagingPath).toBe(input.stagingPath);

    const updated = await repo.findById(input.id);
    expect(updated?.status).toBe("expired");
    expect(updated?.stage).toBe("expired");
  });

  it("markJobsExpired short-circuits on an empty id list without touching the db", async () => {
    const repo = createArchiveIngestRepository(db);
    const refs = await repo.markJobsExpired([]);
    expect(refs).toEqual([]);
  });
});

describe("archive ingest repository listings", () => {
  it("listJobsByOwner returns mapped jobs newest first with limit", async () => {
    const ownerId = await createTestUser();
    const otherOwnerId = await createTestUser("other-owner");
    const repo = createArchiveIngestRepository(db);

    const t1 = new Date("2026-09-01T10:00:00.000Z");
    const t2 = new Date("2026-09-01T11:00:00.000Z");
    const t3 = new Date("2026-09-01T12:00:00.000Z");

    const job1 = makeJobInput(ownerId, { createdAt: t1 });
    const job2 = makeJobInput(ownerId, { createdAt: t2 });
    const job3 = makeJobInput(ownerId, { createdAt: t3 });
    const otherJob = makeJobInput(otherOwnerId, { createdAt: t3 });

    await repo.createJob(job1);
    await repo.createJob(job2);
    await repo.createJob(job3);
    await repo.createJob(otherJob);

    const list = await repo.listJobsByOwner(ownerId, 2);

    expect(list).toHaveLength(2);
    expect(list[0]?.id).toBe(job3.id);
    expect(list[1]?.id).toBe(job2.id);
    expect(list.some((j) => j.id === otherJob.id)).toBe(false);
  });

  it("findQueuedJobs returns queued jobs ordered by createdAt asc up to limit", async () => {
    const ownerId = await createTestUser();
    const repo = createArchiveIngestRepository(db);

    const t1 = new Date("2026-09-01T08:00:00.000Z");
    const t2 = new Date("2026-09-01T09:00:00.000Z");
    const t3 = new Date("2026-09-01T10:00:00.000Z");

    const q1 = makeJobInput(ownerId, {
      status: "queued",
      stage: "queued",
      createdAt: t1,
    });
    const q2 = makeJobInput(ownerId, {
      status: "queued",
      stage: "queued",
      createdAt: t2,
    });
    const notQueued = makeJobInput(ownerId, {
      status: "downloading",
      createdAt: t3,
    });

    await repo.createJob(q2);
    await repo.createJob(q1);
    await repo.createJob(notQueued);

    const queued = await repo.findQueuedJobs(1);

    expect(queued).toHaveLength(1);
    expect(queued[0]?.id).toBe(q1.id);
  });

  it("listActiveJobIds returns plain id strings for active jobs only", async () => {
    const ownerId = await createTestUser();
    const repo = createArchiveIngestRepository(db);

    const active1 = makeJobInput(ownerId, { status: "downloading" });
    const active2 = makeJobInput(ownerId, { status: "ready" });
    const inactive = makeJobInput(ownerId, { status: "failed" });

    await repo.createJob(active1);
    await repo.createJob(active2);
    await repo.createJob(inactive);

    const ids = await repo.listActiveJobIds();

    expect(ids).toContain(active1.id);
    expect(ids).toContain(active2.id);
    expect(ids).not.toContain(inactive.id);
  });

  it("listAllJobIds returns plain id strings for all jobs", async () => {
    const ownerId = await createTestUser();
    const repo = createArchiveIngestRepository(db);

    const j1 = makeJobInput(ownerId, { status: "downloading" });
    const j2 = makeJobInput(ownerId, { status: "failed" });

    await repo.createJob(j1);
    await repo.createJob(j2);

    const ids = await repo.listAllJobIds();

    expect(ids).toContain(j1.id);
    expect(ids).toContain(j2.id);
  });
});
