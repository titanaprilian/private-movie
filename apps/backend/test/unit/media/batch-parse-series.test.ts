import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  OtakudesuProvider,
  SeriesParseError,
} from "@repo/media-scraper";

const sampleOneSeasonHtml = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../fixtures/episodes/sample-one-season.html"),
  "utf8"
);

const provider = new OtakudesuProvider();

describe("parseSeriesPage - batch scraping", () => {
  it("extracts an episodes array with title, url, and date from sample-one-season.html using .episodelist ul li span a selectors", () => {
    const result = provider.parseSeriesHtml(sampleOneSeasonHtml);

    expect(result.title).toBe("Grand Blue Season 3 Subtitle Indonesia");
    expect(result.posterUrl).toBeDefined();
    expect(result.episodes).toBeDefined();
    expect(Array.isArray(result.episodes)).toBe(true);
    expect(result.episodes.length).toBe(7);

    // First episode (newest): Episode 7
    const firstEpisode = result.episodes[0];
    expect(firstEpisode.title).toBe("Grand Blue Season 3 Episode 7 Subtitle Indonesia");
    expect(firstEpisode.url).toBe("https://otakudesu.blog/episode/gb-s3-episode-7-sub-indo/");
    expect(firstEpisode.date).toBe("18 Agustus,2026");

    // Last episode (oldest): Episode 1
    const lastEpisode = result.episodes[6];
    expect(lastEpisode.title).toBe("Grand Blue Season 3 Episode 1 Subtitle Indonesia");
    expect(lastEpisode.url).toBe("https://otakudesu.blog/episode/gb-s3-episode-1-sub-indo/");
    expect(lastEpisode.date).toBe("7 Juli,2026");
  });

  it("returns episodes with correct order (newest first) matching the episode list in sample-one-season.html", () => {
    const result = provider.parseSeriesHtml(sampleOneSeasonHtml);

    expect(result.episodes).toBeDefined();
    expect(Array.isArray(result.episodes)).toBe(true);

    // Episodes should be in reverse chronological order as they appear in the DOM
    expect(result.episodes.length).toBe(7);
    
    // Verify each episode URL matches expected pattern and order
    const expectedUrls = [
      "gb-s3-episode-7-sub-indo",
      "gb-s3-episode-6-sub-indo",
      "gb-s3-episode-5-sub-indo",
      "gb-s3-episode-4-sub-indo",
      "gb-s3-episode-3-sub-indo",
      "gb-s3-episode-2-sub-indo",
      "gb-s3-episode-1-sub-indo",
    ];

    for (let i = 0; i < expectedUrls.length; i++) {
      expect(result.episodes[i].url).toContain(expectedUrls[i]);
    }
  });
});
