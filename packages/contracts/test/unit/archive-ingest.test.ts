import { describe, expect, it } from "vitest";
import type {
  ArchiveIngestCommitItem,
  ArchiveIngestCommitRequest,
  ArchiveIngestPreviewRequest,
  ArchiveIngestPreviewResponse,
  ArchiveIngestSseEvent,
  ArchiveStagedFileItem,
} from "../../src";

describe("archive ingest contracts", () => {
  it("defines the preview request shape", () => {
    const req: ArchiveIngestPreviewRequest = {
      url: "https://example.com/season-pack.zip",
      password: "secret",
      referer: "https://example.com/release",
      targetSeasonId: "season-1",
    };
    expect(req.url).toContain(".zip");

    const minimal: ArchiveIngestPreviewRequest = {
      url: "https://example.com/pack.rar",
    };
    expect(minimal.password).toBeUndefined();
    expect(minimal.referer).toBeUndefined();
    expect(minimal.targetSeasonId).toBeUndefined();
  });

  it("defines staged file items with review flags", () => {
    const matched: ArchiveStagedFileItem = {
      fileId: "file-1",
      filename: "Show.S01E02.1080p.mkv",
      fileSizeBytes: 1024,
      detectedEpisodeNumber: 2,
      matchedEpisodeId: "ep-2",
      quality: "1080p",
      needsReview: false,
    };
    const review: ArchiveStagedFileItem = {
      fileId: "file-2",
      filename: "extra-sample.mp4",
      fileSizeBytes: 512,
      detectedEpisodeNumber: null,
      matchedEpisodeId: null,
      quality: null,
      needsReview: true,
    };
    expect(matched.needsReview).toBe(false);
    expect(review.needsReview).toBe(true);
  });

  it("defines the commit request shape", () => {
    const item: ArchiveIngestCommitItem = {
      fileId: "file-1",
      episodeId: "ep-2",
      label: "1080p",
      quality: "1080p",
      isIgnored: false,
    };
    const req: ArchiveIngestCommitRequest = {
      stagingSessionId: "session-1",
      storageProviderId: "provider-1",
      defaultLabel: "1080p",
      items: [item, { fileId: "file-2", episodeId: "ep-3", isIgnored: true }],
    };
    expect(req.items).toHaveLength(2);
    expect(req.items[1]?.isIgnored).toBe(true);
  });

  it("defines typed SSE event payloads for preview and commit phases", () => {
    const previewResponse: ArchiveIngestPreviewResponse = {
      stagingSessionId: "session-1",
      items: [],
    };
    const events: ArchiveIngestSseEvent[] = [
      { type: "download_progress", data: { loaded: 10, total: 100, percent: 10 } },
      { type: "extract_progress", data: { currentFile: "E01.mkv", totalFiles: 12 } },
      { type: "preview_ready", data: previewResponse },
      {
        type: "upload_progress",
        data: {
          fileIndex: 0,
          totalFiles: 2,
          filename: "E01.mkv",
          percent: 50,
          loaded: 5,
          total: 10,
        },
      },
      { type: "file_completed", data: { episodeId: "ep-1", videoSourceId: "vs-1" } },
      { type: "all_completed", data: { success: true, count: 2 } },
    ];
    expect(events).toHaveLength(6);
    expect(events[0]?.type).toBe("download_progress");
    expect(events[5]?.type).toBe("all_completed");
  });
});
