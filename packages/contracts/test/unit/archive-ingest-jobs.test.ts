import { describe, expect, it } from "vitest";
import { ARCHIVE_INGEST_ACTIVE_STATUSES } from "../../src";
import type {
  ArchiveIngestJob,
  ArchiveIngestJobCreateRequest,
  ArchiveIngestJobStatus,
} from "../../src";

describe("archive ingest durable job contracts", () => {
  it("defines all lifecycle statuses", () => {
    const statuses: ArchiveIngestJobStatus[] = [
      "queued",
      "downloading",
      "listing",
      "ready",
      "uploading",
      "done",
      "failed",
      "cancelled",
      "expired",
    ];
    expect(statuses).toHaveLength(9);
    for (const s of ARCHIVE_INGEST_ACTIVE_STATUSES) {
      expect(statuses).toContain(s);
    }
    expect([...ARCHIVE_INGEST_ACTIVE_STATUSES].sort()).toEqual(
      ["downloading", "listing", "queued", "ready", "uploading"].sort(),
    );
  });

  it("defines the job entity shape", () => {
    const job: ArchiveIngestJob = {
      id: "job-1",
      ownerId: "user-1",
      seriesId: "series-1",
      sourceKey: "drive:abc123",
      sourceUrl: "https://drive.google.com/file/d/abc123/view",
      status: "downloading",
      stage: "downloading",
      bytesDone: 0,
      bytesTotal: 1024,
      stagingPath: null,
      archiveFilename: null,
      entries: [],
      selection: [],
      storageProviderId: null,
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      expiresAt: null,
    };
    expect(job.status).toBe("downloading");
    expect(job.entries).toEqual([]);
  });

  it("defines the create request shape", () => {
    const req: ArchiveIngestJobCreateRequest = {
      sourceUrl: "https://example.com/pack.zip",
      seriesId: "series-1",
    };
    expect(req.sourceUrl).toContain("pack.zip");
  });
});
