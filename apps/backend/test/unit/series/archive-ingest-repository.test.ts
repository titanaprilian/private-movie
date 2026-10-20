import { describe, expect, it, vi } from "vitest";
import type { ArchiveIngestJobRow } from "@repo/db";
import { createArchiveIngestRepository } from "../../../src/modules/series";

function makeRow(
  overrides: Partial<ArchiveIngestJobRow> = {},
): ArchiveIngestJobRow {
  const now = new Date("2026-09-01T00:00:00.000Z");
  return {
    id: "job-123",
    ownerId: "owner-1",
    seriesId: "series-1",
    sourceKey: "https://example.com/archive.zip",
    sourceUrl: "https://example.com/archive.zip",
    referer: null,
    status: "downloading",
    stage: "downloading",
    bytesDone: 0,
    bytesTotal: 1024,
    stagingPath: "/tmp/staging/job-123",
    archiveFilename: "archive.zip",
    entries: [],
    selection: [],
    storageProviderId: null,
    errorCode: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
    ...overrides,
  };
}

/**
 * Builds a mock db whose every query-builder chain resolves to `result`,
 * no matter which terminal (`limit`, `returning`, or bare await) ends it.
 */
interface MockChain {
  from: (...args: unknown[]) => MockChain;
  where: (...args: unknown[]) => MockChain;
  orderBy: (...args: unknown[]) => MockChain;
  limit: (...args: unknown[]) => Promise<unknown>;
  set: (...args: unknown[]) => MockChain;
  values: (...args: unknown[]) => MockChain;
  returning: (...args: unknown[]) => Promise<unknown>;
  then: Promise<unknown>["then"];
}

type MockDbParam = Parameters<typeof createArchiveIngestRepository>[0];

function mockDbFor(result: unknown) {
  const q = {} as MockChain;
  q.from = vi.fn().mockReturnValue(q);
  q.where = vi.fn().mockReturnValue(q);
  q.orderBy = vi.fn().mockReturnValue(q);
  q.limit = vi.fn().mockResolvedValue(result);
  q.set = vi.fn().mockReturnValue(q);
  q.values = vi.fn().mockReturnValue(q);
  q.returning = vi.fn().mockResolvedValue(result);
  q.then = Promise.resolve(result).then.bind(Promise.resolve(result));
  const db = {
    select: vi.fn().mockReturnValue(q),
    insert: vi.fn().mockReturnValue(q),
    update: vi.fn().mockReturnValue(q),
  };
  const repository = createArchiveIngestRepository(
    db as unknown as MockDbParam,
  );
  return { db, q, repository };
}

describe("archive ingest repository findActiveJob", () => {
  it("returns the mapped domain job for an active (owner, sourceKey) pair", async () => {
    const row = makeRow({ status: "ready", stage: "ready" });
    const { db, q, repository } = mockDbFor([row]);

    const result = await repository.findActiveJob("owner-1", row.sourceKey);

    expect(db.select).toHaveBeenCalled();
    expect(q.from).toHaveBeenCalled();
    expect(q.where).toHaveBeenCalled();
    expect(q.limit).toHaveBeenCalledWith(1);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("job-123");
    expect(result?.status).toBe("ready");
    expect(result?.createdAt).toBe("2026-09-01T00:00:00.000Z");
    expect(result?.entries).toEqual([]);
    expect(result?.expiresAt).toBeNull();
  });

  it("returns null when no active job exists", async () => {
    const { repository } = mockDbFor([]);

    await expect(
      repository.findActiveJob("owner-1", "missing"),
    ).resolves.toBeNull();
  });
});

describe("archive ingest repository countActiveJobs", () => {
  it("returns the active job count without an owner filter", async () => {
    const { q, repository } = mockDbFor([{ count: 2 }]);

    await expect(repository.countActiveJobs()).resolves.toBe(2);
    expect(q.where).toHaveBeenCalled();
  });

  it("supports an owner-scoped count and defaults to zero", async () => {
    const { repository } = mockDbFor([{ count: 1 }]);
    await expect(repository.countActiveJobs("owner-1")).resolves.toBe(1);

    const empty = mockDbFor([]);
    const emptyRepo = empty.repository;
    await expect(emptyRepo.countActiveJobs()).resolves.toBe(0);
  });
});

describe("archive ingest repository createJob", () => {
  it("inserts the row and returns the mapped domain job", async () => {
    const row = makeRow();
    const { db, q, repository } = mockDbFor([row]);

    const input = { ...row };
    const result = await repository.createJob(input);

    expect(db.insert).toHaveBeenCalled();
    expect(q.values).toHaveBeenCalledWith(input);
    expect(result.id).toBe("job-123");
    expect(result.ownerId).toBe("owner-1");
    expect(result.bytesTotal).toBe(1024);
    expect(result.updatedAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("throws when the insert returns no row", async () => {
    const { repository } = mockDbFor([]);

    await expect(repository.createJob(makeRow())).rejects.toThrow();
  });
});

describe("archive ingest repository findById", () => {
  it("returns the mapped job for a known id", async () => {
    const row = makeRow({
      id: "job-abc",
      status: "uploading",
      stage: "uploading",
    });
    const { repository } = mockDbFor([row]);

    const result = await repository.findById("job-abc");

    expect(result?.id).toBe("job-abc");
    expect(result?.status).toBe("uploading");
  });

  it("returns null for an unknown id", async () => {
    const { repository } = mockDbFor([]);

    await expect(repository.findById("nope")).resolves.toBeNull();
  });
});

describe("archive ingest repository findFailedJob", () => {
  it("returns the most recent failed job for the pair", async () => {
    const row = makeRow({
      status: "failed",
      stage: "failed",
      errorCode: "INGEST_FAILED",
      errorMessage: "boom",
    });
    const { q, repository } = mockDbFor([row]);

    const result = await repository.findFailedJob("owner-1", row.sourceKey);

    expect(q.orderBy).toHaveBeenCalled();
    expect(q.limit).toHaveBeenCalledWith(1);
    expect(result?.status).toBe("failed");
    expect(result?.errorCode).toBe("INGEST_FAILED");
  });

  it("returns null when no failed job exists", async () => {
    const { repository } = mockDbFor([]);

    await expect(
      repository.findFailedJob("owner-1", "missing"),
    ).resolves.toBeNull();
  });
});

describe("archive ingest repository updateJob", () => {
  it("applies the patch with a fresh updatedAt and returns the mapped job", async () => {
    const updated = makeRow({ status: "ready", stage: "ready" });
    const { db, q, repository } = mockDbFor([updated]);

    const result = await repository.updateJob("job-123", {
      status: "ready",
      stage: "ready",
    });

    expect(db.update).toHaveBeenCalled();
    expect(q.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ready",
        stage: "ready",
        updatedAt: expect.any(Date),
      }),
    );
    expect(result?.status).toBe("ready");
  });

  it("returns null when the job does not exist", async () => {
    const { repository } = mockDbFor([]);

    await expect(
      repository.updateJob("missing", { status: "failed" }),
    ).resolves.toBeNull();
  });
});

describe("archive ingest repository markInterruptedJobsAsFailed", () => {
  it("returns staging refs for filesystem cleanup by the service layer", async () => {
    const refs = [
      { id: "job-1", stagingPath: "/tmp/staging/job-1" },
      { id: "job-2", stagingPath: null },
    ];
    const { db, q, repository } = mockDbFor(refs);

    const result = await repository.markInterruptedJobsAsFailed();

    expect(db.update).toHaveBeenCalled();
    expect(q.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorCode: "SERVER_RESTARTED",
      }),
    );
    expect(result).toEqual(refs);
  });

  it("returns an empty array when nothing was interrupted", async () => {
    const { repository } = mockDbFor([]);

    await expect(repository.markInterruptedJobsAsFailed()).resolves.toEqual([]);
  });
});

describe("archive ingest repository expiry", () => {
  it("findExpiredReadyJobs returns mapped expired ready jobs", async () => {
    const rows = [
      makeRow({
        id: "job-old",
        status: "ready",
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
      }),
    ];
    const { repository } = mockDbFor(rows);

    const result = await repository.findExpiredReadyJobs(
      new Date("2026-09-01T00:00:00.000Z"),
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("job-old");
    expect(result[0]?.status).toBe("ready");
    expect(result[0]?.expiresAt).toBe("2026-08-01T00:00:00.000Z");
  });

  it("markJobsExpired transitions ids and returns staging refs", async () => {
    const refs = [{ id: "job-old", stagingPath: "/tmp/staging/job-old" }];
    const { db, q, repository } = mockDbFor(refs);

    const result = await repository.markJobsExpired(["job-old"]);

    expect(db.update).toHaveBeenCalled();
    expect(q.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: "expired", stage: "expired" }),
    );
    expect(result).toEqual(refs);
  });

  it("markJobsExpired short-circuits on an empty id list without touching the db", async () => {
    const { db, repository } = mockDbFor([]);

    await expect(repository.markJobsExpired([])).resolves.toEqual([]);
    expect(db.update).not.toHaveBeenCalled();
  });
});

describe("archive ingest repository listings", () => {
  it("listJobsByOwner returns mapped jobs newest first", async () => {
    const rows = [makeRow({ id: "job-2" }), makeRow({ id: "job-1" })];
    const { q, repository } = mockDbFor(rows);

    const result = await repository.listJobsByOwner("owner-1", 10);

    expect(q.orderBy).toHaveBeenCalled();
    expect(q.limit).toHaveBeenCalledWith(10);
    expect(result.map((j) => j.id)).toEqual(["job-2", "job-1"]);
  });

  it("findQueuedJobs returns queued jobs up to the limit", async () => {
    const rows = [makeRow({ id: "job-q", status: "queued", stage: "queued" })];
    const { q, repository } = mockDbFor(rows);

    const result = await repository.findQueuedJobs(2);

    expect(q.limit).toHaveBeenCalledWith(2);
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe("queued");
  });

  it("listActiveJobIds returns plain id strings", async () => {
    const { repository } = mockDbFor([{ id: "job-1" }, { id: "job-2" }]);

    await expect(repository.listActiveJobIds()).resolves.toEqual([
      "job-1",
      "job-2",
    ]);
  });
});
