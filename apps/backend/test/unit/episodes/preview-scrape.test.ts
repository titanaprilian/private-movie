import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createMediaService, EpisodeFetchError, type FetchFn } from "@/modules/media";
import { EpisodeParseError } from "@/modules/media/internal/episodes/parse";
import { MirrorResolveError } from "@/modules/media/internal/episodes/resolve";

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

const NONCE_ACTION = "aa1208d27f29ca340c92c66d1926f13f";
const MIRROR_ACTION = "2a3505c93b0035d3f455df82bf976b84";
const sampleBAnimePageUrl =
  "https://otakudesu.blog/anime/katainaka-ossan-kensei-naru-s2-sub-indo/";

function buildMirrorFetchFn(options?: {
  failNonce?: boolean;
  failMirrorIndexes?: number[];
}): FetchFn {
  const failMirrorIndexes = options?.failMirrorIndexes ?? [];
  return {
    async get(url) {
      if (url === sampleBAnimePageUrl) {
        return sampleSeriesHtml;
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    },
    async post(_url, body) {
      const params = new URLSearchParams(body);
      const action = params.get("action") ?? "";
      if (action === NONCE_ACTION) {
        if (options?.failNonce) {
          throw new Error("nonce fetch failed");
        }
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

describe("previewScrape mirror resolution", () => {
  it("resolves all 720p mirrors and returns them as embed video sources", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: buildMirrorFetchFn(),
    });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/knoknn-s2-episode-6-sub-indo/",
      source: "otakudesu",
      html: sampleBHtml,
    });

    expect(result.episode.videoSources).toHaveLength(5);
    expect(result.episode.videoSources).toEqual([
      {
        type: "embed",
        url: "https://player.example.com/embed/mirror-0",
        label: "ondesu2hd",
        quality: "720p",
      },
      {
        type: "embed",
        url: "https://player.example.com/embed/mirror-1",
        label: "odstream",
        quality: "720p",
      },
      {
        type: "embed",
        url: "https://player.example.com/embed/mirror-2",
        label: "filedon",
        quality: "720p",
      },
      {
        type: "embed",
        url: "https://player.example.com/embed/mirror-3",
        label: "vidhide",
        quality: "720p",
      },
      {
        type: "embed",
        url: "https://player.example.com/embed/mirror-4",
        label: "mega",
        quality: "720p",
      },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("skips failed mirrors and returns the successfully resolved ones", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: buildMirrorFetchFn({ failMirrorIndexes: [2] }),
    });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/knoknn-s2-episode-6-sub-indo/",
      source: "otakudesu",
      html: sampleBHtml,
    });

    expect(result.episode.videoSources).toHaveLength(4);
    expect(result.episode.videoSources.map((vs) => vs.label)).toEqual([
      "ondesu2hd",
      "odstream",
      "vidhide",
      "mega",
    ]);
    expect(
      result.episode.videoSources.every((vs) => vs.quality === "720p")
    ).toBe(true);
  });

  it("throws MirrorResolveError when all mirrors fail to resolve", async () => {
    const service = createMediaService(null as never, {
      fetchHtml: buildMirrorFetchFn({ failMirrorIndexes: [0, 1, 2, 3, 4] }),
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
      fetchHtml: buildMirrorFetchFn({ failNonce: true }),
    });

    await expect(
      service.previewScrape({
        sourceUrl: "https://otakudesu.blog/episode/knoknn-s2-episode-6-sub-indo/",
        source: "otakudesu",
        html: sampleBHtml,
      })
    ).rejects.toThrow(/failed to fetch nonce/i);
  });

  it("falls back to the default embed source with a warning when AJAX actions are missing", async () => {
    const htmlWithoutActions = sampleBHtml.replace(
      /<script>\s*window\.__x__nonce=null[\s\S]*?<\/script>/,
      ""
    );
    const service = createMediaService(null as never, {
      fetchHtml: buildMirrorFetchFn(),
    });

    const result = await service.previewScrape({
      sourceUrl: "https://otakudesu.blog/episode/knoknn-s2-episode-6-sub-indo/",
      source: "otakudesu",
      html: htmlWithoutActions,
    });

    expect(result.episode.videoSources).toEqual([
      {
        type: "embed",
        url: "https://desustream.net/dstream/arcg/?id=aHR0cHM6Ly9kZXN1c3RyZWFtLm5ldC9zdHJlYW0vc2FtcGxlLTYubXA0",
        label: "Server Embed",
      },
    ]);
    expect(result.warnings).toEqual([
      "Failed to extract AJAX actions; mirror resolution skipped",
    ]);
  });
});
