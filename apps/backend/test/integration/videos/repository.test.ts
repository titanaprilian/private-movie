import { beforeEach, describe, expect, it } from "vitest";
import { videos } from "@repo/db";
import { createVideoRepositoryInternal } from "@/modules/videos/internal/repository";
import { db } from "../../utils/db";

function makeVideoUrl(index: number): string {
  return `https://otakudesu.blog/episode/repo-${index}/`;
}

async function insertVideo(options: {
  index: number;
  source: string;
  title: string;
  createdAt: Date;
}): Promise<void> {
  await db.insert(videos).values({
    id: `video-${crypto.randomUUID()}`,
    sourceUrl: makeVideoUrl(options.index),
    source: options.source,
    title: options.title,
    videoType: null,
    videoUrl: "https://odvidhide.com/embed/test",
    metadata: {},
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
  });
}

describe("video repository list", () => {
  const repository = createVideoRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(videos);
  });

  it("defaults limit to 20 and returns videos ordered by createdAt desc", async () => {
    for (let i = 0; i < 25; i++) {
      await insertVideo({
        index: i,
        source: "otakudesu",
        title: `video-${i}`,
        createdAt: new Date(2026, 0, i + 1),
      });
    }

    const result = await repository.list({ page: 1 });

    expect(result.videos).toHaveLength(20);
    expect(result.total).toBe(25);
    for (let i = 1; i < result.videos.length; i++) {
      expect(
        result.videos[i - 1].createdAt.getTime() >=
          result.videos[i].createdAt.getTime()
      ).toBe(true);
    }
  });

  it("caps limit at 100", async () => {
    for (let i = 0; i < 101; i++) {
      await insertVideo({
        index: i,
        source: "otakudesu",
        title: `video-${i}`,
        createdAt: new Date(2026, 0, i + 1),
      });
    }

    const result = await repository.list({ page: 1, limit: 500 });

    expect(result.videos).toHaveLength(100);
    expect(result.total).toBe(101);
  });

  it("filters by source when provided", async () => {
    await insertVideo({
      index: 0,
      source: "otakudesu",
      title: "otakudesu-a",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    await insertVideo({
      index: 1,
      source: "otakudesu",
      title: "otakudesu-b",
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const result = await repository.list({
      page: 1,
      limit: 20,
      source: "otakudesu",
    });

    expect(result.total).toBe(2);
    expect(result.videos.every((v) => v.source === "otakudesu")).toBe(true);
  });

  it("returns empty array with accurate total for out-of-range page", async () => {
    for (let i = 0; i < 3; i++) {
      await insertVideo({
        index: i,
        source: "otakudesu",
        title: `video-${i}`,
        createdAt: new Date(2026, 0, i + 1),
      });
    }

    const result = await repository.list({ page: 99, limit: 20 });

    expect(result.videos).toEqual([]);
    expect(result.total).toBe(3);
  });

  it("returns accurate total filtering before pagination", async () => {
    await insertVideo({
      index: 0,
      source: "otakudesu",
      title: "a",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    await insertVideo({
      index: 1,
      source: "otakudesu",
      title: "b",
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const result = await repository.list({ page: 2, limit: 1, source: "otakudesu" });

    expect(result.videos).toHaveLength(1);
    expect(result.total).toBe(2);
  });
});