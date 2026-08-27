import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import {
  parseAnimeTitlesFromHtml,
  scrapeOtakudesu,
  formatTitlesForSeedFile,
  sanitizeTitle,
} from "../../src/scrape-otakudesu";

vi.mock("node:fs");

describe("sanitizeTitle", () => {
  it("strips out Season and Part markers", () => {
    expect(sanitizeTitle("Anime Season 2 Part 3")).toBe("Anime");
    expect(sanitizeTitle("Anime Season 3")).toBe("Anime");
    expect(sanitizeTitle("Anime (TV)")).toBe("Anime");
    expect(sanitizeTitle("Anime  Season 5")).toBe("Anime");
  });
});

describe("parseAnimeTitlesFromHtml", () => {
  it("parses anime titles correctly from .detpost blocks", () => {
    const sampleHtml = `
      <div class="detpost">
        <h2 class="jdlflm">Shunkashuutou Daikousha: Haru no Mai</h2>
      </div>
      <div class="detpost">
        <h2 class="jdlflm">Yowayowa Sensei</h2>
      </div>
    `;
    const titles = parseAnimeTitlesFromHtml(sampleHtml);
    expect(titles).toEqual([
      "Shunkashuutou Daikousha: Haru no Mai",
      "Yowayowa Sensei",
    ]);
  });

  it("returns an empty array when no .detpost elements are present", () => {
    const html = `<div>No anime here</div>`;
    const titles = parseAnimeTitlesFromHtml(html);
    expect(titles).toEqual([]);
  });
});

describe("formatTitlesForSeedFile", () => {
  it("formats titles with # prefix and empty line underneath", () => {
    const titles = ["Anime One", "Anime Two"];
    const formatted = formatTitlesForSeedFile(titles);
    expect(formatted).toBe("# Anime One\n\n# Anime Two\n\n");
  });
});

describe("scrapeOtakudesu", () => {
  const logs: string[] = [];
  const mockLog = (msg: string) => logs.push(msg);

  beforeEach(() => {
    vi.clearAllMocks();
    logs.length = 0;
  });

  it("fetches pages sequentially, delays, and appends to output file", async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith("/1/")) {
        return Promise.resolve(`
          <div class="detpost">
            <h2 class="jdlflm">Anime Page 1</h2>
          </div>
        `);
      }
      if (url.endsWith("/2/")) {
        return Promise.resolve(`
          <div class="detpost">
            <h2 class="jdlflm">Anime Page 2</h2>
          </div>
        `);
      }
      return Promise.resolve("");
    });

    const mockSleep = vi.fn().mockResolvedValue(undefined);
    vi.mocked(fs.appendFileSync).mockReturnValue(undefined);

    const result = await scrapeOtakudesu({
      totalPages: 2,
      delayMs: 500,
      outputPath: "/tmp/tmdb-ids.txt",
      fetchFn: mockFetch,
      sleepFn: mockSleep,
      logFn: mockLog,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://otakudesu.blog/complete-anime/page/1/"
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://otakudesu.blog/complete-anime/page/2/"
    );

    expect(mockSleep).toHaveBeenCalledTimes(1);
    expect(mockSleep).toHaveBeenCalledWith(500);

    expect(fs.appendFileSync).toHaveBeenCalledWith(
      "/tmp/tmdb-ids.txt",
      "# Anime Page 1\n\n"
    );
    expect(fs.appendFileSync).toHaveBeenCalledWith(
      "/tmp/tmdb-ids.txt",
      "# Anime Page 2\n\n"
    );

    expect(result.totalScraped).toBe(2);
  });
});
