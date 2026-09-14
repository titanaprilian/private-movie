import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";
import { describe, expect, it, beforeAll } from "vitest";
import { episodes, seasons, series, videoSources } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { registerUser, authHeaders } from "../../utils/auth";
import { db } from "../../utils/db";
import { eq } from "drizzle-orm";

const sampleOneSeasonHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-one-season.html"),
  "utf8"
);
const sampleEpisodeHtml = readFileSync(
  resolve(import.meta.dirname, "../../fixtures/episodes/sample-a.html"),
  "utf8"
);

function errorCode(body: unknown): string {
  return (body as { error: { code: string } }).error.code;
}

describe("POST /seasons/:id/scrape-ongoing", () => {
  let app: App;
  let headers: Record<string, string>;

  beforeAll(async () => {
    app = await buildApp({
      fetchHtml: {
        get: async (url) => {
          if (url.includes("otakudesu.blog/anime/grand-blue-s3-sub-indo")) {
            return sampleOneSeasonHtml;
          }
          if (url.includes("otakudesu.blog/episode")) {
            return sampleEpisodeHtml;
          }
          return sampleOneSeasonHtml;
        },
        post: async () => "",
      },
    });
    const user = await registerUser(app, {
      email: "scrape-ongoing-tester@example.com",
      password: "password123",
      name: "Scrape Ongoing Tester",
    });
    headers = authHeaders(user.accessToken);
  });

  async function createSeries(title: string) {
    const [row] = await db
      .insert(series)
      .values({
        id: crypto.randomUUID(),
        title,
        type: "tv",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return row;
  }

  async function createSeason(
    seriesId: string,
    title: string,
    options: {
      status?: string;
      scraperUrl?: string | null;
      source?: string | null;
      episodeOffset?: number;
    } = {}
  ) {
    const [row] = await db
      .insert(seasons)
      .values({
        id: crypto.randomUUID(),
        seriesId,
        title,
        status: options.status ?? "ongoing",
        scraperUrl: options.scraperUrl ?? null,
        source: options.source ?? null,
        episodeOffset: options.episodeOffset ?? 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return row;
  }

  async function createEpisode(seasonId: string, order: number) {
    const [row] = await db
      .insert(episodes)
      .values({
        id: crypto.randomUUID(),
        title: `Episode ${order}`,
        order,
        seasonId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return row;
  }

  it("returns 401 when authorization header is missing", async () => {
    const result = await request(app, {
      method: "POST",
      path: `/seasons/${crypto.randomUUID()}/scrape-ongoing`,
    });

    expect(result.status).toBe(401);
  });

  it("returns 404 when season does not exist", async () => {
    const result = await request(app, {
      method: "POST",
      path: `/seasons/${crypto.randomUUID()}/scrape-ongoing`,
      headers,
    });

    expect(result.status).toBe(404);
    expect(errorCode(result.body)).toBe("SEASON_NOT_FOUND");
  });

  it("returns 400 when season is not in ongoing status", async () => {
    const seriesRow = await createSeries("Completed Season Series");
    const seasonRow = await createSeason(seriesRow.id, "Completed Season", {
      status: "completed",
      scraperUrl: "https://otakudesu.blog/anime/grand-blue-s3-sub-indo",
      source: "otakudesu",
    });

    const result = await request(app, {
      method: "POST",
      path: `/seasons/${seasonRow.id}/scrape-ongoing`,
      headers,
    });

    expect(result.status).toBe(400);
    expect(errorCode(result.body)).toBe("SEASON_NOT_ONGOING");

    const [dbRow] = await db.select().from(seasons).where(eq(seasons.id, seasonRow.id));
    expect(dbRow.lastScrapeError).toMatch(/ongoing/i);
    expect(dbRow.lastScrapedAt).toBeDefined();
  });

  it("returns 400 when season is missing scraperUrl or source", async () => {
    const seriesRow = await createSeries("Missing Scraper Season Series");
    const seasonRow = await createSeason(seriesRow.id, "Missing Scraper Season", {
      status: "ongoing",
      scraperUrl: null,
      source: null,
    });

    const result = await request(app, {
      method: "POST",
      path: `/seasons/${seasonRow.id}/scrape-ongoing`,
      headers,
    });

    expect(result.status).toBe(400);
    expect(errorCode(result.body)).toBe("SEASON_MISSING_SCRAPER_URL");

    const [dbRow] = await db.select().from(seasons).where(eq(seasons.id, seasonRow.id));
    expect(dbRow.lastScrapeError).toMatch(/missing scraperUrl/i);
    expect(dbRow.lastScrapedAt).toBeDefined();
  });

  it("successfully triggers ongoing scrape, saves sources, and returns execution result", async () => {
    const seriesRow = await createSeries("Ongoing Grand Blue Series");
    const seasonRow = await createSeason(seriesRow.id, "Season 3", {
      status: "ongoing",
      scraperUrl: "https://otakudesu.blog/anime/grand-blue-s3-sub-indo",
      source: "otakudesu",
      episodeOffset: 0,
    });

    // In sampleOneSeasonHtml, episode 1 exists with order 1
    const ep1 = await createEpisode(seasonRow.id, 1);

    const result = await request(app, {
      method: "POST",
      path: `/seasons/${seasonRow.id}/scrape-ongoing`,
      headers,
    });

    expect(result.status).toBe(200);
    const body = result.body as {
      data: {
        seasonId: string;
        seriesId: string;
        success: boolean;
        episodesScraped: number;
        sourcesSaved: number;
      };
    };
    expect(body.data.success).toBe(true);
    expect(body.data.seasonId).toBe(seasonRow.id);
    expect(body.data.seriesId).toBe(seriesRow.id);
    expect(body.data.episodesScraped).toBeGreaterThan(0);
    expect(body.data.sourcesSaved).toBeGreaterThan(0);

    // Verify sources in database
    const sources = await db
      .select()
      .from(videoSources)
      .where(eq(videoSources.episodeId, ep1.id));
    expect(sources.length).toBeGreaterThan(0);

    // Verify season timestamp updated
    const [dbRow] = await db.select().from(seasons).where(eq(seasons.id, seasonRow.id));
    expect(dbRow.lastScrapedAt).toBeDefined();
    expect(dbRow.lastScrapeError).toBeNull();
  });
});
