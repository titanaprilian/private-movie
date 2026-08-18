import { describe, expect, it, beforeAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { episodes, series, videoSources } from "@repo/db";
import { buildApp, request } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";
import type { FetchFn } from "@repo/media-service";
import type { App } from "../../utils/app";

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

function buildPartialFailureFetchFn(): FetchFn {
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
        return JSON.stringify({ data: "fake-nonce-123" });
      }
      if (action === MIRROR_ACTION) {
        const i = parseInt(params.get("i") ?? "-1", 10);
        if (i === 2) {
          throw new Error(`mirror request failed for index ${i}`);
        }
        const html = `<div id="pembed"><iframe src="https://player.example.com/embed/mirror-${i}" frameborder="0"></iframe></div>`;
        return JSON.stringify({ data: Buffer.from(html).toString("base64") });
      }
      throw new Error(`unknown action: ${action}`);
    },
  };
}

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
            videoSources: [
              {
                type: "embed",
                url: "https://odvidhide.com/embed/test",
                label: "Server Embed",
              },
            ],
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
            videoSources: [
              {
                type: "embed",
                url: "https://odvidhide.com/embed/test",
                label: "Server Embed",
              },
            ],
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
            videoSources: [
              {
                type: "embed",
                url: "https://odvidhide.com/embed/integ1",
                label: "Server Embed",
              },
              {
                type: "direct",
                url: "https://stream.example.com/video1.mp4",
                label: "Server Direct",
              },
            ],
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
            videoSources: [
              {
                type: "embed",
                url: "https://odvidhide.com/embed/integ2",
                label: "Server Embed",
              },
            ],
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
            videoSources: [
              {
                type: "embed",
                url: "https://odvidhide.com/embed/test",
                label: "Server Embed",
              },
            ],
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
            videoSources: [
              {
                type: "embed",
                url: "https://odvidhide.com/embed/special",
                label: "Server Embed",
              },
            ],
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

  describe("resolved mirror sources", () => {
    const resolvedMirrors = [
      { type: "embed" as const, url: "https://player.example.com/embed/mirror-0", label: "ondesu2hd", quality: "720p" },
      { type: "embed" as const, url: "https://player.example.com/embed/mirror-1", label: "odstream", quality: "720p" },
      { type: "embed" as const, url: "https://player.example.com/embed/mirror-2", label: "filedon", quality: "720p" },
      { type: "embed" as const, url: "https://player.example.com/embed/mirror-3", label: "vidhide", quality: "720p" },
      { type: "embed" as const, url: "https://player.example.com/embed/mirror-4", label: "mega", quality: "720p" },
    ];

    it("saves all resolved mirrors as separate video source rows", async () => {
      const { accessToken } = await registerUser(app);
      const epSourceUrl =
        "https://otakudesu.blog/episode/save-media-mirrors-1/";

      const response = await request(app, {
        method: "POST",
        path: "/save-media",
        headers: authHeaders(accessToken),
        body: {
          episode: {
            sourceUrl: epSourceUrl,
            source: "otakudesu",
            title: "Mirrors Episode 1",
            videoType: "TV",
            videoSources: resolvedMirrors,
            metadata: {},
          },
          series: null,
        },
      });

      expect(response.status).toBe(200);
      const body = response.body as { data: { episode: { id: string } } };

      const vsRows = await db
        .select()
        .from(videoSources)
        .where(eq(videoSources.episodeId, body.data.episode.id));
      expect(vsRows).toHaveLength(5);
      expect(vsRows.map((row) => row.label)).toEqual([
        "ondesu2hd",
        "odstream",
        "filedon",
        "vidhide",
        "mega",
      ]);
      expect(
        vsRows.every(
          (row) =>
            row.type === "embed" &&
            row.quality === "720p" &&
            row.url.startsWith("https://player.example.com/embed/mirror-")
        )
      ).toBe(true);
    });

    it("saves only the successfully resolved mirrors when some fail during preview", async () => {
      const previewApp = await buildApp({
        fetchHtml: buildPartialFailureFetchFn(),
      });
      const { accessToken } = await registerUser(previewApp);

      const preview = await request(previewApp, {
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
      expect(preview.status).toBe(200);
      const previewBody = preview.body as {
        data: {
          episode: {
            sourceUrl: string;
            source: string;
            title: string;
            videoType: string | null;
            videoSources: typeof resolvedMirrors;
            metadata: Record<string, unknown>;
          };
        };
      };

      const save = await request(previewApp, {
        method: "POST",
        path: "/save-media",
        headers: authHeaders(accessToken),
        body: {
          episode: previewBody.data.episode,
          series: null,
        },
      });
      expect(save.status).toBe(200);
      const saveBody = save.body as { data: { episode: { id: string } } };

      const vsRows = await db
        .select()
        .from(videoSources)
        .where(eq(videoSources.episodeId, saveBody.data.episode.id));
      expect(vsRows).toHaveLength(4);
      expect(vsRows.map((row) => row.label).sort()).toEqual([
        "mega",
        "odstream",
        "ondesu2hd",
        "vidhide",
      ]);
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
            metadata: {},
          },
        },
      });
      expect(res2.status).toBe(400);
    });
  });
});
