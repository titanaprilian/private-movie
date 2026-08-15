import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeAll } from "vitest";
import { eq, count } from "drizzle-orm";
import { episodes, series } from "@repo/db";
import { buildApp, request } from "../../utils/app";
import { registerUser, authHeaders, signTestToken } from "../../utils/auth";
import { db } from "../../utils/db";
import type { App } from "../../utils/app";

const sampleAHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-a.html"),
  "utf8"
);
const sampleBHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-b.html"),
  "utf8"
);

describe("POST /episodes", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  describe("happy path", () => {
    it("creates an episode record from minimal fixture (sample-a) and returns 200 with saved record", async () => {
      const { accessToken } = await registerUser(app);
      const sourceUrl =
        "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/";

      const response = await request(app, {
        method: "POST",
        path: "/episodes",
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
          id: string;
          sourceUrl: string;
          source: string;
          title: string;
          videoType: string | null;
          videoUrl: string;
          metadata: Record<string, unknown>;
          createdAt: string;
          updatedAt: string;
        };
      };

      expect(body.data).toBeDefined();
      expect(body.data.id).toBeTypeOf("string");
      expect(body.data.sourceUrl).toBe(sourceUrl);
      expect(body.data.source).toBe("otakudesu");
      expect(body.data.title).toBe(
        "Tsuihou sareta Tensei Juukishi wa Game Chishiki de Musou suru Episode 7 Subtitle Indonesia"
      );
      expect(body.data.videoType).toBeNull();
      expect(body.data.videoUrl).toBe(
        "https://odvidhide.com/embed/sylmpeaf3wzs"
      );
      expect(body.data.metadata).toBeDefined();
      expect(body.data.metadata.episodes).toBeDefined();
      expect(body.data.metadata.animePageUrl).toBe(
        "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/"
      );

      // Verify row is persisted in DB
      const rows = await db
        .select()
        .from(episodes)
        .where(eq(episodes.sourceUrl, sourceUrl));
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(body.data.id);
      expect(rows[0].sourceUrl).toBe(sourceUrl);
      expect(rows[0].source).toBe("otakudesu");
      expect(rows[0].title).toBe(body.data.title);
      expect(rows[0].videoType).toBeNull();
      expect(rows[0].videoUrl).toBe(body.data.videoUrl);
      expect(rows[0].seriesId).toBeDefined();
      expect(rows[0].seriesId).not.toBeNull();

      // Verify series row is persisted in DB
      const seriesRows = await db
        .select()
        .from(series)
        .where(
          eq(
            series.sourceUrl,
            "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/"
          )
        );
      expect(seriesRows).toHaveLength(1);
      expect(seriesRows[0].id).toBe(rows[0].seriesId);
      expect(seriesRows[0].title).toBe(
        "Tsuihou sareta Tensei Juukishi wa Game Chishiki de Musou suru"
      );
      expect(seriesRows[0].posterUrl).toBe(
        "https://otakudesu.blog/wp-content/uploads/2026/07/Tsuihou-sareta-Tensei-Juukishi-wa-Game-Chishiki-de-Musou-suru.jpg"
      );
    });

    it("creates an episode record from full fixture (sample-b) and returns 200 with saved record", async () => {
      const { accessToken } = await registerUser(app);
      const sourceUrl =
        "https://otakudesu.blog/episode/knoknn-s2-episode-6-sub-indo/";

      const response = await request(app, {
        method: "POST",
        path: "/episodes",
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
          id: string;
          sourceUrl: string;
          source: string;
          title: string;
          videoType: string | null;
          videoUrl: string;
          metadata: {
            genres?: string[];
            duration?: string;
            posterUrl?: string;
            downloadLinks?: unknown[];
            episodes?: unknown[];
            animePageUrl?: string;
          };
          createdAt: string;
          updatedAt: string;
        };
      };

      expect(body.data).toBeDefined();
      expect(body.data.id).toBeTypeOf("string");
      expect(body.data.sourceUrl).toBe(sourceUrl);
      expect(body.data.source).toBe("otakudesu");
      expect(body.data.title).toBe(
        "Katainaka no Ossan, Kensei ni Naru Season 2 Episode 6 Subtitle Indonesia"
      );
      expect(body.data.videoType).toBe("TV");
      expect(body.data.videoUrl).toBe(
        "https://desustream.net/dstream/arcg/?id=WEwyVVQydlgxSStTNXI4ak1JTTVtZXh5eUR4enRMbjUzTHpYa1VvVTlGai85K1MrTFRYaGViZVl0anN4YkxucFIrWWhrVHBZOU96Y3duZXBqcW1RS1E9PQ=="
      );
      expect(body.data.metadata.genres).toEqual(["Action", "Fantasy"]);
      expect(body.data.metadata.duration).toBe("23 min. per ep.");
      expect(body.data.metadata.posterUrl).toBe(
        "https://otakudesu.blog/wp-content/uploads/2026/07/157173.jpg"
      );
      expect(body.data.metadata.downloadLinks).toHaveLength(6);

      // Verify row is persisted in DB
      const rows = await db
        .select()
        .from(episodes)
        .where(eq(episodes.sourceUrl, sourceUrl));
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe(body.data.title);
      expect(rows[0].videoType).toBe("TV");
    });
  });

  describe("authentication", () => {
    it("returns 401 when authorization header is missing", async () => {
      const response = await request(app, {
        method: "POST",
        path: "/episodes",
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
        path: "/episodes",
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
        path: "/episodes",
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

  describe("error handling", () => {
    it("returns framework default 400 when body is schema-invalid", async () => {
      const { accessToken } = await registerUser(app);

      // Missing sourceUrl
      const response1 = await request(app, {
        method: "POST",
        path: "/episodes",
        headers: authHeaders(accessToken),
        body: {
          source: "otakudesu",
          html: sampleAHtml,
        },
      });
      expect(response1.status).toBe(400);

      // Invalid sourceUrl (not URI format)
      const response2 = await request(app, {
        method: "POST",
        path: "/episodes",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl: "not-a-valid-url",
          source: "otakudesu",
          html: sampleAHtml,
        },
      });
      expect(response2.status).toBe(400);

      // Invalid source enum value
      const response3 = await request(app, {
        method: "POST",
        path: "/episodes",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl:
            "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/",
          source: "invalid-source",
          html: sampleAHtml,
        },
      });
      expect(response3.status).toBe(400);

      // Missing html
      const response4 = await request(app, {
        method: "POST",
        path: "/episodes",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl:
            "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/",
          source: "otakudesu",
        },
      });
      expect(response4.status).toBe(400);
    });

    it("returns 400 with parse-error code EPISODE_PARSE when HTML is missing #venkonten", async () => {
      const { accessToken } = await registerUser(app);
      const invalidHtml =
        "<html><body><div id='other'><h1>Title</h1></div></body></html>";

      const response = await request(app, {
        method: "POST",
        path: "/episodes",
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
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("EPISODE_PARSE");
      expect(body.error.message).toContain("missing #venkonten container");
    });

    it("returns 400 with parse-error code EPISODE_PARSE when HTML is missing iframe src", async () => {
      const { accessToken } = await registerUser(app);
      const invalidHtml =
        "<html><body><div id='venkonten'><h1 class='posttl'>Title</h1></div></body></html>";

      const response = await request(app, {
        method: "POST",
        path: "/episodes",
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
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe("EPISODE_PARSE");
      expect(body.error.message).toContain("missing iframe src");
    });

    it("saves episode successfully with null seriesId when fetchHtml fails/throws error", async () => {
      const failingApp = await buildApp({
        fetchHtml: async () => {
          throw new Error("Network timeout fetching series page");
        },
      });
      const { accessToken } = await registerUser(failingApp);
      const sourceUrl =
        "https://otakudesu.blog/episode/fetch-fail-ep-1-sub-indo/";

      const response = await request(failingApp, {
        method: "POST",
        path: "/episodes",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl,
          source: "otakudesu",
          html: sampleAHtml,
        },
      });

      expect(response.status).toBe(200);
      const rows = await db
        .select()
        .from(episodes)
        .where(eq(episodes.sourceUrl, sourceUrl));
      expect(rows).toHaveLength(1);
      expect(rows[0].seriesId).toBeNull();
    });

    it("saves episode successfully with null seriesId when fetched series HTML is invalid/unparseable", async () => {
      const invalidSeriesApp = await buildApp({
        fetchHtml: async () => {
          return "<html><body><p>No title here</p></body></html>";
        },
      });
      const { accessToken } = await registerUser(invalidSeriesApp);
      const sourceUrl =
        "https://otakudesu.blog/episode/invalid-series-ep-1-sub-indo/";

      const response = await request(invalidSeriesApp, {
        method: "POST",
        path: "/episodes",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl,
          source: "otakudesu",
          html: sampleAHtml,
        },
      });

      expect(response.status).toBe(200);
      const rows = await db
        .select()
        .from(episodes)
        .where(eq(episodes.sourceUrl, sourceUrl));
      expect(rows).toHaveLength(1);
      expect(rows[0].seriesId).toBeNull();
    });
  });

  describe("series linkage and multi-episode behavior", () => {
    it("links multiple episodes saved for the same series to one single series record", async () => {
      const { accessToken } = await registerUser(app);

      // Episode 1
      const sourceUrl1 =
        "https://otakudesu.blog/episode/same-series-ep-1-sub-indo/";
      const resp1 = await request(app, {
        method: "POST",
        path: "/episodes",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl: sourceUrl1,
          source: "otakudesu",
          html: sampleAHtml,
        },
      });
      expect(resp1.status).toBe(200);

      // Episode 2 (with same sample-a HTML pointing to same animePageUrl)
      const sourceUrl2 =
        "https://otakudesu.blog/episode/same-series-ep-2-sub-indo/";
      const resp2 = await request(app, {
        method: "POST",
        path: "/episodes",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl: sourceUrl2,
          source: "otakudesu",
          html: sampleAHtml,
        },
      });
      expect(resp2.status).toBe(200);

      // Verify DB: two episodes, but only 1 series row
      const seriesRows = await db
        .select()
        .from(series)
        .where(
          eq(
            series.sourceUrl,
            "https://otakudesu.blog/anime/tsuihou-game-chishiki-suru-sub-indo/"
          )
        );
      expect(seriesRows).toHaveLength(1);

      const ep1Row = await db
        .select()
        .from(episodes)
        .where(eq(episodes.sourceUrl, sourceUrl1));
      const ep2Row = await db
        .select()
        .from(episodes)
        .where(eq(episodes.sourceUrl, sourceUrl2));

      expect(ep1Row[0].seriesId).toBe(seriesRows[0].id);
      expect(ep2Row[0].seriesId).toBe(seriesRows[0].id);
    });

    it("links episodes from different series to separate series records", async () => {
      const { accessToken } = await registerUser(app);

      // Episode from Series 1 (sample-a)
      const ep1Url = "https://otakudesu.blog/episode/diff-series-1-ep-1/";
      await request(app, {
        method: "POST",
        path: "/episodes",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl: ep1Url,
          source: "otakudesu",
          html: sampleAHtml,
        },
      });

      // Episode from Series 2 (sample-b)
      const ep2Url = "https://otakudesu.blog/episode/diff-series-2-ep-1/";
      await request(app, {
        method: "POST",
        path: "/episodes",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl: ep2Url,
          source: "otakudesu",
          html: sampleBHtml,
        },
      });

      const ep1 = (await db.select().from(episodes).where(eq(episodes.sourceUrl, ep1Url)))[0];
      const ep2 = (await db.select().from(episodes).where(eq(episodes.sourceUrl, ep2Url)))[0];

      expect(ep1.seriesId).toBeDefined();
      expect(ep2.seriesId).toBeDefined();
      expect(ep1.seriesId).not.toBe(ep2.seriesId);
    });
  });

  describe("upsert behavior", () => {
    it("updates existing record in place when re-submitting same sourceUrl and total row count stays 1", async () => {
      const { accessToken } = await registerUser(app);
      const sourceUrl =
        "https://otakudesu.blog/episode/tstjwgcm-episode-7-sub-indo/";

      // First submission with sample-a (minimal)
      const firstResponse = await request(app, {
        method: "POST",
        path: "/episodes",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl,
          source: "otakudesu",
          html: sampleAHtml,
        },
      });
      expect(firstResponse.status).toBe(200);

      // Second submission with same sourceUrl but sample-b (full)
      const secondResponse = await request(app, {
        method: "POST",
        path: "/episodes",
        headers: authHeaders(accessToken),
        body: {
          sourceUrl,
          source: "otakudesu",
          html: sampleBHtml,
        },
      });
      expect(secondResponse.status).toBe(200);

      const secondBody = secondResponse.body as {
        data: {
          id: string;
          sourceUrl: string;
          title: string;
          videoType: string | null;
        };
      };

      expect(secondBody.data.sourceUrl).toBe(sourceUrl);
      expect(secondBody.data.title).toBe(
        "Katainaka no Ossan, Kensei ni Naru Season 2 Episode 6 Subtitle Indonesia"
      );

      // Verify total row count in episodes table is strictly 1
      const totalCount = await db.select({ value: count() }).from(episodes);
      expect(totalCount[0].value).toBe(1);

      // Verify the single row has the updated fields
      const rows = await db
        .select()
        .from(episodes)
        .where(eq(episodes.sourceUrl, sourceUrl));
      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe(
        "Katainaka no Ossan, Kensei ni Naru Season 2 Episode 6 Subtitle Indonesia"
      );
    });
  });
});