import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createMediaService } from "@/modules/media";
import { EpisodeParseError } from "@/modules/media/internal/episodes/parse";

const sampleAHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-a.html"),
  "utf8"
);
const sampleSeriesHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/series/sample-series-list.html"),
  "utf8"
);

describe("previewScrape unit service", () => {
  it("successfully previews episode and series data when animePageUrl is present", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: {
        get: async (url) => {
          if (
            url ===
            "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/"
          ) {
            return sampleSeriesHtml;
          }
          throw new Error(`Unexpected fetch URL: ${url}`);
        },
        post: async () => "",
      },
    });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/",
      source: "otakudesu",
      html: sampleAHtml,
    });

    expect(result.episode).toBeDefined();
    expect(result.episode.title).toBe(
      "Tsuihou sareta Tensei Juukishi wa Game Chishiki de Musou suru Episode 7 Subtitle Indonesia"
    );
    expect(result.episode.sourceUrl).toBe(
      "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/"
    );
    expect(result.episode.source).toBe("otakudesu");
    expect(result.episode.videoSources).toBeInstanceOf(Array);
    expect(result.episode.videoSources.length).toBeGreaterThan(0);
    expect(result.episode.videoSources[0]).toMatchObject({
      type: "embed",
      url: "https://odvidhide.com/embed/sylmpeaf3wzs",
      label: "Server Embed",
    });

    expect(result.series).not.toBeNull();
    expect(result.series?.sourceUrl).toBe(
      "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/"
    );
    expect(result.series?.title).toBe(
      "Tsuihou sareta Tensei Juukishi wa Game Chishiki de Musou suru"
    );
    expect(result.series?.posterUrl).toBe(
      "https://otakudesu.blog/wp-content/uploads/2026/07/Tsuihou-sareta-Tensei-Juukishi-wa-Game-Chishiki-de-Musou-suru.jpg"
    );

    expect(result.warnings).toEqual([]);
  });

  it("returns series as null with warning when series fetch throws an error", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: {
        get: async () => {
          throw new Error("Network error fetching series");
        },
        post: async () => "",
      },
    });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/",
      source: "otakudesu",
      html: sampleAHtml,
    });

    expect(result.episode).toBeDefined();
    expect(result.series).toBeNull();
    expect(result.warnings).toEqual(["Failed to fetch series details"]);
  });

  it("returns series as null with warning when fetched series HTML fails parsing", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: {
        get: async () => "<html><body><p>No series title</p></body></html>",
        post: async () => "",
      },
    });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/",
      source: "otakudesu",
      html: sampleAHtml,
    });

    expect(result.episode).toBeDefined();
    expect(result.series).toBeNull();
    expect(result.warnings).toEqual(["Failed to fetch series details"]);
  });

  it("returns series as null without warning when animePageUrl is not present in episode HTML", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: {
        get: async () => sampleSeriesHtml,
        post: async () => "",
      },
    });

    const htmlWithoutAnimePageUrl = sampleAHtml.replace(
      /class="prevnext".*?See All Episodes.*?<\/a>/s,
      ""
    );

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/test-no-series/",
      source: "otakudesu",
      html: htmlWithoutAnimePageUrl,
    });

    expect(result.episode).toBeDefined();
    expect(result.series).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it("throws EpisodeParseError when episode HTML is invalid", async () => {
    const service = createMediaService(null as never);

    await expect(
      service.previewScrape({
        sourceUrl: "https://otakudesu.blog/episode/invalid/",
        source: "otakudesu",
        html: "<html><body>Invalid</body></html>",
      })
    ).rejects.toThrow(EpisodeParseError);
  });
});
