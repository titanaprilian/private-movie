import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series, videoSources } from "@repo/db";
import { MVP_MEDIA_OPENAPI } from "@repo/contracts";
import { buildApp, request, type App } from "../../utils/app";
import { db } from "../../utils/db";

async function insertPublicSeries(title: string) {
  const now = new Date();
  const seriesId = crypto.randomUUID();
  await db.insert(series).values({
    id: seriesId,
    title,
    description: `${title} description`,
    type: "tv",
    posterUrl: "https://example.com/poster.jpg",
    isFeatured: false,
    createdAt: now,
    updatedAt: now,
  });

  const seasonId = crypto.randomUUID();
  await db.insert(seasons).values({
    id: seasonId,
    seriesId,
    title: "Season 1",
    seasonNumber: 1,
    status: "ongoing",
    createdAt: now,
    updatedAt: now,
  });

  const episodeId = crypto.randomUUID();
  await db.insert(episodes).values({
    id: episodeId,
    title: "Episode 1",
    order: 1,
    seasonId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(videoSources).values({
    id: crypto.randomUUID(),
    episodeId,
    type: "embed",
    url: "https://example.com/embed/1",
    label: "Default",
    createdAt: now,
    updatedAt: now,
  });

  return { seriesId, seasonId, episodeId };
}

describe("MVP public media OpenAPI contract", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("publishes the MVP OpenAPI document with the public endpoints and envelopes", async () => {
    const response = await request(app, { path: "/openapi.json" });

    expect(response.status).toBe(200);
    const body = response.body as typeof MVP_MEDIA_OPENAPI;

    expect(body.openapi).toMatch(/^3\.1\./);
    expect(Object.keys(body.paths)).toContain("/api/series/home-feed");
    expect(Object.keys(body.paths)).toContain("/api/series/{id}");

    const schemas = (
      body as unknown as {
        components: { schemas: Record<string, unknown> };
      }
    ).components.schemas;
    for (const name of [
      "SuccessEnvelope",
      "ErrorEnvelope",
      "ErrorResponse",
      "HomeFeedSuccessResponse",
      "SeriesDetailsSuccessResponse",
    ]) {
      expect(schemas[name], `missing schema ${name}`).toBeDefined();
    }
  });

  it("serves a home feed wrapped in the shared success envelope", async () => {
    await insertPublicSeries("Contract Home Series");

    const response = await request(app, { path: "/series/home-feed" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        hero: unknown;
        rows: Array<{ title: string; items: unknown[] }>;
      };
    };

    expect(body.data).toBeDefined();
    expect("error" in (body as Record<string, unknown>)).toBe(false);
    expect(Array.isArray(body.data.rows)).toBe(true);
    expect(body.data.rows.map((row) => row.title)).toEqual([
      "Ongoing",
      "Korean Drama",
      "Recently Added",
    ]);
  });

  it("serves series details with seasons, episodes, and video sources in the success envelope", async () => {
    const { seriesId, episodeId } = await insertPublicSeries(
      "Contract Detail Series",
    );

    const response = await request(app, { path: `/series/${seriesId}` });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        id: string;
        title: string;
        seasons: Array<{
          id: string;
          episodes: Array<{
            id: string;
            videoSources: Array<{ id: string; type: string; url: string }>;
          }>;
        }>;
        episodes: Array<{ id: string }>;
        genres: unknown[];
      };
    };

    expect(body.data.id).toBe(seriesId);
    expect(body.data.title).toBe("Contract Detail Series");
    expect(body.data.seasons).toHaveLength(1);
    expect(body.data.seasons[0].episodes).toHaveLength(1);
    expect(body.data.seasons[0].episodes[0].id).toBe(episodeId);
    expect(
      body.data.seasons[0].episodes[0].videoSources[0].url,
    ).toContain("https://example.com/embed/1");
    expect(body.data.episodes).toHaveLength(1);
    expect(Array.isArray(body.data.genres)).toBe(true);
  });

  it("returns the shared error envelope when the series does not exist", async () => {
    const missingId = crypto.randomUUID();
    const response = await request(app, { path: `/series/${missingId}` });

    expect(response.status).toBe(404);
    const body = response.body as {
      error: { code: string; message: string };
    };

    expect(body.error.code).toBe("SERIES_NOT_FOUND");
    expect(body.error.message).toContain(missingId);
  });

  it("keeps series rows joinable to seasons for detail assertions", async () => {
    const { seriesId } = await insertPublicSeries("Contract Join Series");
    const [season] = await db
      .select()
      .from(seasons)
      .where(eq(seasons.seriesId, seriesId));
    expect(season).toBeDefined();
  });
});
