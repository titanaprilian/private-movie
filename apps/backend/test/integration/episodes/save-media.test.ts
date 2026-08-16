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
            embedUrl: "https://odvidhide.com/embed/integ1",
            videoUrl: "https://stream.example.com/video1.mp4",
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
      expect(epRows[0].embedUrl).toBe("https://odvidhide.com/embed/integ1");
      expect(epRows[0].videoUrl).toBe("https://stream.example.com/video1.mp4");
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

    it("parses order from episode title when present and defaults to max + 1 when unnumbered", async () => {
      const { accessToken } = await registerUser(app);
      const seriesSourceUrl = "https://otakudesu.blog/anime/order-test-series/";
      const seriesPayload = {
        sourceUrl: seriesSourceUrl,
        source: "otakudesu" as const,
        title: "Order Test Series",
        description: "Anime for testing order",
        posterUrl: null,
      };

      // 1. Save Episode 12 with explicit number in title
      const res1 = await request(app, {
        method: "POST",
        path: "/save-media",
        headers: authHeaders(accessToken),
        body: {
          episode: {
            sourceUrl: "https://otakudesu.blog/episode/order-test-12/",
            source: "otakudesu",
            title: "Order Test Series Episode 12 Sub Indo",
            videoType: "TV",
            videoUrl: "https://odvidhide.com/embed/12",
            metadata: {},
          },
          series: seriesPayload,
        },
      });
      expect(res1.status).toBe(200);
      const ep1Body = res1.body as { data: { episode: { order: number } } };
      expect(ep1Body.data.episode.order).toBe(12);

      // 2. Save unnumbered episode for same series -> should receive max(12) + 1 = 13
      const res2 = await request(app, {
        method: "POST",
        path: "/save-media",
        headers: authHeaders(accessToken),
        body: {
          episode: {
            sourceUrl: "https://otakudesu.blog/episode/order-test-special/",
            source: "otakudesu",
            title: "Order Test Series Movie Special",
            videoType: "Special",
            videoUrl: "https://odvidhide.com/embed/special",
            metadata: {},
          },
          series: seriesPayload,
        },
      });
      expect(res2.status).toBe(200);
      const ep2Body = res2.body as { data: { episode: { order: number } } };
      expect(ep2Body.data.episode.order).toBe(13);
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
