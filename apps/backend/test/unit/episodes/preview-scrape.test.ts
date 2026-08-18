import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createMediaService, EpisodeFetchError, type FetchFn } from "@repo/media-service";
import { EpisodeParseError, MirrorResolveError, extractDirectVideoSources } from "@repo/media-scraper";

const sampleAHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-a.html"),
  "utf8"
);
const sampleBHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-b.html"),
  "utf8"
);
const sampleSeriesHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/series/sample-series-list.html"),
  "utf8"
);
const sampleDirectVideoHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-direct-video.html"),
  "utf8"
);
const sampleMp4VideoHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-mp4-video.html"),
  "utf8"
);

const NONCE_ACTION = "aa1208d27f29ca340c92c66d1926f13f";
const MIRROR_ACTION = "2a3505c93b0035d3f455df82bf976b84";
const SAMPLE_B_ANIME_URL =
  "https://otakudesu.blog/anime/katainaka-ossan-kensei-naru-s2-sub-indo/";
const DESUSTREAM_IFRAME_BASE = "https://desustream.net/dstream/arcg/?id=";
const ODVIDHIDE_EMBED_BASE = "https://odvidhide.com/embed/";

function buildMockFetchFn(options: {
  failNonce?: boolean;
  failMirrorIndexes?: number[];
}): FetchFn {
  const failMirrorIndexes = options?.failMirrorIndexes ?? [];
  return {
    async get(url) {
      if (url === SAMPLE_B_ANIME_URL) {
        return sampleSeriesHtml;
      }
      // sample-b desustream iframe
      if (url.startsWith(DESUSTREAM_IFRAME_BASE)) {
        return sampleDirectVideoHtml;
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    },
    async post(_url, body) {
      const params = new URLSearchParams(body);
      const action = params.get("action") ?? "";
      if (options.failNonce && action === NONCE_ACTION) {
        throw new Error("nonce fetch failed");
      }
      if (action === NONCE_ACTION) {
        return JSON.stringify({ data: "fake-nonce-123" });
      }
      if (action === MIRROR_ACTION) {
        const i = parseInt(params.get("i") ?? "-1", 10);
        if (failMirrorIndexes.includes(i)) {
          throw new Error(`mirror request failed for index ${i}`);
        }
        const html = `<div id="pembed"><iframe src="https://player.example.com/embed/mirror-${i}" frameborder="0"></iframe></div>`;
        return JSON.stringify({ data: Buffer.from(html).toString("base64") });
      }
      throw new Error(`unknown action: ${action}`);
    },
  };
}

describe("previewScrape unit service", () => {
  it("fetches episode HTML automatically when html is omitted", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: {
        get: async (url) => {
          if (
            url ===
            "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/"
          ) {
            return sampleAHtml;
          }
          if (
            url === "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/"
          ) {
            return sampleSeriesHtml;
          }
          if (url.startsWith(ODVIDHIDE_EMBED_BASE)) {
            // direct video has mp4 source
            return sampleDirectVideoHtml;
          }
          throw new Error(`Unexpected fetch URL: ${url}`);
        },
        post: async () => "",
      },
    });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/",
      source: "otakudesu",
    });

    expect(result.episode).toBeDefined();
    expect(result.episode.title).toBe(
      "Tsuihou sareta Tensei Juukishi wa Game Chishiki de Musou suru Episode 7 Subtitle Indonesia"
    );
  });

  it("throws EpisodeFetchError when fetching episode HTML fails", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: {
        get: async () => {
          throw new Error("Network error fetching episode");
        },
        post: async () => "",
      },
    });

    await expect(
      service.previewScrape({
        sourceUrl: "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/",
        source: "otakudesu",
      })
    ).rejects.toThrow(EpisodeFetchError);
  });

  it("successfully previews episode and series data when animePageUrl is present", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: {
        get: async (url) => {
          if (
            url === "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/"
          ) {
            return sampleSeriesHtml;
          }
          if (url.startsWith(ODVIDHIDE_EMBED_BASE)) {
            return sampleDirectVideoHtml;
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

  it("returns series as null with warning when series fetch throws an error but still has embed sources", async () => {
    const mockFetch: FetchFn = {
      get: async (url) => {
        if (url.startsWith(ODVIDHIDE_EMBED_BASE)) {
          return sampleDirectVideoHtml;
        }
        throw new Error("Network error fetching series");
      },
      post: async () => "",
    };
    const service = createMediaService(null as never, { fetchHtml: mockFetch });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/",
      source: "otakudesu",
      html: sampleAHtml,
    });

    expect(result.episode).toBeDefined();
    expect(result.series).toBeNull();
    expect(result.warnings).toContain("Failed to fetch series details");
  });

  it("returns series as null with warning when fetched series HTML fails parsing", async () => {
    const mockFetch: FetchFn = {
      get: async (url) => {
        if (url.startsWith(ODVIDHIDE_EMBED_BASE)) {
          return sampleDirectVideoHtml;
        }
        throw new Error("Network error fetching series");
      },
      post: async () => "",
    };
    const service = createMediaService(null as never, { fetchHtml: mockFetch });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/",
      source: "otakudesu",
      html: sampleAHtml,
    });

    expect(result.episode).toBeDefined();
    expect(result.series).toBeNull();
    expect(result.warnings).toContain("Failed to fetch series details");
  });

  it("returns series as null without warning when animePageUrl is not present in episode HTML", async () => {
    const mockFetch: FetchFn = {
      get: async (url) => {
        if (url.startsWith(ODVIDHIDE_EMBED_BASE)) {
          return sampleDirectVideoHtml;
        }
        return sampleSeriesHtml;
      },
      post: async () => "",
    };
    const service = createMediaService(null as never, { fetchHtml: mockFetch });

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

describe("previewScrape mirror resolution", () => {
  it("resolves all 720p mirrors and returns them as embed video sources", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: buildMockFetchFn({}),
    });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/knoknn-s2-episode-6-sub-indo/",
      source: "otakudesu",
      html: sampleBHtml,
    });

    expect(result.episode.videoSources).toHaveLength(6);
    expect(result.episode.videoSources.map((vs) => vs.type)).toEqual([
      "embed", "embed", "embed", "embed", "embed", "direct"
    ]);
    expect(result.episode.videoSources.find((vs) => vs.type === "direct")).toEqual({
      type: "direct",
      url: "https://archive.org/download/a-menyadari-bahwdaw/Otakudesu.io_MST.S3--02_720p.mp4",
      label: "Otakudesu.io_MST.S3--02_720p",
      quality: "720p",
    });
    expect(result.warnings).toEqual([]);
  });

  it("skips failed mirrors and returns the successfully resolved ones plus direct sources", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: buildMockFetchFn({ failMirrorIndexes: [2] }),
    });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/knoknn-s2-episode-6-sub-indo/",
      source: "otakudesu",
      html: sampleBHtml,
    });

    expect(result.episode.videoSources.map((vs) => vs.label)).toContain(
      "Otakudesu.io_MST.S3--02_720p"
    );
    expect(
      result.episode.videoSources.some((vs) => vs.type === "direct")
    ).toBe(true);
  });

  it("throws MirrorResolveError when all mirrors fail to resolve", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: buildMockFetchFn({ failMirrorIndexes: [0, 1, 2, 3, 4] }),
    });

    await expect(
      service.previewScrape({
        sourceUrl: "https://otakudesu.blog/episode/knoknn-s2-episode-6-sub-indo/",
        source: "otakudesu",
        html: sampleBHtml,
      })
    ).rejects.toThrow(MirrorResolveError);
  });

  it("throws MirrorResolveError when the nonce fetch fails", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: buildMockFetchFn({ failNonce: true }),
    });

    await expect(
      service.previewScrape({
        sourceUrl: "https://otakudesu.blog/episode/knoknn-s2-episode-6-sub-indo/",
        source: "otakudesu",
        html: sampleBHtml,
      })
    ).rejects.toThrow(/failed to fetch nonce/i);
  });

  it("falls back to the default embed source with a warning when AJAX actions are missing (direct sources still merged)", async () => {
    const htmlWithoutActions = sampleBHtml.replace(
      /<script>\s*window\.__x__nonce=null[\s\S]*?<\/script>/,
      ""
    );
    const service = createMediaService(null as never, {
      fetchHtml: buildMockFetchFn({}),
    });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/knoknn-s2-episode-6-sub-indo/",
      source: "otakudesu",
      html: htmlWithoutActions,
    });

    const directSrc = result.episode.videoSources.find((vs) => vs.type === "direct");
    expect(directSrc).toEqual({
      type: "direct",
      url: "https://archive.org/download/a-menyadari-bahwdaw/Otakudesu.io_MST.S3--02_720p.mp4",
      label: "Otakudesu.io_MST.S3--02_720p",
      quality: "720p",
    });
    expect(result.warnings).toContain(
      "Failed to extract AJAX actions; mirror resolution skipped"
    );
  });
});

describe("previewScrape direct video extraction", () => {
  const ANIME_URL = "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/";

  function buildDirectVideoFetchFn(options?: { failIframe?: boolean; failSeries?: boolean }): FetchFn {
    const ANIME_URL = "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/";
    return {
      get: async (url) => {
        if (url === ANIME_URL) {
          if (options?.failSeries) {
            throw new Error("Failed to fetch series");
          }
          return sampleSeriesHtml;
        }
        if (url.startsWith(ODVIDHIDE_EMBED_BASE)) {
          if (options?.failIframe) {
            throw new Error("Failed to connect to odvidhide.com");
          }
          return sampleDirectVideoHtml;
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      },
      post: async () => "",
    };
  }

  it("returns both embed and direct video sources when iframe fetch succeeds", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: buildDirectVideoFetchFn({}),
    });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/test-direct-source/",
      source: "otakudesu",
      html: sampleAHtml,
    });

    const embedSources = result.episode.videoSources.filter((vs) => vs.type === "embed");
    const directSources = result.episode.videoSources.filter((vs) => vs.type === "direct");

    expect(embedSources).toHaveLength(1);
    expect(embedSources[0]).toEqual({
      type: "embed",
      url: "https://odvidhide.com/embed/sylmpeaf3wzs",
      label: "Server Embed",
    });

    expect(directSources).toHaveLength(1);
    expect(directSources[0]).toEqual({
      type: "direct",
      url: "https://archive.org/download/a-menyadari-bahwdaw/Otakudesu.io_MST.S3--02_720p.mp4",
      label: "Otakudesu.io_MST.S3--02_720p",
      quality: "720p",
    });

    expect(result.warnings).toEqual([]);
  });

  it("falls back on iframe fetch failure with embed/mirror sources still returned", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: buildDirectVideoFetchFn({ failIframe: true }),
    });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/test-fallback/",
      source: "otakudesu",
      html: sampleAHtml,
    });

    expect(result.episode.videoSources).toHaveLength(1);
    expect(result.episode.videoSources[0]).toMatchObject({
      type: "embed",
      url: "https://odvidhide.com/embed/sylmpeaf3wzs",
    });
    // no warning since sample-a has no mirrors to fall back to
    expect(result.warnings).toEqual([]);
    expect(result.episode.videoSources.filter((vs) => vs.type === "direct")).toHaveLength(0);
  });

  it("handles no-video HTML gracefully (no direct sources added, no warning)", async () => {
    const noVideoHtml = "<html><body><p>player loaded</p></body></html>";

    const service = createMediaService(null as never, {
      fetchHtml: {
        get: async (url) => {
          if (url === "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/") {
            return sampleSeriesHtml;
          }
          if (url.startsWith(ODVIDHIDE_EMBED_BASE)) {
            return noVideoHtml;
          }
          throw new Error(`Unexpected fetch URL: ${url}`);
        },
        post: async () => "",
      },
    });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/test-no-video/",
      source: "otakudesu",
      html: sampleAHtml,
    });

    const directSources = result.episode.videoSources.filter((vs) => vs.type === "direct");
    expect(directSources).toHaveLength(0);
    expect(result.warnings).toEqual([]);

    // embed source should still be present
    expect(result.episode.videoSources).toContainEqual(
      expect.objectContaining({ type: "embed" })
    );
  });
});
