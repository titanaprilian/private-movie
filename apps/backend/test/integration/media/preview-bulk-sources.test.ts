import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";
import { describe, expect, it, beforeAll } from "vitest";
import { episodes, seasons, series, videoSources } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";

const sampleOneSeasonHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-one-season.html"),
  "utf8"
);
const sampleDramulaHtml = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../../../packages/media-scraper/test/fixtures/episodes/sample-dramula.html"
  ),
  "utf8"
);

describe("POST /series/:id/preview-bulk-sources", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await buildApp({
      fetchHtml: {
        get: async (url) => {
          if (url.includes("otakudesu.blog/anime/grand-blue-s3-sub-indo")) {
            return sampleOneSeasonHtml;
          }
          if (url.includes("dramula.com")) {
            return sampleDramulaHtml;
          }
          throw new Error(`Unexpected fetch URL: ${url}`);
        },
        post: async () => "",
      },
    });
    const user = await registerUser(app, {
      email: "bulk-sources-tester@example.com",
      password: "password123",
      name: "Bulk Sources Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  async function createSeriesWithEpisodes(title: string, episodeOrders: number[]) {
    const seriesId = crypto.randomUUID();
    const now = new Date();
    await db.insert(series).values({
      id: seriesId,
      title,
      type: "tv",
      createdAt: now,
      updatedAt: now,
    });

    const seasonId = crypto.randomUUID();
    await db.insert(seasons).values({
      id: seasonId,
      seriesId,
      title: "Season 1",
      seasonNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    const createdEpisodes: Array<{ id: string; order: number; title: string }> = [];
    for (const order of episodeOrders) {
      const epId = crypto.randomUUID();
      const epTitle = `Episode ${order}`;
      await db.insert(episodes).values({
        id: epId,
        title: epTitle,
        order,
        seasonId,
        createdAt: now,
        updatedAt: now,
      });
      createdEpisodes.push({ id: epId, order, title: epTitle });
    }

    return { seriesId, seasonId, episodes: createdEpisodes };
  }

  it("returns 401 when authorization header is missing", async () => {
    const res = await request(app, {
      method: "POST",
      path: `/series/${crypto.randomUUID()}/preview-bulk-sources`,
      body: {
        sourceUrl: "https://otakudesu.blog/anime/grand-blue-s3-sub-indo/",
        source: "otakudesu",
      },
    });

    expect(res.status).toBe(401);
  });

  it("returns 404 when series does not exist in DB", async () => {
    const nonExistentId = crypto.randomUUID();
    const res = await request(app, {
      method: "POST",
      path: `/series/${nonExistentId}/preview-bulk-sources`,
      headers,
      body: {
        sourceUrl: "https://otakudesu.blog/anime/grand-blue-s3-sub-indo/",
        source: "otakudesu",
      },
    });

    expect(res.status).toBe(404);
    const body = res.body as { error: { code: string } };
    expect(body.error.code).toBe("SERIES_NOT_FOUND");
  });

  it("previews bulk scrape, applies offset 0, matches by order, and returns local episode list", async () => {
    const { seriesId, episodes: createdEps } = await createSeriesWithEpisodes(
      "Grand Blue Season 3",
      [1, 2, 3, 4, 5, 6, 7]
    );

    const sourceUrl = "https://otakudesu.blog/anime/grand-blue-s3-sub-indo/";
    const res = await request(app, {
      method: "POST",
      path: `/series/${seriesId}/preview-bulk-sources`,
      headers,
      body: {
        sourceUrl,
        source: "otakudesu",
        episodeOffset: 0,
      },
    });

    expect(res.status).toBe(200);
    const body = res.body as {
      data: {
        scrapedEpisodes: Array<{
          scrapedTitle: string;
          scrapedUrl: string;
          episodeNumber: number | null;
          calculatedOrder: number | null;
          matchedLocalEpisodeId: string | null;
          matchStatus: "matched" | "unmatched";
        }>;
        localEpisodes: Array<{
          id: string;
          title: string;
          order: number;
          seasonId: string;
          seasonNumber: number | null;
          seasonTitle: string;
          hasSources: boolean;
        }>;
      };
    };

    expect(body.data).toBeDefined();
    expect(body.data.scrapedEpisodes.length).toBe(7);
    expect(body.data.localEpisodes.length).toBe(7);
    expect(body.data.localEpisodes[0]?.hasSources).toBe(false);

    // Verify Ep 1 matching
    const scrapedEp1 = body.data.scrapedEpisodes.find((e) => e.episodeNumber === 1);
    const localEp1 = createdEps.find((e) => e.order === 1);
    expect(scrapedEp1).toBeDefined();
    expect(scrapedEp1?.calculatedOrder).toBe(1);
    expect(scrapedEp1?.matchedLocalEpisodeId).toBe(localEp1?.id);
    expect(scrapedEp1?.matchStatus).toBe("matched");
  });

  it("applies positive episodeOffset correctly for matching higher order numbers", async () => {
    // Scraper has Ep 1, 2, 3...
    // DB has local episodes starting at order 13 (Season 2 offset by 12)
    const { seriesId, episodes: createdEps } = await createSeriesWithEpisodes(
      "Grand Blue S2 Continuous",
      [13, 14, 15, 16, 17, 18, 19]
    );

    const sourceUrl = "https://otakudesu.blog/anime/grand-blue-s3-sub-indo/";
    const res = await request(app, {
      method: "POST",
      path: `/series/${seriesId}/preview-bulk-sources`,
      headers,
      body: {
        sourceUrl,
        source: "otakudesu",
        episodeOffset: 12,
      },
    });

    expect(res.status).toBe(200);
    const body = res.body as {
      data: {
        scrapedEpisodes: Array<{
          episodeNumber: number | null;
          calculatedOrder: number | null;
          matchedLocalEpisodeId: string | null;
          matchStatus: string;
        }>;
      };
    };

    const scrapedEp1 = body.data.scrapedEpisodes.find((e) => e.episodeNumber === 1);
    const localEp13 = createdEps.find((e) => e.order === 13);
    expect(scrapedEp1?.calculatedOrder).toBe(13);
    expect(scrapedEp1?.matchedLocalEpisodeId).toBe(localEp13?.id);
    expect(scrapedEp1?.matchStatus).toBe("matched");
  });

  it("handles decimal episodes (7.5) and unmatched IDs by setting matchStatus: unmatched and matchedLocalEpisodeId: null", async () => {
    const { seriesId } = await createSeriesWithEpisodes("Decimal Series", [1, 2]);

    const customHtml = `
      <div id="venkonten">
        <div class="fotoanime">
          <h1>Aharen-san</h1>
        </div>
        <div class="episodelist">
          <div class="smokelister">
            <span class="monktit">Episode List</span>
          </div>
          <ul>
            <li>
              <span><a href="https://otakudesu.blog/episode/ep-1/">Aharen-san Episode 1 Sub Indo</a></span>
            </li>
            <li>
              <span><a href="https://otakudesu.blog/episode/ep-7-5/">Aharen-san Episode 7.5 Sub Indo</a></span>
            </li>
            <li>
              <span><a href="https://otakudesu.blog/episode/ep-99/">Aharen-san Episode 99 Sub Indo</a></span>
            </li>
          </ul>
        </div>
      </div>
    `;

    const res = await request(app, {
      method: "POST",
      path: `/series/${seriesId}/preview-bulk-sources`,
      headers,
      body: {
        sourceUrl: "https://otakudesu.blog/anime/aharen-san-sub-indo/",
        source: "otakudesu",
        html: customHtml,
      },
    });

    expect(res.status).toBe(200);
    const body = res.body as {
      data: {
        scrapedEpisodes: Array<{
          scrapedTitle: string;
          episodeNumber: number | null;
          calculatedOrder: number | null;
          matchedLocalEpisodeId: string | null;
          matchStatus: string;
        }>;
      };
    };

    const decimalEp = body.data.scrapedEpisodes.find((e) => e.episodeNumber === 7.5);
    expect(decimalEp).toBeDefined();
    expect(decimalEp?.calculatedOrder).toBeNull();
    expect(decimalEp?.matchedLocalEpisodeId).toBeNull();
    expect(decimalEp?.matchStatus).toBe("unmatched");

    const unmatchedEp = body.data.scrapedEpisodes.find((e) => e.episodeNumber === 99);
    expect(unmatchedEp).toBeDefined();
    expect(unmatchedEp?.calculatedOrder).toBe(99);
    expect(unmatchedEp?.matchedLocalEpisodeId).toBeNull();
    expect(unmatchedEp?.matchStatus).toBe("unmatched");
  });

  it("accepts dramula source type and previews bulk sources returning 200 OK", async () => {
    const { seriesId } = await createSeriesWithEpisodes(
      "Dramula Test Series",
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    );

    const sourceUrl = "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1";
    const res = await request(app, {
      method: "POST",
      path: `/series/${seriesId}/preview-bulk-sources`,
      headers,
      body: {
        sourceUrl,
        source: "dramula",
        episodeOffset: 0,
      },
    });

    expect(res.status).toBe(200);
    const body = res.body as {
      data: {
        scrapedEpisodes: Array<{
          scrapedTitle: string;
          scrapedUrl: string;
          episodeNumber: number | null;
          matchedLocalEpisodeId: string | null;
          matchStatus: string;
        }>;
      };
    };

    expect(body.data).toBeDefined();
    expect(body.data.scrapedEpisodes.length).toBe(10);
    expect(body.data.scrapedEpisodes[0]?.scrapedTitle).toBe("1");
    expect(body.data.scrapedEpisodes[0]?.scrapedUrl).toBe(
      "https://dramula.com/watch/teach-you-a-lesson-2026/s1e1"
    );
  });

  it("indicates hasSources: true for local episodes that have existing video sources", async () => {
    const { seriesId, episodes: createdEps } = await createSeriesWithEpisodes(
      "Series With Sources",
      [1, 2]
    );

    // Insert a video source for Ep 1 only
    const ep1Id = createdEps.find((e) => e.order === 1)!.id;
    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: ep1Id,
      type: "embed",
      url: "https://example.com/embed/ep1",
      label: "Server 1",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app, {
      method: "POST",
      path: `/series/${seriesId}/preview-bulk-sources`,
      headers,
      body: {
        sourceUrl: "https://otakudesu.blog/anime/grand-blue-s3-sub-indo/",
        source: "otakudesu",
      },
    });

    expect(res.status).toBe(200);
    const body = res.body as {
      data: {
        localEpisodes: Array<{
          id: string;
          hasSources: boolean;
        }>;
      };
    };

    const localEp1 = body.data.localEpisodes.find((e) => e.id === ep1Id);
    const localEp2 = body.data.localEpisodes.find((e) => e.id !== ep1Id);

    expect(localEp1?.hasSources).toBe(true);
    expect(localEp2?.hasSources).toBe(false);
  });

  it("scopes matching logic strictly to seasonId when provided, preventing overwrites across seasons", async () => {
    const seriesId = crypto.randomUUID();
    const now = new Date();
    await db.insert(series).values({
      id: seriesId,
      title: "Multi Season Series",
      type: "tv",
      createdAt: now,
      updatedAt: now,
    });

    const s1Id = crypto.randomUUID();
    await db.insert(seasons).values({
      id: s1Id,
      seriesId,
      title: "Season 1",
      seasonNumber: 1,
      createdAt: now,
      updatedAt: now,
    });

    const s1Ep1Id = crypto.randomUUID();
    await db.insert(episodes).values({
      id: s1Ep1Id,
      title: "S1 Ep 1",
      order: 1,
      seasonId: s1Id,
      createdAt: now,
      updatedAt: now,
    });

    // Mark S1 Ep 1 as having video sources
    await db.insert(videoSources).values({
      id: crypto.randomUUID(),
      episodeId: s1Ep1Id,
      type: "embed",
      url: "https://example.com/s1e1",
      label: "Server 1",
      createdAt: now,
      updatedAt: now,
    });

    const s2Id = crypto.randomUUID();
    await db.insert(seasons).values({
      id: s2Id,
      seriesId,
      title: "Season 2",
      seasonNumber: 2,
      createdAt: now,
      updatedAt: now,
    });

    const s2Ep1Id = crypto.randomUUID();
    await db.insert(episodes).values({
      id: s2Ep1Id,
      title: "S2 Ep 1",
      order: 1,
      seasonId: s2Id,
      createdAt: now,
      updatedAt: now,
    });

    // Request preview scoped to Season 2
    const res = await request(app, {
      method: "POST",
      path: `/series/${seriesId}/preview-bulk-sources`,
      headers,
      body: {
        sourceUrl: "https://otakudesu.blog/anime/grand-blue-s3-sub-indo/",
        source: "otakudesu",
        seasonId: s2Id,
        episodeOffset: 0,
      },
    });

    expect(res.status).toBe(200);
    const body = res.body as {
      data: {
        scrapedEpisodes: Array<{
          episodeNumber: number | null;
          matchedLocalEpisodeId: string | null;
        }>;
        localEpisodes: Array<{
          id: string;
          seasonId: string;
          hasSources: boolean;
        }>;
      };
    };

    // Scraped episode 1 should match S2 Ep 1, NOT S1 Ep 1
    const scrapedEp1 = body.data.scrapedEpisodes.find((e) => e.episodeNumber === 1);
    expect(scrapedEp1?.matchedLocalEpisodeId).toBe(s2Ep1Id);

    // Only S2 episodes should be in localEpisodes
    expect(body.data.localEpisodes.every((e) => e.seasonId === s2Id)).toBe(true);
    const localS2Ep1 = body.data.localEpisodes.find((e) => e.id === s2Ep1Id);
    expect(localS2Ep1?.hasSources).toBe(false);
  });
});
