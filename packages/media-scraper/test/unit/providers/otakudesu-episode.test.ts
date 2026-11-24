import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MirrorResolveError,
  OtakudesuProvider,
  type FetchFn,
} from "../../../src";

const sampleAHtml = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../fixtures/episodes/sample-a.html"),
  "utf8",
);
const sampleBHtml = fs.readFileSync(
  path.resolve(import.meta.dirname, "../../fixtures/episodes/sample-b.html"),
  "utf8",
);
const sampleDirectVideoHtml = fs.readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../fixtures/episodes/sample-direct-video.html",
  ),
  "utf8",
);

const NONCE_ACTION = "aa1208d27f29ca340c92c66d1926f13f";
const MIRROR_ACTION = "2a3505c93b0035d3f455df82bf976b84";
const DESUSTREAM_IFRAME_BASE = "https://desustream.net/dstream/arcg/?id=";
const ODVIDHIDE_EMBED_BASE = "https://odvidhide.com/embed/";

function buildMockFetchFn(options?: {
  failNonce?: boolean;
  failMirrorIndexes?: number[];
}): FetchFn {
  const failMirrorIndexes = options?.failMirrorIndexes ?? [];
  return {
    async get(url) {
      if (url === "https://otakudesu.blog/episode/sample-a") {
        return sampleAHtml;
      }
      if (url === "https://otakudesu.blog/episode/sample-b") {
        return sampleBHtml;
      }
      if (
        url.startsWith(DESUSTREAM_IFRAME_BASE) ||
        url.startsWith(ODVIDHIDE_EMBED_BASE)
      ) {
        return sampleDirectVideoHtml;
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    },
    async post(_url, body) {
      const params = new URLSearchParams(body);
      const action = params.get("action") ?? "";
      if (options?.failNonce && action === NONCE_ACTION) {
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
        const html = `<div id="pembed"><iframe src="https://desustream.net/dstream/arcg/?id=mirror-${i}" frameborder="0"></iframe></div>`;
        return JSON.stringify({ data: Buffer.from(html).toString("base64") });
      }
      throw new Error(`unknown action: ${action}`);
    },
  };
}

describe("OtakudesuProvider episode operations", () => {
  const provider = new OtakudesuProvider();

  describe("parseEpisode", () => {
    it("parses episode details via fetchFn.get", async () => {
      const fetchFn = buildMockFetchFn();
      const episode = await provider.parseEpisode(
        "https://otakudesu.blog/episode/sample-a",
        fetchFn,
      );

      expect(episode.title).toBe(
        "Tsuihou sareta Tensei Juukishi wa Game Chishiki de Musou suru Episode 7 Subtitle Indonesia",
      );
      expect(episode.videoSources).toEqual([
        {
          type: "embed",
          url: "https://odvidhide.com/embed/sylmpeaf3wzs",
          label: "Server Embed",
        },
      ]);
      expect(episode.episodes).toHaveLength(7);
      expect(episode.episodes?.[0]).toEqual({
        title: "Episode 7",
        url: "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/",
      });
    });

    it("parses full episode layout with download links and providerData", async () => {
      const fetchFn = buildMockFetchFn();
      const episode = await provider.parseEpisode(
        "https://otakudesu.blog/episode/sample-b",
        fetchFn,
      );

      expect(episode.title).toBe(
        "Katainaka no Ossan, Kensei ni Naru Season 2 Episode 6 Subtitle Indonesia",
      );
      expect(episode.videoType).toBe("TV");
      expect(episode.genres).toEqual(["Action", "Fantasy"]);
      expect(episode.downloadLinks).toHaveLength(6);
      expect(episode.providerData).toBeDefined();
      expect(episode.providerData?.mirrorPayloads as unknown[]).toHaveLength(5);
    });
  });

  describe("resolveVideoSources", () => {
    it("resolves all mirrors and extracts direct video sources", async () => {
      const fetchFn = buildMockFetchFn();
      const sources = await provider.resolveVideoSources(
        "https://otakudesu.blog/episode/sample-b",
        fetchFn,
      );

      expect(sources.filter((s) => s.type === "embed")).toHaveLength(5);
      expect(sources.some((s) => s.type === "direct")).toBe(true);
      expect(sources.find((s) => s.type === "direct")).toEqual({
        type: "direct",
        url: "https://archive.org/download/a-menyadari-bahwdaw/Otakudesu.io_MST.S3--02_720p.mp4",
        label: "Otakudesu.io_MST.S3--02_720p",
        quality: "720p",
      });
    });

    it("uses provided context containing mirrorPayloads and ajaxActions", async () => {
      const fetchFn = buildMockFetchFn();
      const episode = provider.parseEpisodeHtml(sampleBHtml);
      const sources = await provider.resolveVideoSources(
        "https://otakudesu.blog/episode/sample-b",
        fetchFn,
        episode.providerData,
      );

      expect(sources.filter((s) => s.type === "embed")).toHaveLength(5);
      expect(sources.some((s) => s.type === "direct")).toBe(true);
    });

    it("skips failed mirrors and returns successfully resolved ones plus direct sources", async () => {
      const fetchFn = buildMockFetchFn({ failMirrorIndexes: [2] });
      const sources = await provider.resolveVideoSources(
        "https://otakudesu.blog/episode/sample-b",
        fetchFn,
      );

      expect(sources.filter((s) => s.type === "embed")).toHaveLength(4);
      expect(sources.some((s) => s.type === "direct")).toBe(true);
    });

    it("throws MirrorResolveError when all mirrors fail", async () => {
      const fetchFn = buildMockFetchFn({ failMirrorIndexes: [0, 1, 2, 3, 4] });
      await expect(
        provider.resolveVideoSources(
          "https://otakudesu.blog/episode/sample-b",
          fetchFn,
        ),
      ).rejects.toThrow(MirrorResolveError);
    });

    it("throws MirrorResolveError when nonce fetch fails", async () => {
      const fetchFn = buildMockFetchFn({ failNonce: true });
      await expect(
        provider.resolveVideoSources(
          "https://otakudesu.blog/episode/sample-b",
          fetchFn,
        ),
      ).rejects.toThrow(/failed to fetch nonce/i);
    });

    it("passes Referer and User-Agent headers when fetching iframe HTML", async () => {
      const getCalls: Array<{ url: string; options?: any }> = [];
      const trackingFetch: FetchFn = {
        async get(url, options) {
          getCalls.push({ url, options });
          if (url === "https://otakudesu.blog/episode/sample-b") {
            return sampleBHtml;
          }
          if (url.startsWith(DESUSTREAM_IFRAME_BASE)) {
            return sampleDirectVideoHtml;
          }
          throw new Error(`Unexpected url: ${url}`);
        },
        async post(_url, body) {
          const params = new URLSearchParams(body);
          const action = params.get("action") ?? "";
          if (action === NONCE_ACTION) {
            return JSON.stringify({ data: "fake-nonce" });
          }
          if (action === MIRROR_ACTION) {
            const html = `<div id="pembed"><iframe src="${DESUSTREAM_IFRAME_BASE}123" frameborder="0"></iframe></div>`;
            return JSON.stringify({
              data: Buffer.from(html).toString("base64"),
            });
          }
          throw new Error(`unknown action: ${action}`);
        },
      };

      await provider.resolveVideoSources(
        "https://otakudesu.blog/episode/sample-b",
        trackingFetch,
      );

      const iframeCall = getCalls.find((call) =>
        call.url.startsWith(DESUSTREAM_IFRAME_BASE),
      );
      expect(iframeCall).toBeDefined();
      const headers = iframeCall?.options?.headers ?? iframeCall?.options;
      expect(headers).toBeDefined();
      expect(headers.Referer).toBe("https://otakudesu.blog/episode/sample-b");
      expect(headers["User-Agent"]).toContain("Mozilla/5.0");
    });

    it("extracts direct video sources statically from ODCloud iframe HTML", async () => {
      const odcloudHtml = fs.readFileSync(
        path.resolve(
          import.meta.dirname,
          "../../fixtures/episodes/sample-odcloud.html",
        ),
        "utf8",
      );
      const customFetch: FetchFn = {
        async get(url) {
          if (url === "https://otakudesu.blog/episode/sample-b") {
            return sampleBHtml;
          }
          if (url.startsWith(DESUSTREAM_IFRAME_BASE)) {
            return odcloudHtml;
          }
          throw new Error(`Unexpected url: ${url}`);
        },
        async post(_url, body) {
          const params = new URLSearchParams(body);
          if (params.get("action") === NONCE_ACTION) {
            return JSON.stringify({ data: "fake-nonce" });
          }
          if (params.get("action") === MIRROR_ACTION) {
            const html = `<div id="pembed"><iframe src="${DESUSTREAM_IFRAME_BASE}odcloud" frameborder="0"></iframe></div>`;
            return JSON.stringify({
              data: Buffer.from(html).toString("base64"),
            });
          }
          throw new Error("unknown");
        },
      };

      const sources = await provider.resolveVideoSources(
        "https://otakudesu.blog/episode/sample-b",
        customFetch,
      );

      const directSources = sources.filter((s) => s.type === "direct");
      expect(directSources).toHaveLength(2);
      expect(directSources[0]).toEqual({
        type: "direct",
        url: "https://cdn.odcloud.net/stream/Otakudesu_Episode_01_720p.mp4?token=abc123xyz&expires=1700000000",
        label: "Otakudesu_Episode_01_720p",
        quality: "720p",
      });
      expect(directSources[1]).toEqual({
        type: "direct",
        url: "https://cdn.odcloud.net/stream/Otakudesu_Episode_01_1080p.mp4?token=def456uvw&expires=1700000000",
        label: "Otakudesu_Episode_01_1080p",
        quality: "1080p",
      });
    });

    it("invokes browserFn fallback when static Cheerio extraction returns no direct sources", async () => {
      const stubFetch: FetchFn = {
        async get(url) {
          if (url === "https://otakudesu.blog/episode/sample-b") {
            return sampleBHtml;
          }
          return `<html><body><div id="player-mount"></div><script src="/app.js"></script></body></html>`;
        },
        async post(_url, body) {
          const params = new URLSearchParams(body);
          if (params.get("action") === NONCE_ACTION) {
            return JSON.stringify({ data: "fake-nonce" });
          }
          if (params.get("action") === MIRROR_ACTION) {
            const html = `<div id="pembed"><iframe src="${DESUSTREAM_IFRAME_BASE}dynamic" frameborder="0"></iframe></div>`;
            return JSON.stringify({
              data: Buffer.from(html).toString("base64"),
            });
          }
          throw new Error("unknown");
        },
      };

      const browserCalls: string[] = [];
      const mockBrowserFn = async (iframeUrl: string) => {
        browserCalls.push(iframeUrl);
        return `<html><body><video controls><source src="https://cdn.odcloud.net/stream/hydrated_720p.mp4?token=xyz" type="video/mp4"></video></body></html>`;
      };

      const sources = await provider.resolveVideoSources(
        "https://otakudesu.blog/episode/sample-b",
        stubFetch,
        undefined,
        mockBrowserFn,
      );

      expect(browserCalls.length).toBeGreaterThan(0);
      expect(browserCalls[0]).toContain(DESUSTREAM_IFRAME_BASE);

      const direct = sources.find((s) => s.type === "direct");
      expect(direct).toEqual({
        type: "direct",
        url: "https://cdn.odcloud.net/stream/hydrated_720p.mp4?token=xyz",
        label: "hydrated_720p",
        quality: "720p",
      });
    });

    it("does not invoke browserFn when static Cheerio extraction succeeds", async () => {
      const fetchFn = buildMockFetchFn();
      let browserCalled = false;
      const mockBrowserFn = async () => {
        browserCalled = true;
        return "";
      };

      const sources = await provider.resolveVideoSources(
        "https://otakudesu.blog/episode/sample-b",
        fetchFn,
        undefined,
        mockBrowserFn,
      );

      expect(browserCalled).toBe(false);
      expect(sources.some((s) => s.type === "direct")).toBe(true);
    });
  });
});
