import { describe, expect, it, beforeAll } from "vitest";
import { episodes } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { db } from "../../utils/db";

function makeVideoUrl(index: number): string {
  return `https://otakudesu.blog/episode/test-episode-${index}/`;
}

function makeTitle(source: string, index: number): string {
  return `${source} episode ${index}`;
}

async function insertEpisode(options: {
  source: string;
  title: string;
  order?: number;
  createdAt: Date;
}): Promise<void> {
  await db.insert(episodes).values({
    id: `episode-${crypto.randomUUID()}`,
    sourceUrl: makeVideoUrl(Math.floor(Math.random() * 1e9)),
    source: options.source,
    title: options.title,
    order: options.order ?? 1,
    videoType: null,
    videoUrl: "https://odvidhide.com/embed/test",
    metadata: {},
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
        source: "otakudesu",
        title: makeTitle("otakudesu", i + 1),
        createdAt: new Date(`2026-08-0${i + 1}T00:00:00.000Z`),
      });
    }

    const response = await request(app, {
      path: "/episodes?page=1&limit=2",
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        episodes: { title: string; source: string }[];
        meta: { total: number; page: number; limit: number };
      };
    };

    expect(body.data.episodes).toHaveLength(2);
    expect(body.data.meta).toEqual({ total: 3, page: 1, limit: 2 });
    expect(body.data.episodes.map((v) => v.title)).toEqual([
      makeTitle("otakudesu", 1),
      makeTitle("otakudesu", 2),
    ]);
  });

  it("defaults to page=1, limit=20 when no query params provided", async () => {
    for (let i = 0; i < 25; i++) {
      await insertEpisode({
        source: "otakudesu",
        title: makeTitle("otakudesu", i),
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

  it("source filter returns only matching episodes", async () => {
    await insertEpisode({
      source: "otakudesu",
      title: "otakudesu-n-only",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    await insertEpisode({
      source: "otakudesu",
      title: "otakudesu-n-only-2",
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const response = await request(app, {
      path: "/episodes?source=otakudesu",
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        episodes: { source: string }[];
        meta: { total: number };
      };
    };

    expect(body.data.episodes).toHaveLength(2);
    expect(body.data.episodes.every((v) => v.source === "otakudesu")).toBe(true);
    expect(body.data.meta.total).toBe(2);
  });

  it("invalid source filter returns 400", async () => {
    const response = await request(app, {
      path: "/episodes?source=invalid-source",
    });

    expect(response.status).toBe(400);
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
        source: "otakudesu",
        title: makeTitle("otakudesu", i),
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
      source: "otakudesu",
      title: "public-episode",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    const response = await request(app, { path: "/episodes" });

    expect(response.status).toBe(200);
  });

  it("results are ordered by order ascending, then createdAt ascending", async () => {
    await insertEpisode({
      source: "otakudesu",
      title: "Episode 3",
      order: 3,
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    await insertEpisode({
      source: "otakudesu",
      title: "Episode 1",
      order: 1,
      createdAt: new Date("2026-08-03T00:00:00.000Z"),
    });
    await insertEpisode({
      source: "otakudesu",
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