import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";

const sampleOneSeasonHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-one-season.html"),
  "utf8"
);

const seriesUrl = "https://otakudesu.blog/anime/grand-blue-s3-sub-indo/";

describe("POST /preview-scrape-series", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp({
      fetchHtml: {
        get: async (url) => {
          if (url === seriesUrl) {
            return sampleOneSeasonHtml;
          }
          throw new Error(`Unexpected fetch URL: ${url}`);
        },
        post: async () => "",
      },
    });
  });

  describe("happy path", () => {
    it("returns 200 with series metadata and an episodes array in the successResponse wrapper", async () => {
      const { accessToken } = await registerUser(app);

      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape-series",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl: seriesUrl,
          source: "otakudesu",
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          series: {
            sourceUrl: string;
            source: string;
            title: string;
            description: string | null;
            posterUrl: string | null;
          };
          episodes: Array<{
            title: string;
            url: string;
            date: string | null;
          }>;
        };
      };

      expect(body.data).toBeDefined();
      expect(body.data.series.sourceUrl).toBe(seriesUrl);
      expect(body.data.series.source).toBe("otakudesu");
      expect(body.data.series.title).toBe("Grand Blue Season 3 Subtitle Indonesia");
      expect(body.data.series.posterUrl).toBe(
        "https://otakudesu.blog/wp-content/uploads/2026/07/158194.jpg"
      );

      expect(Array.isArray(body.data.episodes)).toBe(true);
      expect(body.data.episodes.length).toBe(7);

      const firstEpisode = body.data.episodes[0];
      expect(firstEpisode).toMatchObject({
        title: "Grand Blue Season 3 Episode 7 Subtitle Indonesia",
        url: "https://otakudesu.blog/episode/gb-s3-episode-7-sub-indo/",
        date: "18 Agustus,2026",
      });
    });

    it("returns 200 when html is provided inline instead of fetching", async () => {
      const { accessToken } = await registerUser(app);

      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape-series",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl: seriesUrl,
          source: "otakudesu",
          html: sampleOneSeasonHtml,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: { episodes: Array<{ url: string }> };
      };
      expect(body.data.episodes.length).toBe(7);
      expect(body.data.episodes[6].url).toBe(
        "https://otakudesu.blog/episode/gb-s3-episode-1-sub-indo/"
      );
    });
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape-series",
        body: {
          sourceUrl: seriesUrl,
          source: "otakudesu",
          html: sampleOneSeasonHtml,
        },
      });

      expect(response.status).toBe(401);
    });

    it("returns 401 when authorization token is invalid", async () => {
      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape-series",
        headers: authHeaders("invalid-token-string"),
        body: {
          sourceUrl: seriesUrl,
          source: "otakudesu",
          html: sampleOneSeasonHtml,
        },
      });

      expect(response.status).toBe(401);
    });
  });

  describe("error handling", () => {
    it("returns 400 with SERIES_FETCH when HTML fetch fails", async () => {
      const { accessToken } = await registerUser(app);

      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape-series",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl: "https://otakudesu.blog/anime/failed-fetch/",
          source: "otakudesu",
        },
      });

      expect(response.status).toBe(400);
      const body = response.body as { error: { code: string } };
      expect(body.error.code).toBe("SERIES_FETCH");
    });

    it("returns 400 with SERIES_PARSE when HTML cannot be parsed", async () => {
      const { accessToken } = await registerUser(app);

      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape-series",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl: seriesUrl,
          source: "otakudesu",
          html: "<html><body>No content</body></html>",
        },
      });

      expect(response.status).toBe(400);
      const body = response.body as { error: { code: string } };
      expect(body.error.code).toBe("SERIES_PARSE");
    });

    it("returns 400 when body is schema-invalid", async () => {
      const { accessToken } = await registerUser(app);

      const response = await request(app, {
        method: "POST",
        path: "/preview-scrape-series",
        headers: authHeaders(accessToken),
        body: {
          source: "otakudesu",
          html: sampleOneSeasonHtml,
        },
      });

      expect(response.status).toBe(400);
    });
  });
});