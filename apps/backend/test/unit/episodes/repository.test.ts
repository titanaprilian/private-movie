import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { episodes, seasons, series } from "@repo/db";
import { createEpisodeRepositoryInternal } from "@repo/media-service";
import { db } from "../../utils/db";

async function createTestSeason(id = "season-1"): Promise<string> {
  const now = new Date();
  const [sRow] = await db
    .insert(series)
    .values({
      id: crypto.randomUUID(),
      title: "Series 1",
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
      title: "Season 1",
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return seasonRow.id;
}

async function insertEpisode(order = 1, seasonId: string | null = null): Promise<{ id: string }> {
  const now = new Date();
  const rows = await db
    .insert(episodes)
    .values({
      id: crypto.randomUUID(),
      title: "original-title",
      order,
      seasonId,
      videoType: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return rows[0];
}

describe("episode repository upsert", () => {
  const repository = createEpisodeRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(seasons);
    await db.delete(series);
  });

  it("inserts new episode and updates on conflict targeting seasonId and order", async () => {
    const seasonId = await createTestSeason("season-100");
    const airDate = new Date("2022-04-02T00:00:00.000Z");
    const row = await repository.upsert({
      seasonId,
      order: 1,
      title: "Episode 1",
      videoType: "TV",
      duration: 24,
      tmdbId: 12345,
      thumbnailUrl: "https://example.com/thumb.jpg",
      rating: "8.5",
      airDate,
      metadata: { note: "test" },
    });

    expect(row.title).toBe("Episode 1");
    expect(row.videoType).toBe("TV");
    expect(row.duration).toBe(24);
    expect(row.tmdbId).toBe(12345);
    expect(row.thumbnailUrl).toBe("https://example.com/thumb.jpg");
    expect(row.rating).toBe("8.5");
    expect(row.airDate?.toISOString()).toBe(airDate.toISOString());

    // Conflict update on (seasonId, order)
    const updated = await repository.upsert({
      seasonId,
      order: 1,
      title: "Episode 1 Updated",
      videoType: "TV",
      duration: 25,
      metadata: { note: "updated" },
    });

    expect(updated.id).toBe(row.id);
    expect(updated.title).toBe("Episode 1 Updated");
    expect(updated.duration).toBe(25);
  });
});

describe("episode repository deleteEpisode", () => {
  const repository = createEpisodeRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
    await db.delete(seasons);
    await db.delete(series);
  });

  it("hard-deletes an existing episode and returns the deleted row", async () => {
    const existing = await insertEpisode(1);

    const deleted = await repository.deleteEpisode(existing.id);

    expect(deleted).toBeDefined();
    expect(deleted.id).toBe(existing.id);
    expect(deleted.title).toBe("original-title");

    const remaining = await db
      .select()
      .from(episodes)
      .where(eq(episodes.id, existing.id));
    expect(remaining).toHaveLength(0);
  });

  it("throws an explicit error when the episode id does not exist", async () => {
    const missingId = crypto.randomUUID();

    const result = repository.deleteEpisode(missingId);
    await expect(result).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof Error && error.name === "EpisodeNotFoundError"
    );
  });
});

describe("episode repository updateEpisode", () => {
  const repository = createEpisodeRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
  });

  it("partially updates episode title, videoType, metadata and returns updated row", async () => {
    const existing = await insertEpisode(10);

    // Update title only
    const updatedTitle = await repository.updateEpisode(existing.id, {
      title: "Updated Title",
    });
    expect(updatedTitle.title).toBe("Updated Title");

    // Update videoType only
    const updatedType = await repository.updateEpisode(existing.id, {
      videoType: "Movie",
    });
    expect(updatedType.videoType).toBe("Movie");

    // Update description only
    const updatedDesc = await repository.updateEpisode(existing.id, {
      description: "Updated episode description",
    });
    expect(updatedDesc.description).toBe("Updated episode description");

    // Clear description with null
    const clearedDesc = await repository.updateEpisode(existing.id, {
      description: null,
    });
    expect(clearedDesc.description).toBeNull();

    // Update metadata only
    const updatedMeta = await repository.updateEpisode(existing.id, {
      metadata: { customField: "customValue" },
    });
    expect(updatedMeta.metadata).toEqual({ customField: "customValue" });

    // Update all allowed fields
    const updatedAll = await repository.updateEpisode(existing.id, {
      title: "Final Title",
      videoType: "OVA",
      description: "Final Description",
      metadata: { episodes: [1, 2, 3] },
    });
    expect(updatedAll.title).toBe("Final Title");
    expect(updatedAll.videoType).toBe("OVA");
    expect(updatedAll.description).toBe("Final Description");
    expect(updatedAll.metadata).toEqual({ episodes: [1, 2, 3] });
  });

  it("throws EpisodeNotFoundError when updating a non-existent episode id", async () => {
    const missingId = crypto.randomUUID();

    const result = repository.updateEpisode(missingId, {
      title: "Should Fail",
    });
    await expect(result).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof Error && error.name === "EpisodeNotFoundError"
    );
  });
});

describe("episode repository updateOrders", () => {
  const repository = createEpisodeRepositoryInternal(db);

  beforeEach(async () => {
    await db.delete(episodes);
  });

  it("updates order for multiple episodes in a transaction", async () => {
    const ep1 = await insertEpisode(1);
    const ep2 = await insertEpisode(2);

    await repository.updateOrders([
      { id: ep1.id, order: 5 },
      { id: ep2.id, order: 10 },
    ]);

    const updated1 = await db.select().from(episodes).where(eq(episodes.id, ep1.id));
    const updated2 = await db.select().from(episodes).where(eq(episodes.id, ep2.id));

    expect(updated1[0].order).toBe(5);
    expect(updated2[0].order).toBe(10);
  });

  it("rolls back transaction if any episode in batch does not exist", async () => {
    const ep1 = await insertEpisode(1);
    const initialEp1 = await db.select().from(episodes).where(eq(episodes.id, ep1.id));
    const initialOrder = initialEp1[0].order;

    const missingId = crypto.randomUUID();

    await expect(
      repository.updateOrders([
        { id: ep1.id, order: 99 },
        { id: missingId, order: 100 },
      ])
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof Error && error.name === "EpisodeNotFoundError"
    );

    const checkEp1 = await db.select().from(episodes).where(eq(episodes.id, ep1.id));
    expect(checkEp1[0].order).toBe(initialOrder);
  });
});