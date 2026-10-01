import { describe, expect, it } from "vitest";
import {
  VIDEO_EXTENSIONS,
  detectEpisodeNumber,
  detectQuality,
  filterStagedVideoFiles,
  isSampleFile,
  isVideoFile,
  matchArchiveFilesToEpisodes,
} from "../../../src/modules/episodes";

describe("archive-matcher video filtering", () => {
  it("keeps only supported video extensions", () => {
    for (const ext of VIDEO_EXTENSIONS) {
      expect(isVideoFile(`episode-01${ext}`)).toBe(true);
      expect(isVideoFile(`episode-01${ext.toUpperCase()}`)).toBe(true);
    }
    for (const name of ["notes.txt", "cover.png", "info.nfo", "subs.srt", "readme.md", "video.mp5"]) {
      expect(isVideoFile(name)).toBe(false);
    }
  });

  it("detects sample clips", () => {
    expect(isSampleFile("Show.S01E01.sample.mkv")).toBe(true);
    expect(isSampleFile("sample.mp4")).toBe(true);
    expect(isSampleFile("[Group] Show - 01 [1080p].mkv")).toBe(false);
  });

  it("filters out non-video files and samples", () => {
    const files = [
      { fileId: "1", filename: "Show.S01E01.1080p.mkv", fileSizeBytes: 100 },
      { fileId: "2", filename: "info.nfo", fileSizeBytes: 10 },
      { fileId: "3", filename: "cover.png", fileSizeBytes: 10 },
      { fileId: "4", filename: "subs.srt", fileSizeBytes: 10 },
      { fileId: "5", filename: "Show.S01E01.sample.mkv", fileSizeBytes: 20 },
    ];
    const kept = filterStagedVideoFiles(files);
    expect(kept.map((f) => f.fileId)).toEqual(["1"]);
  });
});

describe("archive-matcher episode detection", () => {
  it.each([
    ["Show.S01E02.1080p.mkv", 2],
    ["show_s1e12_web.mp4", 12],
    ["[Fansub] Show - EP 07 [1080p].mkv", 7],
    ["Show Episode 3 720p.mp4", 3],
    ["Show E04.mkv", 4],
    ["[Group] Show - 02 [1080p].mkv", 2],
    ["show_ep11.mkv", 11],
  ])("detects episode number from %s", (filename, expected) => {
    expect(detectEpisodeNumber(filename)).toBe(expected);
  });

  it("does not mistake quality tokens or years for episode numbers", () => {
    expect(detectEpisodeNumber("Show.1080p.BluRay.mkv")).toBeNull();
    expect(detectEpisodeNumber("Show.2024.720p.mkv")).toBeNull();
    expect(detectEpisodeNumber("Volume 3 Collection.mp4")).toBeNull();
  });
});

describe("archive-matcher quality detection", () => {
  it.each([
    ["Show.S01E02.1080p.mkv", "1080p"],
    ["Show E04 720P.mp4", "720p"],
    ["Show - 02 [4K].mkv", "2160p"],
    ["Show.S01E01.UHD.WEB-DL.mkv", "2160p"],
    ["Show.EP01.DVD.mp4", null],
  ])("detects quality from %s", (filename, expected) => {
    expect(detectQuality(filename)).toBe(expected);
  });
});

describe("archive-matcher episode mapping", () => {
  const episodes = [
    { id: "ep-1", order: 1 },
    { id: "ep-2", order: 2 },
    { id: "ep-3", order: 3 },
  ];

  it("maps detected numbers to episodes without review flags", () => {
    const items = matchArchiveFilesToEpisodes(
      [
        { fileId: "f1", filename: "Show.S01E01.1080p.mkv", fileSizeBytes: 100 },
        { fileId: "f2", filename: "Show.S01E02.1080p.mkv", fileSizeBytes: 200 },
      ],
      episodes
    );
    expect(items[0]).toMatchObject({
      detectedEpisodeNumber: 1,
      matchedEpisodeId: "ep-1",
      quality: "1080p",
      needsReview: false,
    });
    expect(items[1]).toMatchObject({ matchedEpisodeId: "ep-2", needsReview: false });
  });

  it("flags unmapped or unknown files as needing review", () => {
    const items = matchArchiveFilesToEpisodes(
      [
        { fileId: "f1", filename: "Show.S01E99.1080p.mkv", fileSizeBytes: 100 },
        { fileId: "f2", filename: "random-clip.mkv", fileSizeBytes: 100 },
      ],
      episodes
    );
    expect(items[0]).toMatchObject({
      detectedEpisodeNumber: 99,
      matchedEpisodeId: null,
      needsReview: true,
    });
    expect(items[1]).toMatchObject({
      detectedEpisodeNumber: null,
      matchedEpisodeId: null,
      needsReview: true,
    });
  });

  it("flags duplicate mappings to the same episode as needing review", () => {
    const items = matchArchiveFilesToEpisodes(
      [
        { fileId: "f1", filename: "Show.S01E01.1080p.mkv", fileSizeBytes: 100 },
        { fileId: "f2", filename: "Show.S01E01.720p.mkv", fileSizeBytes: 80 },
      ],
      episodes
    );
    expect(items[0]?.needsReview).toBe(true);
    expect(items[1]?.needsReview).toBe(true);
  });
});
