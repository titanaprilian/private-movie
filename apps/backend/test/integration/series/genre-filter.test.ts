import { describe, expect, it, beforeAll } from "vitest";
import { genres, series, seriesToGenres } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { db } from "../../utils/db";

async function insertSeriesRow(title: string): Promise<{ id: string; title: string }> {
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(series).values({
    id,
    sourceUrl: `https://otakudesu.blog/anime/series-${id}/`,
    source: "otakudesu",
    title,
    description: "Sample Description",
    posterUrl: "https://example.com/poster.jpg",
    createdAt: now,
    updatedAt: now,
  });

  return { id, title };
}

async function insertGenreRow(name: string, slug: string): Promise<{ id: string; name: string; slug: string }> {
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(genres).values({
    id,
    name,
    slug,
    createdAt: now,
    updatedAt: now,
  });

  return { id, name, slug };
}

async function linkSeriesToGenre(seriesId: string, genreId: string): Promise<void> {
  await db.insert(seriesToGenres).values({
    seriesId,
    genreId,
  });
}

describe("GET /series?genre=slug", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("filters series by genre slug via inner/outer database joins", async () => {
    const series1 = await insertSeriesRow("Action Series 1");
    const series2 = await insertSeriesRow("Action & Comedy Series 2");
    const series3 = await insertSeriesRow("Drama Series 3");

    const actionGenre = await insertGenreRow("Action", "action");
    const comedyGenre = await insertGenreRow("Comedy", "comedy");

    await linkSeriesToGenre(series1.id, actionGenre.id);
    await linkSeriesToGenre(series2.id, actionGenre.id);
    await linkSeriesToGenre(series2.id, comedyGenre.id);

    // Query series by genre=action
    const actionResponse = await request(app, { path: "/series?genre=action" });

    expect(actionResponse.status).toBe(200);
    const actionBody = actionResponse.body as {
      data: {
        series: { id: string; title: string }[];
        meta: { total: number };
      };
    };

    expect(actionBody.data.meta.total).toBe(2);
    expect(actionBody.data.series).toHaveLength(2);
    const actionIds = actionBody.data.series.map((s) => s.id);
    expect(actionIds).toContain(series1.id);
    expect(actionIds).toContain(series2.id);
    expect(actionIds).not.toContain(series3.id);

    // Query series by genre=comedy
    const comedyResponse = await request(app, { path: "/series?genre=comedy" });

    expect(comedyResponse.status).toBe(200);
    const comedyBody = comedyResponse.body as {
      data: {
        series: { id: string; title: string }[];
        meta: { total: number };
      };
    };

    expect(comedyBody.data.meta.total).toBe(1);
    expect(comedyBody.data.series).toHaveLength(1);
    expect(comedyBody.data.series[0].id).toBe(series2.id);
  });

  it("returns empty array and total=0 when filtering by non-existent genre slug", async () => {
    await insertSeriesRow("Standalone Series");
    await insertGenreRow("Action", "action");

    const response = await request(app, { path: "/series?genre=non-existent-slug" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        series: unknown[];
        meta: { total: number };
      };
    };

    expect(body.data.series).toEqual([]);
    expect(body.data.meta.total).toBe(0);
  });
});
