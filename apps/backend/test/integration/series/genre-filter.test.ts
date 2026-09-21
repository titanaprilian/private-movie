import { describe, expect, it, beforeAll } from "vitest";
import { genres, seasons, series, seriesToGenres } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { db } from "../../utils/db";

async function insertSeriesRow(title: string): Promise<{ id: string; title: string }> {
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(series).values({
    id,
    title,
    type: "tv",
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

  it("combines genre with filter=ongoing / filter=all and pagination metadata", async () => {
    const actionGenre = await insertGenreRow("Action", "action");

    async function insertGenreSeries(title: string, status: "ongoing" | "completed") {
      const row = await insertSeriesRow(title);
      await linkSeriesToGenre(row.id, actionGenre.id);
      const now = new Date();
      await db.insert(seasons).values({
        id: crypto.randomUUID(),
        seriesId: row.id,
        title: "Season 1",
        seasonNumber: 1,
        status,
        createdAt: now,
        updatedAt: now,
      });
      return row;
    }

    const ongoing1 = await insertGenreSeries("Ongoing Action 1", "ongoing");
    const ongoing2 = await insertGenreSeries("Ongoing Action 2", "ongoing");
    const completed = await insertGenreSeries("Completed Action", "completed");

    const ongoingResponse = await request(app, {
      path: "/series?genre=action&filter=ongoing&page=1&limit=20",
    });
    expect(ongoingResponse.status).toBe(200);
    const ongoingBody = ongoingResponse.body as {
      data: {
        series: { id: string }[];
        meta: { total: number; page: number; limit: number };
      };
    };
    expect(ongoingBody.data.meta).toEqual({ total: 2, page: 1, limit: 20 });
    const ongoingIds = ongoingBody.data.series.map((s) => s.id);
    expect(ongoingIds).toContain(ongoing1.id);
    expect(ongoingIds).toContain(ongoing2.id);
    expect(ongoingIds).not.toContain(completed.id);

    const allResponse = await request(app, {
      path: "/series?genre=action&filter=all&page=1&limit=20",
    });
    expect(allResponse.status).toBe(200);
    const allBody = allResponse.body as {
      data: {
        series: { id: string }[];
        meta: { total: number; page: number; limit: number };
      };
    };
    expect(allBody.data.meta).toEqual({ total: 3, page: 1, limit: 20 });
    expect(allBody.data.series).toHaveLength(3);

    const page2Response = await request(app, {
      path: "/series?genre=action&filter=all&page=2&limit=2",
    });
    expect(page2Response.status).toBe(200);
    const page2Body = page2Response.body as {
      data: {
        series: { id: string }[];
        meta: { total: number; page: number; limit: number };
      };
    };
    expect(page2Body.data.meta).toEqual({ total: 3, page: 2, limit: 2 });
    expect(page2Body.data.series).toHaveLength(1);
  });
});
