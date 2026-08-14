import { describe, expect, it, beforeAll } from "vitest";
import { videos } from "@repo/db";
import { buildApp, request, type App } from "../../utils/app";
import { db } from "../../utils/db";

function makeVideoUrl(index: number): string {
  return `https://otakudesu.blog/episode/test-episode-${index}/`;
}

function makeTitle(source: string, index: number): string {
  return `${source} video ${index}`;
}

async function insertVideo(options: {
  source: string;
  title: string;
  createdAt: Date;
}): Promise<void> {
  await db.insert(videos).values({
    id: `video-${crypto.randomUUID()}`,
    sourceUrl: makeVideoUrl(Math.floor(Math.random() * 1e9)),
    source: options.source,
    title: options.title,
    videoType: null,
    videoUrl: "https://odvidhide.com/embed/test",
    metadata: {},
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
  });
}

describe("GET /videos", () => {
  let app: App;

  beforeAll(async () => {
    app = await buildApp();
  });

  it("returns paginated videos with correct meta fields on happy path", async () => {
    for (let i = 0; i < 3; i++) {
      await insertVideo({
        source: "otakudesu",
        title: makeTitle("otakudesu", i),
        createdAt: new Date(`2026-08-0${i + 1}T00:00:00.000Z`),
      });
    }

    const response = await request(app, {
      path: "/videos?page=1&limit=2",
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        videos: { title: string; source: string }[];
        meta: { total: number; page: number; limit: number };
      };
    };

    expect(body.data.videos).toHaveLength(2);
    expect(body.data.meta).toEqual({ total: 3, page: 1, limit: 2 });
    expect(body.data.videos.map((v) => v.title)).toEqual([
      makeTitle("otakudesu", 2),
      makeTitle("otakudesu", 1),
    ]);
  });

  it("defaults to page=1, limit=20 when no query params provided", async () => {
    for (let i = 0; i < 25; i++) {
      await insertVideo({
        source: "otakudesu",
        title: makeTitle("otakudesu", i),
        createdAt: new Date(`2026-07-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`),
      });
    }

    const response = await request(app, { path: "/videos" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        videos: { title: string }[];
        meta: { total: number; page: number; limit: number };
      };
    };

    expect(body.data.meta).toEqual({ total: 25, page: 1, limit: 20 });
    expect(body.data.videos).toHaveLength(20);
  });

  it("source filter returns only matching videos", async () => {
    await insertVideo({
      source: "otakudesu",
      title: "otakudesu-n-only",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    await insertVideo({
      source: "otakudesu",
      title: "otakudesu-n-only-2",
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const response = await request(app, {
      path: "/videos?source=otakudesu",
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        videos: { source: string }[];
        meta: { total: number };
      };
    };

    expect(body.data.videos).toHaveLength(2);
    expect(body.data.videos.every((v) => v.source === "otakudesu")).toBe(true);
    expect(body.data.meta.total).toBe(2);
  });

  it("invalid source filter returns 400", async () => {
    const response = await request(app, {
      path: "/videos?source=invalid-source",
    });

    expect(response.status).toBe(400);
  });

  it("limit exceeding 100 returns 400", async () => {
    const response = await request(app, {
      path: "/videos?limit=101",
    });

    expect(response.status).toBe(400);
  });

  it("out-of-range page returns 200 with empty videos and accurate meta.total", async () => {
    for (let i = 0; i < 3; i++) {
      await insertVideo({
        source: "otakudesu",
        title: makeTitle("otakudesu", i),
        createdAt: new Date(`2026-08-0${i + 1}T00:00:00.000Z`),
      });
    }

    const response = await request(app, {
      path: "/videos?page=99&limit=20",
    });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: {
        videos: unknown[];
        meta: { total: number; page: number; limit: number };
      };
    };

    expect(body.data.videos).toEqual([]);
    expect(body.data.meta).toEqual({ total: 3, page: 99, limit: 20 });
  });

  it("unauthenticated request succeeds with no auth header", async () => {
    await insertVideo({
      source: "otakudesu",
      title: "public-video",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });

    const response = await request(app, { path: "/videos" });

    expect(response.status).toBe(200);
  });

  it("results are ordered by createdAt descending", async () => {
    await insertVideo({
      source: "otakudesu",
      title: "oldest",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    await insertVideo({
      source: "otakudesu",
      title: "middle",
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    });
    await insertVideo({
      source: "otakudesu",
      title: "newest",
      createdAt: new Date("2026-08-03T00:00:00.000Z"),
    });

    const response = await request(app, { path: "/videos" });

    expect(response.status).toBe(200);
    const body = response.body as {
      data: { videos: { title: string }[] };
    };

    expect(body.data.videos.map((v) => v.title)).toEqual([
      "newest",
      "middle",
      "oldest",
    ]);
  });
});