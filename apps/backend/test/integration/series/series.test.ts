import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { db } from "../../utils/db";

async function insertSeriesRow(options?: {
  title?: string;
  source?: string;
  sourceUrl?: string;
  description?: string | null;
  createdAt?: Date;
}): Promise<{ id: string; title: string }> {
  const id = crypto.randomUUID();
  const sourceUrl =
    options?.sourceUrl ?? `https://otakudesu.blog/anime/series-${id}/`;
  const title = options?.title ?? `Series ${id}`;
  const source = options?.source ?? "otakudesu";
  const description =
    options?.description !== undefined ? options.description : "Sample Description";
  const now = options?.createdAt ?? new Date();

  await db.insert(series).values({
    id,
    title,
    description,
    posterUrl: "https://example.com/poster.jpg",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(seasons).values({
    id: crypto.randomUUID(),
    seriesId: id,
    sourceUrl,
    source,
    title,
    description,
    posterUrl: "https://example.com/poster.jpg",
    createdAt: now,
    updatedAt: now,
  });

  return { id, title };
}

async function insertEpisodeRow(options: {
  seriesId?: string | null;
  title?: string;
  createdAt?: Date;
}): Promise<{ id: string; title: string }> {
  const id = crypto.randomUUID();
  const now = options.createdAt ?? new Date();

  let seasonId: string | null = null;
  if (options.seriesId) {
    const [season] = await db.select().from(seasons).where(eq(seasons.seriesId, options.seriesId));
    seasonId = season?.id ?? null;
  }

  await db.insert(episodes).values({
    id,
    sourceUrl: `https://otakudesu.blog/episode/test-ep-${id}/`,
    source: "otakudesu",
    title: options.title ?? "Test Episode",
    videoType: null,
    metadata: {},
    seasonId,
    createdAt: now,
    updatedAt: now,
  });

  return { id, title: options.title ?? "Test Episode" };
}

describe("GET /series", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("returns empty array when database contains 0 series", async () => {
    const response = await request(app, { path: "/series" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        series: unknown[];
        meta: { total: number; page: number; limit: number };
      };
    };

    expect(body.data.series).toEqual([]);
    expect(body.data.meta).toEqual({ total: 0, page: 1, limit: 20 });
  });

  it("returns paginated series with correct meta fields on happy path", async () => {
    for (let i = 0; i < 3; i++) {
      await insertSeriesRow({
        title: `Series ${i + 1}`,
        createdAt: new Date(`2026-08-0${i + 1}T00:00:00.000Z`),
      });
    }

    const response = await request(app, {
      path: "/series?page=1&limit=2",
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        series: { title: string }[];
        meta: { total: number; page: number; limit: number };
      };
    };

    expect(body.data.series).toHaveLength(2);
    expect(body.data.meta).toEqual({ total: 3, page: 1, limit: 2 });
    expect(body.data.series.map((s) => s.title)).toEqual([
      "Series 3",
      "Series 2",
    ]);
  });

  it("defaults to page=1, limit=20 when no query params provided", async () => {
    for (let i = 0; i < 25; i++) {
      await insertSeriesRow({
        title: `Series ${i}`,
        createdAt: new Date(
          `2026-07-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`
        ),
      });
    }

    const response = await request(app, { path: "/series" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        series: { title: string }[];
        meta: { total: number; page: number; limit: number };
      };
    };

    expect(body.data.meta).toEqual({ total: 25, page: 1, limit: 20 });
    expect(body.data.series).toHaveLength(20);
  });

  it("source filter returns only matching series", async () => {
    await insertSeriesRow({
      source: "otakudesu",
      title: "otakudesu-series",
    });

    const response = await request(app, {
      path: "/series?source=otakudesu",
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        series: { source: string }[];
        meta: { total: number };
      };
    };

    expect(body.data.series).toHaveLength(1);
    expect(body.data.meta.total).toBe(1);
  });

  it("invalid limit > 100 returns 400", async () => {
    const response = await request(app, {
      path: "/series?limit=101",
    });

    expect(response.status).toBe(400);
  });

  it("invalid limit < 1 or page < 1 returns 400", async () => {
    const responseLimit = await request(app, {
      path: "/series?limit=0",
    });
    expect(responseLimit.status).toBe(400);

    const responsePage = await request(app, {
      path: "/series?page=0",
    });
    expect(responsePage.status).toBe(400);
  });

  it("pagination boundary: page beyond total items returns empty series list", async () => {
    for (let i = 0; i < 3; i++) {
      await insertSeriesRow({ title: `Boundary Series ${i}` });
    }

    const response = await request(app, {
      path: "/series?page=10&limit=2",
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        series: unknown[];
        meta: { total: number; page: number; limit: number };
      };
    };

    expect(body.data.series).toEqual([]);
    expect(body.data.meta.total).toBe(3);
    expect(body.data.meta.page).toBe(10);
    expect(body.data.meta.limit).toBe(2);
  });

  it("unauthenticated request succeeds with no auth header", async () => {
    await insertSeriesRow({ title: "Public Series" });

    const response = await request(app, { path: "/series" });

    expect(response.status).toBe(200);
  });

  it("queries with ?q=... and returns filtered results matching title or description", async () => {
    await insertSeriesRow({
      title: "Attack on Titan",
      description: "Humanity fights against giant humanoids.",
    });
    await insertSeriesRow({
      title: "Death Note",
      description: "A high school student discovers a supernatural notebook.",
    });

    const titleSearch = await request(app, { path: "/series?q=attack" });
    expect(titleSearch.status).toBe(200);
    const titleBody = titleSearch.body as {
      data: {
        series: { title: string }[];
        meta: { total: number };
      };
    };
    expect(titleBody.data.series).toHaveLength(1);
    expect(titleBody.data.series[0].title).toBe("Attack on Titan");
    expect(titleBody.data.meta.total).toBe(1);

    const descSearch = await request(app, { path: "/series?q=notebook" });
    expect(descSearch.status).toBe(200);
    const descBody = descSearch.body as {
      data: {
        series: { title: string }[];
        meta: { total: number };
      };
    };
    expect(descBody.data.series).toHaveLength(1);
    expect(descBody.data.series[0].title).toBe("Death Note");
    expect(descBody.data.meta.total).toBe(1);
  });
});

describe("GET /series/:id", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("returns requested series joined with its child episodes array", async () => {
    const seriesRow = await insertSeriesRow({ title: "Parent Series" });
    const ep1 = await insertEpisodeRow({
      seriesId: seriesRow.id,
      title: "Episode 1",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    const ep2 = await insertEpisodeRow({
      seriesId: seriesRow.id,
      title: "Episode 2",
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const response = await request(app, {
      path: `/series/${seriesRow.id}`,
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        id: string;
        title: string;
        episodes: { id: string; title: string }[];
      };
    };

    expect(body.data.id).toBe(seriesRow.id);
    expect(body.data.title).toBe("Parent Series");
    expect(body.data.episodes).toHaveLength(2);
    expect(body.data.episodes[0].id).toBe(ep1.id);
    expect(body.data.episodes[1].id).toBe(ep2.id);
  });

  it("returns series with empty episodes array if series has no linked episodes", async () => {
    const seriesRow = await insertSeriesRow({ title: "Standalone Series" });

    const response = await request(app, {
      path: `/series/${seriesRow.id}`,
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        id: string;
        title: string;
        episodes: unknown[];
      };
    };

    expect(body.data.id).toBe(seriesRow.id);
    expect(body.data.episodes).toEqual([]);
  });

  it("returns 404 with SERIES_NOT_FOUND when series ID does not exist", async () => {
    const nonexistentId = crypto.randomUUID();

    const response = await request(app, {
      path: `/series/${nonexistentId}`,
    });

    expect(response.status).toBe(404);
    const body = response.body as {
      error: { code: string; message: string };
    };

    expect(body.error).toBeDefined();
    expect(body.error.code).toBe("SERIES_NOT_FOUND");
    expect(body.error.message).toContain(nonexistentId);
  });

  it("unauthenticated request succeeds with no auth header", async () => {
    const seriesRow = await insertSeriesRow({ title: "Public Series Detail" });

    const response = await request(app, {
      path: `/series/${seriesRow.id}`,
    });

    expect(response.status).toBe(200);
  });
});
