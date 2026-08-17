import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { count } from "drizzle-orm";
import { episodes, series } from "@repo/db";
import { buildApp, request } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";
import type { App } from "../../utils/app";

const sampleAHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-a.html"),
  "utf8"
);
const sampleSeriesHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/series/sample-series-list.html"),
  "utf8"
);

describe("POST /preview-scrape", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp({
      fetchHtml: {
        get: async (url) => {
          if (
            url ===
            "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/"
          ) {
            return sampleSeriesHtml;
          }
          throw new Error(`Failed to fetch ${url}`);
        },
        post: async () => "",
      },
    });
  });

  describe("happy path", () => {
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

  describe("error handling and warnings", () => {
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

    it("returns 200 with series: null and warning when series fetch fails", async () => {
      const failingApp = await buildApp({
        fetchHtml: {
          get: async () => {
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
});
