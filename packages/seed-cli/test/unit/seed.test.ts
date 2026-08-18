import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runSeed } from "../../src/index";
import { MediaScraper } from "@repo/media-scraper";

vi.mock("node:fs");

describe("runSeed", () => {
  const mockDb = {} as any;
  const mockFindBySourceUrl = vi.fn();
  const mockSaveMedia = vi.fn();
  const logs: string[] = [];
  const mockLog = (msg: string) => logs.push(msg);

  beforeEach(() => {
    vi.clearAllMocks();
    logs.length = 0;
  });

  it("throws error if JSON file does not exist", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await expect(
      runSeed({
        jsonPath: "/tmp/nonexistent.json",
        db: mockDb,
        logFn: mockLog,
      })
    ).rejects.toThrow("Seed JSON file not found at /tmp/nonexistent.json");
  });

  it("skips invalid entry with no URL", async () => {
    const jsonContent = JSON.stringify([{ title: "Invalid Entry" }]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(jsonContent);

    await runSeed({
      jsonPath: "/tmp/sample.json",
      db: mockDb,
      logFn: mockLog,
      deps: {
        seriesRepository: { findBySourceUrl: mockFindBySourceUrl },
        mediaService: { saveMedia: mockSaveMedia },
      },
    });

    expect(mockFindBySourceUrl).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes("Skipping invalid entry with no URL"))).toBe(true);
  });

  it("skips series if it already exists in the database", async () => {
    const jsonContent = JSON.stringify([
      { title: "Existing Anime", url: "https://otakudesu.blog/anime/existing-anime" },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(jsonContent);

    mockFindBySourceUrl.mockResolvedValue({ id: "series-1", title: "Existing Anime" });

    await runSeed({
      jsonPath: "/tmp/sample.json",
      db: mockDb,
      logFn: mockLog,
      deps: {
        seriesRepository: { findBySourceUrl: mockFindBySourceUrl },
        mediaService: { saveMedia: mockSaveMedia },
      },
    });

    expect(mockFindBySourceUrl).toHaveBeenCalledWith(
      "https://otakudesu.blog/anime/existing-anime"
    );
    expect(mockSaveMedia).not.toHaveBeenCalled();
    expect(logs.some((l) => l.includes("Series already exists in DB"))).toBe(true);
  });

  it("handles series parse error gracefully", async () => {
    const jsonContent = JSON.stringify([
      { title: "Failing Anime", url: "https://otakudesu.blog/anime/failing-anime" },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(jsonContent);

    mockFindBySourceUrl.mockResolvedValue(null);

    const mockProvider = {
      canHandle: () => true,
      parseSeries: vi.fn().mockRejectedValue(new Error("Parse network timeout")),
    };
    vi.spyOn(MediaScraper, "getProviderForUrl").mockReturnValue(mockProvider as any);

    await runSeed({
      jsonPath: "/tmp/sample.json",
      db: mockDb,
      logFn: mockLog,
      deps: {
        seriesRepository: { findBySourceUrl: mockFindBySourceUrl },
        mediaService: { saveMedia: mockSaveMedia },
      },
    });

    expect(logs.some((l) => l.includes("Error processing series"))).toBe(true);
  });

  it("parses series, parses episodes, and calls saveMedia for new series", async () => {
    const jsonContent = JSON.stringify([
      { title: "New Anime", url: "https://otakudesu.blog/anime/new-anime" },
    ]);
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(jsonContent);

    mockFindBySourceUrl.mockResolvedValue(null);

    const mockParseSeries = vi.fn().mockResolvedValue({
      title: "New Anime",
      description: "A great series",
      posterUrl: "https://example.com/poster.jpg",
      episodes: [{ title: "Episode 1", url: "https://otakudesu.blog/episode/ep-1" }],
    });

    const mockParseEpisode = vi.fn().mockResolvedValue({
      title: "New Anime Episode 1",
      videoType: "TV",
      videoSources: [{ type: "embed", url: "https://embed.com/1", label: "DesuStream" }],
    });

    const mockProvider = {
      canHandle: () => true,
      parseSeries: mockParseSeries,
      parseEpisode: mockParseEpisode,
    };

    vi.spyOn(MediaScraper, "getProviderForUrl").mockReturnValue(mockProvider as any);
    mockSaveMedia.mockResolvedValue({ episode: { id: "ep-1" }, series: { id: "series-1" } });

    await runSeed({
      jsonPath: "/tmp/sample.json",
      db: mockDb,
      logFn: mockLog,
      deps: {
        seriesRepository: { findBySourceUrl: mockFindBySourceUrl },
        mediaService: { saveMedia: mockSaveMedia },
      },
    });

    expect(mockFindBySourceUrl).toHaveBeenCalledWith(
      "https://otakudesu.blog/anime/new-anime"
    );
    expect(mockParseSeries).toHaveBeenCalledWith(
      "https://otakudesu.blog/anime/new-anime",
      expect.anything()
    );
    expect(mockParseEpisode).toHaveBeenCalledWith(
      "https://otakudesu.blog/episode/ep-1",
      expect.anything()
    );
    expect(mockSaveMedia).toHaveBeenCalledWith({
      series: {
        sourceUrl: "https://otakudesu.blog/anime/new-anime",
        source: "otakudesu",
        title: "New Anime",
        description: "A great series",
        posterUrl: "https://example.com/poster.jpg",
      },
      episode: {
        sourceUrl: "https://otakudesu.blog/episode/ep-1",
        source: "otakudesu",
        title: "New Anime Episode 1",
        videoType: "TV",
        videoSources: [
          { type: "embed", url: "https://embed.com/1", label: "DesuStream", quality: null },
        ],
        metadata: {},
      },
    });
  });
});
