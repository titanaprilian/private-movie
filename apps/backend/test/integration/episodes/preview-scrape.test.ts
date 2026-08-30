import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { count } from "drizzle-orm";
import { episodes, series } from "@repo/db";
import { buildApp, request } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";
import type { FetchFn } from "@repo/media-service";
import type { App } from "../../utils/app";

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
const sampleMp4VideoHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-mp4-video.html"),
  "utf8"
);

const NONCE_ACTION = "aa1208d27f29ca340c92c66d1926f13f";
const MIRROR_ACTION = "2a3505c93b0035d3f455df82bf976b84";
const sampleBAnimePageUrl =
  "https://otakudesu.blog/anime/katainaka-ossan-kensei-naru-s2-sub-indo/";

function buildMirrorFetchFn(options?: {
  failMirrorIndexes?: number[];
}): FetchFn {
  const failMirrorIndexes = options?.failMirrorIndexes ?? [];
  return {
    async get(url) {
      if (url === sampleBAnimePageUrl) {
        return sampleSeriesHtml;
      }
      if (
        url.startsWith("https://desustream.net/dstream/arcg/?id=") ||
        url.startsWith("https://odvidhide.com/embed/")
      ) {
        return "<html><body></body></html>";
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    },
    async post(_url, body) {
      const params = new URLSearchParams(body);
      const action = params.get("action") ?? "";
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

describe("POST /preview-scrape", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp({
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
          if (url.startsWith("https://odvidhide.com/embed/")) {
            return "<html><body></body></html>";
          }
          throw new Error(`Failed to fetch ${url}`);
        },
        post: async () => "",
      },
    });
  });

  describe("happy path", () => {
    it("previews scrape with dramula source payload returning 200 OK", async () => {
      const { accessToken } = await registerUser(app);
      const sourceUrl = "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1";

      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl,
          source: "dramula",
          html: sampleAHtml,
        },
      });

      expect(response.status).toBe(200);
    });

    it("previews scrape with URL only (no html field) by fetching HTML automatically", async () => {
      const { accessToken } = await registerUser(app);
      const sourceUrl =
        "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/";

      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl,
          source: "otakudesu",
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          episode: { title: string };
        };
      };
      expect(body.data.episode.title).toBe(
        "Tsuihou sareta Tensei Juukishi wa Game Chishiki de Musou suru Episode 7 Subtitle Indonesia"
      );
    });

    it("returns parsed episode and series data without saving to DB", async () => {
      const { accessToken } = await registerUser(app);
      const sourceUrl =
        "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/";

      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl,
          source: "otakudesu",
          html: sampleAHtml,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          episode: {
            sourceUrl: string;
            source: string;
            title: string;
            videoType: string | null;
            videoSources: Array<{
              type: string;
              url: string;
              label: string;
              quality?: string | null;
            }>;
            metadata: Record<string, unknown>;
          };
          series: {
            sourceUrl: string;
            source: string;
            title: string;
            description: string | null;
            posterUrl: string | null;
          } | null;
          warnings: string[];
        };
      };

      expect(body.data).toBeDefined();
      expect(body.data.episode.sourceUrl).toBe(sourceUrl);
      expect(body.data.episode.source).toBe("otakudesu");
      expect(body.data.episode.title).toBe(
        "Tsuihou sareta Tensei Juukishi wa Game Chishiki de Musou suru Episode 7 Subtitle Indonesia"
      );
      expect(body.data.episode.videoSources).toBeInstanceOf(Array);
      expect(body.data.episode.videoSources.length).toBeGreaterThan(0);
      expect(body.data.episode.videoSources[0]).toMatchObject({
        type: "embed",
        url: "https://odvidhide.com/embed/sylmpeaf3wzs",
        label: "Server Embed",
      });

      expect(body.data.series).not.toBeNull();
      expect(body.data.series?.sourceUrl).toBe(
        "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/"
      );
      expect(body.data.series?.title).toBe(
        "Tsuihou sareta Tensei Juukishi wa Game Chishiki de Musou suru"
      );

      expect(body.data.warnings).toEqual([]);

      // Verify NOTHING was written to database
      const episodeCount = await db.select({ value: count() }).from(episodes);
      expect(episodeCount[0].value).toBe(0);
      const seriesCount = await db.select({ value: count() }).from(series);
      expect(seriesCount[0].value).toBe(0);
    });
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape",
        body: {
          sourceUrl: "https://otakudesu.blog/episode/test-episode/",
          source: "otakudesu",
          html: sampleAHtml,
        },
      });

      expect(response.status).toBe(401);
    });

    it("returns 401 when authorization token is invalid or expired", async () => {
      const invalidTokenResponse = await request(app, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders("invalid-token-string"),
        body: {
          sourceUrl: "https://otakudesu.blog/episode/test-episode/",
          source: "otakudesu",
          html: sampleAHtml,
        },
      });

      expect(invalidTokenResponse.status).toBe(401);

      const expiredToken = signTestToken(
        { sub: "some-user-id" },
        { expiresInSeconds: -3600 }
      );
      const expiredTokenResponse = await request(app, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders(expiredToken),
        body: {
          sourceUrl: "https://otakudesu.blog/episode/test-episode/",
          source: "otakudesu",
          html: sampleAHtml,
        },
      });

      expect(expiredTokenResponse.status).toBe(401);
    });
  });

  describe("mirror resolution", () => {
    let mirrorApp: App;

    beforeAll(async () => {
      mirrorApp = await buildApp({ fetchHtml: buildMirrorFetchFn() });
    });

    it("returns all resolved 720p mirrors in videoSources", async () => {
      const { accessToken } = await registerUser(mirrorApp);
      const sourceUrl =
        "https://otakudesu.blog/episode/knoknn-s2-episode-6-sub-indo/";

      const response = await request(mirrorApp, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl,
          source: "otakudesu",
          html: sampleBHtml,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          episode: {
            videoSources: Array<{
              type: string;
              url: string;
              label: string;
              quality?: string | null;
            }>;
          };
          warnings: string[];
        };
      };
      expect(body.data.episode.videoSources).toEqual([
        { type: "embed", url: "https://player.example.com/embed/mirror-0", label: "ondesu2hd", quality: "720p" },
        { type: "embed", url: "https://player.example.com/embed/mirror-1", label: "odstream", quality: "720p" },
        { type: "embed", url: "https://player.example.com/embed/mirror-2", label: "filedon", quality: "720p" },
        { type: "embed", url: "https://player.example.com/embed/mirror-3", label: "vidhide", quality: "720p" },
        { type: "embed", url: "https://player.example.com/embed/mirror-4", label: "mega", quality: "720p" },
      ]);
      expect(body.data.warnings).toEqual([]);
    });

    it("returns only the successfully resolved mirrors on partial failure", async () => {
      const failingApp = await buildApp({
        fetchHtml: buildMirrorFetchFn({ failMirrorIndexes: [2] }),
      });
      const { accessToken } = await registerUser(failingApp);

      const response = await request(failingApp, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl:
            "https://otakudesu.blog/episode/knoknn-s2-episode-6-sub-indo/",
          source: "otakudesu",
          html: sampleBHtml,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          episode: {
            videoSources: Array<{ label: string }>;
          };
        };
      };
      expect(body.data.episode.videoSources.map((vs) => vs.label)).toEqual([
        "ondesu2hd",
        "odstream",
        "vidhide",
        "mega",
      ]);
    });

    it("returns 400 with MIRROR_RESOLVE when zero mirrors resolve", async () => {
      const failingApp = await buildApp({
        fetchHtml: buildMirrorFetchFn({ failMirrorIndexes: [0, 1, 2, 3, 4] }),
      });
      const { accessToken } = await registerUser(failingApp);

      const response = await request(failingApp, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl:
            "https://otakudesu.blog/episode/knoknn-s2-episode-6-sub-indo/",
          source: "otakudesu",
          html: sampleBHtml,
        },
      });

      expect(response.status).toBe(400);
      const body = response.body as { error: { code: string } };
      expect(body.error.code).toBe("MIRROR_RESOLVE");
    });
  });

  describe("error handling and warnings", () => {
    it("returns 400 with EPISODE_FETCH when HTML fetch fails", async () => {
      const { accessToken } = await registerUser(app);

      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl: "https://otakudesu.blog/episode/failed-fetch/",
          source: "otakudesu",
        },
      });

      expect(response.status).toBe(400);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("EPISODE_FETCH");
    });

    it("returns 400 when body is schema-invalid", async () => {
      const { accessToken } = await registerUser(app);

      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders(accessToken),
        body: {
          source: "otakudesu",
          html: sampleAHtml,
        },
      });
      expect(response.status).toBe(400);
    });

    it("returns 400 with EPISODE_PARSE when HTML is invalid", async () => {
      const { accessToken } = await registerUser(app);
      const invalidHtml = "<html><body>No content</body></html>";

      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl:
            "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/",
          source: "otakudesu",
          html: invalidHtml,
        },
      });

      expect(response.status).toBe(400);
      const body = response.body as { error: { code: string; message: string } };
      expect(body.error.code).toBe("EPISODE_PARSE");
    });

    it("returns 400 Bad Request with EPISODE_MISSING_FIELDS and missingFields array when HTML is missing required episode fields", async () => {
      const { accessToken } = await registerUser(app);
      const malformedHtml = '<div id="venkonten"><p>no title or iframe</p></div>';

      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl:
            "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/",
          source: "otakudesu",
          html: malformedHtml,
        },
      });

      expect(response.status).toBe(400);
      const body = response.body as {
        error: {
          code: string;
          missingFields?: string[];
        };
      };
      expect(body.error.code).toBe("EPISODE_MISSING_FIELDS");
      expect(body.error.missingFields).toEqual(["title", "embedUrl"]);
    });

    it("returns 200 with series: null and warning when series fetch fails", async () => {
      const failingApp = await buildApp({
        fetchHtml: {
          get: async (url) => {
            if (url.startsWith("https://odvidhide.com/embed/")) {
              return "<html><body></body></html>";
            }
            throw new Error("Network timeout fetching series page");
          },
          post: async () => "",
        },
      });
      const { accessToken } = await registerUser(failingApp);

      const response = await request(failingApp, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl:
            "https://otakudesu.blog/episode/fetch-fail-ep-1-sub-indo/",
          source: "otakudesu",
          html: sampleAHtml,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          series: unknown;
          warnings: string[];
        };
      };
      expect(body.data.series).toBeNull();
      expect(body.data.warnings).toEqual(["Failed to fetch series details"]);
    });
  });

  describe("direct video extraction", () => {
    it("returns direct MP4 video source alongside embed source when iframe contains a video tag", async () => {
      const directApp = await buildApp({
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
            if (url === "https://odvidhide.com/embed/sylmpeaf3wzs") {
              return sampleMp4VideoHtml;
            }
            throw new Error(`Unexpected fetch URL: ${url}`);
          },
          post: async () => "",
        },
      });

      const { accessToken } = await registerUser(directApp);
      const sourceUrl =
        "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/";

      const response = await request(directApp, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl,
          source: "otakudesu",
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          episode: {
            videoSources: Array<{
              type: string;
              url: string;
              label: string;
              quality?: string | null;
            }>;
          };
          warnings: string[];
        };
      };

      expect(body.data.episode.videoSources).toEqual([
        {
          type: "embed",
          url: "https://odvidhide.com/embed/sylmpeaf3wzs",
          label: "Server Embed",
        },
        {
          type: "direct",
          url: "https://archive.org/download/diri-dari-skenario-yang-telah-ia-program-sendiri.dwa/Otakudesu.io_TSTJ--01_720p.mp4",
          label: "Otakudesu.io_TSTJ--01_720p",
          quality: "720p",
        },
      ]);
      expect(body.data.warnings).toEqual([]);
    });

    it("returns warning when fetching player iframe fails with 500 error", async () => {
      const errorApp = await buildApp({
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
            if (url === "https://odvidhide.com/embed/sylmpeaf3wzs") {
              throw new Error("500 Internal Server Error");
            }
            throw new Error(`Unexpected fetch URL: ${url}`);
          },
          post: async () => "",
        },
      });

      const { accessToken } = await registerUser(errorApp);
      const sourceUrl =
        "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/";

      const response = await request(errorApp, {
        method: "POST",
        path: "/preview-scrape",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl,
          source: "otakudesu",
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          episode: {
            videoSources: Array<{
              type: string;
              url: string;
              label: string;
              quality?: string | null;
            }>;
          };
          warnings: string[];
        };
      };

      expect(body.data.episode.videoSources).toEqual([
        {
          type: "embed",
          url: "https://odvidhide.com/embed/sylmpeaf3wzs",
          label: "Server Embed",
        },
      ]);
      expect(body.data.warnings).toEqual([]);
    });
  });
});
