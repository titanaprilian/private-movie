import { describe, expect, it, beforeAll } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { db } from "../../utils/db";

function makeTitle(index: number): string {
  return `episode ${index}`;
}

async function ensureSeason(id: string): Promise<string> {
  const [existing] = await db.select().from(seasons).where(eq(seasons.id, id));
  if (existing) return existing.id;

  const now = new Date();
  const [sRow] = await db
    .insert(series)
    .values({
      id: crypto.randomUUID(),
      title: "Test Series",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const [seasonRow] = await db
    .insert(seasons)
    .values({
      id,
      seriesId: sRow.id,
      sourceUrl: `https://otakudesu.blog/anime/season-${id}-${crypto.randomUUID()}`,
      source: "otakudesu",
      title: "Test Season",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return seasonRow.id;
}

async function insertEpisode(options: {
  title: string;
  order?: number;
  seasonId?: string;
  createdAt: Date;
}): Promise<void> {
  const seasonId = await ensureSeason(options.seasonId ?? crypto.randomUUID());

  await db.insert(episodes).values({
    id: `episode-${crypto.randomUUID()}`,
    title: options.title,
    order: options.order ?? 1,
    seasonId,
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
  });
}

describe("GET /episodes", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("returns paginated episodes with correct meta fields on happy path", async () => {
    for (let i = 0; i < 3; i++) {
      await insertEpisode({
        title: makeTitle(i + 1),
        createdAt: new Date(`2026-08-0${i + 1}T00:00:00.000Z`),
      });
    }

    const response = await request(app, {
      path: "/episodes?page=1&limit=2",
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        episodes: { title: string }[];
        meta: { total: number; page: number; limit: number };
      };
    };

    expect(body.data.episodes).toHaveLength(2);
    expect(body.data.meta).toEqual({ total: 3, page: 1, limit: 2 });
    expect(body.data.episodes.map((v) => v.title)).toEqual([
      makeTitle(1),
      makeTitle(2),
    ]);
  });

  it("defaults to page=1, limit=20 when no query params provided", async () => {
    for (let i = 0; i < 25; i++) {
      await insertEpisode({
        title: makeTitle(i),
        createdAt: new Date(`2026-07-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`),
      });
    }

    const response = await request(app, { path: "/episodes" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        episodes: { title: string }[];
        meta: { total: number; page: number; limit: number };
      };
    };

    expect(body.data.meta).toEqual({ total: 25, page: 1, limit: 20 });
    expect(body.data.episodes).toHaveLength(20);
  });

  it("seasonId filter returns only matching episodes", async () => {
    await insertEpisode({
      seasonId: "season-a",
      title: "season-a-ep1",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    await insertEpisode({
      seasonId: "season-b",
      title: "season-b-ep1",
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const response = await request(app, {
      path: "/episodes?seasonId=season-a",
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        episodes: { seasonId: string }[];
        meta: { total: number };
      };
    };

    expect(body.data.episodes).toHaveLength(1);
    expect(body.data.episodes[0].seasonId).toBe("season-a");
    expect(body.data.meta.total).toBe(1);
  });

  it("limit exceeding 100 returns 400", async () => {
    const response = await request(app, {
      path: "/episodes?limit=101",
    });

    expect(response.status).toBe(400);
  });

  it("out-of-range page returns 200 with empty episodes and accurate meta.total", async () => {
    for (let i = 0; i < 3; i++) {
      await insertEpisode({
        title: makeTitle(i),
        createdAt: new Date(`2026-08-0${i + 1}T00:00:00.000Z`),
      });
    }

    const response = await request(app, {
      path: "/episodes?page=99&limit=20",
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        episodes: unknown[];
        meta: { total: number; page: number; limit: number };
      };
    };

    expect(body.data.episodes).toEqual([]);
    expect(body.data.meta).toEqual({ total: 3, page: 99, limit: 20 });
  });

  it("unauthenticated request succeeds with no auth header", async () => {
    await insertEpisode({
      title: "public-episode",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    const response = await request(app, { path: "/episodes" });

    expect(response.status).toBe(200);
  });

  it("results are ordered by order ascending, then createdAt ascending", async () => {
    await insertEpisode({
      title: "Episode 3",
      order: 3,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    await insertEpisode({
      title: "Episode 1",
      order: 1,
      createdAt: new Date("2026-08-03T00:00:00.000Z"),
    });
    await insertEpisode({
      title: "Episode 2",
      order: 2,
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const response = await request(app, { path: "/episodes" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: { episodes: { title: string }[] };
    };

    expect(body.data.episodes.map((v) => v.title)).toEqual([
      "Episode 1",
      "Episode 2",
      "Episode 3",
    ]);
  });
});