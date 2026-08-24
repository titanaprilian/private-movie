import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series } from "@repo/db";
import { createEpisodeRepositoryInternal } from "@repo/media-service";
import { db } from "../../utils/db";

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
  index: number;
  seasonId?: string;
  title: string;
  createdAt: Date;
}): Promise<void> {
  let seasonId: string | null = null;
  if (options.seasonId) {
    seasonId = await ensureSeason(options.seasonId);
  }

  await db.insert(episodes).values({
    id: `episode-${crypto.randomUUID()}`,
    seasonId,
    title: options.title,
    order: options.index + 1,
    videoType: null,
    metadata: {},
    createdAt: options.createdAt,
    updatedAt: options.createdAt,
  });
}

describe("episode repository list", () => {
  const repository = createEpisodeRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(seasons);
    await db.delete(series);
  });

  it("defaults limit to 20 and returns episodes ordered by order asc then createdAt asc", async () => {
    for (let i = 0; i < 25; i++) {
      await insertEpisode({
        index: i,
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
        title: `episode-${i}`,
        createdAt: new Date(2026, 0, i + 1),
      });
    }

    const result = await repository.list({ page: 1, limit: 500 });

    expect(result.episodes).toHaveLength(100);
    expect(result.total).toBe(101);
  });

  it("filters by seasonId when provided", async () => {
    await insertEpisode({
      index: 0,
      seasonId: "season-10",
      title: "ep-a",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    await insertEpisode({
      index: 1,
      seasonId: "season-10",
      title: "ep-b",
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const result = await repository.list({
      page: 1,
      limit: 20,
      seasonId: "season-10",
    });

    expect(result.total).toBe(2);
    expect(result.episodes.every((v) => v.seasonId === "season-10")).toBe(true);
  });

  it("returns empty array with accurate total for out-of-range page", async () => {
    for (let i = 0; i < 3; i++) {
      await insertEpisode({
        index: i,
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
      seasonId: "season-20",
      title: "a",
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
    });
    await insertEpisode({
      index: 1,
      seasonId: "season-20",
      title: "b",
      createdAt: new Date("2026-08-02T00:00:00.000Z"),
    });

    const result = await repository.list({ page: 2, limit: 1, seasonId: "season-20" });

    expect(result.episodes).toHaveLength(1);
    expect(result.total).toBe(2);
  });
});