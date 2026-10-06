import { describe, expect, it } from "vitest";
import {
  ArchiveIngestJobService,
  type ArchiveEntry,
} from "../../../src/modules/series";
import type { DbClient } from "@repo/db";

describe("ArchiveIngestJobService Unit Tests", () => {
  const dummyDb = {} as unknown as DbClient;

  it("extractFilename correctly parses filename or falls back", () => {
    const service = new ArchiveIngestJobService({
      db: dummyDb,
      stagingBaseDir: "/tmp",
    });

    expect(service.extractFilename("https://example.com/downloads/MySeries.S01.7z")).toBe(
      "MySeries.S01.7z"
    );
    expect(
      service.extractFilename("https://example.com/files/Attack%20on%20Titan%20S04.rar?token=123")
    ).toBe("Attack on Titan S04.rar");
    expect(service.extractFilename("invalid-url")).toBe("archive.zip");
  });

  it("deriveSourceKey normalizes URLs and identifies Google Drive files", () => {
    const service = new ArchiveIngestJobService({
      db: dummyDb,
      stagingBaseDir: "/tmp",
    });

    expect(
      service.deriveSourceKey(
        "https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view?usp=sharing"
      )
    ).toBe("gdrive:1a2b3c4d5e6f7g8h9i0j");

    expect(
      service.deriveSourceKey("https://example.com/anime/pack.zip?auth=secret123")
    ).toBe("https://example.com/anime/pack.zip");
  });

  describe("processArchiveEntries (Episode Matching & Size Disparity)", () => {
    it("filters out non-video files and sample files", () => {
      const service = new ArchiveIngestJobService({
        db: dummyDb,
        stagingBaseDir: "/tmp",
      });

      const entries: ArchiveEntry[] = [
        { path: "Season 1/S01E01.mp4", sizeBytes: 500_000_000, isDirectory: false },
        { path: "Season 1/S01E02.mkv", sizeBytes: 510_000_000, isDirectory: false },
        { path: "Season 1/sample-s01e01.mp4", sizeBytes: 15_000_000, isDirectory: false },
        { path: "Season 1/readme.txt", sizeBytes: 1024, isDirectory: false },
        { path: "Season 1/Subtitles/", sizeBytes: 0, isDirectory: true },
      ];

      const processed = service.processArchiveEntries(entries);
      expect(processed).toHaveLength(2);
      expect(processed[0]?.filename).toBe("Season 1/S01E01.mp4");
      expect(processed[0]?.detectedEpisodeNumber).toBe(1);
      expect(processed[0]?.needsReview).toBe(false);

      expect(processed[1]?.filename).toBe("Season 1/S01E02.mkv");
      expect(processed[1]?.detectedEpisodeNumber).toBe(2);
      expect(processed[1]?.needsReview).toBe(false);
    });

    it("flags unusually small sibling videos with needsReview = true", () => {
      const service = new ArchiveIngestJobService({
        db: dummyDb,
        stagingBaseDir: "/tmp",
      });

      // Normal episodes ~500MB, one corrupted/short preview at 50MB (< 50% median of ~500MB)
      const entries: ArchiveEntry[] = [
        { path: "Show/S01E01.mp4", sizeBytes: 500_000_000, isDirectory: false },
        { path: "Show/S01E02.mp4", sizeBytes: 490_000_000, isDirectory: false },
        { path: "Show/S01E03.mp4", sizeBytes: 510_000_000, isDirectory: false },
        { path: "Show/S01E04.mp4", sizeBytes: 505_000_000, isDirectory: false },
        { path: "Show/S01E05.mp4", sizeBytes: 50_000_000, isDirectory: false }, // tiny size!
      ];

      const processed = service.processArchiveEntries(entries);
      expect(processed).toHaveLength(5);

      const ep5 = processed.find((p) => p.filename === "Show/S01E05.mp4");
      expect(ep5).toBeDefined();
      expect(ep5?.detectedEpisodeNumber).toBe(5);
      expect(ep5?.needsReview).toBe(true);

      const ep1 = processed.find((p) => p.filename === "Show/S01E01.mp4");
      expect(ep1?.needsReview).toBe(false);
    });

    it("flags unparseable episode names or duplicate episode collisions with needsReview = true", () => {
      const service = new ArchiveIngestJobService({
        db: dummyDb,
        stagingBaseDir: "/tmp",
      });

      const entries: ArchiveEntry[] = [
        { path: "Show/Episode 01 - 1080p.mp4", sizeBytes: 500_000_000, isDirectory: false },
        { path: "Show/Episode 01 - 720p version.mp4", sizeBytes: 300_000_000, isDirectory: false },
        { path: "Show/Special OVA.mp4", sizeBytes: 500_000_000, isDirectory: false }, // No episode number
      ];

      const processed = service.processArchiveEntries(entries);
      expect(processed).toHaveLength(3);

      const ep1A = processed.find((p) => p.filename.includes("1080p"));
      const ep1B = processed.find((p) => p.filename.includes("720p"));
      const ova = processed.find((p) => p.filename.includes("Special OVA"));

      // Duplicate detected episode 1 collision
      expect(ep1A?.detectedEpisodeNumber).toBe(1);
      expect(ep1A?.needsReview).toBe(true);

      expect(ep1B?.detectedEpisodeNumber).toBe(1);
      expect(ep1B?.needsReview).toBe(true);

      // No episode number detected
      expect(ova?.detectedEpisodeNumber).toBeNull();
      expect(ova?.needsReview).toBe(true);
    });
  });
});
