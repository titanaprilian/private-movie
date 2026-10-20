import { describe, expect, it } from "vitest";
import {
  processArchiveEntries,
  SIBLING_SIZE_DISPARITY_THRESHOLD,
  type ArchiveEntry,
} from "../../../src/modules/series";

describe("processArchiveEntries (pure entry processor)", () => {
  it("exports the disparity threshold constant", () => {
    expect(SIBLING_SIZE_DISPARITY_THRESHOLD).toBe(0.5);
  });

  it("filters to valid videos only (drops directories, non-videos, samples)", () => {
    const entries: ArchiveEntry[] = [
      {
        path: "Season 1/S01E01.mp4",
        sizeBytes: 500_000_000,
        isDirectory: false,
      },
      {
        path: "Season 1/S01E02.mkv",
        sizeBytes: 510_000_000,
        isDirectory: false,
      },
      {
        path: "Season 1/sample-s01e01.mp4",
        sizeBytes: 15_000_000,
        isDirectory: false,
      },
      { path: "Season 1/readme.txt", sizeBytes: 1024, isDirectory: false },
      { path: "Season 1/Subtitles/", sizeBytes: 0, isDirectory: true },
    ];

    const processed = processArchiveEntries(entries);
    expect(processed).toHaveLength(2);
    expect(processed.map((p) => p.filename)).toEqual([
      "Season 1/S01E01.mp4",
      "Season 1/S01E02.mkv",
    ]);
    expect(processed[0]?.detectedEpisodeNumber).toBe(1);
    expect(processed[0]?.needsReview).toBe(false);
    expect(processed[1]?.detectedEpisodeNumber).toBe(2);
    expect(processed[1]?.needsReview).toBe(false);
  });

  it("returns empty for no valid videos", () => {
    expect(
      processArchiveEntries([
        { path: "readme.txt", sizeBytes: 10, isDirectory: false },
        { path: "dir/", sizeBytes: 0, isDirectory: true },
      ]),
    ).toEqual([]);
    expect(processArchiveEntries([])).toEqual([]);
  });

  it("computes median over valid sizes and flags disparity below threshold", () => {
    // Median of [490M, 500M, 505M, 510M] ~ 502.5M; 50M is far below 50% of median.
    const entries: ArchiveEntry[] = [
      { path: "Show/S01E01.mp4", sizeBytes: 500_000_000, isDirectory: false },
      { path: "Show/S01E02.mp4", sizeBytes: 490_000_000, isDirectory: false },
      { path: "Show/S01E03.mp4", sizeBytes: 510_000_000, isDirectory: false },
      { path: "Show/S01E04.mp4", sizeBytes: 505_000_000, isDirectory: false },
      { path: "Show/S01E05.mp4", sizeBytes: 50_000_000, isDirectory: false },
    ];

    const processed = processArchiveEntries(entries);
    expect(processed).toHaveLength(5);
    expect(
      processed.find((p) => p.filename === "Show/S01E05.mp4")?.needsReview,
    ).toBe(true);
    expect(
      processed.find((p) => p.filename === "Show/S01E01.mp4")?.needsReview,
    ).toBe(false);
  });

  it("does not flag entries just above the disparity boundary", () => {
    // Median of 3 x 1000 = 1000; boundary = 500. 501 stays clean, 499 flags.
    const entries: ArchiveEntry[] = [
      { path: "Show/S01E01.mp4", sizeBytes: 1000, isDirectory: false },
      { path: "Show/S01E02.mp4", sizeBytes: 1000, isDirectory: false },
      { path: "Show/S01E03.mp4", sizeBytes: 1000, isDirectory: false },
      { path: "Show/S01E04.mp4", sizeBytes: 501, isDirectory: false },
      { path: "Show/S01E05.mp4", sizeBytes: 1000, isDirectory: false },
      { path: "Show/S01E06.mp4", sizeBytes: 1000, isDirectory: false },
    ];

    const processed = processArchiveEntries(entries);
    expect(
      processed.find((p) => p.filename === "Show/S01E04.mp4")?.needsReview,
    ).toBe(false);
  });

  it("flags duplicate episode number collisions and unparseable names", () => {
    const entries: ArchiveEntry[] = [
      {
        path: "Show/Episode 01 - 1080p.mp4",
        sizeBytes: 500_000_000,
        isDirectory: false,
      },
      {
        path: "Show/Episode 01 - 720p version.mp4",
        sizeBytes: 500_000_000,
        isDirectory: false,
      },
      {
        path: "Show/Special OVA.mp4",
        sizeBytes: 500_000_000,
        isDirectory: false,
      },
    ];

    const processed = processArchiveEntries(entries);
    expect(processed).toHaveLength(3);

    const ep1A = processed.find((p) => p.filename.includes("1080p"));
    const ep1B = processed.find((p) => p.filename.includes("720p"));
    const ova = processed.find((p) => p.filename.includes("Special OVA"));

    expect(ep1A?.detectedEpisodeNumber).toBe(1);
    expect(ep1A?.needsReview).toBe(true);
    expect(ep1B?.detectedEpisodeNumber).toBe(1);
    expect(ep1B?.needsReview).toBe(true);
    expect(ova?.detectedEpisodeNumber).toBeNull();
    expect(ova?.needsReview).toBe(true);
  });

  it("detects quality tags on processed entries", () => {
    const processed = processArchiveEntries([
      {
        path: "Show/S01E01 - 1080p.mp4",
        sizeBytes: 500_000_000,
        isDirectory: false,
      },
    ]);
    expect(processed[0]?.quality).toBe("1080p");
  });
});
