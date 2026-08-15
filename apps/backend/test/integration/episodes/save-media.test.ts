import { describe, expect, it, beforeAll, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, series } from "@repo/db";
import { buildApp, request } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";
import type { App } from "../../utils/app";

describe("POST /save-media", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(series);
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const response = await request(app, {
        method: "POST",
        path: "/save-media",
        body: {
          episode: {
            sourceUrl: "https://otakudesu.blog/episode/test-ep-1/",
            source: "otakudesu",
            title: "Test Episode",
            videoType: "TV",
            videoUrl: "https://odvidhide.com/embed/test",
            metadata: {},
          },
          series: null,
        },
      });

      expect(response.status).toBe(401);
    });

    it("returns 401 when authorization token is invalid or expired", async () => {
      const invalidTokenResponse = await request(app, {
        method: "POST",
        path: "/save-media",
        headers: authHeaders("invalid-token-string"),
        body: {
          episode: {
            sourceUrl: "https://otakudesu.blog/episode/test-ep-1/",
            source: "otakudesu",
            title: "Test Episode",
            videoType: "TV",
            videoUrl: "https://odvidhide.com/embed/test",
            metadata: {},
          },
          series: null,
        },
      });

      expect(invalidTokenResponse.status).toBe(401);
    });
  });

  describe("happy path", () => {
    it("creates episode record with series: null when series is null", async () => {
      const { accessToken } = await registerUser(app);
      const epSourceUrl = "https://otakudesu.blog/episode/save-media-integ-1/";

      const response = await request(app, {
        method: "POST",
        path: "/save-media",
        headers: authHeaders(accessToken),
        body: {
          episode: {
            sourceUrl: epSourceUrl,
            source: "otakudesu",
            title: "Integration Test Episode 1",
            videoType: "TV",
            videoUrl: "https://odvidhide.com/embed/integ1",
            metadata: { duration: "24 min" },
          },
          series: null,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          episode: {
            id: string;
            sourceUrl: string;
            source: string;
            title: string;
            videoType: string | null;
            videoUrl: string;
            seriesId: string | null;
          };
          series: null;
        };
      };

      expect(body.data).toBeDefined();
      expect(body.data.episode.id).toBeTypeOf("string");
      expect(body.data.episode.sourceUrl).toBe(epSourceUrl);
      expect(body.data.episode.seriesId).toBeNull();
      expect(body.data.series).toBeNull();

      // Verify DB record
      const epRows = await db
        .select()
        .from(episodes)
        .where(eq(episodes.sourceUrl, epSourceUrl));
      expect(epRows).toHaveLength(1);
      expect(epRows[0].id).toBe(body.data.episode.id);
      expect(epRows[0].seriesId).toBeNull();
    });

    it("creates episode and series records and links them when series payload is provided", async () => {
      const { accessToken } = await registerUser(app);
      const epSourceUrl = "https://otakudesu.blog/episode/save-media-integ-2/";
      const seriesSourceUrl = "https://otakudesu.blog/anime/save-media-integ-series-2/";

      const response = await request(app, {
        method: "POST",
        path: "/save-media",
        headers: authHeaders(accessToken),
        body: {
          episode: {
            sourceUrl: epSourceUrl,
            source: "otakudesu",
            title: "Integration Test Episode 2",
            videoType: "TV",
            videoUrl: "https://odvidhide.com/embed/integ2",
            metadata: { episodeNumber: 2 },
          },
          series: {
            sourceUrl: seriesSourceUrl,
            source: "otakudesu",
            title: "Integration Test Series 2",
            description: "Cool anime series",
            posterUrl: "https://otakudesu.blog/poster2.jpg",
          },
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as {
        data: {
          episode: {
            id: string;
            sourceUrl: string;
            seriesId: string;
          };
          series: {
            id: string;
            sourceUrl: string;
            title: string;
            description: string | null;
            posterUrl: string | null;
          };
        };
      };

      expect(body.data.series).toBeDefined();
      expect(body.data.series.id).toBeTypeOf("string");
      expect(body.data.series.sourceUrl).toBe(seriesSourceUrl);
      expect(body.data.series.title).toBe("Integration Test Series 2");

      expect(body.data.episode.id).toBeTypeOf("string");
      expect(body.data.episode.seriesId).toBe(body.data.series.id);

      // Verify DB persistence & FK linkage
      const seriesRows = await db
        .select()
        .from(series)
        .where(eq(series.sourceUrl, seriesSourceUrl));
      expect(seriesRows).toHaveLength(1);
      expect(seriesRows[0].id).toBe(body.data.series.id);

      const epRows = await db
        .select()
        .from(episodes)
        .where(eq(episodes.sourceUrl, epSourceUrl));
      expect(epRows).toHaveLength(1);
      expect(epRows[0].seriesId).toBe(body.data.series.id);
    });
  });

  describe("error handling", () => {
    it("returns 400 when body fails schema validation", async () => {
      const { accessToken } = await registerUser(app);

      // Missing episode field
      const res1 = await request(app, {
        method: "POST",
        path: "/save-media",
        headers: authHeaders(accessToken),
        body: {
          series: null,
        },
      });
      expect(res1.status).toBe(400);

      // Invalid sourceUrl format in episode
      const res2 = await request(app, {
        method: "POST",
        path: "/save-media",
        headers: authHeaders(accessToken),
        body: {
          episode: {
            sourceUrl: "invalid-url",
            source: "otakudesu",
            title: "Test Episode",
            videoType: null,
            videoUrl: "https://odvidhide.com/embed/test",
            metadata: {},
          },
        },
      });
      expect(res2.status).toBe(400);
    });
  });
});
