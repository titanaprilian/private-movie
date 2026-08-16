import { beforeEach, describe, expect, it } from "vitest";
import { episodes } from "@repo/db";
import { createEpisodeRepositoryInternal } from "@/modules/media/internal/episodes/repository";
import { db } from "../../utils/db";

function makeVideoUrl(index: number): string {
  return `https://otakudesu.blog/episode/repo-${index}/`;
}

async function insertEpisode(options: {
  index: number;
  source: string;
  title: string;
  createdAt: Date;
}): Promise<void> {
  await db.insert(episodes).values({
    id: `episode-${crypto.randomUUID()}`,
    sourceUrl: makeVideoUrl(options.index),
    source: options.source,
    title: options.title,
    videoType: null,
    embedUrl: "https://odvidhide.com/embed/test",
    videoUrl: "https://example.com/stream.mp4",
    metadata: {},
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
  });
}

describe("episode repository list", () => {
  const repository = createEpisodeRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
  });

  it("defaults limit to 20 and returns episodes ordered by order asc then createdAt asc", async () => {
    for (let i = 0; i < 25; i++) {
      await insertEpisode({
        index: i,
        source: "otakudesu",
        title: `Episode ${i + 1}`,
        createdAt: new Date(2026, 0, i + 1),
      });
    }

    const result = await repository.list({ page: 1 });

    expect(result.episodes).toHaveLength(20);
    expect(result.total).toBe(25);
    for (let i = 1; i < result.episodes.length; i++) {
      expect(
        result.episodes[i - 1].order <= result.episodes[i].order
      ).toBe(true);
    }
  });

  it("caps limit at 100", async () => {
    for (let i = 0; i < 101; i++) {
      await insertEpisode({
        index: i,
        source: "otakudesu",
        title: `episode-${i}`,
        createdAt: new Date(2026, 0, i + 1),
      });
    }

    const result = await repository.list({ page: 1, limit: 500 });

    expect(result.episodes).toHaveLength(100);
    expect(result.total).toBe(101);
  });

  it("filters by source when provided", async () => {
    await insertEpisode({
      index: 0,
      source: "otakudesu",
      title: "otakudesu-a",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    await insertEpisode({
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
    expect(result.episodes.every((v) => v.source === "otakudesu")).toBe(true);
  });

  it("returns empty array with accurate total for out-of-range page", async () => {
    for (let i = 0; i < 3; i++) {
      await insertEpisode({
        index: i,
        source: "otakudesu",
        title: `episode-${i}`,
        createdAt: new Date(2026, 0, i + 1),
      });
    }

    const result = await repository.list({ page: 99, limit: 20 });

    expect(result.episodes).toEqual([]);
    expect(result.total).toBe(3);
  });

  it("returns accurate total filtering before pagination", async () => {
    await insertEpisode({
      index: 0,
      source: "otakudesu",
      title: "a",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    await insertEpisode({
      index: 1,
      source: "otakudesu",
      title: "b",
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const result = await repository.list({ page: 2, limit: 1, source: "otakudesu" });

    expect(result.episodes).toHaveLength(1);
    expect(result.total).toBe(2);
  });
});

describe("episode repository persistence of embedUrl and videoUrl", () => {
  const repository = createEpisodeRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
  });

  it("persists and retrieves both embedUrl and videoUrl on upsert", async () => {
    const created = await repository.upsert({
      sourceUrl: "https://otakudesu.blog/episode/integ-persist-1/",
      source: "otakudesu",
      title: "Episode 1 Persistence",
      videoType: "TV",
      embedUrl: "https://odvidhide.com/embed/integ1",
      videoUrl: "https://stream.example.com/video1.mp4",
      metadata: {},
    });

    expect(created.embedUrl).toBe("https://odvidhide.com/embed/integ1");
    expect(created.videoUrl).toBe("https://stream.example.com/video1.mp4");

    const fetched = await repository.findBySourceUrl("https://otakudesu.blog/episode/integ-persist-1/");
    expect(fetched).not.toBeNull();
    expect(fetched?.embedUrl).toBe("https://odvidhide.com/embed/integ1");
    expect(fetched?.videoUrl).toBe("https://stream.example.com/video1.mp4");
  });

  it("updates both embedUrl and videoUrl on updateEpisode", async () => {
    const created = await repository.upsert({
      sourceUrl: "https://otakudesu.blog/episode/integ-persist-2/",
      source: "otakudesu",
      title: "Episode 2 Persistence",
      videoType: "TV",
      embedUrl: "https://odvidhide.com/embed/integ2",
      videoUrl: null,
      metadata: {},
    });

    expect(created.embedUrl).toBe("https://odvidhide.com/embed/integ2");
    expect(created.videoUrl).toBeNull();

    const updated = await repository.updateEpisode(created.id, {
      embedUrl: "https://odvidhide.com/embed/integ2-updated",
      videoUrl: "https://stream.example.com/video2.mp4",
    });

    expect(updated.embedUrl).toBe("https://odvidhide.com/embed/integ2-updated");
    expect(updated.videoUrl).toBe("https://stream.example.com/video2.mp4");
  });
});